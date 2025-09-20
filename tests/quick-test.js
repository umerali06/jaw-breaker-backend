#!/usr/bin/env node

/**
 * Quick Stripe Payment System Test
 * Run this to quickly verify your payment system is working
 */

import Stripe from "stripe";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

console.log('🧪 Quick Stripe Payment System Test');
console.log('=====================================\n');

async function quickTest() {
  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };

  function test(name, condition, message) {
    results.total++;
    if (condition) {
      results.passed++;
      console.log(`✅ ${name}: ${message}`);
    } else {
      results.failed++;
      console.log(`❌ ${name}: ${message}`);
    }
  }

  try {
    // Test 1: Stripe API Connection
    console.log('🔍 Testing Stripe API Connection...');
    try {
      const account = await stripe.accounts.retrieve();
      test('Stripe API Connection', true, `Connected to account: ${account.id}`);
    } catch (error) {
      test('Stripe API Connection', false, `Failed to connect: ${error.message}`);
      return;
    }

    // Test 2: Payment Method Creation
    console.log('\n🔍 Testing Payment Method Creation...');
    try {
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: '4242424242424242',
          exp_month: 12,
          exp_year: 2025,
          cvc: '123',
        },
      });
      test('Payment Method Creation', true, `Created: ${paymentMethod.id}`);
    } catch (error) {
      test('Payment Method Creation', false, `Failed: ${error.message}`);
    }

    // Test 3: Customer Creation
    console.log('\n🔍 Testing Customer Creation...');
    try {
      const customer = await stripe.customers.create({
        email: 'test@example.com',
        name: 'Test Customer',
      });
      test('Customer Creation', true, `Created: ${customer.id}`);
      
      // Clean up
      await stripe.customers.del(customer.id);
    } catch (error) {
      test('Customer Creation', false, `Failed: ${error.message}`);
    }

    // Test 4: Environment Variables
    console.log('\n🔍 Testing Environment Variables...');
    test('STRIPE_SECRET_KEY', !!process.env.STRIPE_SECRET_KEY, 
      process.env.STRIPE_SECRET_KEY ? 'Set' : 'Not set');
    test('STRIPE_PUBLISHABLE_KEY', !!process.env.STRIPE_PUBLISHABLE_KEY, 
      process.env.STRIPE_PUBLISHABLE_KEY ? 'Set' : 'Not set');
    test('STRIPE_WEBHOOK_SECRET', !!process.env.STRIPE_WEBHOOK_SECRET, 
      process.env.STRIPE_WEBHOOK_SECRET ? 'Set' : 'Not set');

    // Test 5: Test Card Validation
    console.log('\n🔍 Testing Card Validation...');
    const testCards = [
      { name: 'Visa', number: '4242424242424242', expected: 'success' },
      { name: 'Mastercard', number: '5555555555554444', expected: 'success' },
      { name: 'Declined', number: '4000000000000002', expected: 'declined' },
      { name: 'Insufficient Funds', number: '4000000000009995', expected: 'declined' }
    ];

    for (const card of testCards) {
      try {
        const paymentMethod = await stripe.paymentMethods.create({
          type: 'card',
          card: {
            number: card.number,
            exp_month: 12,
            exp_year: 2025,
            cvc: '123',
          },
        });
        test(`${card.name} Card`, true, 'Payment method created');
      } catch (error) {
        if (card.expected === 'declined' && error.type === 'StripeCardError') {
          test(`${card.name} Card`, true, 'Properly declined as expected');
        } else {
          test(`${card.name} Card`, false, `Unexpected error: ${error.message}`);
        }
      }
    }

    // Test 6: Webhook Endpoint (if running)
    console.log('\n🔍 Testing Webhook Endpoint...');
    try {
      const response = await fetch('http://localhost:5000/api/billing/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'test_signature'
        },
        body: JSON.stringify({ test: true })
      });
      
      // We expect a 400 error due to invalid signature, which is correct
      test('Webhook Endpoint', response.status === 400, 
        `Endpoint accessible (status: ${response.status})`);
    } catch (error) {
      test('Webhook Endpoint', false, `Not accessible: ${error.message}`);
    }

    // Test 7: Health Endpoint (if running)
    console.log('\n🔍 Testing Health Endpoint...');
    try {
      const response = await fetch('http://localhost:5000/api/billing/health');
      const health = await response.json();
      test('Health Endpoint', response.ok, 
        `Health check: ${health.status || 'unknown'}`);
    } catch (error) {
      test('Health Endpoint', false, `Not accessible: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Test suite failed:', error);
    results.failed++;
    results.total++;
  }

  // Generate report
  console.log('\n📊 TEST REPORT');
  console.log('================');
  console.log(`Total Tests: ${results.total}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(2)}%`);

  if (results.failed === 0) {
    console.log('\n🎉 All tests passed! Your payment system is ready for testing.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the issues above.');
  }

  return results;
}

// Run the test
quickTest().then(results => {
  process.exit(results.failed > 0 ? 1 : 0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
