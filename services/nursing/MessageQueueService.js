import { EventEmitter } from "events";
import Redis from "ioredis";

class MessageQueueService extends EventEmitter {
  constructor() {
    super();
    this.queues = new Map();
    this.subscribers = new Map();
    this.eventLog = [];
    this.maxEventLogSize = 10000;
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
    this.processingStats = {
      totalProcessed: 0,
      totalFailed: 0,
      averageProcessingTime: 0,
      queueSizes: {},
    };
  }

  // Enqueue message (alias for addToQueue)
  async enqueue(queueName, message, priority = "normal") {
    return this.addToQueue(queueName, message, priority);
  }

  // Dequeue message (alias for getNextMessage)
  async dequeue(queueName) {
    return this.getNextMessage(queueName);
  }

  // Add message to queue with priority handling
  async addToQueue(queueName, message, priority = "normal") {
    try {
      const queueMessage = {
        id: this.generateMessageId(),
        message,
        priority,
        timestamp: new Date(),
        attempts: 0,
        status: "pending",
      };

      if (this.useInMemoryQueue) {
        // In-memory queue implementation
        if (!this.queues.has(queueName)) {
          this.queues.set(queueName, []);
        }

        const queue = this.queues.get(queueName);

        // Insert based on priority
        if (priority === "high") {
          queue.unshift(queueMessage);
        } else {
          queue.push(queueMessage);
        }

        this.updateQueueStats(queueName);
      } else {
        // Redis queue implementation
        const queueKey = `queue:${queueName}`;
        const priorityScore = this.getPriorityScore(priority);

        await this.redis.zadd(
          queueKey,
          priorityScore,
          JSON.stringify(queueMessage)
        );
      }

      // Emit event for real-time monitoring
      this.emit("messageEnqueued", {
        queueName,
        messageId: queueMessage.id,
        priority,
        queueSize: await this.getQueueSize(queueName),
      });

      return {
        success: true,
        messageId: queueMessage.id,
        queueName,
        position: await this.getQueueSize(queueName),
      };
    } catch (error) {
      console.error("Error adding message to queue:", error);
      throw error;
    }
  }

  // Get next message from queue
  async getNextMessage(queueName) {
    try {
      let message = null;

      if (this.useInMemoryQueue) {
        // In-memory queue implementation
        const queue = this.queues.get(queueName);
        if (queue && queue.length > 0) {
          message = queue.shift();
          this.updateQueueStats(queueName);
        }
      } else {
        // Redis queue implementation
        const queueKey = `queue:${queueName}`;
        const result = await this.redis.zpopmax(queueKey);

        if (result && result.length >= 2) {
          message = JSON.parse(result[0]);
        }
      }

      if (message) {
        message.status = "processing";
        message.processedAt = new Date();

        // Emit event for monitoring
        this.emit("messageDequeued", {
          queueName,
          messageId: message.id,
          waitTime: message.processedAt - message.timestamp,
        });
      }

      return message;
    } catch (error) {
      console.error("Error getting next message from queue:", error);
      throw error;
    }
  }

  // Generate unique message ID
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get priority score for Redis sorted set
  getPriorityScore(priority) {
    const scores = {
      low: 1,
      normal: 2,
      high: 3,
      urgent: 4,
    };
    return scores[priority] || 2;
  }

  // Get queue size
  async getQueueSize(queueName) {
    try {
      if (this.useInMemoryQueue) {
        const queue = this.queues.get(queueName);
        return queue ? queue.length : 0;
      } else {
        const queueKey = `queue:${queueName}`;
        return await this.redis.zcard(queueKey);
      }
    } catch (error) {
      console.error("Error getting queue size:", error);
      return 0;
    }
  }

  // Update queue statistics
  updateQueueStats(queueName) {
    const size = this.queues.get(queueName)?.length || 0;
    this.processingStats.queueSizes[queueName] = size;
  }

