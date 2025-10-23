import { generateSampleUsers } from './sample-users.js';

/**
 * Reset Feeds - Delete all activities, reactions, comments, and follows (keep users intact)
 * 
 * This function only deletes feed data. Sample users are permanent and never deleted.
 * They will be reused/updated during seeding.
 * 
 * @param {import('@stream-io/node-sdk').StreamClient} client
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function resetFeeds(client) {
  try {
    console.log('🔄 Starting Feeds reset...');
    console.log('ℹ️ Users will NOT be deleted - only activities, reactions, comments, and follows will be cleaned up');

    // Step 1: Query and delete all activities (with pagination)
    console.log('📋 Querying and deleting activities...');
    let totalActivitiesDeleted = 0;
    
    try {
      let hasMoreActivities = true;
      let activitiesNextCursor = undefined;

      while (hasMoreActivities) {
        const activitiesResponse = await client.feeds.queryActivities({
          limit: 100,
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

        activitiesNextCursor = activitiesResponse.next;
        hasMoreActivities = !!activitiesNextCursor && activityIds.length > 0;
      }
    } catch (activitiesError) {
      if (activitiesError.code === 404 || activitiesError.metadata?.responseCode === 404) {
        console.log('ℹ️ No activities found (this is normal for a new app)');
      } else {
        console.error('⚠️ Error querying activities:', activitiesError.message);
      }
    }

    console.log(`📋 Total activities deleted: ${totalActivitiesDeleted}`);

    // Step 2: Query and delete all follows (with pagination)
    console.log('📋 Querying and deleting follows...');
    let totalFollowsDeleted = 0;
    
    try {
      let hasMoreFollows = true;
      let followsNextCursor = undefined;

      while (hasMoreFollows) {
        const followsResponse = await client.feeds.queryFollows({
          limit: 100,
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
          } catch (error) {
            console.error(`❌ Error deleting follow:`, error.message);
          }
        }

        followsNextCursor = followsResponse.next;
        hasMoreFollows = !!followsNextCursor && followsResponse.follows.length > 0;
      }
    } catch (followsError) {
      if (followsError.code === 404 || followsError.metadata?.responseCode === 404) {
        console.log('ℹ️ No follows found (this is normal for a new app)');
      } else {
        console.error('⚠️ Error querying follows:', followsError.message);
      }
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
 * Ensure required feed groups exist
 * 
 * @param {import('@stream-io/node-sdk').StreamClient} client
 */
async function ensureFeedGroupsExist(client) {
  console.log('🔧 Ensuring required feed groups exist...');
  
  const feedGroupsToCreate = [
    {
      id: 'user',
      activity_selectors: [{ type: 'following' }],
      ranking: { type: 'recency' },
    },
    {
      id: 'timeline',
      activity_selectors: [{ type: 'following' }],
      ranking: { type: 'recency' },
    },
    {
      id: 'notification',
      activity_selectors: [{ type: 'following' }],
      ranking: { type: 'recency' },
      notification: {
        enabled: true,
      },
    },
  ];

  for (const feedGroup of feedGroupsToCreate) {
    try {
      await client.feeds.createFeedGroup(feedGroup);
      console.log(`✅ Created feed group: ${feedGroup.id}`);
    } catch (error) {
      // Feed group might already exist
      if (error.code === 4 || error.message?.includes('already exists')) {
        console.log(`ℹ️ Feed group '${feedGroup.id}' already exists`);
      } else {
        console.error(`⚠️ Error creating feed group '${feedGroup.id}':`, error.message);
      }
    }
  }
}

/**
 * Seed Feeds - Create sample users, activities, reactions, comments, and follows
 * 
 * @param {import('@stream-io/node-sdk').StreamClient} client
 * @param {string} currentUserId
 * @returns {Promise<{success: boolean, message: string, data: any}>}
 */
export async function seedFeeds(client, currentUserId) {
  try {
    console.log('🌱 Starting Feeds seeding...');

    // Step 0: Ensure feed groups exist
    await ensureFeedGroupsExist(client);

    // Step 1: Create/update sample users
    const sampleUsers = generateSampleUsers();
    await client.upsertUsers(sampleUsers);
    console.log(`✅ Created/updated ${sampleUsers.length} sample users`);

    // Step 2: Create individual feed instances for each user
    console.log('🔧 Creating individual feed instances...');
    for (const user of sampleUsers) {
      try {
        const userFeed = client.feeds.feed('user', user.id);
        await userFeed.getOrCreate({ user_id: user.id });
        console.log(`✅ Created feed instance: user:${user.id}`);
      } catch (error) {
        console.error(`❌ Could not create feed for ${user.name}:`, error.message);
      }
    }

    // Step 3: Create sample activities for each user
    const createdActivities = [];
    const activityTexts = [
      '🌟 Just joined the platform! Excited to share my journey.',
      '📸 Beautiful sunset today at the beach!',
      '💡 Learning something new every day keeps the mind sharp.',
      '🎉 Celebrating small wins today!',
      '🚀 Working on an exciting new project!',
    ];

    console.log('📝 Creating activities...');
    for (let i = 0; i < sampleUsers.length; i++) {
      const user = sampleUsers[i];
      const userFeed = `user:${user.id}`;
      
      try {
        const activityResponse = await client.feeds.addActivity({
          user_id: user.id,
          type: 'post',
          feeds: [userFeed],
          text: activityTexts[i] || `Post from ${user.name}`,
        });
        
        createdActivities.push(activityResponse.activity);
        console.log(`✅ Created activity for ${user.name}`);
      } catch (error) {
        console.error(`❌ Could not create activity for ${user.name}:`, error.message);
      }
    }

    // Step 4: Add some sample reactions (likes) to activities
    console.log('👍 Adding reactions...');
    for (let i = 0; i < Math.min(3, createdActivities.length); i++) {
      const activity = createdActivities[i];
      try {
        await client.feeds.addActivityReaction({
          activity_id: activity.id,
          type: 'like',
          user_id: currentUserId,
        });
        console.log(`✅ Added like to activity: ${activity.id}`);
      } catch (error) {
        console.warn(`⚠️ Could not add reaction:`, error.message);
      }
    }

    // Step 5: Add some sample comments
    console.log('💬 Adding comments...');
    for (let i = 0; i < Math.min(2, createdActivities.length); i++) {
      const activity = createdActivities[i];
      try {
        await client.feeds.addComment({
          object_id: activity.id,
          object_type: 'activity',
          comment: 'Great post! 👍',
          user_id: currentUserId,
        });
        console.log(`✅ Added comment to activity: ${activity.id}`);
      } catch (error) {
        console.warn(`⚠️ Could not add comment:`, error.message);
      }
    }

    console.log('✅ Feeds seeding completed successfully');
    return {
      success: true,
      message: 'Feeds seeded successfully',
      data: {
        activities: createdActivities.map(a => a.id),
        sampleUsers: sampleUsers.map(u => u.id),
      },
    };
  } catch (error) {
    console.error('❌ Error during Feeds seeding:', error);
    throw error;
  }
}