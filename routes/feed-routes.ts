import { StreamClient } from '@stream-io/node-sdk';
import express from 'express';
import { resetFeeds, seedFeeds } from './utils/feed-utils.js';

const router = express.Router();

let streamFeedsClient: StreamClient;

export const initializeFeedRoutes = (feedsClient: StreamClient) => {
  streamFeedsClient = feedsClient;
  return router;
}

const sanitizeUserId = (userId: string) => {
  return userId.replace(/[^a-zA-Z0-9@_-]/g, '');
}

router.post('/feeds-token', async (req, res) => {
  try {
    const { user_id, name } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    const sanitizedUserId = sanitizeUserId(user_id);
    
    if (!sanitizedUserId) {
      return res.status(400).json({ error: "Invalid user_id format" });
    }

    try {
      await streamFeedsClient.feeds.createFeedGroup({
        id: "popular-feed-group",
        activity_selectors: [{ type: "popular" }],
        ranking: {
          type: "expression",
          score: "popularity * external.weight + comment_count * external.comment_weight + external.base_score",
          defaults: {
            external: {
              weight: 1.5,          
              comment_weight: 2.0,  
              base_score: 10,       
            },
          },
        },
      });
    } catch (error) {
      console.error('Error creating feed group:', error);
    }

    try {
      await Promise.all([
        streamFeedsClient.feeds.createFeedView({
          id: "popular-view",
          activity_selectors: [{ type: "popular" }],
        }),
      ]);
    } catch (feedViewError) {
      console.error('Error creating feed view:', feedViewError);
    }

    const token = streamFeedsClient.generateUserToken({ user_id: sanitizedUserId });

    return res.json({ token });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post('/stream/reset', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    await resetFeeds(streamFeedsClient);
    const seedResult = await seedFeeds(streamFeedsClient, userId);

    res.json({
      success: true,
      message: 'Feeds reset and seeded successfully',
      data: seedResult.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;