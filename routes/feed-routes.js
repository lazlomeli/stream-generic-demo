import express from 'express';

const router = express.Router();

let streamFeedsClient: StreamClient;

export const initializeFeedRoutes = (feedsClient) => {
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

    // Create feed view (wrapped in try-catch since it may already exist)
    try {
      await Promise.all([
        streamFeedsClient.feeds.createFeedView({
          id: "popular-view",
          activity_selectors: [{ type: "popular" }],
          ranking: {
            type: "expression",
            score:
              "popularity * external.weight + comment_count * external.comment_weight + external.base_score",
          },
        }),
      ]);
      console.log('✅ FEEDS-V3: Popular feed view created/updated');
    } catch (feedViewError) {
      // Feed view might already exist, which is fine
      console.log('feedViewError', feedViewError);
      console.log('⚠️ FEEDS-V3: Feed view creation skipped (may already exist):', feedViewError.message);
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
