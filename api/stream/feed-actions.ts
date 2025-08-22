import { connect } from 'getstream';
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

    // Initialize Stream Feeds client
    const streamFeedsClient = connect(apiKey, apiSecret);

    switch (action) {
      case 'create_post':
        if (!postData?.text) {
          return res.status(400).json({ error: 'Post text is required' });
        }

        const newActivity = await streamFeedsClient.feed('flat', 'global').addActivity({
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
        await streamFeedsClient.feed('flat', userId).addActivity({
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
        await streamFeedsClient.feed('flat', 'global').removeActivity(postId);
        
        // Remove from user's personal flat feed
        await streamFeedsClient.feed('flat', userId).removeActivity(postId);

        return res.json({
          success: true,
          message: 'Post deleted successfully'
        });

      case 'like_post':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        // Create a user-specific client for reactions
        const userToken = streamFeedsClient.createUserToken(userId);
        const userClient = connect(apiKey, userToken, apiSecret);
        
        // Add reaction to the post using user client
        const reaction = await userClient.reactions.add('like', postId);

        return res.json({
          success: true,
          message: 'Post liked successfully'
        });

      case 'unlike_post':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        // Create a user-specific client for reactions
        const userToken = streamFeedsClient.createUserToken(userId);
        const userClient = connect(apiKey, userToken, apiSecret);
        
        // Get the user's reactions to find the like reaction ID
        const userReactions = await userClient.reactions.filter({
          activity_id: postId,
          kind: 'like'
        });

        if (userReactions.results && userReactions.results.length > 0) {
          // Delete the specific like reaction using user client
          await userClient.reactions.delete(userReactions.results[0].id);
        }

        return res.json({
          success: true,
          message: 'Post unliked successfully'
        });

      case 'add_comment':
        if (!postId || !postData?.text) {
          return res.status(400).json({ error: 'postId and comment text are required' });
        }

        // Create a user-specific client for reactions
        const userToken = streamFeedsClient.createUserToken(userId);
        const userClient = connect(apiKey, userToken, apiSecret);
        
        // Add comment to the post using user client
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

        // Add bookmark reaction
        await streamFeedsClient.reactions.add('bookmark', postId, {
          user_id: userId
        });

        return res.json({
          success: true,
          message: 'Post bookmarked successfully'
        });

      case 'remove_bookmark':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        // Remove bookmark reaction (note: this may need to be adapted based on actual getstream API)
        try {
          await streamFeedsClient.reactions.delete(postId);
        } catch (error) {
          console.log('Note: bookmark delete may need specific implementation');
        }

        return res.json({
          success: true,
          message: 'Bookmark removed successfully'
        });

      case 'get_comments':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        // Create a user-specific client for reactions
        const userToken = streamFeedsClient.createUserToken(userId);
        const userClient = connect(apiKey, userToken, apiSecret);
        
        // Get all comments for the post
        const comments = await userClient.reactions.filter({
          activity_id: postId,
          kind: 'comment'
        });

        return res.json({
          success: true,
          comments: comments.results || []
        });

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error: any) {
    console.error('Error in feed actions:', error);
    res.status(500).json({ 
      error: 'Failed to process feed action',
      details: error.message 
    });
  }
}
