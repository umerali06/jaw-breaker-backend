#!/usr/bin/env node

/**
 * Mock Webhook Test
 * Tests webhook functionality without requiring Stripe CLI
 */

import fetch from 'node-fetch';
import crypto from 'crypto';

const WEBHOOK_URL = 'http://localhost:5000/api/billing/webhook';
const MOCK_WEBHOOK_SECRET = 'whsec_test_mock_secret_for_testing';

console.log('🧪 Mock Webhook Test');
console.log('===================\n');

async function testWebhookWithMockSecret() {
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
    // Test 1: Webhook endpoint with mock signature
    console.log('🔍 Testing webhook endpoint with mock signature...');
    try {
      const payload = JSON.stringify({
        id: 'evt_test_webhook',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_payment_intent',
            amount: 2000,
            currency: 'usd',
            status: 'succeeded'
          }
        }
      });

      const signature = `t=${Math.floor(Date.now() / 1000)},v1=${crypto.createHmac('sha256', MOCK_WEBHOOK_SECRET).update(payload).digest('hex')}`;

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': signature
        },
        body: payload
      });

      // We expect a 400 error due to invalid signature, which is correct
      test('Webhook Endpoint with Mock Signature', response.status === 400, 
        `Endpoint accessible (status: ${response.status})`);
    } catch (error) {
      test('Webhook Endpoint with Mock Signature', false, `Not accessible: ${error.message}`);
    }

    // Test 2: Health endpoint
    console.log('\n🔍 Testing health endpoint...');
    try {
      const response = await fetch('http://localhost:5000/api/billing/health');
      const health = await response.json();
      test('Health Endpoint', response.ok, 
        `Health check: ${health.status || 'unknown'}`);
    } catch (error) {
      test('Health Endpoint', false, `Not accessible: ${error.message}`);
    }

    // Test 3: Test payment endpoint
    console.log('\n🔍 Testing payment endpoint...');
    try {
      const response = await fetch('http://localhost:5000/api/billing/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          planId: 'test_plan',
          paymentMethod: {
            type: 'card',
            card: {
              number: '4242424242424242',
              exp_month: 12,
              exp_year: 2025,
              cvc: '123'
            }
          }
        })
      });
      
      // We expect a 400 error due to missing auth, which is correct
      test('Payment Endpoint', response.status === 400 || response.status === 401, 
        `Payment endpoint accessible (status: ${response.status})`);
    } catch (error) {
      test('Payment Endpoint', false, `Not accessible: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    results.failed++;
    results.total++;
  }

  // Generate report
  console.log('\n📊 MOCK WEBHOOK TEST REPORT');
  console.log('============================');
  console.log(`Total Tests: ${results.total}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(2)}%`);

  if (results.failed === 0) {
    console.log('\n🎉 All mock webhook tests passed!');
  } else {
    console.log('\n⚠️ Some mock webhook tests failed.');
  }

  return results;
}

// Run the test
testWebhookWithMockSecret().then(results => {
  process.exit(results.failed > 0 ? 1 : 0);
}).catch(error => {
  console.error('Mock webhook test failed:', error);
  process.exit(1);
});
