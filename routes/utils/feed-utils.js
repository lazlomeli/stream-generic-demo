import { generateSampleUsers } from './sample-users.js';

export async function resetFeeds(client) {
  try {
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
        }

        activitiesNextCursor = activitiesResponse.next;
        hasMoreActivities = !!activitiesNextCursor && activityIds.length > 0;
      }
    } catch (activitiesError) {
      if (activitiesError.code === 404 || activitiesError.metadata?.responseCode === 404) {
        console.error('Activities not found:', activitiesError);
      } else {
        console.error('Error deleting activities:', activitiesError);
      }
    }

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
          } catch (error) {
          }
        }

        followsNextCursor = followsResponse.next;
        hasMoreFollows = !!followsNextCursor && followsResponse.follows.length > 0;
      }
    } catch (followsError) {
      if (followsError.code === 404 || followsError.metadata?.responseCode === 404) {
      } else {
      }
    }

    return { success: true, message: 'Feeds reset completed' };
  } catch (error) {
    console.error('Error resetting feeds:', error);
    throw error;
  }
}

async function ensureFeedGroupsExist(client) {
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
    } catch (error) {
      if (error.code === 4 || error.message?.includes('already exists')) {
        console.error('Feed group already exists:', error);
      } else {
        console.error('Error creating feed group:', error);
      }
    }
  }
}

export async function seedFeeds(client, currentUserId) {
  try {
    await ensureFeedGroupsExist(client);

    const sampleUsers = generateSampleUsers();
    await client.upsertUsers(sampleUsers);

    for (const user of sampleUsers) {
      try {
        const userFeed = client.feeds.feed('user', user.id);
        await userFeed.getOrCreate({ user_id: user.id });
      } catch (error) {
        console.error('Error getting or creating user feed:', error);
      }
    }

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
      
      try {
        const activityResponse = await client.feeds.addActivity({
          user_id: user.id,
          type: 'post',
          feeds: [userFeed],
          text: activityTexts[i] || `Post from ${user.name}`,
        });
        
        createdActivities.push(activityResponse.activity);
      } catch (error) {
        console.error('Error adding reaction:', error);
      }
    }

    for (let i = 0; i < Math.min(3, createdActivities.length); i++) {
      const activity = createdActivities[i];
      try {
        await client.feeds.addReaction({
          activity_id: activity.id,
          type: 'like',
          user_id: currentUserId,
        });
      } catch (error) {
      }
    }

    for (let i = 0; i < Math.min(2, createdActivities.length); i++) {
      const activity = createdActivities[i];
      try {
        await client.feeds.addComment({
          object_id: activity.id,
          object_type: 'activity',
          comment: 'Great post! 👍',
          user_id: currentUserId,
        });
      } catch (error) {
        console.error('Error adding comment:', error);
      }
    }

    return {
      success: true,
      message: 'Feeds seeded successfully',
      data: {
        activities: createdActivities.map(a => a.id),
        sampleUsers: sampleUsers.map(u => u.id),
      },
    };
  } catch (error) {
    console.error('Error seeding feeds:', error);
    throw error;
  }
}