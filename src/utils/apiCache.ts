/**
 * Centralized API caching service to optimize performance and reduce redundant calls
 */

// Cache storage
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();

  // Cache TTL configurations (in milliseconds)
  private readonly TTL = {
    USER_COUNTS: 5 * 60 * 1000,      // 5 minutes
    USER_PROFILE: 10 * 60 * 1000,    // 10 minutes  
    USER_ID_MAPPING: 60 * 60 * 1000, // 1 hour
    STREAM_CHAT_USER: 15 * 60 * 1000, // 15 minutes
    FEED_TOKEN: 30 * 60 * 1000,      // 30 minutes
    FOLLOW_STATE: 5 * 60 * 1000,     // 5 minutes
    FOLLOWING_LIST: 5 * 60 * 1000,   // 5 minutes
  };

  /**
   * Generic cache getter with TTL check
   */
  private get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Generic cache setter
   */
  private set<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Request deduplication wrapper
   */
  private async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // If there's already a pending request for this key, wait for it
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    // Start new request and store the promise
    const promise = requestFn().finally(() => {
      // Clean up after request completes
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Get user counts with caching
   */
  getUserCounts(userId: string): { followers: number; following: number } | null {
    return this.get(`user_counts_${userId}`);
  }

  /**
   * Set user counts in cache
   */
  setUserCounts(userId: string, counts: { followers: number; following: number }): void {
    this.set(`user_counts_${userId}`, counts, this.TTL.USER_COUNTS);
  }

  /**
   * Batch fetch user counts with caching and deduplication
   */
  async fetchUserCountsBatch(
    userIds: string[], 
    fetchFn: (uncachedUserIds: string[]) => Promise<Record<string, { followers: number; following: number }>>
  ): Promise<Record<string, { followers: number; following: number }>> {
    const result: Record<string, { followers: number; following: number }> = {};
    const uncachedUserIds: string[] = [];

    // Check cache first
    userIds.forEach(userId => {
      const cached = this.getUserCounts(userId);
      if (cached) {
        result[userId] = cached;
      } else {
        uncachedUserIds.push(userId);
      }
    });

    // If all data is cached, return immediately
    if (uncachedUserIds.length === 0) {
      return result;
    }

    // Fetch uncached data with deduplication
    const cacheKey = `batch_user_counts_${uncachedUserIds.sort().join(',')}`;
    const freshData = await this.deduplicate(cacheKey, () => fetchFn(uncachedUserIds));

    // Cache fresh data and merge with cached data
    Object.entries(freshData).forEach(([userId, counts]) => {
      this.setUserCounts(userId, counts);
      result[userId] = counts;
    });

    return result;
  }

  /**
   * Get Stream Chat user data with caching
   */
  getStreamChatUser(userId: string): any | null {
    return this.get(`stream_chat_user_${userId}`);
  }

  /**
   * Set Stream Chat user data in cache
   */
  setStreamChatUser(userId: string, userData: any): void {
    this.set(`stream_chat_user_${userId}`, userData, this.TTL.STREAM_CHAT_USER);
  }

  /**
   * Fetch Stream Chat user data with caching and deduplication
   */
  async fetchStreamChatUser(
    userId: string,
    fetchFn: () => Promise<any>
  ): Promise<any> {
    // Check cache first
    const cached = this.getStreamChatUser(userId);
    if (cached) {
      console.log(`🎯 Using cached Stream Chat data for ${userId}`);
      return cached;
    }

    // Fetch with deduplication
    const cacheKey = `fetch_stream_chat_user_${userId}`;
    const userData = await this.deduplicate(cacheKey, fetchFn);

    // Only cache if we have valid user data with image
    if (userData && userData.image) {
      console.log(`💾 Caching Stream Chat data for ${userId} with image: ${userData.image.slice(0, 50)}...`);
      this.setStreamChatUser(userId, userData);
    } else if (userData) {
      console.log(`📝 Stream Chat data for ${userId} has no image - not caching`);
    } else {
      console.log(`❌ No Stream Chat data found for ${userId} - not caching`);
    }

    return userData;
  }

  /**
   * Get user profile data with caching
   */
  getUserProfile(userId: string): any | null {
    return this.get(`user_profile_${userId}`);
  }

  /**
   * Set user profile data in cache
   */
  setUserProfile(userId: string, profile: any): void {
    this.set(`user_profile_${userId}`, profile, this.TTL.USER_PROFILE);
  }

  /**
   * Invalidate user-related caches (useful after follow/unfollow)
   */
  invalidateUserData(userId: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => 
      key.includes(`_${userId}`) || key.includes(`${userId}_`)
    );
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics for debugging
   */
  getStats(): { totalEntries: number; pendingRequests: number; cacheKeys: string[] } {
    return {
      totalEntries: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      cacheKeys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clear specific user's cached data (useful when data is stale)
   */
  clearUserData(userId: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => 
      key.includes(`_${userId}`) || key.includes(`${userId}_`)
    );
    
    keysToDelete.forEach(key => {
      console.log(`🗑️ Clearing stale cache for key: ${key}`);
      this.cache.delete(key);
    });
  }

  /**
   * Clear user counts cache for specific users (useful after follow/unfollow)
   */
  clearUserCounts(userIds: string[]): void {
    userIds.forEach(userId => {
      const key = `user_counts_${userId}`;
      if (this.cache.has(key)) {
        console.log(`🗑️ Clearing user counts cache for: ${userId}`);
        this.cache.delete(key);
      }
    });
    
    // Also clear any batch cache keys that might include these users
    const batchKeysToDelete = Array.from(this.cache.keys()).filter(key => 
      key.startsWith('batch_user_counts_') && 
      userIds.some(userId => key.includes(userId))
    );
    
    batchKeysToDelete.forEach(key => {
      console.log(`🗑️ Clearing batch user counts cache: ${key}`);
      this.cache.delete(key);
    });
  }

  /**
   * Get follow state between two users
   */
  getFollowState(currentUserId: string, targetUserId: string): boolean | null {
    return this.get(`follow_state_${currentUserId}_${targetUserId}`);
  }

  /**
   * Set follow state between two users
   */
  setFollowState(currentUserId: string, targetUserId: string, isFollowing: boolean): void {
    this.set(`follow_state_${currentUserId}_${targetUserId}`, isFollowing, this.TTL.FOLLOW_STATE);
  }

  /**
   * Get list of users that a user is following
   */
  getFollowingList(userId: string): Set<string> | null {
    return this.get(`following_list_${userId}`);
  }

  /**
   * Set list of users that a user is following
   */
  setFollowingList(userId: string, followingSet: Set<string>): void {
    this.set(`following_list_${userId}`, followingSet, this.TTL.FOLLOWING_LIST);
  }

  /**
   * Update follow state after follow/unfollow action
   */
  updateFollowState(currentUserId: string, targetUserId: string, isNowFollowing: boolean): void {
    // Update the specific follow state
    this.setFollowState(currentUserId, targetUserId, isNowFollowing);
    
    // Update the following list cache
    const followingList = this.getFollowingList(currentUserId) || new Set<string>();
    if (isNowFollowing) {
      followingList.add(targetUserId);
    } else {
      followingList.delete(targetUserId);
    }
    this.setFollowingList(currentUserId, followingList);
    
    // Only clear specific counts that actually changed:
    // - currentUser's following count changed (they followed/unfollowed someone)
    // - targetUser's followers count changed (they gained/lost a follower)
    this.clearUserCounts([currentUserId, targetUserId]);
    
    console.log(`📝 Updated follow state: ${currentUserId} ${isNowFollowing ? 'follows' : 'unfollows'} ${targetUserId}`);
    console.log(`🔄 Cache cleared for: ${currentUserId} (following count) & ${targetUserId} (followers count)`);
  }

  /**
   * Clear follow-related cache for specific users
   */
  clearFollowData(currentUserId: string, targetUserId?: string): void {
    if (targetUserId) {
      // Clear specific follow relationship
      const followKey = `follow_state_${currentUserId}_${targetUserId}`;
      this.cache.delete(followKey);
      console.log(`🗑️ Cleared follow state: ${currentUserId} -> ${targetUserId}`);
    }
    
    // Clear following list
    const followingKey = `following_list_${currentUserId}`;
    this.cache.delete(followingKey);
    console.log(`🗑️ Cleared following list for: ${currentUserId}`);
    
    // Clear any follow states where this user is the follower
    const followKeysToDelete = Array.from(this.cache.keys()).filter(key =>
      key.startsWith(`follow_state_${currentUserId}_`)
    );
    
    followKeysToDelete.forEach(key => {
      this.cache.delete(key);
      console.log(`🗑️ Cleared follow state key: ${key}`);
    });
  }

  /**
   * Clear all cache (useful for logout)
   */
  clearAll(): void {
    console.log(`🗑️ Clearing all cache (${this.cache.size} entries)`);
    this.cache.clear();
    this.pendingRequests.clear();
  }
}

// Export singleton instance
export const apiCache = new APICache();

// Export cache statistics for debugging
export const getCacheStats = () => apiCache.getStats();
