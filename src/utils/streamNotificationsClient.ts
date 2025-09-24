/**
 * Stream Notifications Client Management Utility  
 * Handles real-time notification feeds using Stream Feeds V3 API
 * Provides real-time updates for notifications bell
 */

import { FeedsClient } from '@stream-io/feeds-client';

interface StreamNotificationsConfig {
  token: string;
  apiKey: string;
  userId: string;
}

interface NotificationData {
  id: string;
  actor: string;
  verb: string;
  object: string;
  target?: string;
  text?: string;
  created_at: string;
  time: string;
  custom?: {
    notification_type: 'like' | 'comment' | 'follow';
    target_user: string;
    post_id?: string;
    comment_text?: string;
    actor_name?: string;
    actor_image?: string;
  };
}

interface NotificationCallbacks {
  onNewNotification?: (notification: NotificationData) => void;
  onNotificationUpdate?: (notification: NotificationData) => void;
  onUnreadCountChange?: (count: number) => void;
}

class StreamNotificationsManager {
  private client: FeedsClient | null = null;
  private config: StreamNotificationsConfig | null = null;
  private notificationFeed: any = null;
  private isSubscribed: boolean = false;
  private callbacks: NotificationCallbacks = {};
  private unreadCount: number = 0;

  /**
   * Initialize the Stream Notifications client with V3 SDK
   */
  async initialize(config: StreamNotificationsConfig): Promise<void> {
    try {
      console.log('🔔 Initializing Stream Notifications V3 client...');
      
      this.config = config;
      
      // Initialize V3 FeedsClient
      this.client = new FeedsClient(config.apiKey);
      
      // Connect user with token (V3 pattern)
      await this.client.connectUser({ id: config.userId }, config.token);
      
      console.log('✅ Stream Notifications V3 client initialized for user:', config.userId);
    } catch (error) {
      console.error('❌ Failed to initialize Stream Notifications V3 client:', error);
      throw error;
    }
  }

  /**
   * Set up real-time notification feed subscription
   */
  async subscribeToNotifications(): Promise<void> {
    if (!this.client || !this.config) {
      throw new Error('Stream notifications client not initialized');
    }

    if (this.isSubscribed) {
      console.log('⚠️ Already subscribed to notifications');
      return;
    }

    try {
      console.log(`🔔 Setting up notification feed subscription for user: ${this.config.userId}`);
      
      // Get or create user feed with state management (we'll filter for notifications)
      this.notificationFeed = this.client.feed('user', this.config.userId);
      
      await this.notificationFeed.getOrCreate({ 
        watch: true,
        pagination: {
          limit: 100, // Get more to filter for notifications
        },
      });

      // Set up real-time listeners for new notifications (filter for notification verb only)
      this.notificationFeed.on('activity.new', (data: any) => {
        console.log('🔔 New activity received:', data);
        
        // Only process notification activities
        if (data.activity?.verb === 'notification') {
          console.log('🔔 New notification received:', data);
          const notification = this.formatNotification(data.activity);
          
          // Update unread count
          this.unreadCount += 1;
          this.callbacks.onUnreadCountChange?.(this.unreadCount);
          
          // Trigger callback for new notification
          this.callbacks.onNewNotification?.(notification);
        }
      });

      // Set up listener for notification updates (filter for notification verb only)
      this.notificationFeed.on('activity.update', (data: any) => {
        console.log('🔔 Activity updated:', data);
        
        // Only process notification activities
        if (data.activity?.verb === 'notification') {
          console.log('🔔 Notification updated:', data);
          const notification = this.formatNotification(data.activity);
          this.callbacks.onNotificationUpdate?.(notification);
        }
      });

      // Set up listener for connection status
      this.notificationFeed.on('subscription.created', () => {
        console.log('✅ Notification feed subscription created');
        this.isSubscribed = true;
      });

      this.notificationFeed.on('subscription.deleted', () => {
        console.log('❌ Notification feed subscription deleted');
        this.isSubscribed = false;
      });

      console.log('✅ Notification feed subscription setup complete');
      
      // Fetch initial unread count
      await this.updateUnreadCount();

    } catch (error) {
      console.error('❌ Failed to subscribe to notifications:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from real-time notifications
   */
  async unsubscribeFromNotifications(): Promise<void> {
    if (this.notificationFeed && this.isSubscribed) {
      try {
        console.log('🔔 Unsubscribing from notifications...');
        await this.notificationFeed.unsubscribe();
        this.isSubscribed = false;
        console.log('✅ Unsubscribed from notifications');
      } catch (error) {
        console.error('❌ Failed to unsubscribe from notifications:', error);
      }
    }
  }

  /**
   * Set callbacks for notification events
   */
  setCallbacks(callbacks: NotificationCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Get current unread notification count
   */
  getUnreadCount(): number {
    return this.unreadCount;
  }

  /**
   * Mark notifications as read (for future implementation)
   */
  async markAsRead(notificationIds: string[]): Promise<void> {
    // This would require additional implementation
    // For now, just update the local unread count
    this.unreadCount = Math.max(0, this.unreadCount - notificationIds.length);
    this.callbacks.onUnreadCountChange?.(this.unreadCount);
  }

  /**
   * Update unread count by fetching latest notifications
   */
  private async updateUnreadCount(): Promise<void> {
    if (!this.notificationFeed) return;

    try {
      // Get activities and filter for notifications only
      const activities = await this.notificationFeed.get({ limit: 100 });
      const notifications = (activities.activities || []).filter((activity: any) => activity.verb === 'notification');
      this.unreadCount = Math.min(notifications.length, 25); // Limit to 25 for display
      this.callbacks.onUnreadCountChange?.(this.unreadCount);
      
      console.log(`🔔 Updated unread count: ${this.unreadCount}`);
    } catch (error) {
      console.error('❌ Failed to update unread count:', error);
    }
  }

  /**
   * Format notification data for consistency
   */
  private formatNotification(activity: any): NotificationData {
    return {
      id: activity.id,
      actor: activity.actor,
      verb: activity.verb,
      object: activity.object,
      target: activity.target,
      text: activity.text,
      created_at: activity.created_at || activity.time,
      time: activity.created_at || activity.time,
      custom: activity.custom || {}
    };
  }

  /**
   * Get the current user ID
   */
  getCurrentUserId(): string | null {
    return this.config?.userId || null;
  }

  /**
   * Check if currently subscribed to notifications
   */
  isSubscribedToNotifications(): boolean {
    return this.isSubscribed;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up Stream Notifications resources...');
    
    await this.unsubscribeFromNotifications();
    
    this.notificationFeed = null;
    this.config = null;
    this.callbacks = {};
    this.unreadCount = 0;
  }
}

// Export singleton instance
export const streamNotificationsManager = new StreamNotificationsManager();
export default streamNotificationsManager;
