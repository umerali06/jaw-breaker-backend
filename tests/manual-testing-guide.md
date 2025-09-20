# 🧪 Manual Stripe Payment Testing Guide

This guide will help you manually test your Stripe payment system before going live.

## 📋 Prerequisites

### 1. Install Stripe CLI
```bash
# Windows (using Chocolatey)
choco install stripe-cli

# macOS (using Homebrew)
brew install stripe/stripe-cli/stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_*_linux_x86_64.tar.gz
tar -xvf stripe_*_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin
```

### 2. Login to Stripe
```bash
stripe login
```

### 3. Set Environment Variables
```bash
# Test environment
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
NODE_ENV=development
```

## 🔧 Test Setup

### 1. Start Webhook Forwarding
```bash
# Forward webhooks to your local server
stripe listen --forward-to localhost:5000/api/billing/webhook
```

### 2. Start Your Application
```bash
# Start your Node.js application
npm start
# or
node server.js
```

## 🧪 Test Scenarios

### Test 1: Successful Payment Flow

#### 1.1 Test with Visa Card
1. Go to your payment form
2. Enter test card: `4242424242424242`
3. Expiry: `12/25`
4. CVC: `123`
5. Submit payment
6. **Expected**: Payment succeeds, user gets access

#### 1.2 Test with Mastercard
1. Use test card: `5555555555554444`
2. **Expected**: Payment succeeds

#### 1.3 Test with American Express
1. Use test card: `378282246310005`
2. **Expected**: Payment succeeds

### Test 2: Payment Failure Scenarios

#### 2.1 Declined Card
1. Use test card: `4000000000000002`
2. **Expected**: Payment fails with "Your card was declined" message

#### 2.2 Insufficient Funds
1. Use test card: `4000000000009995`
2. **Expected**: Payment fails with "Insufficient funds" message

#### 2.3 Expired Card
1. Use test card: `4000000000000069`
2. **Expected**: Payment fails with "Card expired" message

#### 2.4 Incorrect CVC
1. Use test card: `4000000000000127`
2. **Expected**: Payment fails with "Incorrect CVC" message

### Test 3: Webhook Processing

#### 3.1 Test Webhook Events
1. Make a successful payment
2. Check Stripe CLI output for webhook events
3. **Expected**: See events like:
   - `payment_intent.succeeded`
   - `customer.subscription.created`
   - `invoice.payment_succeeded`

#### 3.2 Test Webhook Failures
1. Stop your application
2. Make a payment
3. Restart your application
4. **Expected**: Webhook events should be retried

### Test 4: Subscription Management

#### 4.1 Test Subscription Creation
1. Create a new subscription
2. Check database for subscription record
3. **Expected**: Subscription created with correct status

#### 4.2 Test Subscription Updates
1. Update subscription in Stripe Dashboard
2. Check webhook processing
3. **Expected**: Subscription updated in database

#### 4.3 Test Subscription Cancellation
1. Cancel subscription in Stripe Dashboard
2. Check webhook processing
3. **Expected**: Subscription marked as canceled

### Test 5: Refund Processing

#### 5.1 Test Full Refund
1. Make a successful payment
2. Process full refund via API
3. **Expected**: Refund processed successfully

#### 5.2 Test Partial Refund
1. Make a successful payment
2. Process partial refund via API
3. **Expected**: Partial refund processed

### Test 6: Error Handling

#### 6.1 Test Network Errors
1. Disconnect internet during payment
2. **Expected**: Proper error message displayed

#### 6.2 Test Invalid Data
1. Submit payment with invalid email
2. **Expected**: Validation error displayed

### Test 7: Monitoring & Logging

#### 7.1 Test Metrics Endpoint
1. Make several payments
2. Call `/api/billing/metrics`
3. **Expected**: Metrics returned with payment data

#### 7.2 Test Health Endpoint
1. Call `/api/billing/health`
2. **Expected**: System health status returned

## 🔍 Verification Checklist

### Payment Processing
- [ ] Successful payments grant access
- [ ] Failed payments show proper error messages
- [ ] Payment verification works correctly
- [ ] Retry logic functions properly

### Webhook Processing
- [ ] Webhooks are received and processed
- [ ] Signature verification works
- [ ] Duplicate events are handled
- [ ] Failed webhooks are retried

### Subscription Management
- [ ] Subscriptions are created correctly
- [ ] Status updates are processed
- [ ] Cancellations are handled
- [ ] Feature access is managed

### Refund Processing
- [ ] Full refunds work
- [ ] Partial refunds work
- [ ] Prorated refunds work
- [ ] Refund status is tracked

### Error Handling
- [ ] Card errors are handled gracefully
- [ ] Network errors are handled
- [ ] Validation errors are shown
- [ ] System errors are logged

### Monitoring
- [ ] Metrics are collected
- [ ] Alerts are triggered
- [ ] Health checks work
- [ ] Logging is comprehensive

## 🚨 Common Issues & Solutions

### Issue: Webhook not received
**Solution**: Check webhook URL and Stripe CLI forwarding

### Issue: Payment succeeds but no access
**Solution**: Check webhook processing and payment verification

### Issue: Error messages not user-friendly
**Solution**: Check PaymentErrorHandler implementation

### Issue: Refunds not processing
**Solution**: Check RefundProcessor and Stripe API calls

### Issue: Monitoring not working
**Solution**: Check PaymentMonitoringService configuration

## 📊 Test Results Template

```
Test Date: ___________
Tester: ___________
Environment: ___________

Payment Processing:
- [ ] Successful payments: ___/___ tests passed
- [ ] Failed payments: ___/___ tests passed
- [ ] Error handling: ___/___ tests passed

Webhook Processing:
- [ ] Event reception: ___/___ tests passed
- [ ] Event processing: ___/___ tests passed
- [ ] Error handling: ___/___ tests passed

Subscription Management:
- [ ] Creation: ___/___ tests passed
- [ ] Updates: ___/___ tests passed
- [ ] Cancellation: ___/___ tests passed

Refund Processing:
- [ ] Full refunds: ___/___ tests passed
- [ ] Partial refunds: ___/___ tests passed
- [ ] Error handling: ___/___ tests passed

Monitoring & Logging:
- [ ] Metrics collection: ___/___ tests passed
- [ ] Health checks: ___/___ tests passed
- [ ] Error logging: ___/___ tests passed

Overall Result: PASS / FAIL
Ready for Production: YES / NO
```

## 🎯 Production Readiness Checklist

Before going live, ensure:

- [ ] All test scenarios pass
- [ ] Webhook endpoint is configured in Stripe Dashboard
- [ ] Production Stripe keys are set
- [ ] Database is properly configured
- [ ] Monitoring is set up
- [ ] Error handling is comprehensive
- [ ] Logging is enabled
- [ ] Backup procedures are in place
- [ ] Support team is trained
- [ ] Documentation is complete

## 🚀 Going Live

1. **Switch to Production Keys**
   ```bash
   STRIPE_SECRET_KEY=sk_live_xxxxx
   STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   NODE_ENV=production
   ```

2. **Configure Production Webhook**
   - URL: `https://yourdomain.com/api/billing/webhook`
   - Events: All payment and subscription events

3. **Monitor Closely**
   - Check metrics dashboard
   - Monitor error logs
   - Watch for failed payments
   - Verify webhook processing

4. **Have Rollback Plan**
   - Keep test environment ready
   - Have database backup
   - Know how to disable payments quickly
