// import { FeedsClient } from '@stream-io/feeds-client'; // Disabled - V3 alpha causing 500 errors
import { connect } from 'getstream'; // Use V2 for production stability
import * as jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Define a basic type for the user profile response
interface UserProfileResponse {
  [key: string]: {
    name?: string;
    username?: string;
    image?: string;
    profile_image?: string;
    role?: string;
    company?: string;
  };
}

// Helper function to process a bookmarked activity
async function processBookmarkedActivity(
  activity: any,
  bookmarkReaction: any,
  serverClient: any,
  trimmedUserId: string
) {
  console.log(`📖 Processing bookmarked activity: ${activity.id} by ${activity.actor}`);
  
  // Enrich with user information
  let userInfo: {
    name: string;
    image: string | undefined;
    role: string | undefined;
    company: string | undefined;
  } = {
    name: activity.actor,
    image: undefined,
    role: undefined,
    company: undefined
  };
  
  try {
    // Priority 1: Use userProfile data stored directly in the activity
    if (activity.userProfile && activity.userProfile.name) {
      console.log(`✅ Using stored userProfile for ${activity.actor}:`, activity.userProfile);
      userInfo = {
        name: activity.userProfile.name,
        image: activity.userProfile.image || undefined,
        role: activity.userProfile.role || undefined,
        company: activity.userProfile.company || undefined
      };
    }
    // Priority 2: Fallback to Stream's user profile system
    else if (serverClient.getUsers) {
      try {
        const userProfile = await serverClient.getUsers([activity.actor]) as UserProfileResponse;
        const userData = userProfile[activity.actor];
        if (userData) {
          userInfo = {
            name: userData.name || userData.username || activity.actor,
            image: userData.image || userData.profile_image || undefined,
            role: userData.role || undefined,
            company: userData.company || undefined
          };
        }
      } catch (getUserError: any) {
        // Handle user not found gracefully
        if (getUserError?.response?.status === 404 || getUserError?.error?.status_code === 404) {
          console.log(`👤 User ${activity.actor} not found in Stream user database - using fallback for bookmarks`);
        } else {
          console.warn(`❌ Failed to fetch user profile for ${activity.actor}:`, getUserError?.message);
        }
        // Keep the default userInfo (actor ID as name)
      }
    }
  } catch (userError) {
    console.warn(`Failed to fetch user profile for ${activity.actor}:`, userError);
    // Keep the default userInfo (actor ID as name)
  }
  
  return {
    id: activity.id, // Use activity id for highlighting
    activity_id: activity.id,
    actor: activity.actor || 'Unknown',
    verb: activity.verb || 'post',
    object: activity.object || 'post',
    text: activity.text || 'No content',
    attachments: activity.attachments || [],
    custom: activity.custom || {},
    created_at: activity.created_at || activity.time,
    time: activity.created_at || activity.time,
    reaction_counts: activity.reaction_counts || {},
    own_reactions: activity.own_reactions || {},
    reaction_id: bookmarkReaction?.id, // Keep the reaction ID for removal
    bookmarked_at: bookmarkReaction?.created_at, // When user bookmarked this post
    userInfo: userInfo, // Add enriched user information
    userProfile: activity.userProfile // Store the full user profile
  };
}

