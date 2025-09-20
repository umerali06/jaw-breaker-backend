import Stripe from "stripe";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import SubscriptionLifecycleManager from "../services/SubscriptionLifecycleManager.js";
import PaymentMonitoringService from "../services/PaymentMonitoringService.js";
import crypto from "crypto";

const stripe = process.env.STRIPE_SECRET_KEY && 
  process.env.STRIPE_SECRET_KEY !== "sk_test_your_stripe_secret_key_here"
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null;

/**
 * Comprehensive Stripe Webhook Handler
 * Handles all payment events and subscription lifecycle management
 */
class WebhookController {
  constructor() {
    this.stripeAvailable = !!stripe;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    this.processedEvents = new Set(); // Prevent duplicate processing
  }

  /**
   * Main webhook handler - verifies signature and routes events
   */
  async handleWebhook(req, res) {
    const startTime = Date.now();
    const sig = req.headers['stripe-signature'];
    const payload = req.body;

    console.log('🔔 Webhook received:', {
      timestamp: new Date().toISOString(),
      signature: sig ? 'present' : 'missing',
      payloadSize: payload.length
    });

    // Verify webhook signature
    if (!this.webhookSecret) {
      console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
      await PaymentMonitoringService.logError(
        new Error('Webhook secret not configured'),
        { operation: 'webhook_verification' }
      );
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(payload, sig, this.webhookSecret);
      console.log('✅ Webhook signature verified:', event.type);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      await PaymentMonitoringService.logError(err, {
        operation: 'webhook_signature_verification',
        eventType: 'unknown'
      });
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    // Check for duplicate events
    const eventId = event.id;
    if (this.processedEvents.has(eventId)) {
      console.log('⚠️ Duplicate event ignored:', eventId);
      await PaymentMonitoringService.logWebhookEvent('duplicate', event, Date.now() - startTime, true);
      return res.status(200).json({ received: true, duplicate: true });
    }

    // Add to processed events (with cleanup to prevent memory leak)
    this.processedEvents.add(eventId);
    if (this.processedEvents.size > 1000) {
      const oldestEvents = Array.from(this.processedEvents).slice(0, 100);
      oldestEvents.forEach(id => this.processedEvents.delete(id));
    }

    try {
      // Process the event
      await this.processEvent(event);
      const processingTime = Date.now() - startTime;
      
      console.log('✅ Event processed successfully:', event.type);
      
      // Log successful webhook processing
      await PaymentMonitoringService.logWebhookEvent(event.type, event, processingTime, true);
      
      return res.status(200).json({ 
        received: true, 
        eventType: event.type,
        eventId: event.id,
        processingTime
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('❌ Error processing webhook event:', error);
      
      // Log failed webhook processing
      await PaymentMonitoringService.logError(error, {
        operation: 'webhook_processing',
        eventType: event.type,
        eventId: event.id
      });
      
      await PaymentMonitoringService.logWebhookEvent(event.type, event, processingTime, false);
      
      return res.status(500).json({ 
        error: 'Event processing failed',
        eventType: event.type,
        eventId: event.id 
      });
    }
  }

  /**
   * Route events to appropriate handlers
   */
  async processEvent(event) {
    const { type, data } = event;
    
    console.log(`🔄 Processing event: ${type}`, {
      eventId: event.id,
      created: new Date(event.created * 1000).toISOString()
    });

    switch (type) {
      // Payment Events
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(data.object);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(data.object);
        break;
      
      // Invoice Events
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(data.object);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(data.object);
        break;
      
      // Subscription Events
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(data.object);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(data.object);
        break;
      
      // Customer Events
      case 'customer.created':
        await this.handleCustomerCreated(data.object);
        break;
      case 'customer.updated':
        await this.handleCustomerUpdated(data.object);
        break;
      case 'customer.deleted':
        await this.handleCustomerDeleted(data.object);
        break;
      
      // Dispute Events
      case 'charge.dispute.created':
        await this.handleDisputeCreated(data.object);
        break;
      
      // Refund Events
      case 'charge.refunded':
        await this.handleRefundCreated(data.object);
        break;
      
      default:
        console.log(`ℹ️ Unhandled event type: ${type}`);
    }
  }

  /**
   * Handle successful payment
   */
  async handlePaymentSuccess(paymentIntent) {
    console.log('💰 Payment succeeded:', paymentIntent.id);
    
    try {
      // Find subscription by payment intent
      const subscription = await Subscription.findOne({
        'stripePaymentIntentId': paymentIntent.id
      });

      if (subscription) {
        // Use lifecycle manager to handle payment success
        await SubscriptionLifecycleManager.handlePaymentSuccess(subscription._id);
        
        // Log payment success event
        await PaymentMonitoringService.logPaymentEvent(
          PaymentMonitoringService.eventTypes.PAYMENT_SUCCESS,
          {
            userId: subscription.userId,
            subscriptionId: subscription._id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            paymentMethod: paymentIntent.payment_method,
            status: 'succeeded'
          }
        );
        
        console.log('✅ Payment success handled for user:', subscription.userId);
      }
    } catch (error) {
      console.error('❌ Error handling payment success:', error);
      await PaymentMonitoringService.logError(error, {
        operation: 'payment_success_handling',
        paymentIntentId: paymentIntent.id
      });
    }
  }

  /**
   * Handle failed payment
   */
  async handlePaymentFailure(paymentIntent) {
    console.log('💳 Payment failed:', paymentIntent.id);
    
    try {
      // Find subscription by payment intent
      const subscription = await Subscription.findOne({
        'stripePaymentIntentId': paymentIntent.id
      });

      if (subscription) {
        // Use lifecycle manager to handle payment failure
        await SubscriptionLifecycleManager.handlePaymentFailure(
          subscription._id, 
          paymentIntent.last_payment_error?.message || 'unknown'
        );
        
        // Log payment failure event
        await PaymentMonitoringService.logPaymentEvent(
          PaymentMonitoringService.eventTypes.PAYMENT_FAILURE,
          {
            userId: subscription.userId,
            subscriptionId: subscription._id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            paymentMethod: paymentIntent.payment_method,
            status: 'failed',
            error: paymentIntent.last_payment_error?.message || 'unknown'
          }
        );
        
        console.log('⚠️ Payment failure handled for user:', subscription.userId);
      }
    } catch (error) {
      console.error('❌ Error handling payment failure:', error);
      await PaymentMonitoringService.logError(error, {
        operation: 'payment_failure_handling',
        paymentIntentId: paymentIntent.id
      });
    }
  }

  /**
   * Handle successful invoice payment
   */
  async handleInvoicePaymentSucceeded(invoice) {
    console.log('📄 Invoice payment succeeded:', invoice.id);
    
    try {
      if (invoice.subscription) {
        const subscription = await Subscription.findOne({
          stripeSubscriptionId: invoice.subscription
        });

        if (subscription) {
          subscription.status = 'active';
          subscription.lastPaymentDate = new Date();
          subscription.currentPeriodStart = new Date(invoice.period_start * 1000);
          subscription.currentPeriodEnd = new Date(invoice.period_end * 1000);
          await subscription.save();

          await this.updateUserFeatureAccess(subscription.userId);
          
          console.log('✅ Subscription renewed for user:', subscription.userId);
        }
      }
    } catch (error) {
      console.error('❌ Error handling invoice payment success:', error);
    }
  }

  /**
   * Handle failed invoice payment
   */
  async handleInvoicePaymentFailed(invoice) {
    console.log('📄 Invoice payment failed:', invoice.id);
    
    try {
      if (invoice.subscription) {
        const subscription = await Subscription.findOne({
          stripeSubscriptionId: invoice.subscription
        });

        if (subscription) {
          subscription.status = 'past_due';
          subscription.lastPaymentAttempt = new Date();
          await subscription.save();

          await this.updateUserFeatureAccess(subscription.userId);
          
          // Notify user of payment failure
          await this.notifyUserOfPaymentFailure(subscription.userId, invoice);
          
          console.log('⚠️ Subscription payment failed for user:', subscription.userId);
        }
      }
    } catch (error) {
      console.error('❌ Error handling invoice payment failure:', error);
    }
  }

  /**
   * Handle subscription creation
   */
  async handleSubscriptionCreated(stripeSubscription) {
    console.log('🆕 Subscription created:', stripeSubscription.id);
    
    try {
      // Find existing subscription in database
      let subscription = await Subscription.findOne({
        stripeSubscriptionId: stripeSubscription.id
      });

      if (!subscription) {
        // Find user by Stripe customer ID
        const user = await User.findOne({
          stripeCustomerId: stripeSubscription.customer
        });

        if (user) {
          // Use lifecycle manager to create subscription
          subscription = await SubscriptionLifecycleManager.handleSubscriptionCreated(
            stripeSubscription, 
            user._id
          );
          
          console.log('✅ New subscription created for user:', user._id);
        } else {
          console.error('❌ User not found for customer:', stripeSubscription.customer);
        }
      }
    } catch (error) {
      console.error('❌ Error handling subscription creation:', error);
    }
  }

  /**
   * Handle subscription updates
   */
  async handleSubscriptionUpdated(stripeSubscription) {
    console.log('🔄 Subscription updated:', stripeSubscription.id);
    
    try {
      // Use lifecycle manager to handle subscription update
      const subscription = await SubscriptionLifecycleManager.handleSubscriptionUpdated(stripeSubscription);
      
      if (subscription) {
        console.log('✅ Subscription updated for user:', subscription.userId);
      }
    } catch (error) {
      console.error('❌ Error handling subscription update:', error);
    }
  }

  /**
   * Handle subscription deletion/cancellation
   */
  async handleSubscriptionDeleted(stripeSubscription) {
    console.log('🗑️ Subscription deleted:', stripeSubscription.id);
    
    try {
      // Use lifecycle manager to handle subscription cancellation
      const subscription = await SubscriptionLifecycleManager.handleSubscriptionCancellation(stripeSubscription);
      
      if (subscription) {
        console.log('✅ Subscription canceled for user:', subscription.userId);
      }
    } catch (error) {
      console.error('❌ Error handling subscription deletion:', error);
    }
  }

  /**
   * Handle customer creation
   */
  async handleCustomerCreated(stripeCustomer) {
    console.log('👤 Customer created:', stripeCustomer.id);
    // Customer creation is handled in the subscription process
  }

  /**
   * Handle customer updates
   */
  async handleCustomerUpdated(stripeCustomer) {
    console.log('👤 Customer updated:', stripeCustomer.id);
    
    try {
      const user = await User.findOne({
        stripeCustomerId: stripeCustomer.id
      });

      if (user) {
        // Update user details if needed
        user.email = stripeCustomer.email;
        user.name = stripeCustomer.name;
        await user.save();
        
        console.log('✅ User updated from customer:', user._id);
      }
    } catch (error) {
      console.error('❌ Error handling customer update:', error);
    }
  }

  /**
   * Handle customer deletion
   */
  async handleCustomerDeleted(stripeCustomer) {
    console.log('👤 Customer deleted:', stripeCustomer.id);
    
    try {
      const user = await User.findOne({
        stripeCustomerId: stripeCustomer.id
      });

      if (user) {
        // Cancel all subscriptions
        const subscriptions = await Subscription.find({
          userId: user._id,
          status: { $in: ['active', 'trialing', 'past_due'] }
        });

        for (const subscription of subscriptions) {
          subscription.status = 'canceled';
          subscription.canceledAt = new Date();
          await subscription.save();
        }

        await this.updateUserFeatureAccess(user._id);
        
        console.log('✅ All subscriptions canceled for deleted customer:', user._id);
      }
    } catch (error) {
      console.error('❌ Error handling customer deletion:', error);
    }
  }

  /**
   * Handle dispute creation
   */
  async handleDisputeCreated(dispute) {
    console.log('⚖️ Dispute created:', dispute.id);
    
    try {
      // Find related subscription
      const subscription = await Subscription.findOne({
        'stripePaymentIntentId': dispute.payment_intent
      });

      if (subscription) {
        // Mark subscription as disputed
        subscription.status = 'disputed';
        subscription.disputeId = dispute.id;
        await subscription.save();

        // Suspend user access
        await this.updateUserFeatureAccess(subscription.userId);
        
        console.log('⚠️ Subscription disputed for user:', subscription.userId);
      }
    } catch (error) {
      console.error('❌ Error handling dispute creation:', error);
    }
  }

  /**
   * Handle refund creation
   */
  async handleRefundCreated(refund) {
    console.log('💸 Refund created:', refund.id);
    
    try {
      // Find related subscription
      const subscription = await Subscription.findOne({
        'stripePaymentIntentId': refund.payment_intent
      });

      if (subscription) {
        // Process refund logic
        subscription.refunds = subscription.refunds || [];
        subscription.refunds.push({
          refundId: refund.id,
          amount: refund.amount,
          reason: refund.reason,
          createdAt: new Date()
        });
        
        await subscription.save();
        
        console.log('✅ Refund processed for subscription:', subscription._id);
      }
    } catch (error) {
      console.error('❌ Error handling refund creation:', error);
    }
  }

  /**
   * Update user feature access based on subscription status
   */
  async updateUserFeatureAccess(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      // Get all active subscriptions
      const activeSubscriptions = await Subscription.find({
        userId: userId,
        status: { $in: ['active', 'trialing'] }
      });

      // Calculate combined feature access
      const features = new Set();
      const limits = {
        fileUploads: 0,
        storageGB: 0,
        aiRequests: 0
      };

      for (const subscription of activeSubscriptions) {
        if (subscription.features) {
          subscription.features.forEach(feature => features.add(feature));
        }
        if (subscription.limits) {
          Object.keys(subscription.limits).forEach(key => {
            if (subscription.limits[key] === -1) {
              limits[key] = -1; // Unlimited
            } else if (limits[key] !== -1) {
              limits[key] += subscription.limits[key] || 0;
            }
          });
        }
      }

      // Update user feature access
      user.featureAccess = {
        lastUpdated: new Date(),
        features: Array.from(features),
        limits: limits
      };

      // Update subscription status
      user.subscriptionStatus = activeSubscriptions.length > 0 ? 'active' : 'free';
      user.lastSubscriptionUpdate = new Date();

      await user.save();
      
      console.log('✅ Feature access updated for user:', userId);
    } catch (error) {
      console.error('❌ Error updating user feature access:', error);
    }
  }

  /**
   * Notify user of payment failure
   */
  async notifyUserOfPaymentFailure(userId, paymentData) {
    try {
      // This would integrate with your notification system
      console.log('📧 Payment failure notification sent to user:', userId);
      // TODO: Implement email/SMS notification
    } catch (error) {
      console.error('❌ Error sending payment failure notification:', error);
    }
  }

  /**
   * Extract plan ID from Stripe subscription
   */
  extractPlanIdFromSubscription(stripeSubscription) {
    const priceId = stripeSubscription.items.data[0]?.price?.id;
    
    // Map Stripe price IDs to your plan IDs
    const priceIdMap = {
      'price_nursing_monthly': 'nursing-monthly',
      'price_nursing_annual': 'nursing-annual',
      'price_pt_monthly': 'pt-monthly',
      'price_pt_annual': 'pt-annual',
      'price_medical_monthly': 'medical-monthly',
      'price_medical_annual': 'medical-annual'
    };

    return priceIdMap[priceId] || 'unknown';
  }
}

export default new WebhookController();
