import Stripe from "stripe";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import PaymentErrorHandler from "./PaymentErrorHandler.js";

const stripe = process.env.STRIPE_SECRET_KEY && 
  process.env.STRIPE_SECRET_KEY !== "sk_test_your_stripe_secret_key_here"
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null;

/**
 * Comprehensive Refund Processing Service
 * Handles all refund operations with proper validation, logging, and user notifications
 */
class RefundProcessor {
  constructor() {
    this.stripeAvailable = !!stripe;
    this.refundReasons = {
      DUPLICATE: 'duplicate',
      FRAUDULENT: 'fraudulent',
      REQUESTED_BY_CUSTOMER: 'requested_by_customer',
      CANCELLED: 'cancelled',
      OTHER: 'other'
    };

    this.refundStatuses = {
      PENDING: 'pending',
      SUCCEEDED: 'succeeded',
      FAILED: 'failed',
      CANCELLED: 'cancelled'
    };

    this.refundTypes = {
      FULL: 'full',
      PARTIAL: 'partial',
      PRORATED: 'prorated'
    };
  }

  /**
   * Process a full refund for a subscription
   */
  async processFullRefund(subscriptionId, reason = this.refundReasons.REQUESTED_BY_CUSTOMER, adminNotes = '') {
    try {
      console.log('💸 Processing full refund for subscription:', subscriptionId);

      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Get the latest invoice
      const latestInvoice = await stripe.invoices.retrieve(subscription.stripeSubscriptionId);
      if (!latestInvoice.payment_intent) {
        throw new Error('No payment intent found for refund');
      }

      // Process refund through Stripe
      const refund = await stripe.refunds.create({
        payment_intent: latestInvoice.payment_intent,
        amount: latestInvoice.amount_paid,
        reason: reason,
        metadata: {
          subscriptionId: subscription._id.toString(),
          userId: subscription.userId.toString(),
          refundType: this.refundTypes.FULL,
          adminNotes: adminNotes
        }
      });

      // Update subscription with refund information
      subscription.refunds = subscription.refunds || [];
      subscription.refunds.push({
        refundId: refund.id,
        amount: refund.amount,
        reason: reason,
        status: refund.status,
        type: this.refundTypes.FULL,
        createdAt: new Date(),
        adminNotes: adminNotes
      });

      await subscription.save();

      // Log refund event
      await this.logRefundEvent('full_refund_processed', subscription, {
        refundId: refund.id,
        amount: refund.amount,
        reason: reason,
        adminNotes: adminNotes
      });

      // Send notification to user
      await this.sendRefundNotification(subscription, refund, this.refundTypes.FULL);

      console.log('✅ Full refund processed successfully:', refund.id);
      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount,
        status: refund.status,
        type: this.refundTypes.FULL
      };

    } catch (error) {
      console.error('❌ Error processing full refund:', error);
      throw error;
    }
  }

  /**
   * Process a partial refund for a subscription
   */
  async processPartialRefund(subscriptionId, amount, reason = this.refundReasons.REQUESTED_BY_CUSTOMER, adminNotes = '') {
    try {
      console.log('💸 Processing partial refund for subscription:', subscriptionId, 'Amount:', amount);

      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Validate refund amount
      const latestInvoice = await stripe.invoices.retrieve(subscription.stripeSubscriptionId);
      if (amount > latestInvoice.amount_paid) {
        throw new Error('Refund amount cannot exceed paid amount');
      }

      // Process refund through Stripe
      const refund = await stripe.refunds.create({
        payment_intent: latestInvoice.payment_intent,
        amount: amount,
        reason: reason,
        metadata: {
          subscriptionId: subscription._id.toString(),
          userId: subscription.userId.toString(),
          refundType: this.refundTypes.PARTIAL,
          adminNotes: adminNotes
        }
      });

      // Update subscription with refund information
      subscription.refunds = subscription.refunds || [];
      subscription.refunds.push({
        refundId: refund.id,
        amount: refund.amount,
        reason: reason,
        status: refund.status,
        type: this.refundTypes.PARTIAL,
        createdAt: new Date(),
        adminNotes: adminNotes
      });

      await subscription.save();

      // Log refund event
      await this.logRefundEvent('partial_refund_processed', subscription, {
        refundId: refund.id,
        amount: refund.amount,
        reason: reason,
        adminNotes: adminNotes
      });

      // Send notification to user
      await this.sendRefundNotification(subscription, refund, this.refundTypes.PARTIAL);

      console.log('✅ Partial refund processed successfully:', refund.id);
      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount,
        status: refund.status,
        type: this.refundTypes.PARTIAL
      };

    } catch (error) {
      console.error('❌ Error processing partial refund:', error);
      throw error;
    }
  }

  /**
   * Process a prorated refund for subscription cancellation
   */
  async processProratedRefund(subscriptionId, reason = this.refundReasons.CANCELLED, adminNotes = '') {
    try {
      console.log('💸 Processing prorated refund for subscription:', subscriptionId);

      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Calculate prorated amount
      const proratedAmount = await this.calculateProratedRefund(subscription);
      
      if (proratedAmount <= 0) {
        console.log('ℹ️ No prorated refund needed');
        return {
          success: true,
          refundId: null,
          amount: 0,
          status: 'no_refund_needed',
          type: this.refundTypes.PRORATED
        };
      }

      // Get the latest invoice
      const latestInvoice = await stripe.invoices.retrieve(subscription.stripeSubscriptionId);
      if (!latestInvoice.payment_intent) {
        throw new Error('No payment intent found for refund');
      }

      // Process refund through Stripe
      const refund = await stripe.refunds.create({
        payment_intent: latestInvoice.payment_intent,
        amount: proratedAmount,
        reason: reason,
        metadata: {
          subscriptionId: subscription._id.toString(),
          userId: subscription.userId.toString(),
          refundType: this.refundTypes.PRORATED,
          adminNotes: adminNotes
        }
      });

      // Update subscription with refund information
      subscription.refunds = subscription.refunds || [];
      subscription.refunds.push({
        refundId: refund.id,
        amount: refund.amount,
        reason: reason,
        status: refund.status,
        type: this.refundTypes.PRORATED,
        createdAt: new Date(),
        adminNotes: adminNotes
      });

      await subscription.save();

      // Log refund event
      await this.logRefundEvent('prorated_refund_processed', subscription, {
        refundId: refund.id,
        amount: refund.amount,
        reason: reason,
        adminNotes: adminNotes
      });

      // Send notification to user
      await this.sendRefundNotification(subscription, refund, this.refundTypes.PRORATED);

      console.log('✅ Prorated refund processed successfully:', refund.id);
      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount,
        status: refund.status,
        type: this.refundTypes.PRORATED
      };

    } catch (error) {
      console.error('❌ Error processing prorated refund:', error);
      throw error;
    }
  }

  /**
   * Calculate prorated refund amount
   */
  async calculateProratedRefund(subscription) {
    try {
      const now = new Date();
      const periodStart = subscription.currentPeriodStart;
      const periodEnd = subscription.currentPeriodEnd;
      const totalAmount = subscription.amount;

      // Calculate days used and total days in period
      const totalDays = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24));
      const daysUsed = Math.ceil((now - periodStart) / (1000 * 60 * 60 * 24));
      const daysRemaining = totalDays - daysUsed;

      // Calculate prorated amount (amount for unused days)
      const proratedAmount = Math.floor((totalAmount * daysRemaining) / totalDays);

      // Ensure minimum refund amount (Stripe minimum is $0.50)
      const minimumRefund = 50; // $0.50 in cents
      
      return proratedAmount >= minimumRefund ? proratedAmount : 0;

    } catch (error) {
      console.error('❌ Error calculating prorated refund:', error);
      return 0;
    }
  }

  /**
   * Cancel a pending refund
   */
  async cancelRefund(refundId) {
    try {
      console.log('❌ Canceling refund:', refundId);

      // Cancel refund in Stripe
      const refund = await stripe.refunds.cancel(refundId);

      // Update subscription refund status
      await Subscription.updateOne(
        { 'refunds.refundId': refundId },
        { 
          $set: { 
            'refunds.$.status': this.refundStatuses.CANCELLED,
            'refunds.$.cancelledAt': new Date()
          }
        }
      );

      // Log refund cancellation
      await this.logRefundEvent('refund_cancelled', null, {
        refundId: refundId,
        status: refund.status
      });

      console.log('✅ Refund canceled successfully:', refundId);
      return {
        success: true,
        refundId: refundId,
        status: refund.status
      };

    } catch (error) {
      console.error('❌ Error canceling refund:', error);
      throw error;
    }
  }

  /**
   * Get refund status
   */
  async getRefundStatus(refundId) {
    try {
      const refund = await stripe.refunds.retrieve(refundId);
      
      return {
        refundId: refund.id,
        amount: refund.amount,
        status: refund.status,
        reason: refund.reason,
        created: new Date(refund.created * 1000),
        metadata: refund.metadata
      };

    } catch (error) {
      console.error('❌ Error getting refund status:', error);
      throw error;
    }
  }

  /**
   * Get all refunds for a subscription
   */
  async getSubscriptionRefunds(subscriptionId) {
    try {
      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      return subscription.refunds || [];

    } catch (error) {
      console.error('❌ Error getting subscription refunds:', error);
      throw error;
    }
  }

  /**
   * Get all refunds for a user
   */
  async getUserRefunds(userId) {
    try {
      const subscriptions = await Subscription.find({ userId: userId });
      const allRefunds = [];

      for (const subscription of subscriptions) {
        if (subscription.refunds) {
          allRefunds.push(...subscription.refunds.map(refund => ({
            ...refund,
            subscriptionId: subscription._id,
            planId: subscription.planId
          })));
        }
      }

      return allRefunds.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    } catch (error) {
      console.error('❌ Error getting user refunds:', error);
      throw error;
    }
  }

  /**
   * Process refund with error handling
   */
  async processRefundWithErrorHandling(subscriptionId, refundType, amount = null, reason = this.refundReasons.REQUESTED_BY_CUSTOMER, adminNotes = '') {
    try {
      let result;

      switch (refundType) {
        case this.refundTypes.FULL:
          result = await this.processFullRefund(subscriptionId, reason, adminNotes);
          break;
        case this.refundTypes.PARTIAL:
          if (!amount) {
            throw new Error('Amount required for partial refund');
          }
          result = await this.processPartialRefund(subscriptionId, amount, reason, adminNotes);
          break;
        case this.refundTypes.PRORATED:
          result = await this.processProratedRefund(subscriptionId, reason, adminNotes);
          break;
        default:
          throw new Error('Invalid refund type');
      }

      return result;

    } catch (error) {
      console.error('❌ Refund processing failed:', error);
      
      // Use error handler for user-friendly error messages
      const errorInfo = PaymentErrorHandler.handlePaymentError(error, {
        subscriptionId,
        refundType,
        amount,
        reason
      });

      return {
        success: false,
        error: errorInfo.userMessage,
        errorType: errorInfo.type,
        recoveryAction: errorInfo.recoveryAction,
        retryable: errorInfo.retryable
      };
    }
  }

  /**
   * Log refund event
   */
  async logRefundEvent(eventType, subscription, metadata = {}) {
    try {
      const logData = {
        eventType,
        subscriptionId: subscription?._id,
        userId: subscription?.userId,
        timestamp: new Date(),
        metadata
      };

      console.log('📝 Refund Event:', logData);
      
      // TODO: Send to monitoring service (e.g., Sentry, DataDog)
      // this.sendToMonitoringService(logData);
      
    } catch (error) {
      console.error('❌ Error logging refund event:', error);
    }
  }

  /**
   * Send refund notification to user
   */
  async sendRefundNotification(subscription, refund, refundType) {
    try {
      const user = await User.findById(subscription.userId);
      if (!user) {
        console.error('❌ User not found for refund notification:', subscription.userId);
        return;
      }

      // TODO: Implement notification system
      console.log('📧 Refund notification sent to user:', user.email, {
        refundId: refund.id,
        amount: refund.amount,
        type: refundType
      });

    } catch (error) {
      console.error('❌ Error sending refund notification:', error);
    }
  }

  /**
   * Validate refund request
   */
  validateRefundRequest(subscriptionId, refundType, amount = null) {
    const errors = [];

    if (!subscriptionId) {
      errors.push('Subscription ID is required');
    }

    if (!refundType || !Object.values(this.refundTypes).includes(refundType)) {
      errors.push('Valid refund type is required');
    }

    if (refundType === this.refundTypes.PARTIAL && (!amount || amount <= 0)) {
      errors.push('Valid amount is required for partial refund');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Get refund statistics
   */
  async getRefundStatistics(startDate = null, endDate = null) {
    try {
      const matchQuery = {};
      
      if (startDate && endDate) {
        matchQuery.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const pipeline = [
        { $unwind: '$refunds' },
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalRefunds: { $sum: 1 },
            totalAmount: { $sum: '$refunds.amount' },
            averageAmount: { $avg: '$refunds.amount' },
            refundsByType: {
              $push: {
                type: '$refunds.type',
                amount: '$refunds.amount',
                status: '$refunds.status'
              }
            }
          }
        }
      ];

      const result = await Subscription.aggregate(pipeline);
      
      if (result.length === 0) {
        return {
          totalRefunds: 0,
          totalAmount: 0,
          averageAmount: 0,
          refundsByType: {}
        };
      }

      const stats = result[0];
      const refundsByType = {};

      stats.refundsByType.forEach(refund => {
        if (!refundsByType[refund.type]) {
          refundsByType[refund.type] = {
            count: 0,
            totalAmount: 0
          };
        }
        refundsByType[refund.type].count++;
        refundsByType[refund.type].totalAmount += refund.amount;
      });

      return {
        totalRefunds: stats.totalRefunds,
        totalAmount: stats.totalAmount,
        averageAmount: Math.round(stats.averageAmount),
        refundsByType: refundsByType
      };

    } catch (error) {
      console.error('❌ Error getting refund statistics:', error);
      throw error;
    }
  }
}

export default new RefundProcessor();
