/**
 * Automated Data Collection Service
 *
 * Orchestrates automated extraction of quality indicators from OASIS assessments
 * and SOAP notes with scheduling and monitoring capabilities.
 */

const cron = require("node-cron");
const OASISDataExtractor = require("./OASISDataExtractor");
const SOAPDataExtractor = require("./SOAPDataExtractor");
const OASISAssessment = require("../../models/nursing/OASISAssessment");
const SOAPNote = require("../../models/nursing/SOAPNote");
const OutcomeMeasure = require("../../models/nursing/OutcomeMeasure");

class AutomatedDataCollectionService {
  constructor() {
    this.oasisExtractor = new OASISDataExtractor();
    this.soapExtractor = new SOAPDataExtractor();
    this.scheduledJobs = new Map();
    this.collectionStats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastRunTime: null,
      nextRunTime: null,
    };
    this.isRunning = false;
  }

  /**
   * Initialize automated data collection with default schedule
   */
  async initialize() {
    try {
      // Schedule daily data collection at 2 AM
      this.scheduleDataCollection("0 2 * * *", "daily_collection");

      // Schedule hourly incremental collection during business hours
      this.scheduleIncrementalCollection(
        "0 9-17 * * 1-5",
        "hourly_incremental"
      );

      console.log("Automated data collection service initialized");
      return true;
    } catch (error) {
      console.error("Failed to initialize automated data collection:", error);
      return false;
    }
  }

  /**
   * Schedule full data collection job
   */
  scheduleDataCollection(cronExpression, jobName) {
    if (this.scheduledJobs.has(jobName)) {
      this.scheduledJobs.get(jobName).destroy();
    }

    const job = cron.schedule(
      cronExpression,
      async () => {
        await this.runFullDataCollection();
      },
      {
        scheduled: true,
        timezone: "America/New_York",
      }
    );

    this.scheduledJobs.set(jobName, job);
    console.log(`Scheduled ${jobName} with expression: ${cronExpression}`);
  }

  /**
   * Schedule incremental data collection job
   */
  scheduleIncrementalCollection(cronExpression, jobName) {
    if (this.scheduledJobs.has(jobName)) {
      this.scheduledJobs.get(jobName).destroy();
    }

    const job = cron.schedule(
      cronExpression,
      async () => {
        await this.runIncrementalDataCollection();
      },
      {
        scheduled: true,
        timezone: "America/New_York",
      }
    );

    this.scheduledJobs.set(jobName, job);
    console.log(`Scheduled ${jobName} with expression: ${cronExpression}`);
  }

  /**
   * Run full data collection for all users
   */
  async runFullDataCollection() {
    if (this.isRunning) {
      console.log("Data collection already running, skipping...");
      return;
    }

    this.isRunning = true;
    const startTime = new Date();

    try {
      console.log("Starting full data collection...");
      this.collectionStats.totalRuns++;

      // Get all users with nursing subscriptions
      const users = await this.getNursingUsers();
      const results = {
        totalUsers: users.length,
        processedUsers: 0,
        totalOASISProcessed: 0,
        totalSOAPProcessed: 0,
        totalMeasuresCreated: 0,
        errors: [],
      };

      for (const user of users) {
        try {
          const userResult = await this.processUserData(user._id, "full");
          results.processedUsers++;
          results.totalOASISProcessed += userResult.oasisProcessed;
          results.totalSOAPProcessed += userResult.soapProcessed;
          results.totalMeasuresCreated += userResult.measuresCreated;
        } catch (error) {
          results.errors.push({
            userId: user._id,
            error: error.message,
          });
        }
      }

      const endTime = new Date();
      const duration = endTime - startTime;

      this.collectionStats.successfulRuns++;
      this.collectionStats.lastRunTime = endTime;

      console.log(`Full data collection completed in ${duration}ms:`, results);

      // Store collection results for monitoring
      await this.storeCollectionResults("full", results, duration);

      return results;
    } catch (error) {
      this.collectionStats.failedRuns++;
      console.error("Full data collection failed:", error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run incremental data collection for recent data
   */
  async runIncrementalDataCollection() {
    if (this.isRunning) {
      console.log("Data collection already running, skipping incremental...");
      return;
    }

    this.isRunning = true;
    const startTime = new Date();

    try {
      console.log("Starting incremental data collection...");

      // Process data from last 2 hours
      const cutoffTime = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const users = await this.getNursingUsers();
      const results = {
        totalUsers: users.length,
        processedUsers: 0,
        totalOASISProcessed: 0,
        totalSOAPProcessed: 0,
        totalMeasuresCreated: 0,
        errors: [],
      };

      for (const user of users) {
        try {
          const userResult = await this.processUserData(
            user._id,
            "incremental",
            cutoffTime
          );
          results.processedUsers++;
          results.totalOASISProcessed += userResult.oasisProcessed;
          results.totalSOAPProcessed += userResult.soapProcessed;
          results.totalMeasuresCreated += userResult.measuresCreated;
        } catch (error) {
          results.errors.push({
            userId: user._id,
            error: error.message,
          });
        }
      }

      const endTime = new Date();
      const duration = endTime - startTime;

      console.log(
        `Incremental data collection completed in ${duration}ms:`,
        results
      );

      // Store collection results for monitoring
      await this.storeCollectionResults("incremental", results, duration);

      return results;
    } catch (error) {
      console.error("Incremental data collection failed:", error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process data for a specific user
   */
  async processUserData(userId, mode = "full", cutoffTime = null) {
    const results = {
      oasisProcessed: 0,
      soapProcessed: 0,
      measuresCreated: 0,
      errors: [],
    };

    try {
      // Process OASIS assessments
      const oasisResults = await this.processUserOASISData(
        userId,
        mode,
        cutoffTime
      );
      results.oasisProcessed = oasisResults.processed;
      results.measuresCreated += oasisResults.measuresCreated;
      results.errors.push(...oasisResults.errors);

      // Process SOAP notes
      const soapResults = await this.processUserSOAPData(
        userId,
        mode,
        cutoffTime
      );
      results.soapProcessed = soapResults.processed;
      results.measuresCreated += soapResults.measuresCreated;
      results.errors.push(...soapResults.errors);
    } catch (error) {
      results.errors.push({
        userId,
        error: error.message,
        type: "user_processing_error",
      });
    }

    return results;
  }

  /**
   * Process OASIS assessments for a user
   */
  async processUserOASISData(userId, mode, cutoffTime) {
    const results = {
      processed: 0,
      measuresCreated: 0,
      errors: [],
    };

    try {
      // Build query based on mode
      let query = { userId: userId };

      if (mode === "incremental" && cutoffTime) {
        query.createdAt = { $gte: cutoffTime };

        // Also check if we've already processed this assessment
        const processedAssessments = await OutcomeMeasure.distinct(
          "metadata.sourceId",
          {
            userId: userId,
            "metadata.source": "oasis",
            createdAt: { $gte: cutoffTime },
          }
        );

        if (processedAssessments.length > 0) {
          query._id = { $nin: processedAssessments };
        }
      } else if (mode === "full") {
        // For full mode, only process assessments not already processed
        const processedAssessments = await OutcomeMeasure.distinct(
          "metadata.sourceId",
          {
            userId: userId,
            "metadata.source": "oasis",
          }
        );

        if (processedAssessments.length > 0) {
          query._id = { $nin: processedAssessments };
        }
      }

      const assessments = await OASISAssessment.find(query)
        .sort({ createdAt: -1 })
        .limit(mode === "incremental" ? 50 : 1000);

      for (const assessment of assessments) {
        try {
          const extractionResult =
            await this.oasisExtractor.extractFromAssessment(
              userId,
              assessment._id
            );

          results.processed++;
          results.measuresCreated += extractionResult.extractedCount;
        } catch (error) {
          results.errors.push({
            assessmentId: assessment._id,
            error: error.message,
            type: "oasis_extraction_error",
          });
        }
      }
    } catch (error) {
      results.errors.push({
        userId,
        error: error.message,
        type: "oasis_query_error",
      });
    }

    return results;
  }

  /**
   * Process SOAP notes for a user
   */
  async processUserSOAPData(userId, mode, cutoffTime) {
    const results = {
      processed: 0,
      measuresCreated: 0,
      errors: [],
    };

    try {
      // Build query based on mode
      let query = { userId: userId };

      if (mode === "incremental" && cutoffTime) {
        query.createdAt = { $gte: cutoffTime };

        // Also check if we've already processed this note
        const processedNotes = await OutcomeMeasure.distinct(
          "metadata.sourceId",
          {
            userId: userId,
            "metadata.source": "soap",
            createdAt: { $gte: cutoffTime },
          }
        );

        if (processedNotes.length > 0) {
          query._id = { $nin: processedNotes };
        }
      } else if (mode === "full") {
        // For full mode, only process notes not already processed
        const processedNotes = await OutcomeMeasure.distinct(
          "metadata.sourceId",
          {
            userId: userId,
            "metadata.source": "soap",
          }
        );

        if (processedNotes.length > 0) {
          query._id = { $nin: processedNotes };
        }
      }

      const soapNotes = await SOAPNote.find(query)
        .sort({ createdAt: -1 })
        .limit(mode === "incremental" ? 100 : 2000);

      for (const note of soapNotes) {
        try {
          const extractionResult = await this.soapExtractor.extractFromSOAPNote(
            userId,
            note._id
          );

          results.processed++;
          results.measuresCreated += extractionResult.extractedCount;
        } catch (error) {
          results.errors.push({
            noteId: note._id,
            error: error.message,
            type: "soap_extraction_error",
          });
        }
      }
    } catch (error) {
      results.errors.push({
        userId,
        error: error.message,
        type: "soap_query_error",
      });
    }

    return results;
  }

  /**
   * Get all users with nursing subscriptions
   */
  async getNursingUsers() {
    try {
      const User = require("../../models/User");

      return await User.find({
        profession: "nursing",
        subscriptionStatus: "active",
        $or: [
          { subscriptionPlan: "nursing_professional" },
          { subscriptionPlan: "nursing_premium" },
        ],
      }).select("_id email subscriptionPlan");
    } catch (error) {
      console.error("Error fetching nursing users:", error);
      return [];
    }
  }

  /**
   * Store collection results for monitoring and analytics
   */
  async storeCollectionResults(mode, results, duration) {
    try {
      // Create a simple collection log (you might want to create a dedicated model)
      const collectionLog = {
        mode,
        timestamp: new Date(),
        duration,
        results,
        success: results.errors.length === 0,
      };

      // For now, just log to console. In production, you'd store this in a database
      console.log("Collection results stored:", {
        mode,
        duration: `${duration}ms`,
        totalUsers: results.totalUsers,
        processedUsers: results.processedUsers,
        totalMeasuresCreated: results.totalMeasuresCreated,
        errorCount: results.errors.length,
      });

      return collectionLog;
    } catch (error) {
      console.error("Error storing collection results:", error);
    }
  }

  /**
   * Manually trigger data collection for a specific user
   */
  async collectDataForUser(userId, options = {}) {
    const {
      includeOASIS = true,
      includeSOAP = true,
      mode = "full",
      cutoffTime = null,
    } = options;

    try {
      const results = {
        userId,
        oasisResults: null,
        soapResults: null,
        totalMeasuresCreated: 0,
        errors: [],
      };

      if (includeOASIS) {
        results.oasisResults = await this.processUserOASISData(
          userId,
          mode,
          cutoffTime
        );
        results.totalMeasuresCreated += results.oasisResults.measuresCreated;
        results.errors.push(...results.oasisResults.errors);
      }

      if (includeSOAP) {
        results.soapResults = await this.processUserSOAPData(
          userId,
          mode,
          cutoffTime
        );
        results.totalMeasuresCreated += results.soapResults.measuresCreated;
        results.errors.push(...results.soapResults.errors);
      }

      return results;
    } catch (error) {
      console.error(`Error collecting data for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get collection statistics
   */
  getCollectionStats() {
    return {
      ...this.collectionStats,
      isRunning: this.isRunning,
      scheduledJobs: Array.from(this.scheduledJobs.keys()),
    };
  }

  /**
   * Configure custom collection schedule
   */
  configureSchedule(scheduleConfig) {
    try {
      // Stop existing jobs
      this.stopAllJobs();

      // Configure new schedules
      if (scheduleConfig.fullCollection) {
        this.scheduleDataCollection(
          scheduleConfig.fullCollection.cron,
          scheduleConfig.fullCollection.name || "custom_full_collection"
        );
      }

      if (scheduleConfig.incrementalCollection) {
        this.scheduleIncrementalCollection(
          scheduleConfig.incrementalCollection.cron,
          scheduleConfig.incrementalCollection.name ||
            "custom_incremental_collection"
        );
      }

      console.log("Custom schedule configured:", scheduleConfig);
      return true;
    } catch (error) {
      console.error("Error configuring custom schedule:", error);
      return false;
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stopAllJobs() {
    for (const [jobName, job] of this.scheduledJobs) {
      job.destroy();
      console.log(`Stopped job: ${jobName}`);
    }
    this.scheduledJobs.clear();
  }

  /**
   * Start all scheduled jobs
   */
  startAllJobs() {
    for (const [jobName, job] of this.scheduledJobs) {
      job.start();
      console.log(`Started job: ${jobName}`);
    }
  }

  /**
   * Get data mapping configuration for different indicator types
   */
  getDataMappingConfig() {
    return {
      oasis: {
        clinical: [
          "wound_healing_rate",
          "medication_compliance",
          "pain_management_effectiveness",
          "infection_prevention",
        ],
        functional: [
          "adl_improvement",
          "mobility_improvement",
          "cognitive_improvement",
          "self_care_improvement",
        ],
        safety: [
          "fall_prevention_effectiveness",
          "emergency_department_utilization",
          "hospitalization_risk_reduction",
        ],
      },
      soap: {
        clinical: [
          "patient_reported_pain",
          "symptom_improvement",
          "vital_signs_stability",
          "wound_healing_progress",
          "clinical_progress",
          "care_plan_adherence",
          "intervention_effectiveness",
        ],
        functional: [
          "patient_reported_function",
          "observed_mobility",
          "observed_cognitive_function",
          "goal_achievement",
          "discharge_readiness",
        ],
        safety: ["risk_level_assessment"],
      },
    };
  }

  /**
   * Validate extraction results
   */
  validateExtractionResults(results) {
    const validation = {
      isValid: true,
      warnings: [],
      errors: [],
    };

    // Check for minimum confidence levels
    if (results.confidence < 0.6) {
      validation.warnings.push(
        `Low extraction confidence: ${results.confidence}`
      );
    }

    // Check for reasonable number of measures
    if (results.extractedCount === 0) {
      validation.warnings.push("No measures extracted from source");
    } else if (results.extractedCount > 20) {
      validation.warnings.push(
        `Unusually high number of measures extracted: ${results.extractedCount}`
      );
    }

    // Validate measure values
    if (results.measures) {
      results.measures.forEach((measure, index) => {
        if (measure.value < 0 || measure.value > 1) {
          validation.errors.push(
            `Invalid measure value at index ${index}: ${measure.value}`
          );
          validation.isValid = false;
        }

        if (!measure.indicatorType || !measure.category) {
          validation.errors.push(`Missing required fields at index ${index}`);
          validation.isValid = false;
        }
      });
    }

    return validation;
  }

  /**
   * Cleanup old extraction results
   */
  async cleanupOldResults(retentionDays = 90) {
    try {
      const cutoffDate = new Date(
        Date.now() - retentionDays * 24 * 60 * 60 * 1000
      );

      const result = await OutcomeMeasure.deleteMany({
        createdAt: { $lt: cutoffDate },
        "metadata.source": { $in: ["oasis", "soap"] },
      });

      console.log(`Cleaned up ${result.deletedCount} old outcome measures`);
      return result.deletedCount;
    } catch (error) {
      console.error("Error cleaning up old results:", error);
      throw error;
    }
  }

  /**
   * Generate extraction report
   */
  async generateExtractionReport(userId, timeframe = "30d") {
    try {
      const days = parseInt(timeframe.replace("d", ""));
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const pipeline = [
        {
          $match: {
            userId: userId,
            createdAt: { $gte: startDate },
            "metadata.source": { $in: ["oasis", "soap"] },
          },
        },
        {
          $group: {
            _id: {
              source: "$metadata.source",
              category: "$category",
              indicatorType: "$indicatorType",
            },
            count: { $sum: 1 },
            avgValue: { $avg: "$value" },
            avgConfidence: { $avg: "$metadata.confidence" },
            minValue: { $min: "$value" },
            maxValue: { $max: "$value" },
          },
        },
        {
          $sort: { "_id.source": 1, "_id.category": 1, "_id.indicatorType": 1 },
        },
      ];

      const results = await OutcomeMeasure.aggregate(pipeline);

      return {
        userId,
        timeframe,
        generatedAt: new Date(),
        totalMeasures: results.reduce((sum, item) => sum + item.count, 0),
        bySource: this.groupResultsBySource(results),
        byCategory: this.groupResultsByCategory(results),
        overallStats: this.calculateOverallStats(results),
      };
    } catch (error) {
      console.error("Error generating extraction report:", error);
      throw error;
    }
  }

  /**
   * Group results by source
   */
  groupResultsBySource(results) {
    const grouped = {};

    results.forEach((item) => {
      const source = item._id.source;
      if (!grouped[source]) {
        grouped[source] = {
          totalMeasures: 0,
          categories: {},
        };
      }

      grouped[source].totalMeasures += item.count;

      const category = item._id.category;
      if (!grouped[source].categories[category]) {
        grouped[source].categories[category] = [];
      }

      grouped[source].categories[category].push({
        indicatorType: item._id.indicatorType,
        count: item.count,
        avgValue: item.avgValue,
        avgConfidence: item.avgConfidence,
      });
    });

    return grouped;
  }

  /**
   * Group results by category
   */
  groupResultsByCategory(results) {
    const grouped = {};

    results.forEach((item) => {
      const category = item._id.category;
      if (!grouped[category]) {
        grouped[category] = {
          totalMeasures: 0,
          indicators: [],
        };
      }

      grouped[category].totalMeasures += item.count;
      grouped[category].indicators.push({
        indicatorType: item._id.indicatorType,
        source: item._id.source,
        count: item.count,
        avgValue: item.avgValue,
        avgConfidence: item.avgConfidence,
      });
    });

    return grouped;
  }

  /**
   * Calculate overall statistics
   */
  calculateOverallStats(results) {
    if (results.length === 0) {
      return {
        totalMeasures: 0,
        avgValue: 0,
        avgConfidence: 0,
        valueRange: { min: 0, max: 0 },
      };
    }

    const totalMeasures = results.reduce((sum, item) => sum + item.count, 0);
    const weightedValueSum = results.reduce(
      (sum, item) => sum + item.avgValue * item.count,
      0
    );
    const weightedConfidenceSum = results.reduce(
      (sum, item) => sum + item.avgConfidence * item.count,
      0
    );

    const allMinValues = results.map((item) => item.minValue);
    const allMaxValues = results.map((item) => item.maxValue);

    return {
      totalMeasures,
      avgValue: weightedValueSum / totalMeasures,
      avgConfidence: weightedConfidenceSum / totalMeasures,
      valueRange: {
        min: Math.min(...allMinValues),
        max: Math.max(...allMaxValues),
      },
    };
  }
}

module.exports = AutomatedDataCollectionService;
