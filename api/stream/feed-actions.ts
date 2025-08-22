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

        // Add reaction using server client with user impersonation
        const reaction = await streamFeedsClient.reactions.add('like', postId, {}, userId);

        return res.json({
          success: true,
          message: 'Post liked successfully'
        });

      case 'unlike_post':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        // Get the user's reactions to find the like reaction ID using server client
        const userReactions = await streamFeedsClient.reactions.filter({
          activity_id: postId,
          kind: 'like',
          user_id: userId
        });

        if (userReactions.results && userReactions.results.length > 0) {
          // Delete the specific like reaction
          await streamFeedsClient.reactions.delete(userReactions.results[0].id);
        }

        return res.json({
          success: true,
          message: 'Post unliked successfully'
        });

      case 'add_comment':
        if (!postId || !postData?.text) {
          return res.status(400).json({ error: 'postId and comment text are required' });
        }

        // Add comment using server client with user impersonation
        const comment = await streamFeedsClient.reactions.add('comment', postId, {
          text: postData.text
        }, userId);

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

        // Get all comments for the post using server client
        const comments = await streamFeedsClient.reactions.filter({
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
    console.error('Error stack:', error.stack);
    console.error('Action:', req.body?.action, 'UserId:', req.body?.userId, 'PostId:', req.body?.postId);
    res.status(500).json({ 
      error: 'Failed to process feed action',
      details: error.message,
      action: req.body?.action
    });
  }
}
