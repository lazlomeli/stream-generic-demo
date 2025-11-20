import { generateSampleUsers } from './sample-users.js';

function extractHashtags(text) {
  if (!text) return [];
  const regex = /#(\w+)/g;
  const matches = text.matchAll(regex);
  const hashtags = [...matches].map(match => match[1].toLowerCase());
  return [...new Set(hashtags)];
}

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
      activity_selectors: [{ type: 'following', cutoff_time: new Date(Date.now() + 31536000000) }], // 1 year from creation time
      ranking: { type: 'recency' },
    },
    {
      id: 'timeline',
      activity_selectors: [{ type: 'following', cutoff_time: new Date(Date.now() + 31536000000) }], 
      ranking: { type: 'recency' },
    },
    {
      id: 'notification',
      activity_selectors: [{ type: 'following', cutoff_time: new Date(Date.now() + 31536000000) }], 
      ranking: { type: 'recency' },
      notification: {
        enabled: true,
      },
    },
    {
      id: 'hashtag',
      activity_selectors: [{ cutoff_time: new Date(Date.now() + 31536000000) }], 
    },
  ];

  for (const feedGroup of feedGroupsToCreate) {
    try {
      await client.feeds.createFeedGroup(feedGroup);
      console.log(`✅ Created feed group: ${feedGroup.id}`);
    } catch (error) {
      if (error.code === 4 || error.message?.includes('already exists')) {
        console.log(`ℹ️ Feed group already exists: ${feedGroup.id}`);
      } else {
        console.error(`❌ Error creating feed group ${feedGroup.id}:`, error);
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
      '🌟 Just joined the platform! Excited to share my journey. #newbeginnings #introduction',
      '📸 Beautiful sunset today at the beach! #photography #nature #sunset',
      '💡 Learning something new every day keeps the mind sharp. #learning #growth #technology',
      '🎉 Celebrating small wins today! #motivation #success #productivity',
      '🚀 Working on an exciting new project! #coding #development #innovation',
    ];

    for (let i = 0; i < sampleUsers.length; i++) {
      const user = sampleUsers[i];
      const userFeed = `user:${user.id}`;
      const text = activityTexts[i] || `Post from ${user.name}`;
      
      try {
        // Extract hashtags from the text
        const hashtags = extractHashtags(text);
        const feeds = [userFeed];
        
        // Create hashtag feeds using getOrCreate for each hashtag
        if (hashtags.length > 0) {
          console.log(`📝 Creating activity with hashtags:`, hashtags);
          
          for (const hashtag of hashtags) {
            try {
              const hashtagFeed = client.feeds.feed('hashtag', hashtag);
              // Use getOrCreate with user_id to create the hashtag feed
              const feedResponse = await hashtagFeed.getOrCreate({
                user_id: user.id,
                visibility: 'public',
                name: hashtag,
              });
              feeds.push(feedResponse.feed.feed);
              console.log(`✅ Created/verified hashtag feed: ${hashtag} -> ${feedResponse.feed.feed}`);
            } catch (hashtagError) {
              console.error(`❌ Error creating hashtag feed ${hashtag}:`, hashtagError);
            }
          }
        }
        
        console.log(`📤 Adding activity to feeds:`, feeds);
        
        // Add activity to user feed and hashtag feeds
        const activityResponse = await client.feeds.addActivity({
          user_id: user.id,
          type: 'post',
          feeds: feeds,
          text: text,
        });
        
        console.log(`✅ Created activity ${activityResponse.activity.id} with ${hashtags.length} hashtags`);
        createdActivities.push(activityResponse.activity);
      } catch (error) {
        console.error('❌ Error adding activity:', error);
      }
    }

    // Add some likes
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

    // Add some comments
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