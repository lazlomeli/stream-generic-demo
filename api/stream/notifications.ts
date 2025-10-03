import { connect } from 'getstream'; // Use V2 for production stability
import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface NotificationActivity {
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
    aggregated_count?: number;
    actor_names?: string[];
  };
  userInfo?: {
    name: string;
    image?: string;
    role?: string;
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔔 NOTIFICATIONS: Request received:', {
      action: req.body?.action,
      userId: req.body?.userId,
      method: req.method,
      hasBody: !!req.body
    });
    
    const { action, userId } = req.body;

    // Enhanced validation for userId
    if (!userId || !action || typeof userId !== 'string' || userId.trim() === '') {
      console.error('❌ NOTIFICATIONS: Missing or invalid required fields:', { 
        userId: userId, 
        userIdType: typeof userId,
        action: !!action 
      });
      return res.status(400).json({ error: 'userId and action are required and userId must be a non-empty string' });
    }

    // Trim userId to ensure no whitespace issues
    const trimmedUserId = userId.trim();
    
    console.log('🔔 NOTIFICATIONS: Using userId for Stream API:', {
      originalUserId: userId,
      trimmedUserId: trimmedUserId,
      userIdLength: trimmedUserId.length,
      action: action
    });

    // Get Stream API credentials with fallbacks
    const apiKey = process.env.STREAM_API_KEY || process.env.VITE_STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET || process.env.VITE_STREAM_API_SECRET;

    // Debug environment variables in production
    console.log('🔑 Environment variables check:', {
      hasStreamApiKey: !!process.env.STREAM_API_KEY,
      hasViteStreamApiKey: !!process.env.VITE_STREAM_API_KEY,
      hasStreamApiSecret: !!process.env.STREAM_API_SECRET,
      hasViteStreamApiSecret: !!process.env.VITE_STREAM_API_SECRET,
      apiKeyUsed: apiKey ? `${apiKey.slice(0, 8)}...` : 'none',
      apiSecretUsed: apiSecret ? `${apiSecret.slice(0, 8)}...` : 'none'
    });

    if (!apiKey || !apiSecret) {
      console.error('❌ Missing Stream API credentials:', {
        apiKey: !!apiKey,
        apiSecret: !!apiSecret,
        envKeys: Object.keys(process.env).filter(key => key.includes('STREAM'))
      });
      return res.status(500).json({ 
        error: 'Missing Stream API credentials',
        debug: {
          hasApiKey: !!apiKey,
          hasApiSecret: !!apiSecret,
          availableStreamEnvs: Object.keys(process.env).filter(key => key.includes('STREAM'))
        }
      });
    }

    console.log('🔔 NOTIFICATIONS: Initializing Stream V2 client for production stability...');
    
    // Initialize Stream V2 Feeds client (server-side access)
    const serverClient = connect(apiKey, apiSecret, undefined);
    
    console.log('✅ NOTIFICATIONS: Stream V2 client initialized successfully');

    switch (action) {
      case 'get_notifications':
        try {
          console.log(`🔔 GET_NOTIFICATIONS: Fetching notifications for user ${trimmedUserId}`);
          
          // Get notifications from the user's personal feed (filtering for notification activities)
          const userFeed = serverClient.feed('user', trimmedUserId);
          const result = await userFeed.get({
            limit: 100, // Get more activities to filter from
            offset: 0,
            withReactionCounts: false,
            withOwnReactions: false,
          });

          console.log(`🔔 GET_NOTIFICATIONS_DEBUG: Retrieved ${result.results?.length || 0} total activities for user ${trimmedUserId}`);
          console.log(`🔔 GET_NOTIFICATIONS_DEBUG: Activity verbs found:`, result.results?.map((a: any) => a.verb) || []);

          // Filter for notification activities only
          const notifications = (result.results || []).filter(activity => 
            activity.verb === 'notification'
          ).slice(0, 25); // Take only the first 25 notifications
          
          console.log(`✅ GET_NOTIFICATIONS_DEBUG: Found ${notifications.length} notifications for user ${trimmedUserId}`);
          console.log(`🔔 GET_NOTIFICATIONS_DEBUG: Notification types:`, notifications.map((n: any) => n.custom?.notification_type || 'unknown'));
          console.log(`🔔 GET_NOTIFICATIONS_DEBUG: Notification actors:`, notifications.map((n: any) => n.actor));
          console.log(`🔔 GET_NOTIFICATIONS_DEBUG: Notification targets:`, notifications.map((n: any) => n.target));

          // Enrich notifications with user information
          const enrichedNotifications: NotificationActivity[] = [];
          
          for (const notification of notifications) {
            try {
              // Try to get user profile information for the actor
              let userInfo = {
                name: notification.actor,
                image: undefined,
                role: undefined
              };
              
              try {
                const actorProfile = await serverClient.user(notification.actor).get();
                if (actorProfile.data) {
                  const userData = actorProfile.data;
                  userInfo = {
                    name: userData.name || userData.username || notification.actor,
                    image: userData.image || userData.profile_image || undefined,
                    role: userData.role || undefined
                  };
                }
              } catch (userError: any) {
                // Handle user not found gracefully
                if (userError?.response?.status === 404 || userError?.error?.status_code === 404) {
                  console.log(`👤 GET_NOTIFICATIONS_DEBUG: User ${notification.actor} not found in Stream user database - using fallback for notifications`);
                } else {
                  console.warn(`❌ GET_NOTIFICATIONS_DEBUG: Failed to fetch user profile for ${notification.actor}:`, userError?.message);
                }
                // Keep the default userInfo (actor ID as name)
              }
              
              enrichedNotifications.push({
                id: notification.id,
                actor: notification.actor,
                verb: notification.verb,
                object: notification.object,
                target: notification.target,
                text: notification.text,
                created_at: notification.created_at || notification.time,
                time: notification.created_at || notification.time,
                custom: notification.custom || {},
                userInfo: userInfo
              });
            } catch (enrichError) {
              console.warn(`❌ GET_NOTIFICATIONS_DEBUG: Failed to enrich notification ${notification.id}:`, enrichError);
              // Add the notification without enrichment
              enrichedNotifications.push({
                id: notification.id,
                actor: notification.actor,
                verb: notification.verb,
                object: notification.object,
                target: notification.target,
                text: notification.text,
                created_at: notification.created_at || notification.time,
                time: notification.created_at || notification.time,
                custom: notification.custom || {}
              });
            }
          }

          console.log(`✅ GET_NOTIFICATIONS_DEBUG: Returning ${enrichedNotifications.length} enriched notifications`);

          return res.json({
            success: true,
            notifications: enrichedNotifications
          });
        } catch (error) {
          console.error('❌ GET_NOTIFICATIONS_DEBUG: Error fetching notifications:', error);
          return res.status(500).json({
            error: 'Failed to fetch notifications',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }

      case 'mark_read':
        const { notificationIds } = req.body;
        if (!notificationIds || !Array.isArray(notificationIds)) {
          return res.status(400).json({ error: 'notificationIds array is required' });
        }

        try {
          console.log(`🔔 MARK_READ: Marking ${notificationIds.length} notifications as read for user ${trimmedUserId}`);
          
          // Mark notifications as read by adding a "read" reaction to each notification
          const markReadPromises = notificationIds.map(async (notificationId: string) => {
            try {
              // Add a "read" reaction to the notification
              await serverClient.reactions.add(
                'read',
                notificationId,
                { read_at: new Date().toISOString() },
                { userId: trimmedUserId }
              );
              console.log(`✅ Marked notification ${notificationId} as read`);
            } catch (error) {
              console.error(`❌ Failed to mark notification ${notificationId} as read:`, error);
            }
          });
          
          await Promise.all(markReadPromises);
          
          return res.json({
            success: true,
            message: `Marked ${notificationIds.length} notifications as read`
          });
        } catch (error) {
          console.error('❌ Error marking notifications as read:', error);
          return res.status(500).json({
            error: 'Failed to mark notifications as read',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }

      case 'get_unread_count':
        try {
          console.log(`🔔 GET_UNREAD_COUNT: Getting unread notification count for user ${trimmedUserId}`);
          
          // Get notifications from the user's personal feed (filtering for notification activities)
          const userFeed = serverClient.feed('user', trimmedUserId);
          const result = await userFeed.get({
            limit: 100, // Get more activities to filter from
            offset: 0,
            withReactionCounts: false,
            withOwnReactions: false,
          });

          // Filter for notification activities only
          const notifications = (result.results || []).filter(activity => 
            activity.verb === 'notification'
          );
          
          // Check which notifications have been read by checking for "read" reactions
          const unreadNotifications = [];
          for (const notification of notifications) {
            try {
              // Check if this notification has a "read" reaction from this user
              const readReactions = await serverClient.reactions.filter({
                kind: 'read',
                activity_id: notification.id,
                limit: 1
              });
              
              // If no read reaction found, it's unread
              if (!readReactions.results || readReactions.results.length === 0) {
                unreadNotifications.push(notification);
              }
            } catch (error) {
              console.warn(`❌ Failed to check read status for notification ${notification.id}:`, error);
              // If we can't check read status, assume it's unread
              unreadNotifications.push(notification);
            }
          }
          
          const unreadCount = unreadNotifications.length;
          
          console.log(`✅ Found ${unreadCount} unread notifications for user ${trimmedUserId}`);

          return res.json({
            success: true,
            unreadCount: unreadCount
          });
        } catch (error) {
          console.error('❌ Error getting unread count:', error);
          return res.status(500).json({
            error: 'Failed to get unread count',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error: any) {
    const { action, userId } = req.body || {};
    const trimmedUserId = typeof userId === 'string' ? userId.trim() : userId;
    
    console.error('❌ NOTIFICATIONS: Critical error in notifications API:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      action: action,
      userId: trimmedUserId
    });
    res.status(500).json({ 
      error: 'Failed to process notification request',
      details: error instanceof Error ? error.message : String(error),
      action: action,
      userId: trimmedUserId
    });
  }
}
