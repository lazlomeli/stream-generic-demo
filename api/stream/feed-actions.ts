// import { FeedsClient } from '@stream-io/feeds-client'; // Disabled - V3 alpha causing 500 errors
import { connect } from 'getstream'; // Use V2 for production stability
import jwt from 'jsonwebtoken';
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

    if (!userId || !action) {
      console.error('❌ FEED-ACTIONS: Missing required fields:', { userId: !!userId, action: !!action });
      return res.status(400).json({ error: 'userId and action are required' });
    }

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
              id: userId,
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
          actor: userId,
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
            name: userProfile.name || userId,
            image: userProfile.image || undefined,
            role: userProfile.role || 'User',
            company: userProfile.company || undefined,
            // Store additional Auth0 profile data
            given_name: userProfile.given_name || undefined,
            family_name: userProfile.family_name || undefined,
            nickname: userProfile.nickname || undefined,
            email: userProfile.email || undefined,
            sub: userProfile.sub || userId
          }
        };

        // Create post in BOTH global feed AND user's personal feed
        console.log('📝 Creating post in both global and user feeds...');
        const [globalActivity, userActivity] = await Promise.all([
          // Global feed for main feed display
          serverClient.feed('flat', 'global').addActivity(activityData),
          // User's personal feed for profile and follow relationships
          serverClient.feed('user', userId).addActivity(activityData)
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
        await serverClient.feed('user', userId).removeActivity(postId);
        
        // Remove from user's timeline feed
        await serverClient.feed('timeline', userId).removeActivity(postId);

        return res.json({
          success: true,
          message: 'Post deleted successfully'
        });

      case 'like_post':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        // Add reaction using server client for proper attribution
        await serverClient.reactions.add('like', postId);

        return res.json({
          success: true,
          message: 'Post liked successfully'
        });

      case 'unlike_post':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }   
        
        try {
          // Get user's like reactions for this activity using the correct API approach
          const userReactions = await serverClient.reactions.filter({
            kind: 'like',
            user_id: userId
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

        // Add comment using server client for proper attribution
        const comment = await serverClient.reactions.add('comment', postId, {
          text: postData.text
        });

        return res.json({
          success: true,
          message: 'Comment added successfully',
          comment
        });

      case 'bookmark_post':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        // Add bookmark reaction using server client
        await serverClient.reactions.add('bookmark', postId);

        return res.json({
          success: true,
          message: 'Post bookmarked successfully'
        });

      case 'remove_bookmark':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        
        
        try {
          // Get user's bookmark reactions using the correct API approach
          const userBookmarkReactions = await serverClient.reactions.filter({
            kind: 'bookmark',
            user_id: userId
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
        
        
        // Get all bookmark reactions for the user with activity data
        const bookmarkReactions = await serverClient.reactions.filter({
          kind: 'bookmark',
          user_id: userId,
          with_activity_data: true
        });

        
        
        if (!bookmarkReactions.results || bookmarkReactions.results.length === 0) {
          return res.json({
            success: true,
            bookmarkedPosts: []
          });
        }

        // Get activity IDs to fetch fresh data with reaction counts
        const activityIds = bookmarkReactions.results.map(r => r.activity_id);
        

        // Fetch activities with current reaction counts from the global feed
        const feed = serverClient.feed('flat', 'global');
        const feedData = await feed.get({ 
          limit: 100, 
          withReactionCounts: true,
          withOwnReactions: true
        });

        

        // Filter feed activities to only bookmarked ones and merge data
        const bookmarkedPosts = await Promise.all(
          feedData.results
            ?.filter(activity => activityIds.includes(activity.id))
            .map(async (activity: any) => {
              const bookmarkReaction = bookmarkReactions.results?.find(r => r.activity_id === activity.id);
              
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
                if (serverClient.getUsers) {
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
                }
              } catch (userError: any) {
                // Handle user not found gracefully
                if (userError?.response?.status === 404 || userError?.error?.status_code === 404) {
                  console.log(`👤 User ${activity.actor} not found in Stream user database - using fallback for bookmarks`);
                } else {
                  console.warn(`❌ Failed to fetch user profile for ${activity.actor}:`, userError?.message);
                }
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
                userInfo: userInfo // Add enriched user information
              };
            }) || []
        );

        
        

        // Sort by bookmark date (newest bookmarks first)
        const sortedBookmarkedPosts = bookmarkedPosts.sort((a, b) => {
          const dateA = a.bookmarked_at ? new Date(a.bookmarked_at).getTime() : 0;
          const dateB = b.bookmarked_at ? new Date(b.bookmarked_at).getTime() : 0;
          return dateB - dateA;
        });

        return res.json({
          success: true,
          bookmarkedPosts: sortedBookmarkedPosts
        });

      case 'follow_user':
        const { targetUserId } = req.body;
        console.log(`👥 FOLLOW REQUEST: User ${userId} wants to follow ${targetUserId}`);
        
        if (!targetUserId) {
          console.error('❌ Missing targetUserId in follow request');
          return res.status(400).json({ error: 'targetUserId is required' });
        }

        try {
          console.log(`🚀 Initiating follow operation (V2)...`);
          console.log(`📋 Pattern: timeline:${userId} follows user:${targetUserId}`);
          
          // V2 API follow operation using server-side client
          const timelineFeed = serverClient.feed('timeline', userId);
          
          const followResult = await timelineFeed.follow('user', targetUserId);
          console.log(`🎉 Follow operation completed (V2):`, followResult);
          
          // Verify the follow was created using V2 following()
          try {
            const verification = await timelineFeed.following({ limit: 10 });
            console.log(`🔍 Verification (V2): timeline:${userId} now follows ${verification.results?.length || 0} feeds`);
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
          
          console.log(`✅ User ${userId} successfully followed ${targetUserId}`);

          return res.json({
            success: true,
            message: 'User followed successfully',
            followerUserId: userId,
            targetUserId: targetUserId,
            timestamp: new Date().toISOString(),
            followPattern: `timeline:${userId} → user:${targetUserId}`
          });
        } catch (error) {
          console.error('❌ Error following user:', {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
            userId,
            targetUserId
          });
          return res.status(500).json({ 
            error: 'Failed to follow user',
            details: error instanceof Error ? error.message : 'Unknown error',
            userId,
            targetUserId
          });
        }

      case 'unfollow_user':
        const { targetUserId: unfollowTargetUserId } = req.body;
        console.log(`👥 UNFOLLOW REQUEST: User ${userId} wants to unfollow ${unfollowTargetUserId}`);
        
        if (!unfollowTargetUserId) {
          console.error('❌ Missing targetUserId in unfollow request');
          return res.status(400).json({ error: 'targetUserId is required' });
        }

        try {
          console.log(`🚀 Initiating unfollow operation (V2)...`);
          console.log(`📋 Pattern: timeline:${userId} unfollows user:${unfollowTargetUserId}`);
          
          // V2 API unfollow operation using server-side client
          const timelineUnfollowFeed = serverClient.feed('timeline', userId);
          
          const unfollowResult = await timelineUnfollowFeed.unfollow('user', unfollowTargetUserId);
          console.log(`🎉 Unfollow operation completed (V2):`, unfollowResult);
          
          console.log(`✅ User ${userId} successfully unfollowed ${unfollowTargetUserId}`);

          return res.json({
            success: true,
            message: 'User unfollowed successfully',
            followerUserId: userId,
            targetUserId: unfollowTargetUserId,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('❌ Error unfollowing user:', {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
            userId,
            unfollowTargetUserId
          });
          return res.status(500).json({ 
            error: 'Failed to unfollow user',
            details: error instanceof Error ? error.message : 'Unknown error',
            userId,
            targetUserId: unfollowTargetUserId
          });
        }

      case 'get_followers':
        // Get followers for a user's feed
        const targetUser = req.body.targetUserId || userId;
        
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
          const timelineFeed = serverClient.feed('timeline', userId);
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
          const timelineFeed = serverClient.feed('timeline', userId);
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
    console.error('❌ FEED-ACTIONS: Critical error in feed actions:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      action: req.body?.action,
      userId: req.body?.userId,
      targetUserId: req.body?.targetUserId,
      postId: req.body?.postId
    });
    res.status(500).json({ 
      error: 'Failed to process feed action',
      details: error instanceof Error ? error.message : String(error),
      action: req.body?.action,
      userId: req.body?.userId
    });
  }
}
