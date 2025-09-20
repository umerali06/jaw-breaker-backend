import Stripe from "stripe";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import PaymentErrorHandler from "./PaymentErrorHandler.js";

const stripe = process.env.STRIPE_SECRET_KEY && 
  process.env.STRIPE_SECRET_KEY !== "sk_test_your_stripe_secret_key_here"
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null;

/**
 * Comprehensive Subscription Lifecycle Management Service
 * Handles all subscription state changes, renewals, cancellations, and upgrades
 */
class SubscriptionLifecycleManager {
  constructor() {
    this.stripeAvailable = !!stripe;
    this.subscriptionStates = {
      ACTIVE: 'active',
      TRIALING: 'trialing',
      PAST_DUE: 'past_due',
      CANCELED: 'canceled',
      UNPAID: 'unpaid',
      INCOMPLETE: 'incomplete',
      INCOMPLETE_EXPIRED: 'incomplete_expired',
      PAUSED: 'paused'
    };

    this.lifecycleEvents = {
      CREATED: 'subscription_created',
      UPDATED: 'subscription_updated',
      RENEWED: 'subscription_renewed',
      CANCELED: 'subscription_canceled',
      PAUSED: 'subscription_paused',
      RESUMED: 'subscription_resumed',
      UPGRADED: 'subscription_upgraded',
      DOWNGRADED: 'subscription_downgraded',
      PAYMENT_FAILED: 'payment_failed',
      PAYMENT_SUCCEEDED: 'payment_succeeded'
    };
  }

