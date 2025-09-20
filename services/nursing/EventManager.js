import { EventEmitter } from "events";
import redis from "redis";

class EventManager extends EventEmitter {
  constructor() {
    super();
    this.redisClient = null;
    this.pubClient = null;
    this.subClient = null;
    this.redisAvailable = false;
    this.eventQueue = [];
    this.subscribers = new Map();
    this.eventLog = [];
    this.maxEventLogSize = 10000;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  // Initialize Redis (alias for initialize)
  async initializeRedis() {
    return this.initialize();
  }

  // Process event (alias for processEventWithRetry)
  async processEvent(event) {
    return this.processEventWithRetry(event);
  }

  // Initialize Redis clients for pub/sub with fallback to in-memory
  async initialize() {
    try {
      // Try to initialize Redis
      await this.initializeRedisClients();
      console.log("📡 Event Manager initialized with Redis pub/sub");
      return true;
    } catch (error) {
      console.warn(
        "Redis unavailable, falling back to in-memory event handling:",
        error.message
      );
      this.initializeInMemoryMode();
      console.log("📡 Event Manager initialized in in-memory mode");
      return true;
    }
  }

  // Check if Redis is available before attempting connection
  async checkRedisAvailability() {
    return new Promise((resolve) => {
      const testClient = redis.createClient({
        host: process.env.REDIS_HOST || "localhost",
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_EVENTS_DB || 2,
        socket: {
          connectTimeout: 1000,
          lazyConnect: true,
        },
      });

      // Set up a timeout
      const timeout = setTimeout(() => {
        testClient.disconnect().catch(() => {});
        resolve(false);
      }, 2000);

      testClient.on("error", () => {
        clearTimeout(timeout);
        try {
          if (testClient.isOpen) {
            testClient.disconnect().catch(() => {});
          }
        } catch (e) {
          // Client already closed, ignore
        }
        resolve(false);
      });

      testClient
        .connect()
        .then(() => testClient.ping())
        .then(() => {
          clearTimeout(timeout);
          testClient.quit().catch(() => {});
          resolve(true);
        })
        .catch(() => {
          clearTimeout(timeout);
          try {
            if (testClient.isOpen) {
              testClient.disconnect().catch(() => {});
            }
          } catch (e) {
            // Client already closed, ignore
          }
          resolve(false);
        });
    });
  }

  // Initialize Redis clients
  async initializeRedisClients() {
    // First check if Redis is available
    const isAvailable = await this.checkRedisAvailability();
    if (!isAvailable) {
      throw new Error("Redis server is not available");
    }

    // Publisher client
    this.pubClient = redis.createClient({
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_EVENTS_DB || 2,
      socket: {
        connectTimeout: 5000,
        lazyConnect: true,
      },
    });

    // Subscriber client
    this.subClient = redis.createClient({
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_EVENTS_DB || 2,
      socket: {
        connectTimeout: 5000,
        lazyConnect: true,
      },
    });

    // Set up error handlers
    this.pubClient.on("error", (err) => {
      console.warn("Redis pub client error:", err.message);
      this.redisAvailable = false;
    });

    this.subClient.on("error", (err) => {
      console.warn("Redis sub client error:", err.message);
      this.redisAvailable = false;
    });

    await this.pubClient.connect();
    await this.subClient.connect();

    // Set up subscriber event handlers
    this.subClient.on("message", (channel, message) => {
      this.handleIncomingEvent(channel, message);
    });

    this.redisAvailable = true;
  }

  // Initialize in-memory mode when Redis is unavailable
  initializeInMemoryMode() {
    this.redisAvailable = false;
    this.pubClient = null;
    this.subClient = null;
    console.log(
      "📡 Event Manager running in in-memory mode (Redis unavailable)"
    );
  }

  // Publish event to Redis or in-memory
  async publishEvent(eventType, data, options = {}) {
    try {
      const event = {
        id: this.generateEventId(),
        type: eventType,
        data,
        timestamp: new Date().toISOString(),
        source: options.source || "nursing-backend",
        userId: options.userId,
        patientId: options.patientId,
        priority: options.priority || "normal",
        retryCount: 0,
        metadata: options.metadata || {},
      };

      // Log event
      this.logEvent(event);

      // Publish to Redis channel if available
      if (this.redisAvailable && this.pubClient) {
        try {
          const channel = this.getChannelName(eventType);
          await this.pubClient.publish(channel, JSON.stringify(event));
        } catch (redisError) {
          console.warn(
            `Redis publish failed, continuing with local emit:`,
            redisError.message
          );
        }
      }

      // Always emit locally for immediate subscribers
      this.emit(eventType, event);

      console.log(
        `📤 Published event: ${eventType} (ID: ${event.id}) ${
          this.redisAvailable ? "[Redis + Local]" : "[Local Only]"
        }`
      );
      return event.id;
    } catch (error) {
      console.error(`Error publishing event ${eventType}:`, error);
      throw error;
    }
  }

  // Subscribe to event type
  async subscribe(eventType, handler) {
    try {
      // Add to local subscribers
      if (!this.subscribers.has(eventType)) {
        this.subscribers.set(eventType, new Set());
      }
      this.subscribers.get(eventType).add(handler);

      // Subscribe to Redis channel if available
      if (this.redisAvailable && this.subClient) {
        try {
          const channel = this.getChannelName(eventType);
          await this.subClient.subscribe(channel);
        } catch (redisError) {
          console.warn(
            `Redis subscribe failed for ${eventType}:`,
            redisError.message
          );
        }
      }

      // Always listen to local events
      this.on(eventType, handler);

      console.log(
        `📥 Subscribed to event type: ${eventType} ${
          this.redisAvailable ? "[Redis + Local]" : "[Local Only]"
        }`
      );
    } catch (error) {
      console.error(`Error subscribing to ${eventType}:`, error);
      throw error;
    }
  }

  // Unsubscribe from event type
  async unsubscribe(eventType, handler) {
    try {
      // Remove from local subscribers
      if (this.subscribers.has(eventType)) {
        this.subscribers.get(eventType).delete(handler);
        if (this.subscribers.get(eventType).size === 0) {
          this.subscribers.delete(eventType);

          // Unsubscribe from Redis if available
          if (this.redisAvailable && this.subClient) {
            try {
              const channel = this.getChannelName(eventType);
              await this.subClient.unsubscribe(channel);
            } catch (redisError) {
              console.warn(
                `Redis unsubscribe failed for ${eventType}:`,
                redisError.message
              );
            }
          }
        }
      }

      // Remove local event listener
      this.off(eventType, handler);

      console.log(`📤 Unsubscribed from event type: ${eventType}`);
    } catch (error) {
      console.error(`Error unsubscribing from ${eventType}:`, error);
      throw error;
    }
  }

  // Handle incoming events from Redis
  handleIncomingEvent(channel, message) {
    try {
      const event = JSON.parse(message);
      const eventType = this.getEventTypeFromChannel(channel);

      // Log received event
      this.logEvent(event, "received");

      // Process event with retry logic
      this.processEventWithRetry(event);
    } catch (error) {
      console.error(`Error handling incoming event from ${channel}:`, error);
    }
  }

  // Process event with retry logic
  async processEventWithRetry(event, attempt = 1) {
    try {
      // Emit to local subscribers
      this.emit(event.type, event);

      console.log(`✅ Processed event: ${event.type} (ID: ${event.id})`);
    } catch (error) {
      console.error(
        `Error processing event ${event.id} (attempt ${attempt}):`,
        error
      );

      if (attempt < this.retryAttempts) {
        setTimeout(() => {
          this.processEventWithRetry(event, attempt + 1);
        }, this.retryDelay * attempt);
      } else {
        console.error(
          `❌ Failed to process event ${event.id} after ${this.retryAttempts} attempts`
        );
        this.handleFailedEvent(event, error);
      }
    }
  }

  // Handle failed events
  handleFailedEvent(event, error) {
    // Store failed event for manual review
    const failedEvent = {
      ...event,
      failedAt: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
    };

    // In production, this would be stored in a dead letter queue
    console.error("💀 Dead letter event:", failedEvent);

    // Emit failure event for monitoring
    this.emit("event_failed", failedEvent);
  }

  // Nursing-specific event publishers
  async publishOASISEvent(action, data, userId) {
    return await this.publishEvent(
      "oasis_assessment",
      {
        action,
        ...data,
      },
      {
        userId,
        patientId: data.patientId,
        source: "oasis-service",
      }
    );
  }

  async publishSOAPEvent(action, data, userId) {
    return await this.publishEvent(
      "soap_note",
      {
        action,
        ...data,
      },
      {
        userId,
        patientId: data.patientId,
        source: "soap-service",
      }
    );
  }

  async publishProgressEvent(action, data, userId) {
    return await this.publishEvent(
      "progress_tracking",
      {
        action,
        ...data,
      },
      {
        userId,
        patientId: data.patientId,
        source: "progress-service",
      }
    );
  }

  async publishOutcomeEvent(action, data, userId) {
    return await this.publishEvent(
      "outcome_measures",
      {
        action,
        ...data,
      },
      {
        userId,
        source: "outcome-service",
      }
    );
  }

  async publishMedicationEvent(action, data, userId) {
    return await this.publishEvent(
      "medication_management",
      {
        action,
        ...data,
      },
      {
        userId,
        patientId: data.patientId,
        source: "medication-service",
      }
    );
  }

  async publishAssessmentEvent(action, data, userId) {
    return await this.publishEvent(
      "nursing_assessment",
      {
        action,
        ...data,
      },
      {
        userId,
        patientId: data.patientId,
        source: "assessment-service",
      }
    );
  }

  async publishClinicalEvent(action, data, userId) {
    return await this.publishEvent(
      "clinical_decision",
      {
        action,
        ...data,
      },
      {
        userId,
        patientId: data.patientId,
        source: "clinical-service",
        priority: "high",
      }
    );
  }

  async publishCarePlanEvent(action, data, userId) {
    return await this.publishEvent(
      "care_plan",
      {
        action,
        ...data,
      },
      {
        userId,
        patientId: data.patientId,
        source: "careplan-service",
      }
    );
  }

  // Real-time collaboration events
  async publishCollaborationEvent(
    documentType,
    documentId,
    operation,
    content,
    userId
  ) {
    return await this.publishEvent(
      "real_time_collaboration",
      {
        documentType,
        documentId,
        operation,
        content,
        userId,
      },
      {
        userId,
        source: "collaboration-service",
        priority: "high",
      }
    );
  }

  // Utility methods
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  getChannelName(eventType) {
    return `nursing:events:${eventType}`;
  }

  getEventTypeFromChannel(channel) {
    return channel.replace("nursing:events:", "");
  }

  logEvent(event, direction = "published") {
    const logEntry = {
      ...event,
      direction,
      loggedAt: new Date().toISOString(),
    };

    this.eventLog.push(logEntry);

    // Keep log size manageable
    if (this.eventLog.length > this.maxEventLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxEventLogSize);
    }
  }

