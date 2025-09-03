/**
 * Stream Feeds Client Management Utility  
 * Handles client-side Stream Feeds instances and real-time state management
 * Using GetStream Feeds V3 Alpha API exclusively
 */

import { FeedsClient } from '@stream-io/feeds-client';

interface StreamFeedsConfig {
  token: string;
  apiKey: string;
  userId: string;
}

interface UserCounts {
  followers: number;
  following: number;
}

class StreamFeedsManager {
  private client: FeedsClient | null = null;
  private config: StreamFeedsConfig | null = null;
  private userFeeds: Map<string, any> = new Map();
  private timelineFeeds: Map<string, any> = new Map();

  /**
   * Initialize the Stream Feeds V3 client
   */
  async initialize(config: StreamFeedsConfig): Promise<void> {
    try {
      console.log('🔌 Initializing Stream Feeds V3 client...');
      
      this.config = config;
      
      // Initialize V3 FeedsClient
      this.client = new FeedsClient(config.apiKey);
      
      // Connect user with token (V3 pattern)
      await this.client.connectUser({ id: config.userId }, config.token);
      
      console.log('✅ Stream Feeds V3 client initialized for user:', config.userId);
    } catch (error) {
      console.error('❌ Failed to initialize Stream Feeds V3 client:', error);
      throw error;
    }
  }

  /**
   * Get user feed with state management (V3 API)
   */
  async getUserFeed(userId: string): Promise<any> {
    if (!this.client) {
      throw new Error('Stream client not initialized');
    }

    if (this.userFeeds.has(userId)) {
      return this.userFeeds.get(userId);
    }

    try {
      console.log(`🔍 Creating user feed with state for: ${userId}`);
      const feed = this.client.feed('user', userId);
      
      // Initialize feed with state management (V3 pattern)
      await feed.getOrCreate({ 
        watch: true,
        followers_pagination: {
          limit: 1000,
        },
      });
      
      this.userFeeds.set(userId, feed);
      console.log(`✅ User feed created with state: user:${userId}`);
      
      return feed;
    } catch (error) {
      console.error(`❌ Failed to create user feed for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get timeline feed with state management (V3 API)
   */
  async getTimelineFeed(userId: string): Promise<any> {
    if (!this.client) {
      throw new Error('Stream client not initialized');
    }

    if (this.timelineFeeds.has(userId)) {
      return this.timelineFeeds.get(userId);
    }

    try {
      console.log(`🔍 Creating timeline feed with state for: ${userId}`);
      const feed = this.client.feed('timeline', userId);
      
      // Initialize feed with state management (V3 pattern)
      await feed.getOrCreate({ 
        watch: true,
        following_pagination: {
          limit: 1000,
        },
      });
      
      this.timelineFeeds.set(userId, feed);
      console.log(`✅ Timeline feed created with state: timeline:${userId}`);
      
      return feed;
    } catch (error) {
      console.error(`❌ Failed to create timeline feed for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get follower/following counts using V3 queryFollowers/queryFollowing API
   */
  async getUserCounts(userId: string): Promise<UserCounts> {
    try {
      console.log(`📊 Getting counts for user: ${userId} (using V2 backend API)`);
      
      // Use V2 backend API instead of V3 client
      const response = await fetch('/api/stream/get-user-counts-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.config?.userId || 'unknown',
          targetUserIds: [userId]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const userCounts = data.userCounts?.[userId];

      if (!userCounts) {
        console.warn(`⚠️ No counts found for ${userId}`);
        return { followers: 0, following: 0 };
      }

      console.log(`✅ V2 backend counts for ${userId}:`, {
        followers: userCounts.followers,
        following: userCounts.following
      });

      return {
        followers: userCounts.followers || 0,
        following: userCounts.following || 0
      };
    } catch (error) {
      console.error(`❌ Failed to get user counts for ${userId}:`, error);
      return { followers: 0, following: 0 };
    }
  }

  /**
   * Follow a user using V2 backend API
   */
  async followUser(targetUserId: string): Promise<void> {
    if (!this.config) {
      throw new Error('Stream client not initialized');
    }

    try {
      console.log(`👥 Following user: ${this.config.userId} → ${targetUserId} (using V2 backend)`);
      
      // Use V2 backend API for follow action
      const response = await fetch('/api/stream/feed-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.config.userId,
          action: 'follow_user',
          targetUserId: targetUserId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Follow action failed');
      }
      
      console.log(`✅ Successfully followed via V2 backend: ${this.config.userId} → ${targetUserId}`);
    } catch (error) {
      console.error(`❌ Failed to follow user ${targetUserId}:`, error);
      throw error;
    }
  }

  /**
   * Unfollow a user using V2 backend API
   */
  async unfollowUser(targetUserId: string): Promise<void> {
    if (!this.config) {
      throw new Error('Stream client not initialized');
    }

    try {
      console.log(`👥 Unfollowing user: ${this.config.userId} → ${targetUserId} (using V2 backend)`);
      
      // Use V2 backend API for unfollow action
      const response = await fetch('/api/stream/feed-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.config.userId,
          action: 'unfollow_user',
          targetUserId: targetUserId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Unfollow action failed');
      }
      
      console.log(`✅ Successfully unfollowed via V2 backend: ${this.config.userId} → ${targetUserId}`);
    } catch (error) {
      console.error(`❌ Failed to unfollow user ${targetUserId}:`, error);
      throw error;
    }
  }

  /**
   * Check if current user is following target user using V2 backend API
   */
  async isFollowing(targetUserId: string): Promise<boolean> {
    if (!this.config) {
      return false;
    }

    try {
      console.log(`🔍 Checking follow status: ${this.config.userId} → ${targetUserId} (using V2 backend)`);
      
      // Use V2 backend API for follow status check
      const response = await fetch('/api/stream/feed-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.config.userId,
          action: 'is_following',
          targetUserId: targetUserId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const isFollowing = data.isFollowing || false;

      console.log(`✅ Follow status via V2 backend: ${this.config.userId} → ${targetUserId} = ${isFollowing}`);
      return isFollowing;
    } catch (error) {
      console.error(`❌ Failed to check follow status for ${targetUserId}:`, error);
      return false;
    }
  }

  /**
   * Get the current user ID
   */
  getCurrentUserId(): string | null {
    return this.config?.userId || null;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    console.log('🧹 Cleaning up Stream Feeds resources...');
    this.userFeeds.clear();
    this.timelineFeeds.clear();
    this.client = null;
    this.config = null;
  }
}

// Export singleton instance
export const streamFeedsManager = new StreamFeedsManager();
export default streamFeedsManager;
