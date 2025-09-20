import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
    },
    stripeInvoiceId: {
      type: String,
      required: true,
      unique: true,
    },
    stripeCustomerId: {
      type: String,
      required: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "usd",
    },
    status: {
      type: String,
      required: true,
      enum: ["draft", "open", "paid", "void", "uncollectible"],
      default: "open",
    },
    description: {
      type: String,
      required: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    dueDate: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
    attemptedAt: {
      type: Date,
    },
    nextPaymentAttempt: {
      type: Date,
    },
    hostedInvoiceUrl: {
      type: String,
    },
    invoicePdf: {
      type: String,
    },
    lineItems: [
      {
        description: {
          type: String,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
        quantity: {
          type: Number,
          default: 1,
        },
        planId: {
          type: String,
        },
      },
    ],
    discounts: [
      {
        couponId: String,
        amount: Number,
        percentage: Number,
        description: String,
      },
    ],
    tax: {
      amount: {
        type: Number,
        default: 0,
      },
      rate: {
        type: Number,
        default: 0,
      },
      description: String,
    },
    subtotal: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    amountRemaining: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: {
        type: String,
        enum: ["card", "bank_account", "ach", "wire"],
      },
      last4: String,
      brand: String,
      expMonth: Number,
      expYear: Number,
    },
    billingAddress: {
      name: String,
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    metadata: {
      type: Map,
      of: String,
      default: {},
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
invoiceSchema.index({ userId: 1, status: 1 });
invoiceSchema.index({ subscriptionId: 1 });
invoiceSchema.index({ stripeInvoiceId: 1 });
invoiceSchema.index({ createdAt: -1 });

// Virtual for checking if invoice is overdue
invoiceSchema.virtual("isOverdue").get(function () {
  return this.status === "open" && this.dueDate && new Date() > this.dueDate;
});

// Virtual for days overdue
invoiceSchema.virtual("daysOverdue").get(function () {
  if (!this.isOverdue) return 0;
  const now = new Date();
  const dueDate = new Date(this.dueDate);
  const diffTime = now - dueDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Method to mark invoice as paid
invoiceSchema.methods.markAsPaid = function (paymentDate = new Date()) {
  this.status = "paid";
  this.paidAt = paymentDate;
  this.amountPaid = this.total;
  this.amountRemaining = 0;
  return this.save();
};

// Method to add payment attempt
invoiceSchema.methods.recordPaymentAttempt = function (nextAttempt = null) {
  this.attemptedAt = new Date();
  if (nextAttempt) {
    this.nextPaymentAttempt = nextAttempt;
  }
  return this.save();
};

// Static method to find overdue invoices
invoiceSchema.statics.findOverdue = function () {
  return this.find({
    status: "open",
    dueDate: { $lt: new Date() },
  });
};

// Static method to find invoices for user
invoiceSchema.statics.findForUser = function (userId, limit = 10) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("subscriptionId", "planName planId");
};

// Static method to calculate total revenue
invoiceSchema.statics.calculateRevenue = function (startDate, endDate) {
  const matchStage = {
    status: "paid",
    paidAt: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$amountPaid" },
        invoiceCount: { $sum: 1 },
        averageInvoiceAmount: { $avg: "$amountPaid" },
      },
    },
  ]);
};

// Pre-save middleware to calculate totals
invoiceSchema.pre("save", function (next) {
  // Calculate subtotal from line items
  this.subtotal = this.lineItems.reduce((sum, item) => {
    return sum + item.amount * item.quantity;
  }, 0);

  // Apply discounts
  let discountAmount = 0;
  this.discounts.forEach((discount) => {
    if (discount.percentage) {
      discountAmount += this.subtotal * (discount.percentage / 100);
    } else if (discount.amount) {
      discountAmount += discount.amount;
    }
  });

  // Calculate total
  this.total = this.subtotal - discountAmount + (this.tax.amount || 0);
  this.amountRemaining = this.total - this.amountPaid;

  next();
});

const Invoice = mongoose.model("Invoice", invoiceSchema);

export default Invoice;