  // Event replay functionality
  async replayEvents(fromTimestamp, toTimestamp, eventTypes = null) {
    try {
      const filteredEvents = this.eventLog.filter((event) => {
        const eventTime = new Date(event.timestamp);
        const inTimeRange =
          eventTime >= fromTimestamp && eventTime <= toTimestamp;
        const matchesType = !eventTypes || eventTypes.includes(event.type);
        return inTimeRange && matchesType && event.direction === "published";
      });

      console.log(`🔄 Replaying ${filteredEvents.length} events`);

      for (const event of filteredEvents) {
        // Re-emit the event
        this.emit(event.type, event);

        // Small delay to prevent overwhelming
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      return filteredEvents.length;
    } catch (error) {
      console.error("Error replaying events:", error);
      throw error;
    }
  }

  // Get event statistics
  getEventStats() {
    const stats = {
      totalEvents: this.eventLog.length,
      eventsByType: {},
      eventsBySource: {},
      recentEvents: this.eventLog.slice(-10),
      subscriberCount: this.subscribers.size,
    };

    // Count events by type and source
    for (const event of this.eventLog) {
      stats.eventsByType[event.type] =
        (stats.eventsByType[event.type] || 0) + 1;
      stats.eventsBySource[event.source] =
        (stats.eventsBySource[event.source] || 0) + 1;
    }

    return stats;
  }

  // Health check
  async healthCheck() {
    try {
      const testEvent = {
        type: "health_check",
        data: { timestamp: Date.now() },
        timestamp: new Date().toISOString(),
      };

      if (this.redisAvailable && this.pubClient) {
        await this.pubClient.publish(
          "nursing:events:health_check",
          JSON.stringify(testEvent)
        );
      } else {
        // In-memory mode health check
        this.emit("health_check", testEvent);
      }

      return true;
    } catch (error) {
      console.error("Event Manager health check failed:", error);
      return false;
    }
  }

  // Cleanup and shutdown
  async shutdown() {
    try {
      // Clear all subscribers
      this.subscribers.clear();
      this.removeAllListeners();

      // Close Redis connections if available
      if (this.redisAvailable) {
        if (this.pubClient) {
          await this.pubClient.quit();
        }
        if (this.subClient) {
          await this.subClient.quit();
        }
      }

      console.log("📡 Event Manager shut down");
    } catch (error) {
      console.error("Error shutting down Event Manager:", error);
    }
  }
}

export default EventManager;
