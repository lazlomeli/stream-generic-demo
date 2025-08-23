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

        // Get and delete the user's like reaction
        const userReactions = await serverClient.reactions.filter({
          activity_id: postId,
          kind: 'like',
          user_id: userId
        });

        if (userReactions.results && userReactions.results.length > 0) {
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

        // Get and delete the user's bookmark reaction
        const bookmarkReactions = await serverClient.reactions.filter({
          activity_id: postId,
          kind: 'bookmark',
          user_id: userId
        });

        if (bookmarkReactions.results && bookmarkReactions.results.length > 0) {
          await userClient.reactions.delete(bookmarkReactions.results[0].id);
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
          withActivityData: true
        });

        console.log('📖 Bookmark reactions found:', bookmarkReactions.results?.length || 0);
        console.log('📖 First reaction sample:', bookmarkReactions.results?.[0]);

        // Extract the bookmarked posts with activity details
        const bookmarkedPosts = bookmarkReactions.results?.map((reaction: any) => ({
          id: reaction.id,
          activity_id: reaction.activity_id,
          actor: reaction.activity?.actor || 'Unknown',
          text: reaction.activity?.object?.text || reaction.activity?.text || 'No content',
          attachments: reaction.activity?.attachments || [],
          custom: reaction.activity?.custom || {},
          created_at: reaction.created_at,
          time: reaction.created_at
        })) || [];

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