// Helper function to create notification activities
async function createNotificationActivity(
  serverClient: any,
  notificationType: 'like' | 'comment' | 'follow',
  actorUserId: string,
  targetUserId: string,
  postId?: string,
  commentText?: string
) {
  try {
    // Don't create notifications for self-actions
    if (actorUserId === targetUserId) {
      console.log(`🔔 Skipping notification: actor and target are the same user (${actorUserId})`);
      return;
    }

    console.log(`🔔 Creating ${notificationType} notification: ${actorUserId} → ${targetUserId}`);

    // Get actor user profile for the notification
    let actorProfile = {
      name: actorUserId,
      image: undefined
    };

    try {
      const userProfileResponse = await serverClient.user(actorUserId).get();
      if (userProfileResponse.data) {
        const userData = userProfileResponse.data;
        actorProfile = {
          name: userData.name || userData.username || actorUserId,
          image: userData.image || userData.profile_image || undefined
        };
      }
    } catch (userError) {
      console.log(`⚠️ Could not fetch user profile for ${actorUserId}, using fallback`);
    }

    // Create notification activity data
    let notificationData: any = {
      actor: actorUserId,
      verb: 'notification',
      object: notificationType,
      target: targetUserId,
      custom: {
        notification_type: notificationType,
        target_user: targetUserId,
        actor_name: actorProfile.name,
        actor_image: actorProfile.image
      }
    };

    // Add type-specific data
    switch (notificationType) {
      case 'like':
        notificationData.text = `${actorProfile.name} liked your post`;
        notificationData.custom.post_id = postId;
        break;
      case 'comment':
        notificationData.text = `${actorProfile.name} commented on your post`;
        notificationData.custom.post_id = postId;
        notificationData.custom.comment_text = commentText?.substring(0, 100) || '';
        break;
      case 'follow':
        notificationData.text = `${actorProfile.name} followed you`;
        break;
    }

    // Add notification to target user's personal feed with notification verb
    // We'll filter these out from regular feeds display but show them in notifications
    const userFeed = serverClient.feed('user', targetUserId);
    const notificationActivity = await userFeed.addActivity(notificationData);
    
    console.log(`✅ Notification created: ${notificationActivity.id}`);
    return notificationActivity;
  } catch (error) {
    console.error(`❌ Failed to create ${notificationType} notification:`, error);
    // Don't throw error - notifications are not critical
  }
}

