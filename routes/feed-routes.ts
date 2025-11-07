import { StreamClient } from '@stream-io/node-sdk';
import express from 'express';
import { resetFeeds, seedFeeds } from './utils/feed-utils.js';

const router = express.Router();

let streamFeedsClient: StreamClient;

// Helper to check if error is "already exists"
const isAlreadyExistsError = (error: any) => {
  return error?.code === 4 || 
         error?.message?.toLowerCase().includes('already exists') ||
         error?.statusCode === 409;
}

// Initialize feed groups and views (call this once at server startup)
const initializeFeedGroupsAndViews = async (client: StreamClient) => {
  console.log('🔄 Initializing Stream feed groups and views...');
  
  // Create popular feed group
  try {
    await client.feeds.createFeedGroup({
      id: "popular-feed-group",
      activity_selectors: [{ type: "popular" }],
      activity_processors: [{ type: "og_metadata_enrichment"}],
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
    console.log('✅ Feed group "popular-feed-group" created');
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      console.log('ℹ️  Feed group "popular-feed-group" already exists');
    } else {
      console.error('❌ Error creating feed group:', error);
      throw error;
    }
  }

  // Create hashtag feed group
  try {
    await client.feeds.createFeedGroup({
      id: "hashtag",
    });
    console.log('✅ Feed group "hashtag" created');
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      console.log('ℹ️  Feed group "hashtag" already exists');
    } else {
      console.error('❌ Error creating hashtag feed group:', error);
      throw error;
    }
  }

  // Create popular view
  try {
    await client.feeds.createFeedView({
      id: "popular-view",
      activity_selectors: [{ type: "popular" }],
    });
    console.log('✅ Feed view "popular-view" created');
  } catch (feedViewError) {
    if (isAlreadyExistsError(feedViewError)) {
      console.log('ℹ️  Feed view "popular-view" already exists');
    } else {
      console.error('❌ Error creating feed view:', feedViewError);
      throw feedViewError;
    }
  }

  console.log('✅ Stream feed initialization complete\n');
};

export const initializeFeedRoutes = async (feedsClient: StreamClient) => {
  streamFeedsClient = feedsClient;
  
  // Initialize feed groups and views once at startup
  await initializeFeedGroupsAndViews(feedsClient);
  
  return router;
}

const sanitizeUserId = (userId: string) => {
  return userId.replace(/[^a-zA-Z0-9@_-]/g, '');
}

router.post('/feeds-token', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }
    const sanitizedUserId = sanitizeUserId(user_id);
    
    if (!sanitizedUserId) {
      return res.status(400).json({ error: "Invalid user_id format" });
    }
    // Generate token (feed groups/views already created at startup)
    const token = streamFeedsClient.generateUserToken({ user_id: sanitizedUserId });
    return res.json({ token });
  } catch (err) {
    console.error('Error generating feeds token:', err);
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
    console.error('Error resetting feeds:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;