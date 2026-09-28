import { cacheConfig, redisConfig } from "@/config/index.js";
import { redisClientIfReady } from "@/framework/redis/client.js";

function cacheKey(key: string) {
  return `${cacheConfig.keyPrefix}:${key}`;
}

// In-Memory L1 Cache Map for sub-millisecond lookups
const memoryStore = new Map<string, { value: any; expiresAt: number }>();

/**
 * Why: Provides multi-tier (L1 Memory + L2 Redis) cache helpers with graceful fallback.
 * When: Controllers/jobs need high-speed master data and computed results caching.
 * Where: Application module code via facade.
 * How: Checks in-memory store first, falls back to Redis, then executes callback.
 */
export const cache = {
  /**
   * Reads cached JSON value by key.
   */
  async get<T>(key: string, fallback: T | null = null): Promise<T | null> {
    const fullKey = cacheKey(key);
    const now = Date.now();

    // 1. Check L1 Memory Cache
    const memEntry = memoryStore.get(fullKey);
    if (memEntry) {
      if (memEntry.expiresAt > now) {
        return memEntry.value as T;
      }
      memoryStore.delete(fullKey);
    }

    // 2. Check L2 Redis Cache
    const client = redisClientIfReady();
    if (!client) return fallback;

    try {
      const value = await client.get(fullKey);
      if (value) {
        const parsed = JSON.parse(value) as T;
        memoryStore.set(fullKey, { value: parsed, expiresAt: now + 60000 }); // 1-min L1 buffer
        return parsed;
      }
    } catch {
      // Graceful fallback
    }

    return fallback;
  },

  /**
   * Stores value in cache with TTL (seconds).
   */
  async put(key: string, value: unknown, ttl = cacheConfig.ttlSeconds): Promise<boolean> {
    const fullKey = cacheKey(key);
    const now = Date.now();

    // Store in L1 Memory Cache
    memoryStore.set(fullKey, { value, expiresAt: now + (ttl * 1000) });

    // Store in L2 Redis Cache if available
    const client = redisClientIfReady();
    if (client) {
      try {
        await client.set(fullKey, JSON.stringify(value), "EX", ttl);
      } catch {
        // L1 memory cache will still serve
      }
    }
    return true;
  },

  /**
   * Deletes a cached value by key.
   */
  async forget(key: string): Promise<boolean> {
    const fullKey = cacheKey(key);
    memoryStore.delete(fullKey);

    const client = redisClientIfReady();
    if (client) {
      try {
        await client.del(fullKey);
      } catch {}
    }
    return true;
  },

  /**
   * Returns cached value or computes/stores a fresh one.
   */
  async remember<T>(key: string, ttl: number, callback: () => Promise<T>): Promise<T> {
    const cached = await cache.get<T>(key);
    if (cached !== null) return cached;

    const fresh = await callback();
    await cache.put(key, fresh, ttl);
    return fresh;
  },

  /**
   * Clears all matching cache keys by prefix.
   */
  async forgetByPrefix(prefix: string): Promise<void> {
    const targetPrefix = cacheKey(prefix);
    for (const k of memoryStore.keys()) {
      if (k.startsWith(targetPrefix)) {
        memoryStore.delete(k);
      }
    }

    const client = redisClientIfReady();
    if (client) {
      try {
        const pattern = `${targetPrefix}*`;
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } catch (err) {
        console.error(`Error deleting keys by prefix ${prefix} from Redis:`, err);
      }
    }
  },

  /**
   * Indicates whether cache backend is currently usable.
   */
  isAvailable() {
    return true;
  }
};