// Helper function to get post author from activity
async function getPostAuthor(serverClient: any, postId: string): Promise<string | null> {
  try {
    // Try to get the activity from global feed first
    const globalFeed = serverClient.feed('flat', 'global');
    const activities = await globalFeed.get({ limit: 100, withReactionCounts: false });
    
    // Find the activity by ID
    const activity = activities.results?.find((act: any) => act.id === postId);
    if (activity && activity.actor) {
      console.log(`📍 Found post author: ${activity.actor} for post ${postId}`);
      return activity.actor;
    }

    console.log(`⚠️ Could not find post author for post ${postId}`);
    return null;
  } catch (error) {
    console.error(`❌ Error getting post author for ${postId}:`, error);
    return null;
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔧 FEED-ACTIONS: Request received:', {
      action: req.body?.action,
      userId: req.body?.userId,
      targetUserId: req.body?.targetUserId,
      method: req.method,
      hasBody: !!req.body
    });
    
    const { action, userId, postData, postId } = req.body;

    // Enhanced validation for userId
    if (!userId || !action || typeof userId !== 'string' || userId.trim() === '') {
      console.error('❌ FEED-ACTIONS: Missing or invalid required fields:', { 
        userId: userId, 
        userIdType: typeof userId,
        userIdTrimmed: userId?.trim?.(),
        userIdLength: userId?.length,
        action: !!action 
      });
      return res.status(400).json({ error: 'userId and action are required and userId must be a non-empty string' });
    }

    // Trim userId to ensure no whitespace issues
    const trimmedUserId = userId.trim();
    
    console.log('🔧 FEED-ACTIONS: Using userId for Stream API:', {
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

    console.log('🔧 FEED-ACTIONS: Initializing Stream V2 client for production stability...');
    
    // Initialize Stream V2 Feeds client (server-side access)
    const serverClient = connect(apiKey, apiSecret, undefined);
    
    console.log('✅ FEED-ACTIONS: Stream V2 client initialized successfully');

    switch (action) {
      case 'create_post':
        // Allow posts with either text or attachments (or both)
        if (!postData?.text && (!postData?.attachments || postData.attachments.length === 0)) {
          return res.status(400).json({ error: 'Post must have either text or attachments' });
        }

        // First, update the user's profile in Stream with their Auth0 information
        try {
          const { userProfile } = req.body;
          if (userProfile) {
            await serverClient.setUser({
              id: trimmedUserId,
              name: userProfile.name,
              image: userProfile.image,
              role: userProfile.role,
              company: userProfile.company
            });
          }
        } catch (profileError) {
          console.warn('Failed to update user profile:', profileError);
          // Continue with post creation even if profile update fails
        }

        // Extract user profile information from request
        const userProfile = req.body.userProfile || {};
        
        console.log('📝 Creating post:', postData.text ? postData.text.substring(0, 50) + '...' : '[Media only post]');
        console.log('👤 User profile data:', JSON.stringify(userProfile, null, 2));
        
        // Create post activity data
        const activityData = {
          actor: trimmedUserId,
          verb: 'post',
          object: postData.text && postData.text.trim() ? 'post' : 'media', // Use 'media' for media-only posts
          text: postData.text || '', // Allow empty text for media-only posts
          attachments: postData.attachments || [],
          custom: {
            likes: 0,
            shares: 0,
            comments: 0,
            category: postData.category || 'general'
          },
          // Store complete user profile information in the post
          userProfile: {
            name: userProfile.name || trimmedUserId,
            image: userProfile.image || undefined,
            role: userProfile.role || 'User',
            company: userProfile.company || undefined,
            // Store additional Auth0 profile data
            given_name: userProfile.given_name || undefined,
            family_name: userProfile.family_name || undefined,
            nickname: userProfile.nickname || undefined,
            email: userProfile.email || undefined,
            sub: userProfile.sub || trimmedUserId
          }
        };

        // Ensure user follows themselves (timeline:user follows user:user)
        try {
          const timelineFeed = serverClient.feed('timeline', trimmedUserId);
          await timelineFeed.follow('user', trimmedUserId);
          console.log(`✅ Ensured self-follow: timeline:${trimmedUserId} → user:${trimmedUserId}`);
        } catch (followError) {
          // This might fail if already following, which is fine
          console.log(`ℹ️ Self-follow already exists or error (this is normal):`, followError.message);
        }

        // Create post in BOTH global feed AND user's personal feed
        console.log('📝 Creating post in both global and user feeds...');
        const [globalActivity, userActivity] = await Promise.all([
          // Global feed for main feed display
          serverClient.feed('flat', 'global').addActivity(activityData),
          // User's personal feed for profile and follow relationships
          serverClient.feed('user', trimmedUserId).addActivity(activityData)
        ]);

        console.log('✅ Post created in global feed with ID:', globalActivity.id);
        console.log('✅ Post created in user feed with ID:', userActivity.id);

        // Return the global activity (for consistency with existing code)
        const newActivity = globalActivity;

        console.log('✅ Post created with ID:', newActivity.id);

        return res.json({
          success: true,
          message: 'Post created successfully',
          activity: newActivity
        });

      case 'delete_post':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        // Remove from global flat feed
        await serverClient.feed('flat', 'global').removeActivity(postId);
        
        // Remove from user's personal feed
        await serverClient.feed('user', trimmedUserId).removeActivity(postId);
        
        // Remove from user's timeline feed
        await serverClient.feed('timeline', trimmedUserId).removeActivity(postId);

        return res.json({
          success: true,
          message: 'Post deleted successfully'
        });

      case 'like_post':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        console.log('👍 LIKE_POST: Adding like reaction:', { userId, postId });
        
        // Add reaction using server client for proper attribution (V2 requires userId)
        const likeResult = await serverClient.reactions.add('like', postId, {}, { userId: trimmedUserId });
        
        console.log('✅ LIKE_POST: Like added successfully:', likeResult?.id || 'success');

        // Create notification for the post author
        console.log(`🔔 About to create like notification for post: ${postId}`);
        const postAuthor = await getPostAuthor(serverClient, postId);
        console.log(`🔔 Found post author: ${postAuthor}`);
        if (postAuthor) {
          try {
            await createNotificationActivity(serverClient, 'like', trimmedUserId, postAuthor, postId);
            console.log(`✅ Like notification creation completed`);
          } catch (notificationError) {
            console.error(`❌ Like notification failed:`, notificationError);
          }
        } else {
          console.log(`⚠️ No post author found, skipping like notification`);
        }

        return res.json({
          success: true,
          message: 'Post liked successfully',
          reactionId: likeResult?.id
        });

      case 'unlike_post':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }   
        
        try {
          // Get user's like reactions for this activity using the correct API approach
          const userReactions = await serverClient.reactions.filter({
            kind: 'like',
            user_id: trimmedUserId
          });

          // Filter to find reactions for this specific activity
          const activityReaction = userReactions.results?.find(reaction => reaction.activity_id === postId);

          if (activityReaction) {
            
            await serverClient.reactions.delete(activityReaction.id);
            
          } else {
            
          }

          return res.json({
            success: true,
            message: 'Post unliked successfully'
          });
        } catch (error) {
          console.error('💔 Error unliking post:', error);
          return res.status(500).json({ 
            error: 'Failed to unlike post',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }

      case 'add_comment':
        if (!postId || !postData?.text) {
          return res.status(400).json({ error: 'postId and comment text are required' });
        }

        console.log('💬 ADD_COMMENT: Adding comment reaction:', { userId, postId, text: postData.text.substring(0, 50) });
        
        // Add comment using server client for proper attribution (V2 requires userId)
        const comment = await serverClient.reactions.add('comment', postId, {
          text: postData.text
        }, { userId: trimmedUserId });
        
        console.log('✅ ADD_COMMENT: Comment added successfully:', comment?.id || 'success');

        // Create notification for the post author
        console.log(`🔔 About to create comment notification for post: ${postId}`);
        const commentPostAuthor = await getPostAuthor(serverClient, postId);
        console.log(`🔔 Found comment post author: ${commentPostAuthor}`);
        if (commentPostAuthor) {
          try {
            await createNotificationActivity(serverClient, 'comment', trimmedUserId, commentPostAuthor, postId, postData.text);
            console.log(`✅ Comment notification creation completed`);
          } catch (notificationError) {
            console.error(`❌ Comment notification failed:`, notificationError);
          }
        } else {
          console.log(`⚠️ No comment post author found, skipping comment notification`);
        }

        return res.json({
          success: true,
          message: 'Comment added successfully',
          comment
        });

      case 'bookmark_post':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        console.log('🔖 BOOKMARK_POST: Adding bookmark reaction:', { userId, postId });
        
        // Add bookmark reaction using server client (V2 requires userId)
        const bookmarkResult = await serverClient.reactions.add('bookmark', postId, {}, { userId: trimmedUserId });
        
        console.log('✅ BOOKMARK_POST: Bookmark added successfully:', bookmarkResult?.id || 'success');

        return res.json({
          success: true,
          message: 'Post bookmarked successfully',
          reactionId: bookmarkResult?.id
        });

      case 'remove_bookmark':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        
        
        try {
          // Get user's bookmark reactions using the correct API approach
          const userBookmarkReactions = await serverClient.reactions.filter({
            kind: 'bookmark',
            user_id: trimmedUserId
          });

          

          // Filter to find reactions for this specific activity
          const activityReaction = userBookmarkReactions.results?.find(reaction => reaction.activity_id === postId);

          if (activityReaction) {
            
            await serverClient.reactions.delete(activityReaction.id);
            
          } else {
            
          }

          return res.json({
            success: true,
            message: 'Bookmark removed successfully'
          });
        } catch (error) {
          console.error('🔖 Error removing bookmark:', error);
          return res.status(500).json({ 
            error: 'Failed to remove bookmark',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }

      case 'get_comments':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        // Get all comments for the post using server client
        const comments = await serverClient.reactions.filter({
          activity_id: postId,
          kind: 'comment'
        });

        return res.json({
          success: true,
          comments: comments.results || []
        });

      case 'get_bookmarked_posts':
        console.log(`🚨 NEW CODE LOADING: This is the updated get_bookmarked_posts implementation!`);
        console.log(`📖 Getting bookmarked posts for user: ${trimmedUserId}`);
        console.log(`📖 DEBUG: Starting get_bookmarked_posts implementation...`);
        
        // Get all bookmark reactions for the user (activity data will be fetched separately)
        const bookmarkReactions = await serverClient.reactions.filter({
          kind: 'bookmark',
          user_id: trimmedUserId
        });

        console.log(`📖 Bookmark reactions found: ${bookmarkReactions.results?.length || 0}`);
        
        if (!bookmarkReactions.results || bookmarkReactions.results.length === 0) {
          return res.json({
            success: true,
            bookmarkedPosts: []
          });
        }

        // Get activity IDs to fetch from multiple feed sources
        const activityIds = bookmarkReactions.results.map(r => r.activity_id);
        console.log(`📖 Activity IDs: ${JSON.stringify(activityIds)}`);
        console.log(`📖 DEBUG: About to start multi-feed search for ${activityIds.length} activities...`);
        
        // ENHANCED APPROACH: Try to fetch activities from multiple feed sources
        const foundActivities = new Map<string, any>();
        
        // Try multiple feed sources to find the activities (prioritize timeline feed first)
        const feedSources = [
          { type: 'timeline', id: trimmedUserId }, // Try timeline first since that's where main posts come from
          { type: 'user', id: trimmedUserId },
          { type: 'flat', id: 'global' }
        ];
        
        // Also search for timestamped user feeds (pattern: originalUserId_timestamp)
        // Extract unique actors from activity IDs and add their user feeds
        const uniqueActors = new Set<string>();
        
        // Try to extract actor IDs from the existing global feed to find timestamped users
        try {
          const globalFeed = serverClient.feed('flat', 'global');
          const globalActivities = await globalFeed.get({ limit: 100 });
          
          if (globalActivities.results && globalActivities.results.length > 0) {
            for (const activity of globalActivities.results) {
              const activityAny = activity as any; // Cast to access actor property
              if (activityAny.actor && activityAny.actor.includes('_') && /\d{13}$/.test(activityAny.actor)) {
                uniqueActors.add(activityAny.actor);
              }
            }
          }
          
          // Add timestamped user feeds to search
          for (const actor of Array.from(uniqueActors)) { // Convert Set to Array for iteration
            feedSources.push({ type: 'user', id: actor });
          }
          
          console.log(`📖 Added ${uniqueActors.size} timestamped user feeds to search`);
        } catch (globalError) {
          console.warn(`⚠️ Could not search global feed for timestamped users:`, globalError.message);
        }
        
        console.log(`📖 DEBUG: Starting to search ${feedSources.length} feed sources...`);
        
        for (const feedSource of feedSources) {
          try {
            console.log(`📖 Searching for activities in ${feedSource.type}:${feedSource.id}...`);
            const feed = serverClient.feed(feedSource.type, feedSource.id);
            const feedData = await feed.get({ 
              limit: 200, // Increase limit to find more activities
              withReactionCounts: true,
              withOwnReactions: true
            });
            
            console.log(`📖 Feed activities found: ${feedData.results?.length || 0}`);
            
            // Find activities matching our bookmark activity IDs
            if (feedData.results && feedData.results.length > 0) {
              for (const activity of feedData.results) {
                const activityAny = activity as any; // Cast to access properties
                if (activityIds.includes(activityAny.id) && !foundActivities.has(activityAny.id)) {
                  console.log(`✅ Found bookmarked activity ${activityAny.id} in ${feedSource.type}:${feedSource.id}`);
                  foundActivities.set(activityAny.id, activityAny);
                }
              }
            }
          } catch (feedError) {
            console.warn(`⚠️ Could not fetch from ${feedSource.type}:${feedSource.id}:`, feedError.message);
          }
        }
        
        console.log(`📖 Total activities found: ${foundActivities.size} out of ${activityIds.length} bookmarked`);
        
        // Process found activities and create bookmarked posts
        const bookmarkedPosts = await Promise.all(
          bookmarkReactions.results.map(async (bookmarkReaction: any) => {
            const activity = foundActivities.get(bookmarkReaction.activity_id);
            
            if (!activity) {
              console.warn(`⚠️ Activity ${bookmarkReaction.activity_id} not found in any feed, skipping...`);
              return null;
            }
            
            // Process the activity using the helper function
            return await processBookmarkedActivity(activity, bookmarkReaction, serverClient, trimmedUserId);
          })
        );

        // Filter out any null entries and sort by bookmark date (newest bookmarks first)
        const validBookmarkedPosts = bookmarkedPosts
          .filter(post => post !== null)
          .sort((a, b) => {
            const dateA = a.bookmarked_at ? new Date(a.bookmarked_at).getTime() : 0;
            const dateB = b.bookmarked_at ? new Date(b.bookmarked_at).getTime() : 0;
            return dateB - dateA;
          });

        console.log(`📖 Successfully processed ${validBookmarkedPosts.length} bookmarked posts`);
        console.log(`📖 DEBUG: Final result - returning ${validBookmarkedPosts.length} bookmarked posts to frontend`);

        return res.json({
          success: true,
          bookmarkedPosts: validBookmarkedPosts
        });

      case 'follow_user':
        const { targetUserId } = req.body;
        console.log(`👥 FOLLOW REQUEST: User ${trimmedUserId} wants to follow ${targetUserId}`);
        
        if (!targetUserId) {
          console.error('❌ Missing targetUserId in follow request');
          return res.status(400).json({ error: 'targetUserId is required' });
        }

        try {
          console.log(`🚀 Initiating follow operation (V2)...`);
          console.log(`📋 Pattern: timeline:${trimmedUserId} follows user:${targetUserId}`);
          
          // V2 API follow operation using server-side client
          const timelineFeed = serverClient.feed('timeline', trimmedUserId);
          
          const followResult = await timelineFeed.follow('user', targetUserId);
          console.log(`🎉 Follow operation completed (V2):`, followResult);
          
          // Verify the follow was created using V2 following()
          try {
            const verification = await timelineFeed.following({ limit: 10 });
            console.log(`🔍 Verification (V2): timeline:${trimmedUserId} now follows ${verification.results?.length || 0} feeds`);
            if (verification.results?.length > 0) {
              console.log(`🔍 Following relationships:`, verification.results.map(r => ({
                feed_id: r.feed_id,
                target_id: r.target_id,
                created_at: r.created_at
              })));
            }
            
            // Also check if the target user gained a follower
            const userFeed = serverClient.feed('user', targetUserId);
            const targetFollowers = await userFeed.followers({ limit: 10 });
            console.log(`🔍 Target user ${targetUserId} now has ${targetFollowers.results?.length || 0} followers`);
            if (targetFollowers.results?.length > 0) {
              console.log(`🔍 Follower relationships:`, targetFollowers.results.map(r => ({
                feed_id: r.feed_id,
                target_id: r.target_id,
                created_at: r.created_at
              })));
            }
          } catch (verifyError) {
            console.warn(`⚠️  Could not verify follow (V2):`, verifyError);
          }
          
          console.log(`✅ User ${trimmedUserId} successfully followed ${targetUserId}`);

          // Create notification for the followed user
          console.log(`🔔 About to create follow notification: ${trimmedUserId} → ${targetUserId}`);
          try {
            await createNotificationActivity(serverClient, 'follow', trimmedUserId, targetUserId);
            console.log(`✅ Follow notification creation completed`);
          } catch (notificationError) {
            console.error(`❌ Follow notification failed:`, notificationError);
          }

          return res.json({
            success: true,
            message: 'User followed successfully',
            followerUserId: trimmedUserId,
            targetUserId: targetUserId,
            timestamp: new Date().toISOString(),
            followPattern: `timeline:${trimmedUserId} → user:${targetUserId}`
          });
        } catch (error) {
          console.error('❌ Error following user:', {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
            userId: trimmedUserId,
            targetUserId
          });
          return res.status(500).json({ 
            error: 'Failed to follow user',
            details: error instanceof Error ? error.message : 'Unknown error',
            userId: trimmedUserId,
            targetUserId
          });
        }

      case 'unfollow_user':
        const { targetUserId: unfollowTargetUserId } = req.body;
        console.log(`👥 UNFOLLOW REQUEST: User ${trimmedUserId} wants to unfollow ${unfollowTargetUserId}`);
        
        if (!unfollowTargetUserId) {
          console.error('❌ Missing targetUserId in unfollow request');
          return res.status(400).json({ error: 'targetUserId is required' });
        }

        try {
          console.log(`🚀 Initiating unfollow operation (V2)...`);
          console.log(`📋 Pattern: timeline:${trimmedUserId} unfollows user:${unfollowTargetUserId}`);
          
          // V2 API unfollow operation using server-side client
          const timelineUnfollowFeed = serverClient.feed('timeline', trimmedUserId);
          
          const unfollowResult = await timelineUnfollowFeed.unfollow('user', unfollowTargetUserId);
          console.log(`🎉 Unfollow operation completed (V2):`, unfollowResult);
          
          console.log(`✅ User ${trimmedUserId} successfully unfollowed ${unfollowTargetUserId}`);

          return res.json({
            success: true,
            message: 'User unfollowed successfully',
            followerUserId: trimmedUserId,
            targetUserId: unfollowTargetUserId,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('❌ Error unfollowing user:', {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
            userId: trimmedUserId,
            unfollowTargetUserId
          });
          return res.status(500).json({ 
            error: 'Failed to unfollow user',
            details: error instanceof Error ? error.message : 'Unknown error',
            userId: trimmedUserId,
            targetUserId: unfollowTargetUserId
          });
        }

      case 'get_followers':
        // Get followers for a user's feed
        const targetUser = req.body.targetUserId || trimmedUserId;
        
        try {
          // Use the correct Stream SDK method for getting followers
          const userFeed = serverClient.feed('user', targetUser);
          const followers = await userFeed.followers({
            limit: req.body.limit || 20,
            offset: req.body.offset || 0
          });

          return res.json({
            success: true,
            followers: followers.results || [],
            count: followers.results?.length || 0
          });
        } catch (error) {
          console.error('Error getting followers:', error);
          return res.json({
            success: true,
            followers: [],
            count: 0
          });
        }

      case 'get_following':
        // Get users that this user is following
        try {
          // Use the correct Stream SDK method for getting following
          const timelineFeed = serverClient.feed('timeline', trimmedUserId);
          const following = await timelineFeed.following({
            limit: req.body.limit || 20,
            offset: req.body.offset || 0
          });

          return res.json({
            success: true,
            following: following.results || [],
            count: following.results?.length || 0
          });
        } catch (error) {
          console.error('Error getting following:', error);
          return res.json({
            success: true,
            following: [],
            count: 0
          });
        }

      case 'check_following':
        // Check if current user follows target user
        const { targetUserId: checkTargetUserId } = req.body;
        if (!checkTargetUserId) {
          return res.status(400).json({ error: 'targetUserId is required' });
        }

        try {
          // Use the correct Stream SDK method for checking following status
          const timelineFeed = serverClient.feed('timeline', trimmedUserId);
          const following = await timelineFeed.following({
            filter: [`user:${checkTargetUserId}`],
            limit: 1
          });

          const isFollowing = following.results && following.results.length > 0;

          return res.json({
            success: true,
            isFollowing
          });
        } catch (error) {
          console.error('Error checking following status:', error);
          return res.json({
            success: true,
            isFollowing: false
          });
        }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error: any) {
    const { action, userId, targetUserId, postId } = req.body || {};
    const trimmedUserId = typeof userId === 'string' ? userId.trim() : userId;
    
    console.error('❌ FEED-ACTIONS: Critical error in feed actions:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      action: action,
      userId: trimmedUserId,
      targetUserId: targetUserId,
      postId: postId
    });
    res.status(500).json({ 
      error: 'Failed to process feed action',
      details: error instanceof Error ? error.message : String(error),
      action: action,
      userId: trimmedUserId
    });
  }
}
