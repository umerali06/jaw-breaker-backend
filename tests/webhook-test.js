#!/usr/bin/env node

/**
 * Webhook Endpoint Test
 * Tests the webhook endpoint without requiring Stripe CLI
 */

import fetch from 'node-fetch';

const WEBHOOK_URL = 'http://localhost:5000/api/billing/webhook';

console.log('🧪 Testing Webhook Endpoint');
console.log('============================\n');

async function testWebhookEndpoint() {
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
    // Test 1: Webhook endpoint accessibility
    console.log('🔍 Testing webhook endpoint accessibility...');
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'test_signature'
        },
        body: JSON.stringify({ test: true })
      });
      
      // We expect a 400 error due to invalid signature, which is correct
      test('Webhook Endpoint Accessible', response.status === 400, 
        `Endpoint accessible (status: ${response.status})`);
    } catch (error) {
      test('Webhook Endpoint Accessible', false, `Not accessible: ${error.message}`);
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

    // Test 3: Metrics endpoint
    console.log('\n🔍 Testing metrics endpoint...');
    try {
      const response = await fetch('http://localhost:5000/api/billing/metrics');
      test('Metrics Endpoint', response.status === 401 || response.ok, 
        `Metrics endpoint accessible (status: ${response.status})`);
    } catch (error) {
      test('Metrics Endpoint', false, `Not accessible: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    results.failed++;
    results.total++;
  }

  // Generate report
  console.log('\n📊 WEBHOOK TEST REPORT');
  console.log('========================');
  console.log(`Total Tests: ${results.total}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(2)}%`);

  if (results.failed === 0) {
    console.log('\n🎉 All webhook tests passed!');
  } else {
    console.log('\n⚠️ Some webhook tests failed.');
  }

  return results;
}

// Run the test
testWebhookEndpoint().then(results => {
  process.exit(results.failed > 0 ? 1 : 0);
}).catch(error => {
  console.error('Webhook test failed:', error);
  process.exit(1);
});
