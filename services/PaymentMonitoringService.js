import Stripe from "stripe";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";

const stripe = process.env.STRIPE_SECRET_KEY && 
  process.env.STRIPE_SECRET_KEY !== "sk_test_your_stripe_secret_key_here"
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null;

/**
 * Comprehensive Payment Monitoring and Logging Service
 * Tracks all payment events, metrics, and alerts for production monitoring
 */
class PaymentMonitoringService {
  constructor() {
    this.stripeAvailable = !!stripe;
    this.metrics = {
      totalPayments: 0,
      successfulPayments: 0,
      failedPayments: 0,
      totalRevenue: 0,
      refunds: 0,
      refundAmount: 0,
      activeSubscriptions: 0,
      churnRate: 0
    };

    this.alertThresholds = {
      paymentFailureRate: 0.1, // 10%
      refundRate: 0.05, // 5%
      churnRate: 0.15, // 15%
      responseTime: 5000, // 5 seconds
      errorRate: 0.05 // 5%
    };

    this.eventTypes = {
      PAYMENT_SUCCESS: 'payment_success',
      PAYMENT_FAILURE: 'payment_failure',
      SUBSCRIPTION_CREATED: 'subscription_created',
      SUBSCRIPTION_UPDATED: 'subscription_updated',
      SUBSCRIPTION_CANCELED: 'subscription_canceled',
      REFUND_PROCESSED: 'refund_processed',
      WEBHOOK_RECEIVED: 'webhook_received',
      WEBHOOK_FAILED: 'webhook_failed',
      ERROR_OCCURRED: 'error_occurred',
      THRESHOLD_EXCEEDED: 'threshold_exceeded'
    };
  }

  /**
   * Log payment event with comprehensive metadata
   */
  async logPaymentEvent(eventType, data, metadata = {}) {
    try {
      const logEntry = {
        eventType,
        timestamp: new Date(),
        data: {
          userId: data.userId,
          subscriptionId: data.subscriptionId,
          amount: data.amount,
          currency: data.currency || 'usd',
          paymentMethod: data.paymentMethod,
          status: data.status,
          error: data.error,
          ...metadata
        },
        environment: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0'
      };

      // Log to console with structured format
      console.log('📊 Payment Event:', JSON.stringify(logEntry, null, 2));

      // Update metrics
      await this.updateMetrics(eventType, data);

      // Check for alerts
      await this.checkAlerts(eventType, data);

      // TODO: Send to external monitoring service (e.g., DataDog, New Relic, Sentry)
      // await this.sendToExternalMonitoring(logEntry);

      // TODO: Store in database for analytics
      // await this.storeEventInDatabase(logEntry);

    } catch (error) {
      console.error('❌ Error logging payment event:', error);
    }
  }

  /**
   * Log webhook event
   */
  async logWebhookEvent(eventType, stripeEvent, processingTime = null, success = true) {
    try {
      const logEntry = {
        eventType: success ? this.eventTypes.WEBHOOK_RECEIVED : this.eventTypes.WEBHOOK_FAILED,
        timestamp: new Date(),
        stripeEvent: {
          id: stripeEvent.id,
          type: stripeEvent.type,
          created: new Date(stripeEvent.created * 1000),
          livemode: stripeEvent.livemode
        },
        processingTime,
        success,
        environment: process.env.NODE_ENV || 'development'
      };

      console.log('🔔 Webhook Event:', JSON.stringify(logEntry, null, 2));

      // Check webhook processing performance
      if (processingTime && processingTime > this.alertThresholds.responseTime) {
        await this.triggerAlert('webhook_slow_processing', {
          eventType: stripeEvent.type,
          processingTime,
          threshold: this.alertThresholds.responseTime
        });
      }

    } catch (error) {
      console.error('❌ Error logging webhook event:', error);
    }
  }

