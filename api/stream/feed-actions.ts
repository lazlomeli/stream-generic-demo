import { connect } from 'getstream';
import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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
        if (!postData?.text) {
          return res.status(400).json({ error: 'Post text is required' });
        }

        const newActivity = await serverClient.feed('flat', 'global').addActivity({
          actor: userId,
          verb: 'post',
          object: 'post',
          text: postData.text,
          attachments: postData.attachments || [],
          custom: {
            likes: 0,
            shares: 0,
            comments: 0,
            category: postData.category || 'general'
          }
        });

        // Also add to user's personal flat feed
        await serverClient.feed('flat', userId).addActivity({
          actor: userId,
          verb: 'post',
          object: 'post',
          text: postData.text,
          attachments: postData.attachments || [],
          custom: {
            likes: 0,
            shares: 0,
            comments: 0,
            category: postData.category || 'general'
          }
        });

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
        
        // Remove from user's personal flat feed
        await serverClient.feed('flat', userId).removeActivity(postId);

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

        console.log('💔 Unliking post:', postId, 'for user:', userId);
        
        try {
          // Get user's like reactions for this activity using the correct API approach
          const userReactions = await serverClient.reactions.filter({
            kind: 'like',
            user_id: userId
          });

          console.log('💔 Found total like reactions for user:', userReactions.results?.length || 0);

          // Filter to find reactions for this specific activity
          const activityReaction = userReactions.results?.find(reaction => reaction.activity_id === postId);

          if (activityReaction) {
            console.log('💔 Deleting like reaction:', activityReaction.id);
            await userClient.reactions.delete(activityReaction.id);
            console.log('💔 Like reaction deleted successfully');
          } else {
            console.log('💔 No like reaction found for this activity');
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

        console.log('🔖 Removing bookmark for post:', postId, 'for user:', userId);
        
        try {
          // Get user's bookmark reactions using the correct API approach
          const userBookmarkReactions = await serverClient.reactions.filter({
            kind: 'bookmark',
            user_id: userId
          });

          console.log('🔖 Found total bookmark reactions for user:', userBookmarkReactions.results?.length || 0);

          // Filter to find reactions for this specific activity
          const activityReaction = userBookmarkReactions.results?.find(reaction => reaction.activity_id === postId);

          if (activityReaction) {
            console.log('🔖 Deleting bookmark reaction:', activityReaction.id);
            await userClient.reactions.delete(activityReaction.id);
            console.log('🔖 Bookmark reaction deleted successfully');
          } else {
            console.log('🔖 No bookmark reaction found for this activity');
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
        console.log('📖 Getting bookmarked posts for user:', userId);
        
        // Get all bookmark reactions for the user with activity data
        const bookmarkReactions = await serverClient.reactions.filter({
          kind: 'bookmark',
          user_id: userId,
          with_activity_data: true
        });

        console.log('📖 Bookmark reactions found:', bookmarkReactions.results?.length || 0);
        
        if (!bookmarkReactions.results || bookmarkReactions.results.length === 0) {
          return res.json({
            success: true,
            bookmarkedPosts: []
          });
        }

        // Get activity IDs to fetch fresh data with reaction counts
        const activityIds = bookmarkReactions.results.map(r => r.activity_id);
        console.log('📖 Activity IDs:', activityIds);

        // Fetch activities with current reaction counts from the global feed
        const feed = serverClient.feed('flat', 'global');
        const feedData = await feed.get({ 
          limit: 100, 
          withReactionCounts: true,
          withOwnReactions: true
        });

        console.log('📖 Feed activities found:', feedData.results?.length || 0);

        // Filter feed activities to only bookmarked ones and merge data
        const bookmarkedPosts = feedData.results
          ?.filter(activity => activityIds.includes(activity.id))
          .map((activity: any) => {
            const bookmarkReaction = bookmarkReactions.results?.find(r => r.activity_id === activity.id);
            
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
              bookmarked_at: bookmarkReaction?.created_at // When user bookmarked this post
            };
          })
          // Sort by bookmark date (newest bookmarks first)
          .sort((a, b) => new Date(b.bookmarked_at).getTime() - new Date(a.bookmarked_at).getTime()) || [];

        console.log('📖 Final bookmarked posts:', bookmarkedPosts.length);
        console.log('📖 First post sample:', JSON.stringify(bookmarkedPosts[0], null, 2));

        return res.json({
          success: true,
          bookmarkedPosts
        });

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
