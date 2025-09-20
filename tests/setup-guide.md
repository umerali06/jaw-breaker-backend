# 🚀 Stripe Payment System Setup Guide

Follow this guide to set up your Stripe payment system for testing and production.

## 📋 Prerequisites

### 1. Stripe Account Setup
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Create a Stripe account if you don't have one
3. Complete account verification
4. Switch to **Test mode** for development

### 2. Enable Raw Card Data APIs
1. In Stripe Dashboard, go to **Settings** → **API keys**
2. Scroll down to **Raw card data APIs**
3. Click **Enable** for testing
4. This allows you to test with raw card numbers

### 3. Get Your API Keys
1. In Stripe Dashboard, go to **Developers** → **API keys**
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)

## 🔧 Environment Setup

### 1. Create Environment File
Create a `.env` file in your server directory:

```bash
# Copy from env.example
cp env.example .env
```

### 2. Configure Environment Variables
Edit your `.env` file with your Stripe keys:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_actual_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Other required variables
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/jawbreaker
JWT_SECRET_KEY=your_jwt_secret_here
```

### 3. Get Webhook Secret
1. Install Stripe CLI: `choco install stripe-cli` (Windows) or `brew install stripe/stripe-cli/stripe` (macOS)
2. Login: `stripe login`
3. Start webhook forwarding: `stripe listen --forward-to localhost:5000/api/billing/webhook`
4. Copy the webhook secret from the CLI output (starts with `whsec_`)

## 🧪 Testing Setup

### 1. Start Your Application
```bash
# Install dependencies
npm install

# Start the server
npm start
```

### 2. Run Quick Test
```bash
# Test basic functionality
node tests/quick-test.js
```

### 3. Run Webhook Test
```bash
# Test webhook endpoint
node tests/webhook-test.js
```

### 4. Run Comprehensive Test
```bash
# Run full test suite
node tests/stripe-payment-test.js
```

## 🔍 Manual Testing

### 1. Test Cards
Use these test card numbers:

| Card Type | Number | Expected Result |
|-----------|--------|----------------|
| **Visa** | `4242424242424242` | ✅ Payment succeeds |
| **Mastercard** | `5555555555554444` | ✅ Payment succeeds |
| **American Express** | `378282246310005` | ✅ Payment succeeds |
| **Declined** | `4000000000000002` | ❌ Payment declined |
| **Insufficient Funds** | `4000000000009995` | ❌ Insufficient funds |

### 2. Test Payment Flow
1. Go to your payment form
2. Enter test card details
3. Submit payment
4. Verify payment processing
5. Check webhook events in Stripe CLI

### 3. Test Webhook Processing
1. Make a payment
2. Check Stripe CLI for webhook events
3. Verify events are processed correctly
4. Check database for subscription records

## 🚨 Troubleshooting

### Issue: Raw Card Data API Not Enabled
**Error**: "Sending credit card numbers directly to the Stripe API is generally unsafe"
**Solution**: Enable raw card data APIs in Stripe Dashboard

### Issue: Webhook Secret Not Set
**Error**: "STRIPE_WEBHOOK_SECRET not configured"
**Solution**: Set the webhook secret in your `.env` file

### Issue: Webhook Endpoint Not Accessible
**Error**: "Webhook endpoint not accessible"
**Solution**: Make sure your server is running on the correct port

### Issue: Payment Succeeds But No Access
**Solution**: Check webhook processing and payment verification

## 📊 Expected Test Results

### Quick Test Results
```
✅ Stripe API Connection: Connected
✅ Payment Method Creation: Created
✅ Customer Creation: Created
✅ Environment Variables: All set
✅ Card Validation: All cards tested
✅ Webhook Endpoint: Accessible
✅ Health Endpoint: Healthy
```

### Comprehensive Test Results
```
✅ Basic Payment Flow: Passed
✅ Payment Success Scenarios: Passed
✅ Payment Failure Scenarios: Passed
✅ Webhook Processing: Passed
✅ Subscription Lifecycle: Passed
✅ Refund Processing: Passed
✅ Error Handling: Passed
✅ Monitoring & Logging: Passed
```

## 🚀 Production Deployment

### 1. Switch to Live Mode
1. In Stripe Dashboard, switch to **Live mode**
2. Get your live API keys
3. Update environment variables

### 2. Configure Production Webhook
1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Add endpoint: `https://yourdomain.com/api/billing/webhook`
3. Select events: All payment and subscription events
4. Copy webhook secret

### 3. Update Environment Variables
```bash
STRIPE_SECRET_KEY=sk_live_your_live_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret
NODE_ENV=production
```

### 4. Deploy and Monitor
1. Deploy to production
2. Monitor payment success rate
3. Check webhook processing
4. Monitor error logs

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Stripe documentation
3. Check your environment variables
4. Verify webhook configuration
5. Monitor error logs

## 🎯 Success Criteria

Your payment system is ready when:
- [ ] All tests pass
- [ ] Webhook events are processed
- [ ] Payments succeed and grant access
- [ ] Error handling works correctly
- [ ] Monitoring is functional
- [ ] Refunds can be processed

---

**Remember**: Always test thoroughly before going to production!
