import { FeedsClient } from '@stream-io/feeds-client';
import { StreamClient } from '@stream-io/node-sdk';
import express from 'express';

const router = express.Router();

let streamFeedsClient: StreamClient;

export const initializeFeedRoutes = (feedsClient: StreamClient) => {
  streamFeedsClient = feedsClient;
  return router;
}

const sanitizeUserId = (userId: string) => {
  return userId.replace(/[^a-zA-Z0-9@_-]/g, '');
}

/**
 * Helper function to generate sample users for Feeds
 */
function generateSampleFeedsUsers() {
  return [
    {
      id: 'feeds_alice_2025',
      name: 'Alice Johnson',
      image: 'https://getstream.io/random_png/?name=Alice',
    },
    {
      id: 'feeds_bob_2025',
      name: 'Bob Smith',
      image: 'https://getstream.io/random_png/?name=Bob',
    },
    {
      id: 'feeds_charlie_2025',
      name: 'Charlie Brown',
      image: 'https://getstream.io/random_png/?name=Charlie',
    },
    {
      id: 'feeds_diana_2025',
      name: 'Diana Prince',
      image: 'https://getstream.io/random_png/?name=Diana',
    },
    {
      id: 'feeds_eve_2025',
      name: 'Eve Martinez',
      image: 'https://getstream.io/random_png/?name=Eve',
    },
  ];
}

/**
 * Reset Feeds - Delete all activities, reactions, comments, and follows (keep users intact)
 * 
 * This function only deletes feed data. Sample users are permanent and never deleted.
 * They will be reused/updated during seeding.
 */
async function resetFeeds(
  client: StreamClient
): Promise<{ success: boolean; message: string }> {
  try {
    console.log('🔄 Starting Feeds reset...');
    console.log('ℹ️ Users will NOT be deleted - only activities, reactions, comments, and follows will be cleaned up');

    // Step 1: Query and delete all activities (with pagination)
    console.log('📋 Querying and deleting activities...');
    let totalActivitiesDeleted = 0;
    let hasMoreActivities = true;
    let activitiesNextCursor: string | undefined = undefined;

    while (hasMoreActivities) {
      const activitiesResponse = await client.feeds.queryActivities({
        limit: 100, // Max limit allowed by API
        next: activitiesNextCursor,
      });

      const activityIds = activitiesResponse.activities.map(a => a.id);
      
      if (activityIds.length > 0) {
        await client.feeds.deleteActivities({
          ids: activityIds,
          hard_delete: true,
        });
        totalActivitiesDeleted += activityIds.length;
        console.log(`✅ Deleted ${activityIds.length} activities (total: ${totalActivitiesDeleted})`);
      }

      // Check if there are more activities to fetch
      activitiesNextCursor = activitiesResponse.next;
      hasMoreActivities = !!activitiesNextCursor && activityIds.length > 0;
    }

    console.log(`📋 Total activities deleted: ${totalActivitiesDeleted}`);

    // Step 2: Query and delete all follows (with pagination)
    console.log('📋 Querying and deleting follows...');
    let totalFollowsDeleted = 0;
    let hasMoreFollows = true;
    let followsNextCursor: string | undefined = undefined;

    while (hasMoreFollows) {
      const followsResponse = await client.feeds.queryFollows({
        limit: 100, // Max limit allowed by API
        next: followsNextCursor,
      });

      for (const follow of followsResponse.follows) {
        try {
          await client.feeds.unfollow({
            source: follow.source_feed.feed,
            target: follow.target_feed.feed,
          });
          totalFollowsDeleted++;
          console.log(`✅ Deleted follow: ${follow.source_feed.feed} -> ${follow.target_feed.feed}`);
        } catch (error: any) {
          console.error(`❌ Error deleting follow:`, error.message);
        }
      }

      // Check if there are more follows to fetch
      followsNextCursor = followsResponse.next;
      hasMoreFollows = !!followsNextCursor && followsResponse.follows.length > 0;
    }

    console.log(`📋 Total follows deleted: ${totalFollowsDeleted}`);

    console.log('✅ Feeds reset completed successfully (users preserved)');
    return { success: true, message: 'Feeds reset completed' };
  } catch (error) {
    console.error('❌ Error during Feeds reset:', error);
    throw error;
  }
}

/**
 * Seed Feeds - Create sample users, activities, reactions, comments, and follows
 */
/**
 * Seed Feeds - Create sample users, activities, reactions, comments, and follows
 */
async function seedFeeds(
  client: StreamClient,
  currentUserId: string
): Promise<{ success: boolean; message: string; data: any }> {
  try {
    console.log('🌱 Starting Feeds seeding...');

    // Step 1: Create/update sample users
    const sampleUsers = generateSampleFeedsUsers();
    await client.upsertUsers(sampleUsers);
    console.log(`✅ Created/updated ${sampleUsers.length} sample users`);

    // Step 2: Create user feeds for each sample user
    const createdFeeds: string[] = [];
    for (const user of sampleUsers) {
      const userFeed = client.feeds.feed('user', user.id);
      await userFeed.getOrCreate({ user_id: user.id });
      createdFeeds.push(`user:${user.id}`);
      console.log(`✅ Created feed: user:${user.id}`);
    }

    // Step 3: Create current user's timeline feed
    const currentUserTimeline = client.feeds.feed('timeline', currentUserId);
    await currentUserTimeline.getOrCreate({ user_id: currentUserId });
    console.log(`✅ Created timeline feed for current user: timeline:${currentUserId}`);

    // Step 4: Create sample activities for each user
    const createdActivities: any[] = [];
    const activityTexts = [
      '🌟 Just joined the platform! Excited to share my journey.',
      '📸 Beautiful sunset today at the beach!',
      '💡 Learning something new every day keeps the mind sharp.',
      '🎉 Celebrating small wins today!',
      '🚀 Working on an exciting new project!',
    ];

    for (let i = 0; i < sampleUsers.length; i++) {
      const user = sampleUsers[i];
      const userFeed = `user:${user.id}`;
      
      const activityResponse = await client.feeds.addActivity({
        user_id: user.id,
        type: 'post',
        feeds: [userFeed],
        text: activityTexts[i] || `Post from ${user.name}`,
      });
      
      createdActivities.push(activityResponse.activity);
      console.log(`✅ Created activity for ${user.name}`);
    }

    // Step 5: Add some sample reactions (likes) to activities
    for (let i = 0; i < Math.min(3, createdActivities.length); i++) {
      const activity = createdActivities[i];
      await client.feeds.addReaction({
        activity_id: activity.id,
        type: 'like',
        user_id: currentUserId,
      });
      console.log(`✅ Added like to activity: ${activity.id}`);
    }

    // Step 6: Add some sample comments
    for (let i = 0; i < Math.min(2, createdActivities.length); i++) {
      const activity = createdActivities[i];
      await client.feeds.addComment({
        object_id: activity.id,
        object_type: 'activity',
        comment: 'Great post! 👍',
        user_id: currentUserId,
      });
      console.log(`✅ Added comment to activity: ${activity.id}`);
    }

    console.log('✅ Feeds seeding completed successfully');
    return {
      success: true,
      message: 'Feeds seeded successfully',
      data: {
        feeds: createdFeeds,
        activities: createdActivities.map(a => a.id),
        sampleUsers: sampleUsers.map(u => u.id),
      },
    };
  } catch (error) {
    console.error('❌ Error during Feeds seeding:', error);
    throw error;
  }
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