  // Initialize the message queue system
  async initialize() {
    try {
      // Set up Redis connection for production
      if (process.env.NODE_ENV === "production" && process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL);

        this.redis.on("connect", () => {
          console.log("✅ MessageQueue: Connected to Redis");
        });

        this.redis.on("error", (error) => {
          console.error("❌ MessageQueue: Redis connection error:", error);
          // Fallback to in-memory queue
          this.useInMemoryQueue = true;
        });
      } else {
        // Use in-memory queue for development
        this.useInMemoryQueue = true;
        console.log("📝 MessageQueue: Using in-memory queue for development");
      }

      // Initialize default queues
      this.createQueue("nursing-events");
      this.createQueue("ai-processing");
      this.createQueue("notifications");
      this.createQueue("data-sync");
      this.createQueue("audit-logs");

      // Start queue processors
      this.startQueueProcessors();

      console.log("✅ MessageQueue: Service initialized successfully");
      return true;
    } catch (error) {
      console.error("❌ MessageQueue: Initialization failed:", error);
      throw error;
    }
  }

  // Create a new queue
  createQueue(queueName, options = {}) {
    if (this.queues.has(queueName)) {
      return this.queues.get(queueName);
    }

    const queue = {
      name: queueName,
      messages: [],
      subscribers: [],
      options: {
        maxSize: options.maxSize || 1000,
        persistent: options.persistent || false,
        priority: options.priority || false,
        deadLetterQueue: options.deadLetterQueue || false,
        ...options,
      },
      stats: {
        totalMessages: 0,
        processedMessages: 0,
        failedMessages: 0,
        averageProcessingTime: 0,
      },
    };

    this.queues.set(queueName, queue);
    this.processingStats.queueSizes[queueName] = 0;

    console.log(`📋 MessageQueue: Created queue "${queueName}"`);
    return queue;
  }

  // Publish message to queue
  async publish(queueName, message, options = {}) {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue "${queueName}" does not exist`);
      }

      const messageObj = {
        id: this.generateMessageId(),
        queueName,
        payload: message,
        timestamp: new Date(),
        priority: options.priority || 0,
        retryCount: 0,
        maxRetries: options.maxRetries || this.retryAttempts,
        delay: options.delay || 0,
        metadata: options.metadata || {},
        userId: options.userId,
        sessionId: options.sessionId,
      };

      // Check queue size limits
      if (queue.messages.length >= queue.options.maxSize) {
        if (queue.options.deadLetterQueue) {
          await this.moveToDeadLetterQueue(messageObj);
        } else {
          // Remove oldest message
          queue.messages.shift();
        }
      }

      // Add to queue with priority handling
      if (queue.options.priority) {
        this.insertByPriority(queue.messages, messageObj);
      } else {
        queue.messages.push(messageObj);
      }

      queue.stats.totalMessages++;
      this.processingStats.queueSizes[queueName] = queue.messages.length;

      // Log event
      this.logEvent("message_published", {
        queueName,
        messageId: messageObj.id,
        userId: options.userId,
      });

      // Emit event for real-time processing
      this.emit("message_published", { queueName, message: messageObj });

      // Process immediately if using in-memory queue
      if (this.useInMemoryQueue) {
        setImmediate(() => this.processQueue(queueName));
      }

      return messageObj.id;
    } catch (error) {
      console.error(
        `❌ MessageQueue: Failed to publish to "${queueName}":`,
        error
      );
      throw error;
    }
  }

  // Subscribe to queue messages
  subscribe(queueName, handler, options = {}) {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue "${queueName}" does not exist`);
      }

      const subscription = {
        id: this.generateSubscriptionId(),
        queueName,
        handler,
        options: {
          autoAck: options.autoAck !== false,
          batchSize: options.batchSize || 1,
          concurrency: options.concurrency || 1,
          ...options,
        },
        stats: {
          processedMessages: 0,
          failedMessages: 0,
          averageProcessingTime: 0,
        },
      };

      queue.subscribers.push(subscription);

      if (!this.subscribers.has(queueName)) {
        this.subscribers.set(queueName, []);
      }
      this.subscribers.get(queueName).push(subscription);

      console.log(`📨 MessageQueue: Subscribed to queue "${queueName}"`);
      return subscription.id;
    } catch (error) {
      console.error(
        `❌ MessageQueue: Failed to subscribe to "${queueName}":`,
        error
      );
      throw error;
    }
  }

  // Process queue messages
  async processQueue(queueName) {
    try {
      const queue = this.queues.get(queueName);
      if (!queue || queue.messages.length === 0) {
        return;
      }

      const message = queue.messages.shift();
      this.processingStats.queueSizes[queueName] = queue.messages.length;

      // Check if message should be delayed
      if (
        message.delay > 0 &&
        Date.now() - message.timestamp.getTime() < message.delay
      ) {
        queue.messages.unshift(message); // Put back at front
        return;
      }

      const startTime = Date.now();

      // Process with all subscribers
      for (const subscription of queue.subscribers) {
        try {
          await this.processMessageWithSubscription(message, subscription);
          subscription.stats.processedMessages++;
        } catch (error) {
          subscription.stats.failedMessages++;
          console.error(
            `❌ MessageQueue: Subscription processing failed:`,
            error
          );

          // Retry logic
          if (message.retryCount < message.maxRetries) {
            message.retryCount++;
            setTimeout(() => {
              queue.messages.unshift(message);
              this.processQueue(queueName);
            }, this.retryDelay * Math.pow(2, message.retryCount));
          } else {
            await this.moveToDeadLetterQueue(message);
          }
        }
      }

      const processingTime = Date.now() - startTime;
      this.updateProcessingStats(queue, processingTime);

      // Continue processing if more messages
      if (queue.messages.length > 0) {
        setImmediate(() => this.processQueue(queueName));
      }
    } catch (error) {
      console.error(
        `❌ MessageQueue: Failed to process queue "${queueName}":`,
        error
      );
    }
  }

  // Process message with specific subscription
  async processMessageWithSubscription(message, subscription) {
    try {
      const startTime = Date.now();

      // Call the handler
      await subscription.handler(message.payload, {
        messageId: message.id,
        queueName: message.queueName,
        timestamp: message.timestamp,
        retryCount: message.retryCount,
        metadata: message.metadata,
        userId: message.userId,
        sessionId: message.sessionId,
      });

      const processingTime = Date.now() - startTime;
      subscription.stats.averageProcessingTime =
        (subscription.stats.averageProcessingTime + processingTime) / 2;

      // Log successful processing
      this.logEvent("message_processed", {
        queueName: message.queueName,
        messageId: message.id,
        subscriptionId: subscription.id,
        processingTime,
      });
    } catch (error) {
      console.error("❌ MessageQueue: Message processing failed:", error);
      throw error;
    }
  }

  // Start queue processors
  startQueueProcessors() {
    if (this.useInMemoryQueue) {
      // Process queues every 100ms
      this.processingInterval = setInterval(() => {
        for (const queueName of this.queues.keys()) {
          this.processQueue(queueName);
        }
      }, 100);
    }
  }

  // Move message to dead letter queue
  async moveToDeadLetterQueue(message) {
    try {
      const dlqName = `${message.queueName}-dlq`;

      if (!this.queues.has(dlqName)) {
        this.createQueue(dlqName, { maxSize: 10000 });
      }

      const dlqMessage = {
        ...message,
        originalQueue: message.queueName,
        failedAt: new Date(),
        reason: "Max retries exceeded",
      };

      await this.publish(dlqName, dlqMessage, { priority: 0 });

      this.logEvent("message_moved_to_dlq", {
        originalQueue: message.queueName,
        messageId: message.id,
        dlqName,
      });
    } catch (error) {
      console.error("❌ MessageQueue: Failed to move to DLQ:", error);
    }
  }

  // Insert message by priority
  insertByPriority(messages, message) {
    let inserted = false;
    for (let i = 0; i < messages.length; i++) {
      if (message.priority > messages[i].priority) {
        messages.splice(i, 0, message);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      messages.push(message);
    }
  }

  // Update processing statistics
  updateProcessingStats(queue, processingTime) {
    queue.stats.processedMessages++;
    queue.stats.averageProcessingTime =
      (queue.stats.averageProcessingTime + processingTime) / 2;

    this.processingStats.totalProcessed++;
    this.processingStats.averageProcessingTime =
      (this.processingStats.averageProcessingTime + processingTime) / 2;
  }

  // Generate unique message ID
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate unique subscription ID
  generateSubscriptionId() {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Log events
  logEvent(eventType, data) {
    const event = {
      id: this.generateMessageId(),
      type: eventType,
      timestamp: new Date(),
      data,
    };

    this.eventLog.push(event);

    // Maintain log size
    if (this.eventLog.length > this.maxEventLogSize) {
      this.eventLog.shift();
    }

    // Emit for real-time monitoring
    this.emit("event_logged", event);
  }

  // Get queue statistics
  getQueueStats(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }

    return {
      name: queueName,
      messageCount: queue.messages.length,
      subscriberCount: queue.subscribers.length,
      stats: queue.stats,
      options: queue.options,
    };
  }

  // Get all statistics
  getAllStats() {
    const queueStats = {};
    for (const [queueName, queue] of this.queues.entries()) {
      queueStats[queueName] = this.getQueueStats(queueName);
    }

    return {
      global: this.processingStats,
      queues: queueStats,
      eventLogSize: this.eventLog.length,
      uptime: process.uptime(),
    };
  }

  // Get recent events
  getRecentEvents(limit = 100) {
    return this.eventLog.slice(-limit);
  }

  // Clear queue
  async clearQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (queue) {
      queue.messages = [];
      this.processingStats.queueSizes[queueName] = 0;
      this.logEvent("queue_cleared", { queueName });
      return true;
    }
    return false;
  }

  // Shutdown gracefully
  async shutdown() {
    try {
      console.log("🔄 MessageQueue: Shutting down...");

      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = null;
      }

      if (this.redis) {
        await this.redis.quit();
      }

      this.removeAllListeners();

      console.log("✅ MessageQueue: Shutdown complete");
    } catch (error) {
      console.error("❌ MessageQueue: Shutdown error:", error);
    }
  }
}

export default MessageQueueService;