  /**
   * Log error with context
   */
  async logError(error, context = {}) {
    try {
      const logEntry = {
        eventType: this.eventTypes.ERROR_OCCURRED,
        timestamp: new Date(),
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
          type: error.type,
          code: error.code
        },
        context: {
          userId: context.userId,
          subscriptionId: context.subscriptionId,
          operation: context.operation,
          ...context
        },
        environment: process.env.NODE_ENV || 'development',
        severity: this.getErrorSeverity(error)
      };

      console.error('🚨 Error Logged:', JSON.stringify(logEntry, null, 2));

      // Send critical errors to monitoring service
      if (logEntry.severity === 'critical') {
        await this.triggerAlert('critical_error', logEntry);
      }

    } catch (logError) {
      console.error('❌ Error logging error:', logError);
    }
  }

  /**
   * Update metrics based on event
   */
  async updateMetrics(eventType, data) {
    try {
      switch (eventType) {
        case this.eventTypes.PAYMENT_SUCCESS:
          this.metrics.totalPayments++;
          this.metrics.successfulPayments++;
          this.metrics.totalRevenue += data.amount || 0;
          break;

        case this.eventTypes.PAYMENT_FAILURE:
          this.metrics.totalPayments++;
          this.metrics.failedPayments++;
          break;

        case this.eventTypes.SUBSCRIPTION_CREATED:
          this.metrics.activeSubscriptions++;
          break;

        case this.eventTypes.SUBSCRIPTION_CANCELED:
          this.metrics.activeSubscriptions = Math.max(0, this.metrics.activeSubscriptions - 1);
          break;

        case this.eventTypes.REFUND_PROCESSED:
          this.metrics.refunds++;
          this.metrics.refundAmount += data.amount || 0;
          break;
      }

      // Calculate derived metrics
      this.metrics.paymentSuccessRate = this.metrics.totalPayments > 0 ? 
        this.metrics.successfulPayments / this.metrics.totalPayments : 0;
      
      this.metrics.paymentFailureRate = this.metrics.totalPayments > 0 ? 
        this.metrics.failedPayments / this.metrics.totalPayments : 0;

      this.metrics.refundRate = this.metrics.totalRevenue > 0 ? 
        this.metrics.refundAmount / this.metrics.totalRevenue : 0;

    } catch (error) {
      console.error('❌ Error updating metrics:', error);
    }
  }

  /**
   * Check for alert conditions
   */
  async checkAlerts(eventType, data) {
    try {
      // Check payment failure rate
      if (this.metrics.paymentFailureRate > this.alertThresholds.paymentFailureRate) {
        await this.triggerAlert('high_payment_failure_rate', {
          currentRate: this.metrics.paymentFailureRate,
          threshold: this.alertThresholds.paymentFailureRate,
          totalPayments: this.metrics.totalPayments,
          failedPayments: this.metrics.failedPayments
        });
      }

      // Check refund rate
      if (this.metrics.refundRate > this.alertThresholds.refundRate) {
        await this.triggerAlert('high_refund_rate', {
          currentRate: this.metrics.refundRate,
          threshold: this.alertThresholds.refundRate,
          totalRevenue: this.metrics.totalRevenue,
          refundAmount: this.metrics.refundAmount
        });
      }

      // Check for consecutive failures
      if (eventType === this.eventTypes.PAYMENT_FAILURE) {
        await this.checkConsecutiveFailures(data);
      }

    } catch (error) {
      console.error('❌ Error checking alerts:', error);
    }
  }

  /**
   * Check for consecutive payment failures
   */
  async checkConsecutiveFailures(data) {
    try {
      // This would typically query a database for recent failures
      // For now, we'll use a simple in-memory counter
      const failureKey = `failures_${data.userId || 'unknown'}`;
      const currentFailures = this.consecutiveFailures || {};
      
      currentFailures[failureKey] = (currentFailures[failureKey] || 0) + 1;
      this.consecutiveFailures = currentFailures;

      // Alert if more than 3 consecutive failures
      if (currentFailures[failureKey] >= 3) {
        await this.triggerAlert('consecutive_payment_failures', {
          userId: data.userId,
          consecutiveFailures: currentFailures[failureKey],
          lastFailure: data
        });
      }

    } catch (error) {
      console.error('❌ Error checking consecutive failures:', error);
    }
  }

  /**
   * Trigger alert
   */
  async triggerAlert(alertType, data) {
    try {
      const alert = {
        alertType,
        timestamp: new Date(),
        severity: this.getAlertSeverity(alertType),
        data,
        environment: process.env.NODE_ENV || 'development'
      };

      console.warn('🚨 Alert Triggered:', JSON.stringify(alert, null, 2));

      // TODO: Send to alerting service (e.g., PagerDuty, Slack, email)
      // await this.sendToAlertingService(alert);

      // TODO: Store alert in database
      // await this.storeAlertInDatabase(alert);

    } catch (error) {
      console.error('❌ Error triggering alert:', error);
    }
  }

  /**
   * Get error severity level
   */
  getErrorSeverity(error) {
    if (error.type === 'StripeCardError') return 'warning';
    if (error.type === 'StripeRateLimitError') return 'warning';
    if (error.type === 'StripeInvalidRequestError') return 'error';
    if (error.type === 'StripeAuthenticationError') return 'critical';
    if (error.type === 'StripeAPIError') return 'error';
    if (error.type === 'StripeConnectionError') return 'warning';
    
    return 'error';
  }

  /**
   * Get alert severity level
   */
  getAlertSeverity(alertType) {
    const severityMap = {
      'high_payment_failure_rate': 'warning',
      'high_refund_rate': 'warning',
      'consecutive_payment_failures': 'error',
      'webhook_slow_processing': 'warning',
      'critical_error': 'critical',
      'threshold_exceeded': 'warning'
    };

    return severityMap[alertType] || 'info';
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'development'
    };
  }

  /**
   * Get payment analytics for a time period
   */
  async getPaymentAnalytics(startDate, endDate) {
    try {
      const pipeline = [
        {
          $match: {
            createdAt: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        },
        {
          $group: {
            _id: {
              status: '$status',
              planId: '$planId'
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            averageAmount: { $avg: '$amount' }
          }
        },
        {
          $sort: { count: -1 }
        }
      ];

      const analytics = await Subscription.aggregate(pipeline);
      
      return {
        period: { startDate, endDate },
        analytics,
        summary: {
          totalSubscriptions: analytics.reduce((sum, item) => sum + item.count, 0),
          totalRevenue: analytics.reduce((sum, item) => sum + item.totalAmount, 0),
          averageRevenue: analytics.length > 0 ? 
            analytics.reduce((sum, item) => sum + item.totalAmount, 0) / analytics.length : 0
        }
      };

    } catch (error) {
      console.error('❌ Error getting payment analytics:', error);
      throw error;
    }
  }

  /**
   * Get user payment history
   */
  async getUserPaymentHistory(userId, limit = 50) {
    try {
      const subscriptions = await Subscription.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userId', 'email name');

      return subscriptions.map(sub => ({
        subscriptionId: sub._id,
        planId: sub.planId,
        planName: sub.planName,
        status: sub.status,
        amount: sub.amount,
        currency: sub.currency,
        createdAt: sub.createdAt,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        refunds: sub.refunds || []
      }));

    } catch (error) {
      console.error('❌ Error getting user payment history:', error);
      throw error;
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth() {
    try {
      const health = {
        timestamp: new Date(),
        status: 'healthy',
        services: {
          stripe: this.stripeAvailable ? 'connected' : 'disconnected',
          database: 'connected', // TODO: Add actual DB health check
          webhooks: 'active' // TODO: Add webhook health check
        },
        metrics: this.getMetrics(),
        alerts: {
          active: 0, // TODO: Count active alerts
          critical: 0 // TODO: Count critical alerts
        }
      };

      // Determine overall health status
      if (health.services.stripe === 'disconnected') {
        health.status = 'degraded';
      }

      if (health.metrics.paymentFailureRate > 0.2) {
        health.status = 'unhealthy';
      }

      return health;

    } catch (error) {
      console.error('❌ Error getting system health:', error);
      return {
        timestamp: new Date(),
        status: 'unknown',
        error: error.message
      };
    }
  }

  /**
   * Reset consecutive failure counter
   */
  resetConsecutiveFailures(userId) {
    if (this.consecutiveFailures) {
      delete this.consecutiveFailures[`failures_${userId}`];
    }
  }

  /**
   * Send to external monitoring service
   */
  async sendToExternalMonitoring(logEntry) {
    try {
      // TODO: Implement integration with monitoring services
      // Examples:
      // - DataDog: await this.sendToDataDog(logEntry);
      // - New Relic: await this.sendToNewRelic(logEntry);
      // - Sentry: await this.sendToSentry(logEntry);
      
      console.log('📊 External monitoring:', logEntry.eventType);
    } catch (error) {
      console.error('❌ Error sending to external monitoring:', error);
    }
  }

  /**
   * Send to alerting service
   */
  async sendToAlertingService(alert) {
    try {
      // TODO: Implement integration with alerting services
      // Examples:
      // - PagerDuty: await this.sendToPagerDuty(alert);
      // - Slack: await this.sendToSlack(alert);
      // - Email: await this.sendEmailAlert(alert);
      
      console.log('🚨 Alerting service:', alert.alertType);
    } catch (error) {
      console.error('❌ Error sending to alerting service:', error);
    }
  }
}

export default new PaymentMonitoringService();
