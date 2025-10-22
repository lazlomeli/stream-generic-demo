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
    let hasMoreActivities = true;
    let activitiesNextCursor = undefined;

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
    let followsNextCursor = undefined;

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
        } catch (error) {
          console.error(`❌ Error deleting follow:`, error.message);
        }
      }

      // Check if there are more follows to fetch
      followsNextCursor = followsResponse.next;
      hasMoreFollows = !!followsNextCursor && followsResponse.follows.length > 0;
    }

    console.log(`📋 Total follows deleted: ${totalFollowsDeleted}`)

    console.log('✅ Feeds reset completed successfully (users preserved)');
    return { success: true, message: 'Feeds reset completed' };
  } catch (error) {
    console.error('❌ Error during Feeds reset:', error);
    throw error;
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

    // Step 1: Create/update sample users
    const sampleUsers = generateSampleUsers();
    await client.upsertUsers(sampleUsers);
    console.log(`✅ Created/updated ${sampleUsers.length} sample users`);

    // Step 2: Create user feeds for each sample user
    const createdFeeds = [];
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
    const createdActivities = [];
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