  /**
   * Handle subscription creation
   */
  async handleSubscriptionCreated(stripeSubscription, userId) {
    try {
      console.log('🆕 Creating subscription:', stripeSubscription.id);

      const subscription = new Subscription({
        userId: userId,
        stripeCustomerId: stripeSubscription.customer,
        stripeSubscriptionId: stripeSubscription.id,
        planId: this.extractPlanIdFromSubscription(stripeSubscription),
        planName: this.extractPlanNameFromSubscription(stripeSubscription),
        planType: this.extractPlanTypeFromSubscription(stripeSubscription),
        status: stripeSubscription.status,
        amount: this.extractAmountFromSubscription(stripeSubscription),
        currency: stripeSubscription.currency || 'usd',
        interval: this.extractIntervalFromSubscription(stripeSubscription),
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
        createdAt: new Date(),
        metadata: stripeSubscription.metadata || {}
      });

      await subscription.save();

      // Add to user's subscriptions
      await User.findByIdAndUpdate(userId, {
        $push: { subscriptions: subscription._id }
      });

      // Update user feature access
      await this.updateUserFeatureAccess(userId);

      // Log lifecycle event
      await this.logLifecycleEvent(this.lifecycleEvents.CREATED, subscription, {
        stripeSubscriptionId: stripeSubscription.id,
        planId: subscription.planId
      });

      console.log('✅ Subscription created successfully:', subscription._id);
      return subscription;

    } catch (error) {
      console.error('❌ Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Handle subscription updates
   */
  async handleSubscriptionUpdated(stripeSubscription) {
    try {
      console.log('🔄 Updating subscription:', stripeSubscription.id);

      const subscription = await Subscription.findOne({
        stripeSubscriptionId: stripeSubscription.id
      });

      if (!subscription) {
        console.error('❌ Subscription not found:', stripeSubscription.id);
        return null;
      }

      const oldStatus = subscription.status;
      const oldPlanId = subscription.planId;

      // Update subscription details
      subscription.status = stripeSubscription.status;
      subscription.planId = this.extractPlanIdFromSubscription(stripeSubscription);
      subscription.planName = this.extractPlanNameFromSubscription(stripeSubscription);
      subscription.planType = this.extractPlanTypeFromSubscription(stripeSubscription);
      subscription.amount = this.extractAmountFromSubscription(stripeSubscription);
      subscription.interval = this.extractIntervalFromSubscription(stripeSubscription);
      subscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
      subscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
      subscription.trialStart = stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null;
      subscription.trialEnd = stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null;
      subscription.updatedAt = new Date();
      subscription.metadata = { ...subscription.metadata, ...stripeSubscription.metadata };

      await subscription.save();

      // Update user feature access
      await this.updateUserFeatureAccess(subscription.userId);

      // Determine lifecycle event type
      let eventType = this.lifecycleEvents.UPDATED;
      if (oldStatus !== subscription.status) {
        if (subscription.status === this.subscriptionStates.ACTIVE && oldStatus === this.subscriptionStates.PAST_DUE) {
          eventType = this.lifecycleEvents.PAYMENT_SUCCEEDED;
        } else if (subscription.status === this.subscriptionStates.PAST_DUE && oldStatus === this.subscriptionStates.ACTIVE) {
          eventType = this.lifecycleEvents.PAYMENT_FAILED;
        } else if (subscription.status === this.subscriptionStates.CANCELED) {
          eventType = this.lifecycleEvents.CANCELED;
        }
      }

      if (oldPlanId !== subscription.planId) {
        eventType = this.isUpgrade(subscription.planId, oldPlanId) ? 
          this.lifecycleEvents.UPGRADED : this.lifecycleEvents.DOWNGRADED;
      }

      // Log lifecycle event
      await this.logLifecycleEvent(eventType, subscription, {
        oldStatus,
        newStatus: subscription.status,
        oldPlanId,
        newPlanId: subscription.planId,
        stripeSubscriptionId: stripeSubscription.id
      });

      console.log('✅ Subscription updated successfully:', subscription._id);
      return subscription;

    } catch (error) {
      console.error('❌ Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Handle subscription cancellation
   */
  async handleSubscriptionCancellation(stripeSubscription) {
    try {
      console.log('🗑️ Canceling subscription:', stripeSubscription.id);

      const subscription = await Subscription.findOne({
        stripeSubscriptionId: stripeSubscription.id
      });

      if (!subscription) {
        console.error('❌ Subscription not found:', stripeSubscription.id);
        return null;
      }

      // Update subscription status
      subscription.status = this.subscriptionStates.CANCELED;
      subscription.canceledAt = new Date();
      subscription.cancelReason = stripeSubscription.cancellation_details?.reason || 'user_requested';
      subscription.updatedAt = new Date();

      await subscription.save();

      // Update user feature access
      await this.updateUserFeatureAccess(subscription.userId);

      // Log lifecycle event
      await this.logLifecycleEvent(this.lifecycleEvents.CANCELED, subscription, {
        stripeSubscriptionId: stripeSubscription.id,
        cancelReason: subscription.cancelReason,
        canceledAt: subscription.canceledAt
      });

      console.log('✅ Subscription canceled successfully:', subscription._id);
      return subscription;

    } catch (error) {
      console.error('❌ Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Handle subscription pause
   */
  async pauseSubscription(subscriptionId, reason = 'user_requested') {
    try {
      console.log('⏸️ Pausing subscription:', subscriptionId);

      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Pause in Stripe
      if (this.stripeAvailable) {
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          pause_collection: {
            behavior: 'void'
          }
        });
      }

      // Update local subscription
      subscription.status = this.subscriptionStates.PAUSED;
      subscription.pausedAt = new Date();
      subscription.pauseReason = reason;
      subscription.updatedAt = new Date();

      await subscription.save();

      // Update user feature access
      await this.updateUserFeatureAccess(subscription.userId);

      // Log lifecycle event
      await this.logLifecycleEvent(this.lifecycleEvents.PAUSED, subscription, {
        pauseReason: reason,
        pausedAt: subscription.pausedAt
      });

      console.log('✅ Subscription paused successfully:', subscription._id);
      return subscription;

    } catch (error) {
      console.error('❌ Error pausing subscription:', error);
      throw error;
    }
  }

  /**
   * Handle subscription resume
   */
  async resumeSubscription(subscriptionId) {
    try {
      console.log('▶️ Resuming subscription:', subscriptionId);

      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Resume in Stripe
      if (this.stripeAvailable) {
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          pause_collection: null
        });
      }

      // Update local subscription
      subscription.status = this.subscriptionStates.ACTIVE;
      subscription.resumedAt = new Date();
      subscription.updatedAt = new Date();

      await subscription.save();

      // Update user feature access
      await this.updateUserFeatureAccess(subscription.userId);

      // Log lifecycle event
      await this.logLifecycleEvent(this.lifecycleEvents.RESUMED, subscription, {
        resumedAt: subscription.resumedAt
      });

      console.log('✅ Subscription resumed successfully:', subscription._id);
      return subscription;

    } catch (error) {
      console.error('❌ Error resuming subscription:', error);
      throw error;
    }
  }

  /**
   * Handle subscription upgrade/downgrade
   */
  async changeSubscriptionPlan(subscriptionId, newPlanId, prorationBehavior = 'create_prorations') {
    try {
      console.log('🔄 Changing subscription plan:', subscriptionId, 'to', newPlanId);

      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Get new plan configuration
      const newPlanConfig = this.getPlanConfig(newPlanId);
      if (!newPlanConfig) {
        throw new Error('Invalid plan ID');
      }

      // Update in Stripe
      if (this.stripeAvailable) {
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          items: [{
            id: subscription.stripeSubscriptionId,
            price: newPlanConfig.stripePriceId
          }],
          proration_behavior: prorationBehavior
        });
      }

      // Update local subscription
      const oldPlanId = subscription.planId;
      subscription.planId = newPlanId;
      subscription.planName = newPlanConfig.name;
      subscription.planType = newPlanConfig.type;
      subscription.amount = newPlanConfig.price;
      subscription.features = newPlanConfig.features;
      subscription.limits = newPlanConfig.limits;
      subscription.updatedAt = new Date();

      await subscription.save();

      // Update user feature access
      await this.updateUserFeatureAccess(subscription.userId);

      // Determine if it's an upgrade or downgrade
      const eventType = this.isUpgrade(newPlanId, oldPlanId) ? 
        this.lifecycleEvents.UPGRADED : this.lifecycleEvents.DOWNGRADED;

      // Log lifecycle event
      await this.logLifecycleEvent(eventType, subscription, {
        oldPlanId,
        newPlanId,
        prorationBehavior
      });

      console.log('✅ Subscription plan changed successfully:', subscription._id);
      return subscription;

    } catch (error) {
      console.error('❌ Error changing subscription plan:', error);
      throw error;
    }
  }

  /**
   * Handle payment failure
   */
  async handlePaymentFailure(subscriptionId, failureReason = 'unknown') {
    try {
      console.log('💳 Handling payment failure for subscription:', subscriptionId);

      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Update subscription status
      subscription.status = this.subscriptionStates.PAST_DUE;
      subscription.lastPaymentAttempt = new Date();
      subscription.paymentFailureReason = failureReason;
      subscription.updatedAt = new Date();

      await subscription.save();

      // Update user feature access
      await this.updateUserFeatureAccess(subscription.userId);

      // Log lifecycle event
      await this.logLifecycleEvent(this.lifecycleEvents.PAYMENT_FAILED, subscription, {
        failureReason,
        lastPaymentAttempt: subscription.lastPaymentAttempt
      });

      // TODO: Send payment failure notification to user
      await this.sendPaymentFailureNotification(subscription, failureReason);

      console.log('✅ Payment failure handled successfully:', subscription._id);
      return subscription;

    } catch (error) {
      console.error('❌ Error handling payment failure:', error);
      throw error;
    }
  }

  /**
   * Handle payment success
   */
  async handlePaymentSuccess(subscriptionId) {
    try {
      console.log('✅ Handling payment success for subscription:', subscriptionId);

      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Update subscription status
      subscription.status = this.subscriptionStates.ACTIVE;
      subscription.lastPaymentDate = new Date();
      subscription.updatedAt = new Date();

      await subscription.save();

      // Update user feature access
      await this.updateUserFeatureAccess(subscription.userId);

      // Log lifecycle event
      await this.logLifecycleEvent(this.lifecycleEvents.PAYMENT_SUCCEEDED, subscription, {
        lastPaymentDate: subscription.lastPaymentDate
      });

      console.log('✅ Payment success handled successfully:', subscription._id);
      return subscription;

    } catch (error) {
      console.error('❌ Error handling payment success:', error);
      throw error;
    }
  }

  /**
   * Update user feature access based on active subscriptions
   */
  async updateUserFeatureAccess(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        console.error('❌ User not found:', userId);
        return;
      }

      // Get all active subscriptions
      const activeSubscriptions = await Subscription.find({
        userId: userId,
        status: { $in: [this.subscriptionStates.ACTIVE, this.subscriptionStates.TRIALING] }
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
      throw error;
    }
  }

  /**
   * Log lifecycle event
   */
  async logLifecycleEvent(eventType, subscription, metadata = {}) {
    try {
      const logData = {
        eventType,
        subscriptionId: subscription._id,
        userId: subscription.userId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        planId: subscription.planId,
        status: subscription.status,
        timestamp: new Date(),
        metadata
      };

      console.log('📝 Lifecycle Event:', logData);
      
      // TODO: Send to monitoring service (e.g., Sentry, DataDog)
      // this.sendToMonitoringService(logData);
      
    } catch (error) {
      console.error('❌ Error logging lifecycle event:', error);
    }
  }

  /**
   * Send payment failure notification
   */
  async sendPaymentFailureNotification(subscription, failureReason) {
    try {
      // TODO: Implement notification system
      console.log('📧 Payment failure notification sent to user:', subscription.userId);
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

  /**
   * Extract plan name from Stripe subscription
   */
  extractPlanNameFromSubscription(stripeSubscription) {
    const price = stripeSubscription.items.data[0]?.price;
    return price?.nickname || price?.product?.name || 'Unknown Plan';
  }

  /**
   * Extract plan type from Stripe subscription
   */
  extractPlanTypeFromSubscription(stripeSubscription) {
    const planId = this.extractPlanIdFromSubscription(stripeSubscription);
    
    if (planId.includes('nursing')) return 'nursing';
    if (planId.includes('pt') || planId.includes('physical-therapy')) return 'physical-therapy';
    if (planId.includes('medical')) return 'medical-provider';
    return 'general';
  }

  /**
   * Extract amount from Stripe subscription
   */
  extractAmountFromSubscription(stripeSubscription) {
    return stripeSubscription.items.data[0]?.price?.unit_amount || 0;
  }

  /**
   * Extract interval from Stripe subscription
   */
  extractIntervalFromSubscription(stripeSubscription) {
    return stripeSubscription.items.data[0]?.price?.recurring?.interval || 'month';
  }

  /**
   * Check if plan change is an upgrade
   */
  isUpgrade(newPlanId, oldPlanId) {
    // Define plan hierarchy (higher number = higher tier)
    const planHierarchy = {
      'nursing-monthly': 1,
      'nursing-annual': 2,
      'pt-monthly': 1,
      'pt-annual': 2,
      'medical-monthly': 1,
      'medical-annual': 2
    };

    const newTier = planHierarchy[newPlanId] || 0;
    const oldTier = planHierarchy[oldPlanId] || 0;

    return newTier > oldTier;
  }

  /**
   * Get plan configuration
   */
  getPlanConfig(planId) {
    // This should match your plan configurations
    const planConfigs = {
      'nursing-monthly': {
        name: 'Nursing Professional Monthly',
        type: 'nursing',
        price: 4900,
        stripePriceId: 'price_nursing_monthly',
        features: ['oasis_scoring', 'soap_notes', 'clinical_insights'],
        limits: { fileUploads: -1, storageGB: 10, aiRequests: -1 }
      },
      'nursing-annual': {
        name: 'Nursing Professional Annual',
        type: 'nursing',
        price: 49000,
        stripePriceId: 'price_nursing_annual',
        features: ['oasis_scoring', 'soap_notes', 'clinical_insights'],
        limits: { fileUploads: -1, storageGB: 50, aiRequests: -1 }
      }
      // Add other plan configurations
    };

    return planConfigs[planId];
  }
}

export default new SubscriptionLifecycleManager();
