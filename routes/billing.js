import express from "express";
import SecureBillingController from "../controllers/SecureBillingController.js";
import WebhookController from "../controllers/WebhookController.js";
import RefundProcessor from "../services/RefundProcessor.js";
import PaymentMonitoringService from "../services/PaymentMonitoringService.js";
import { authenticateToken, optionalAuth } from "../middleware/auth.js";
import rateLimit from "express-rate-limit";

// Rate limiting for billing endpoints
const billingRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: "Too many billing attempts",
    userFriendly: {
      title: "Too Many Attempts",
      message:
        "Please wait before trying again. This helps keep your account secure.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const secureBilling = new SecureBillingController();

const router = express.Router();

// Public routes
router.get("/plans", secureBilling.getPlans.bind(secureBilling));

// Secure multi-subscription routes
router.post(
  "/subscribe",
  optionalAuth,
  billingRateLimit,
  secureBilling.processSubscription.bind(secureBilling)
);
router.post(
  "/add-subscription",
  optionalAuth, // Use optional auth to handle invalid tokens gracefully
  billingRateLimit,
  secureBilling.processSubscription.bind(secureBilling)
);

// Subscription management routes
router.get(
  "/subscriptions",
  authenticateToken,
  secureBilling.getSubscriptions.bind(secureBilling)
);
router.get(
  "/subscription",
  authenticateToken,
  secureBilling.getSubscription.bind(secureBilling)
);
router.post(
  "/subscription/:subscriptionId/cancel",
  authenticateToken,
  secureBilling.cancelSubscription.bind(secureBilling)
);

// Billing information routes
router.get("/history", authenticateToken, secureBilling.getBillingHistory.bind(secureBilling));
router.get("/usage", authenticateToken, secureBilling.getUsageStats.bind(secureBilling));

// Refund routes
router.post("/refund/full/:subscriptionId", authenticateToken, async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { reason, adminNotes } = req.body;
    
    const result = await RefundProcessor.processRefundWithErrorHandling(
      subscriptionId, 
      'full', 
      null, 
      reason, 
      adminNotes
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/refund/partial/:subscriptionId", authenticateToken, async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { amount, reason, adminNotes } = req.body;
    
    const result = await RefundProcessor.processRefundWithErrorHandling(
      subscriptionId, 
      'partial', 
      amount, 
      reason, 
      adminNotes
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/refund/prorated/:subscriptionId", authenticateToken, async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { reason, adminNotes } = req.body;
    
    const result = await RefundProcessor.processRefundWithErrorHandling(
      subscriptionId, 
      'prorated', 
      null, 
      reason, 
      adminNotes
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/refunds/:subscriptionId", authenticateToken, async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const refunds = await RefundProcessor.getSubscriptionRefunds(subscriptionId);
    res.json({ success: true, refunds });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/refunds", authenticateToken, async (req, res) => {
  try {
    const refunds = await RefundProcessor.getUserRefunds(req.user.id);
    res.json({ success: true, refunds });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/refund/status/:refundId", authenticateToken, async (req, res) => {
  try {
    const { refundId } = req.params;
    const status = await RefundProcessor.getRefundStatus(refundId);
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/refund/cancel/:refundId", authenticateToken, async (req, res) => {
  try {
    const { refundId } = req.params;
    const result = await RefundProcessor.cancelRefund(refundId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Monitoring and analytics routes
router.get("/metrics", authenticateToken, async (req, res) => {
  try {
    const metrics = PaymentMonitoringService.getMetrics();
    res.json({ success: true, metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/analytics", authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const analytics = await PaymentMonitoringService.getPaymentAnalytics(startDate, endDate);
    res.json({ success: true, analytics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/health", async (req, res) => {
  try {
    const health = await PaymentMonitoringService.getSystemHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ 
      timestamp: new Date(),
      status: 'error',
      error: error.message 
    });
  }
});

router.get("/history/:userId", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const history = await PaymentMonitoringService.getUserPaymentHistory(userId);
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook endpoint for Stripe - Production Ready
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  WebhookController.handleWebhook.bind(WebhookController)
);

export default router;
