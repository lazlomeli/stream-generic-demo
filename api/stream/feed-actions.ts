import { connect } from 'getstream';
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
    const { action, userId, postData, postId } = req.body;

    if (!userId || !action) {
      return res.status(400).json({ error: 'userId and action are required' });
    }

    // Get Stream API credentials
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Missing Stream API credentials' });
    }

    // Initialize Stream client with proper user impersonation
    // Create server client for admin operations
    const serverClient = connect(apiKey, apiSecret);
    
    // Create user token and user client for proper attribution
    const userToken = serverClient.createUserToken(userId);
    const userClient = connect(apiKey, userToken);

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
        
        // Create post only in global feed - Stream will handle fanout to timelines
        const newActivity = await serverClient.feed('flat', 'global').addActivity({
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
        });

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

        // Add reaction using user client for proper attribution
        await userClient.reactions.add('like', postId);

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
            
            await userClient.reactions.delete(activityReaction.id);
            
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

        // Add comment using user client for proper attribution
        const comment = await userClient.reactions.add('comment', postId, {
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

        // Add bookmark reaction using user client
        await userClient.reactions.add('bookmark', postId);

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
            
            await userClient.reactions.delete(activityReaction.id);
            
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
              } catch (userError) {
                console.warn(`Failed to fetch user profile for ${activity.actor}:`, userError);
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
        if (!targetUserId) {
          return res.status(400).json({ error: 'targetUserId is required' });
        }

        // Following the React docs pattern: timeline feed follows user feed
        const userTimeline = serverClient.feed('timeline', userId);
        await userTimeline.follow('user', targetUserId);

        return res.json({
          success: true,
          
        });

      case 'unfollow_user':
        const { targetUserId: unfollowTargetUserId } = req.body;
        if (!unfollowTargetUserId) {
          return res.status(400).json({ error: 'targetUserId is required' });
        }

        // Unfollow using timeline feed
        const userTimelineUnfollow = serverClient.feed('timeline', userId);
        await userTimelineUnfollow.unfollow('user', unfollowTargetUserId);

        return res.json({
          success: true,
          message: 'User unfollowed successfully'
        });

      case 'get_followers':
        // Get followers for a user's feed
        const targetUser = req.body.targetUserId || userId;
        
        try {
          const followers = await serverClient.feed('user', targetUser).queryFollowers({
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
          const following = await serverClient.feed('timeline', userId).queryFollowing({
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
          const following = await serverClient.feed('timeline', userId).queryFollowing({
            filter: { target_feed: `user:${checkTargetUserId}` },
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
    console.error('Error in feed actions:', error);
    console.error('Error stack:', error.stack);
    console.error('Action:', req.body?.action, 'UserId:', req.body?.userId, 'PostId:', req.body?.postId);
    res.status(500).json({ 
      error: 'Failed to process feed action',
      details: error.message,
      action: req.body?.action
    });
  }
}
