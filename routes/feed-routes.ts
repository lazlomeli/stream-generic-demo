import { StreamClient } from '@stream-io/node-sdk';
import express from 'express';

const router = express.Router();

let streamFeedsClient: StreamClient;

export const initializeFeedRoutes = (feedsClient: StreamClient) => {
  streamFeedsClient = feedsClient;
  return router;
}

// Feeds V3 Token Generation and User Setup
router.post('/feeds-token', async (req, res) => {
  try {
    const { user_id, name } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    console.log('🍃 FEEDS-V3: Generating token for user:', user_id);

    // Create or update user if name is provided
    if (name) {
      console.log('👤 FEEDS-V3: Creating/updating user:', { user_id, name });
      await streamFeedsClient.upsertUsers([
        {
          id: user_id,
          name: name,
        },
      ]);
    }

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
    const token = streamFeedsClient.generateUserToken({ user_id });
    
    console.log('✅ FEEDS-V3: Token generated successfully for user:', user_id);

    return res.json({ token });
  } catch (err) {
    console.error('❌ FEEDS-V3: Error generating token:', err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


export default router;
