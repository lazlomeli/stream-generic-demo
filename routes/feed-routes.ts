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

// Feeds V3 Token Generation and User Setup
router.post('/feeds-token', async (req, res) => {
  try {
    const { user_id, name } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    // Sanitize user_id to only allow safe characters
    const sanitizedUserId = sanitizeUserId(user_id);
    
    if (!sanitizedUserId) {
      return res.status(400).json({ error: "Invalid user_id format" });
    }

    console.log('🍃 FEEDS-V3: Generating token for user:', sanitizedUserId);
    
    // Note: User creation/restoration should happen during login via auth-tokens endpoint
    // This endpoint is only for token generation

    // Create feed group with custom ranking
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
      console.log('ERROR FEED GROUP, already exists');
    }

    // Create feed view 
    try {
      await Promise.all([
        streamFeedsClient.feeds.createFeedView({
          id: "popular-view",
          activity_selectors: [{ type: "popular" }],
        }),
      ]);
      console.log('✅ FEEDS-V3: Popular feed view created/updated');
    } catch (feedViewError) {
      // Feed view might already exist, which is fine
      console.log('⚠️ FEEDS-V3: Feed view creation skipped (may already exist)');
    }

    // Generate user token
    const token = streamFeedsClient.generateUserToken({ user_id: sanitizedUserId });
    
    console.log('✅ FEEDS-V3: Token generated successfully for user:', sanitizedUserId);

    return res.json({ token });
  } catch (err) {
    console.error('❌ FEEDS-V3: Error generating token:', err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * API endpoint to reset Feeds (delete all activities, reactions, comments, follows - keep users)
 */
router.post('/feeds/reset', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    console.log(`🔄 [feeds-routes.ts]: Feeds reset and seed requested by user: ${userId}`);

    // Step 1: Reset (delete all feed data, keep users)
    await resetFeeds(streamFeedsClient);

    // Step 2: Seed (create sample data)
    const seedResult = await seedFeeds(streamFeedsClient, userId);

    res.json({
      success: true,
      message: 'Feeds reset and seeded successfully',
      data: seedResult.data,
    });
  } catch (error) {
    console.error('[feeds-routes.ts]: Error in feeds reset-and-seed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * API endpoint to only seed Feeds (without reset)
 */
router.post('/feeds/seed', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    console.log(`🌱 [feeds-routes.ts]: Feeds seed requested by user: ${userId}`);

    const result = await seedFeeds(streamFeedsClient, userId);
    res.json(result);
  } catch (error) {
    console.error('[feeds-routes.ts]: Error in feeds seed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;