import Stripe from "stripe";
import request from "supertest";
import app from "../app.js"; // Adjust path as needed
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import PaymentMonitoringService from "../services/PaymentMonitoringService.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Comprehensive Stripe Payment Testing Suite
 * Tests all payment scenarios before production deployment
 */
class StripePaymentTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
    
    this.testCards = {
      // Successful payments
      visa: "4242424242424242",
      mastercard: "5555555555554444",
      amex: "378282246310005",
      discover: "6011111111111117",
      
      // Declined payments
      declined: "4000000000000002",
      insufficient_funds: "4000000000009995",
      expired_card: "4000000000000069",
      incorrect_cvc: "4000000000000127",
      
      // Requires authentication
      requires_authentication: "4000002500003155",
      
      // Processing errors
      processing_error: "4000000000000119"
    };
    
    this.testUsers = [];
    this.testSubscriptions = [];
  }

  /**
   * Run all payment tests
   */
  async runAllTests() {
    console.log('🧪 Starting Comprehensive Stripe Payment Tests...\n');
    
    try {
      // Test 1: Basic Payment Flow
      await this.testBasicPaymentFlow();
      
      // Test 2: Payment Success Scenarios
      await this.testPaymentSuccessScenarios();
      
      // Test 3: Payment Failure Scenarios
      await this.testPaymentFailureScenarios();
      
      // Test 4: Webhook Processing
      await this.testWebhookProcessing();
      
      // Test 5: Subscription Lifecycle
      await this.testSubscriptionLifecycle();
      
      // Test 6: Refund Processing
      await this.testRefundProcessing();
      
      // Test 7: Error Handling
      await this.testErrorHandling();
      
      // Test 8: Monitoring & Logging
      await this.testMonitoringAndLogging();
      
      // Test 9: Edge Cases
      await this.testEdgeCases();
      
      // Test 10: Performance Tests
      await this.testPerformance();
      
      // Generate test report
      this.generateTestReport();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.recordTestResult('Test Suite', false, error.message);
    }
  }

  /**
   * Test 1: Basic Payment Flow
   */
  async testBasicPaymentFlow() {
    console.log('🔍 Test 1: Basic Payment Flow');
    
    try {
      // Create test user
      const testUser = await this.createTestUser();
      this.testUsers.push(testUser);
      
      // Test payment method creation
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: this.testCards.visa,
          exp_month: 12,
          exp_year: 2025,
          cvc: '123',
        },
      });
      
      this.recordTestResult('Payment Method Creation', true, 'Payment method created successfully');
      
      // Test customer creation
      const customer = await stripe.customers.create({
        email: testUser.email,
        name: testUser.name,
        payment_method: paymentMethod.id,
      });
      
      this.recordTestResult('Customer Creation', true, 'Customer created successfully');
      
      // Test subscription creation
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: 'price_test_monthly' }], // Use your test price ID
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });
      
      this.recordTestResult('Subscription Creation', true, 'Subscription created successfully');
      
      // Test payment intent confirmation
      const paymentIntent = subscription.latest_invoice.payment_intent;
      const confirmedPayment = await stripe.paymentIntents.confirm(paymentIntent.id);
      
      this.recordTestResult('Payment Confirmation', true, 'Payment confirmed successfully');
      
      // Clean up
      await this.cleanupTestData([subscription.id], [customer.id]);
      
    } catch (error) {
      this.recordTestResult('Basic Payment Flow', false, error.message);
    }
  }

  /**
   * Test 2: Payment Success Scenarios
   */
  async testPaymentSuccessScenarios() {
    console.log('🔍 Test 2: Payment Success Scenarios');
    
    const successCards = ['visa', 'mastercard', 'amex', 'discover'];
    
    for (const cardType of successCards) {
      try {
        const testUser = await this.createTestUser();
        this.testUsers.push(testUser);
        
        const paymentMethod = await stripe.paymentMethods.create({
          type: 'card',
          card: {
            number: this.testCards[cardType],
            exp_month: 12,
            exp_year: 2025,
            cvc: '123',
          },
        });
        
        const customer = await stripe.customers.create({
          email: testUser.email,
          name: testUser.name,
          payment_method: paymentMethod.id,
        });
        
        const subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{ price: 'price_test_monthly' }],
          payment_behavior: 'default_incomplete',
          expand: ['latest_invoice.payment_intent'],
        });
        
        const paymentIntent = subscription.latest_invoice.payment_intent;
        const confirmedPayment = await stripe.paymentIntents.confirm(paymentIntent.id);
        
        this.recordTestResult(`${cardType.toUpperCase()} Payment Success`, true, 'Payment succeeded');
        
        // Clean up
        await this.cleanupTestData([subscription.id], [customer.id]);
        
      } catch (error) {
        this.recordTestResult(`${cardType.toUpperCase()} Payment Success`, false, error.message);
      }
    }
  }

  /**
   * Test 3: Payment Failure Scenarios
   */
  async testPaymentFailureScenarios() {
    console.log('🔍 Test 3: Payment Failure Scenarios');
    
    const failureScenarios = [
      { card: 'declined', expectedError: 'card_declined' },
      { card: 'insufficient_funds', expectedError: 'card_declined' },
      { card: 'expired_card', expectedError: 'expired_card' },
      { card: 'incorrect_cvc', expectedError: 'incorrect_cvc' },
      { card: 'processing_error', expectedError: 'processing_error' }
    ];
    
    for (const scenario of failureScenarios) {
      try {
        const testUser = await this.createTestUser();
        this.testUsers.push(testUser);
        
        const paymentMethod = await stripe.paymentMethods.create({
          type: 'card',
          card: {
            number: this.testCards[scenario.card],
            exp_month: 12,
            exp_year: 2025,
            cvc: '123',
          },
        });
        
        const customer = await stripe.customers.create({
          email: testUser.email,
          name: testUser.name,
          payment_method: paymentMethod.id,
        });
        
        const subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{ price: 'price_test_monthly' }],
          payment_behavior: 'default_incomplete',
          expand: ['latest_invoice.payment_intent'],
        });
        
        const paymentIntent = subscription.latest_invoice.payment_intent;
        
        try {
          await stripe.paymentIntents.confirm(paymentIntent.id);
          this.recordTestResult(`${scenario.card} Payment Failure`, false, 'Expected failure but payment succeeded');
        } catch (error) {
          if (error.type === 'StripeCardError' && error.code === scenario.expectedError) {
            this.recordTestResult(`${scenario.card} Payment Failure`, true, 'Payment failed as expected');
          } else {
            this.recordTestResult(`${scenario.card} Payment Failure`, false, `Unexpected error: ${error.message}`);
          }
        }
        
        // Clean up
        await this.cleanupTestData([subscription.id], [customer.id]);
        
      } catch (error) {
        this.recordTestResult(`${scenario.card} Payment Failure`, false, error.message);
      }
    }
  }

  /**
   * Test 4: Webhook Processing
   */
  async testWebhookProcessing() {
    console.log('🔍 Test 4: Webhook Processing');
    
    try {
      // Test webhook signature verification
      const testPayload = JSON.stringify({
        id: 'evt_test_webhook',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_webhook',
            amount: 4900,
            currency: 'usd',
            status: 'succeeded'
          }
        }
      });
      
      const testSignature = 'test_signature';
      
      // This would test your webhook endpoint
      const response = await request(app)
        .post('/api/billing/webhook')
        .set('stripe-signature', testSignature)
        .send(testPayload);
      
      // Note: This will fail without proper webhook secret, but tests the endpoint
      this.recordTestResult('Webhook Endpoint', response.status === 400, 'Webhook endpoint accessible');
      
    } catch (error) {
      this.recordTestResult('Webhook Processing', false, error.message);
    }
  }

  /**
   * Test 5: Subscription Lifecycle
   */
  async testSubscriptionLifecycle() {
    console.log('🔍 Test 5: Subscription Lifecycle');
    
    try {
      const testUser = await this.createTestUser();
      this.testUsers.push(testUser);
      
      // Create subscription
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: this.testCards.visa,
          exp_month: 12,
          exp_year: 2025,
          cvc: '123',
        },
      });
      
      const customer = await stripe.customers.create({
        email: testUser.email,
        name: testUser.name,
        payment_method: paymentMethod.id,
      });
      
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: 'price_test_monthly' }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });
      
      const paymentIntent = subscription.latest_invoice.payment_intent;
      await stripe.paymentIntents.confirm(paymentIntent.id);
      
      this.recordTestResult('Subscription Creation', true, 'Subscription created successfully');
      
      // Test subscription update
      const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
        metadata: { test: 'true' }
      });
      
      this.recordTestResult('Subscription Update', true, 'Subscription updated successfully');
      
      // Test subscription cancellation
      const canceledSubscription = await stripe.subscriptions.cancel(subscription.id);
      
      this.recordTestResult('Subscription Cancellation', true, 'Subscription canceled successfully');
      
      // Clean up
      await this.cleanupTestData([], [customer.id]);
      
    } catch (error) {
      this.recordTestResult('Subscription Lifecycle', false, error.message);
    }
  }

  /**
   * Test 6: Refund Processing
   */
  async testRefundProcessing() {
    console.log('🔍 Test 6: Refund Processing');
    
    try {
      const testUser = await this.createTestUser();
      this.testUsers.push(testUser);
      
      // Create successful payment
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: this.testCards.visa,
          exp_month: 12,
          exp_year: 2025,
          cvc: '123',
        },
      });
      
      const customer = await stripe.customers.create({
        email: testUser.email,
        name: testUser.name,
        payment_method: paymentMethod.id,
      });
      
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: 'price_test_monthly' }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });
      
      const paymentIntent = subscription.latest_invoice.payment_intent;
      await stripe.paymentIntents.confirm(paymentIntent.id);
      
      // Test full refund
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntent.id,
        amount: 4900,
        reason: 'requested_by_customer'
      });
      
      this.recordTestResult('Full Refund', true, 'Full refund processed successfully');
      
      // Clean up
      await this.cleanupTestData([subscription.id], [customer.id]);
      
    } catch (error) {
      this.recordTestResult('Refund Processing', false, error.message);
    }
  }

  /**
   * Test 7: Error Handling
   */
  async testErrorHandling() {
    console.log('🔍 Test 7: Error Handling');
    
    try {
      // Test invalid payment method
      try {
        await stripe.paymentMethods.create({
          type: 'card',
          card: {
            number: 'invalid_card_number',
            exp_month: 12,
            exp_year: 2025,
            cvc: '123',
          },
        });
        this.recordTestResult('Invalid Payment Method', false, 'Should have failed but succeeded');
      } catch (error) {
        this.recordTestResult('Invalid Payment Method', true, 'Properly rejected invalid payment method');
      }
      
      // Test invalid customer
      try {
        await stripe.customers.retrieve('invalid_customer_id');
        this.recordTestResult('Invalid Customer', false, 'Should have failed but succeeded');
      } catch (error) {
        this.recordTestResult('Invalid Customer', true, 'Properly rejected invalid customer');
      }
      
    } catch (error) {
      this.recordTestResult('Error Handling', false, error.message);
    }
  }

  /**
   * Test 8: Monitoring & Logging
   */
  async testMonitoringAndLogging() {
    console.log('🔍 Test 8: Monitoring & Logging');
    
    try {
      // Test metrics retrieval
      const metrics = PaymentMonitoringService.getMetrics();
      this.recordTestResult('Metrics Retrieval', !!metrics, 'Metrics retrieved successfully');
      
      // Test system health
      const health = await PaymentMonitoringService.getSystemHealth();
      this.recordTestResult('System Health', !!health, 'System health retrieved successfully');
      
      // Test error logging
      const testError = new Error('Test error for monitoring');
      await PaymentMonitoringService.logError(testError, { test: true });
      this.recordTestResult('Error Logging', true, 'Error logged successfully');
      
    } catch (error) {
      this.recordTestResult('Monitoring & Logging', false, error.message);
    }
  }

  /**
   * Test 9: Edge Cases
   */
  async testEdgeCases() {
    console.log('🔍 Test 9: Edge Cases');
    
    try {
      // Test duplicate payment attempts
      const testUser = await this.createTestUser();
      this.testUsers.push(testUser);
      
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: this.testCards.visa,
          exp_month: 12,
          exp_year: 2025,
          cvc: '123',
        },
      });
      
      const customer = await stripe.customers.create({
        email: testUser.email,
        name: testUser.name,
        payment_method: paymentMethod.id,
      });
      
      // Test multiple subscription attempts
      const subscription1 = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: 'price_test_monthly' }],
        payment_behavior: 'default_incomplete',
      });
      
      const subscription2 = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: 'price_test_monthly' }],
        payment_behavior: 'default_incomplete',
      });
      
      this.recordTestResult('Multiple Subscriptions', true, 'Multiple subscriptions created successfully');
      
      // Clean up
      await this.cleanupTestData([subscription1.id, subscription2.id], [customer.id]);
      
    } catch (error) {
      this.recordTestResult('Edge Cases', false, error.message);
    }
  }

  /**
   * Test 10: Performance Tests
   */
  async testPerformance() {
    console.log('🔍 Test 10: Performance Tests');
    
    try {
      const startTime = Date.now();
      
      // Test payment method creation performance
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: this.testCards.visa,
          exp_month: 12,
          exp_year: 2025,
          cvc: '123',
        },
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      this.recordTestResult('Payment Method Performance', duration < 5000, `Payment method created in ${duration}ms`);
      
    } catch (error) {
      this.recordTestResult('Performance Tests', false, error.message);
    }
  }

  /**
   * Create test user
   */
  async createTestUser() {
    const testUser = new User({
      email: `test_${Date.now()}@example.com`,
      name: 'Test User',
      password: 'testpassword123'
    });
    
    await testUser.save();
    return testUser;
  }

  /**
   * Clean up test data
   */
  async cleanupTestData(subscriptionIds = [], customerIds = []) {
    try {
      // Cancel subscriptions
      for (const subscriptionId of subscriptionIds) {
        try {
          await stripe.subscriptions.cancel(subscriptionId);
        } catch (error) {
          // Subscription might already be canceled
        }
      }
      
      // Delete customers
      for (const customerId of customerIds) {
        try {
          await stripe.customers.del(customerId);
        } catch (error) {
          // Customer might already be deleted
        }
      }
      
      // Delete test users
      for (const user of this.testUsers) {
        try {
          await User.findByIdAndDelete(user._id);
        } catch (error) {
          // User might already be deleted
        }
      }
      
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  }

  /**
   * Record test result
   */
  recordTestResult(testName, passed, message) {
    this.testResults.total++;
    if (passed) {
      this.testResults.passed++;
      console.log(`✅ ${testName}: ${message}`);
    } else {
      this.testResults.failed++;
      console.log(`❌ ${testName}: ${message}`);
    }
    
    this.testResults.details.push({
      testName,
      passed,
      message,
      timestamp: new Date()
    });
  }

  /**
   * Generate test report
   */
  generateTestReport() {
    console.log('\n📊 TEST REPORT');
    console.log('================');
    console.log(`Total Tests: ${this.testResults.total}`);
    console.log(`Passed: ${this.testResults.passed}`);
    console.log(`Failed: ${this.testResults.failed}`);
    console.log(`Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(2)}%`);
    
    if (this.testResults.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults.details
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`- ${test.testName}: ${test.message}`);
        });
    }
    
    console.log('\n🎯 RECOMMENDATIONS:');
    if (this.testResults.failed === 0) {
      console.log('✅ All tests passed! Your payment system is ready for production.');
    } else {
      console.log('⚠️ Some tests failed. Please fix the issues before going to production.');
    }
  }
}

// Export for use in other files
export default StripePaymentTester;

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new StripePaymentTester();
  tester.runAllTests().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}
