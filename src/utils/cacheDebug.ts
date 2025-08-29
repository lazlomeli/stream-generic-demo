/**
 * Debug utilities for cache management
 */

import { apiCache, getCacheStats } from './apiCache';

// Global function to clear user cache (for debugging)
(window as any).clearUserCache = (userId: string) => {
  console.log(`🧹 Manually clearing cache for user: ${userId}`);
  apiCache.clearUserData(userId);
};

// Global function to clear all cache (for debugging)
(window as any).clearAllCache = () => {
  console.log(`🧹 Manually clearing all cache`);
  apiCache.clearAll();
};

// Global function to view cache stats (for debugging)
(window as any).viewCacheStats = () => {
  const stats = getCacheStats();
  console.log('📊 Cache Statistics:', stats);
  return stats;
};

// Global function to view specific user cache (for debugging)
(window as any).viewUserCache = (userId: string) => {
  const stats = getCacheStats();
  const userKeys = stats.cacheKeys.filter(key => key.includes(userId));
  console.log(`📊 Cache entries for user ${userId}:`, userKeys);
  return userKeys;
};

console.log('🛠️ Cache debug utilities loaded. Available commands:');
console.log('  clearUserCache("userId")     - Clear cache for specific user');
console.log('  clearAllCache()              - Clear all cache');
console.log('  viewCacheStats()             - View cache statistics');
console.log('  viewUserCache("userId")      - View cache for specific user');
