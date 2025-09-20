import mongoose from "mongoose";

const UserStorageSchema = new mongoose.Schema(
  {
    // User Reference
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // Storage Quota (in bytes)
    quota: {
      total: {
        type: Number,
        default: 1073741824, // 1GB in bytes for nursing premium users
      },
      used: {
        type: Number,
        default: 0,
      },
      available: {
        type: Number,
        default: 1073741824,
      },
      lastCalculated: {
        type: Date,
        default: Date.now,
      },
    },

    // Storage Breakdown by Feature
    storageBreakdown: {
      oasisAssessments: {
        count: { type: Number, default: 0 },
        size: { type: Number, default: 0 },
      },
      soapNotes: {
        count: { type: Number, default: 0 },
        size: { type: Number, default: 0 },
      },
      nursingAssessments: {
        count: { type: Number, default: 0 },
        size: { type: Number, default: 0 },
      },
      medicationRecords: {
        count: { type: Number, default: 0 },
        size: { type: Number, default: 0 },
      },
      progressTracking: {
        count: { type: Number, default: 0 },
        size: { type: Number, default: 0 },
      },
      outcomeMeasures: {
        count: { type: Number, default: 0 },
        size: { type: Number, default: 0 },
      },
      clinicalDecisionSupport: {
        count: { type: Number, default: 0 },
        size: { type: Number, default: 0 },
      },
      carePlans: {
        count: { type: Number, default: 0 },
        size: { type: Number, default: 0 },
      },
      attachments: {
        count: { type: Number, default: 0 },
        size: { type: Number, default: 0 },
      },
    },

    // Data Archiving Settings
    archiving: {
      enabled: {
        type: Boolean,
        default: true,
      },
      autoArchiveAfterDays: {
        type: Number,
        default: 365, // Archive data after 1 year
      },
      compressionLevel: {
        type: Number,
        default: 6, // 1-9, higher = more compression
        min: 1,
        max: 9,
      },
      lastArchiveRun: Date,
      archivedData: {
        count: { type: Number, default: 0 },
        size: { type: Number, default: 0 },
        compressionRatio: { type: Number, default: 0 },
      },
    },

    // Storage Optimization
    optimization: {
      deduplicationEnabled: {
        type: Boolean,
        default: true,
      },
      compressionEnabled: {
        type: Boolean,
        default: true,
      },
      lastOptimizationRun: Date,
      spaceSavedBytes: {
        type: Number,
        default: 0,
      },
      optimizationHistory: [
        {
          date: Date,
          spaceSaved: Number,
          method: String, // 'deduplication', 'compression', 'archiving'
          details: String,
        },
      ],
    },

    // Usage Analytics
    usage: {
      dailyUsage: [
        {
          date: Date,
          bytesAdded: Number,
          bytesRemoved: Number,
          netChange: Number,
          operations: {
            create: Number,
            update: Number,
            delete: Number,
            archive: Number,
          },
        },
      ],
      monthlyUsage: [
        {
          month: String, // YYYY-MM format
          totalBytes: Number,
          averageDailyUsage: Number,
          peakUsage: Number,
          operations: {
            total: Number,
            create: Number,
            update: Number,
            delete: Number,
          },
        },
      ],
      trends: {
        growthRate: Number, // bytes per day
        projectedFullDate: Date,
        usagePattern: String, // 'steady', 'growing', 'declining'
      },
    },

    // Alerts and Notifications
    alerts: {
      quotaWarningThreshold: {
        type: Number,
        default: 0.8, // Alert at 80% usage
      },
      quotaCriticalThreshold: {
        type: Number,
        default: 0.95, // Critical alert at 95% usage
      },
      lastQuotaWarning: Date,
      lastQuotaCritical: Date,
      alertHistory: [
        {
          date: Date,
          type: String, // 'warning', 'critical', 'full'
          message: String,
          acknowledged: Boolean,
          acknowledgedAt: Date,
        },
      ],
    },

    // Backup and Recovery
    backup: {
      enabled: {
        type: Boolean,
        default: true,
      },
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly"],
        default: "weekly",
      },
      retentionDays: {
        type: Number,
        default: 90,
      },
      lastBackup: Date,
      backupSize: Number,
      backupHistory: [
        {
          date: Date,
          size: Number,
          status: String, // 'success', 'failed', 'partial'
          location: String,
          checksum: String,
        },
      ],
    },

    // Metadata
    metadata: {
      createdAt: {
        type: Date,
        default: Date.now,
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
      lastAccessed: Date,
      version: {
        type: Number,
        default: 1,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
UserStorageSchema.index({ userId: 1 }, { unique: true });
UserStorageSchema.index({ "quota.used": -1 });
UserStorageSchema.index({ "alerts.quotaWarningThreshold": 1 });
UserStorageSchema.index({ "metadata.lastAccessed": -1 });
UserStorageSchema.index({ "usage.trends.growthRate": -1 });

// Pre-save middleware
UserStorageSchema.pre("save", function (next) {
  this.metadata.updatedAt = new Date();
  this.quota.available = this.quota.total - this.quota.used;

  // Update usage pattern
  if (this.usage.dailyUsage.length > 7) {
    const recentUsage = this.usage.dailyUsage.slice(-7);
    const totalGrowth = recentUsage.reduce(
      (sum, day) => sum + day.netChange,
      0
    );
    this.usage.trends.growthRate = totalGrowth / 7;

    if (this.usage.trends.growthRate > 0) {
      const daysToFull = this.quota.available / this.usage.trends.growthRate;
      this.usage.trends.projectedFullDate = new Date(
        Date.now() + daysToFull * 24 * 60 * 60 * 1000
      );
      this.usage.trends.usagePattern = "growing";
    } else if (this.usage.trends.growthRate < 0) {
      this.usage.trends.usagePattern = "declining";
    } else {
      this.usage.trends.usagePattern = "steady";
    }
  }

  next();
});

// Methods
UserStorageSchema.methods.calculateUsage = async function () {
  const collections = [
    { name: "oasisassessments", field: "oasisAssessments" },
    { name: "soapnotes", field: "soapNotes" },
    { name: "nursingassessments", field: "nursingAssessments" },
    { name: "medicationrecords", field: "medicationRecords" },
    { name: "progresstrackings", field: "progressTracking" },
    { name: "outcomemeasures", field: "outcomeMeasures" },
    { name: "clinicaldecisionsupports", field: "clinicalDecisionSupport" },
    { name: "careplans", field: "carePlans" },
  ];

  let totalUsed = 0;

  for (const collection of collections) {
    try {
      const Model = mongoose.model(collection.name);
      const docs = await Model.find({ userId: this.userId }).lean();

      const count = docs.length;
      const size = JSON.stringify(docs).length; // Approximate size in bytes

      this.storageBreakdown[collection.field].count = count;
      this.storageBreakdown[collection.field].size = size;
      totalUsed += size;
    } catch (error) {
      console.warn(
        `Could not calculate usage for ${collection.name}:`,
        error.message
      );
    }
  }

  this.quota.used = totalUsed;
  this.quota.available = this.quota.total - totalUsed;
  this.quota.lastCalculated = new Date();

  return this.save();
};

UserStorageSchema.methods.checkQuotaStatus = function () {
  const usagePercentage = this.quota.used / this.quota.total;

  if (usagePercentage >= this.alerts.quotaCriticalThreshold) {
    return {
      status: "critical",
      percentage: Math.round(usagePercentage * 100),
      message:
        "Storage quota critically low. Please archive or delete old data.",
      canUpload: false,
    };
  } else if (usagePercentage >= this.alerts.quotaWarningThreshold) {
    return {
      status: "warning",
      percentage: Math.round(usagePercentage * 100),
      message: "Storage quota warning. Consider archiving old data.",
      canUpload: true,
    };
  } else {
    return {
      status: "normal",
      percentage: Math.round(usagePercentage * 100),
      message: "Storage quota normal.",
      canUpload: true,
    };
  }
};

UserStorageSchema.methods.addUsageRecord = function (
  bytesAdded,
  operation = "create"
) {
  const today = new Date().toISOString().split("T")[0];
  let dailyRecord = this.usage.dailyUsage.find(
    (record) => record.date.toISOString().split("T")[0] === today
  );

  if (!dailyRecord) {
    dailyRecord = {
      date: new Date(),
      bytesAdded: 0,
      bytesRemoved: 0,
      netChange: 0,
      operations: {
        create: 0,
        update: 0,
        delete: 0,
        archive: 0,
      },
    };
    this.usage.dailyUsage.push(dailyRecord);
  }

  if (bytesAdded > 0) {
    dailyRecord.bytesAdded += bytesAdded;
    dailyRecord.netChange += bytesAdded;
  } else {
    dailyRecord.bytesRemoved += Math.abs(bytesAdded);
    dailyRecord.netChange += bytesAdded;
  }

  dailyRecord.operations[operation] += 1;

  // Keep only last 30 days
  if (this.usage.dailyUsage.length > 30) {
    this.usage.dailyUsage = this.usage.dailyUsage.slice(-30);
  }

  return this.save();
};

UserStorageSchema.methods.performOptimization = async function (
  method = "all"
) {
  let spaceSaved = 0;
  const optimizationRecord = {
    date: new Date(),
    method: method,
    details: "",
  };

  if (method === "all" || method === "compression") {
    // Simulate compression savings (in real implementation, this would compress data)
    const compressionSavings = Math.floor(this.quota.used * 0.1); // 10% savings
    spaceSaved += compressionSavings;
    optimizationRecord.details += `Compression saved ${compressionSavings} bytes. `;
  }

  if (method === "all" || method === "deduplication") {
    // Simulate deduplication savings
    const deduplicationSavings = Math.floor(this.quota.used * 0.05); // 5% savings
    spaceSaved += deduplicationSavings;
    optimizationRecord.details += `Deduplication saved ${deduplicationSavings} bytes. `;
  }

  if (method === "all" || method === "archiving") {
    // Archive old data
    const archivingSavings = await this.performArchiving();
    spaceSaved += archivingSavings;
    optimizationRecord.details += `Archiving saved ${archivingSavings} bytes. `;
  }

  optimizationRecord.spaceSaved = spaceSaved;
  this.optimization.optimizationHistory.push(optimizationRecord);
  this.optimization.spaceSavedBytes += spaceSaved;
  this.optimization.lastOptimizationRun = new Date();

  // Update quota
  this.quota.used -= spaceSaved;
  this.quota.available += spaceSaved;

  return this.save();
};

UserStorageSchema.methods.performArchiving = async function () {
  const cutoffDate = new Date();
  cutoffDate.setDate(
    cutoffDate.getDate() - this.archiving.autoArchiveAfterDays
  );

  let archivedSize = 0;
  let archivedCount = 0;

  // In a real implementation, this would move old data to archive storage
  // For now, we'll simulate the process
  const collections = ["oasisassessments", "soapnotes", "nursingassessments"];

  for (const collectionName of collections) {
    try {
      const Model = mongoose.model(collectionName);
      const oldDocs = await Model.find({
        userId: this.userId,
        createdAt: { $lt: cutoffDate },
      }).lean();

      const size = JSON.stringify(oldDocs).length;
      archivedSize += size;
      archivedCount += oldDocs.length;

      // In real implementation, move to archive storage and delete from main collection
      // await Model.deleteMany({ userId: this.userId, createdAt: { $lt: cutoffDate } });
    } catch (error) {
      console.warn(`Could not archive ${collectionName}:`, error.message);
    }
  }

  this.archiving.archivedData.count += archivedCount;
  this.archiving.archivedData.size += archivedSize;
  this.archiving.lastArchiveRun = new Date();

  return archivedSize;
};

// Static methods
UserStorageSchema.statics.getStorageStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        totalUsedStorage: { $sum: "$quota.used" },
        totalAvailableStorage: { $sum: "$quota.available" },
        averageUsage: { $avg: "$quota.used" },
        usersNearQuota: {
          $sum: {
            $cond: [
              { $gte: [{ $divide: ["$quota.used", "$quota.total"] }, 0.8] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
};

UserStorageSchema.statics.getUsersNeedingOptimization = function () {
  return this.find({
    $or: [
      { "quota.used": { $gte: { $multiply: ["$quota.total", 0.8] } } },
      {
        "optimization.lastOptimizationRun": {
          $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    ],
  });
};

export default mongoose.model("UserStorage", UserStorageSchema);
