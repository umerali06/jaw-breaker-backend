import NursingCacheService from "./NursingCacheService.js";
import MockCacheService from "./MockCacheService.js";

class CacheFactory {
  static instance = null;
  static cacheService = null;

  static async createCacheService() {
    if (this.instance) {
      return this.instance;
    }

    try {
      // Try to initialize Redis cache first
      const redisCache = new NursingCacheService();
      const initialized = await redisCache.initialize();

      if (initialized) {
        console.log("✅ Using Redis-based NursingCacheService");
        this.cacheService = redisCache;
        this.instance = redisCache;

        // Set up error handling to fallback to mock cache
        redisCache.on("error", async (error) => {
          console.error("Redis cache error, considering fallback:", error);

          // If Redis fails critically, we might want to switch to mock cache
          if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
            console.warn("⚠️ Redis connection lost, switching to mock cache");
            await this.switchToMockCache();
          }
        });

        return this.instance;
      } else {
        throw new Error("Redis cache initialization failed");
      }
    } catch (error) {
      console.warn(
        "⚠️ Redis cache not available, using mock cache:",
        error.message
      );
      return await this.createMockCache();
    }
  }

  static async createMockCache() {
    const mockCache = new MockCacheService();
    await mockCache.initialize();

    console.log("✅ Using MockCacheService as fallback");
    this.cacheService = mockCache;
    this.instance = mockCache;

    return this.instance;
  }

  static async switchToMockCache() {
    try {
      // Clean up existing Redis connection
      if (this.instance && typeof this.instance.cleanup === "function") {
        await this.instance.cleanup();
      }

      // Create new mock cache instance
      await this.createMockCache();

      console.log("🔄 Successfully switched to mock cache");
      return this.instance;
    } catch (error) {
      console.error("Failed to switch to mock cache:", error);
      throw error;
    }
  }

  static getCacheService() {
    if (!this.instance) {
      throw new Error(
        "Cache service not initialized. Call createCacheService() first."
      );
    }
    return this.instance;
  }

  static async resetCacheService() {
    if (this.instance) {
      try {
        if (typeof this.instance.cleanup === "function") {
          await this.instance.cleanup();
        }
      } catch (error) {
        console.error("Error cleaning up cache service:", error);
      }
    }

    this.instance = null;
    this.cacheService = null;
  }

  static isRedisCache() {
    return this.instance instanceof NursingCacheService;
  }

  static isMockCache() {
    return this.instance instanceof MockCacheService;
  }

  static getCacheType() {
    if (this.isRedisCache()) {
      return "redis";
    } else if (this.isMockCache()) {
      return "mock";
    } else {
      return "unknown";
    }
  }

  static async healthCheck() {
    if (!this.instance) {
      return false;
    }

    try {
      return await this.instance.healthCheck();
    } catch (error) {
      console.error("Cache health check failed:", error);
      return false;
    }
  }

  static getPerformanceMetrics() {
    if (!this.instance || !this.instance.performanceMetrics) {
      return null;
    }

    return {
      ...this.instance.performanceMetrics,
      cacheType: this.getCacheType(),
      hitRate: this.instance.calculateHitRate
        ? this.instance.calculateHitRate()
        : 0,
    };
  }
}

export default CacheFactory;
