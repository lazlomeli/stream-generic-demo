import { StreamChat } from 'stream-chat';
import { connect } from 'getstream';

// Unified sample users definition
export const SAMPLE_USERS = [
  { 
    id: "alice_smith", 
    name: "Alice Smith", 
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face",
    role: "Frontend Developer",
    company: "Stream"
  },
  { 
    id: "bob_johnson", 
    name: "Bob Johnson", 
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    role: "Backend Engineer", 
    company: "TechCorp"
  },
  { 
    id: "carol_williams", 
    name: "Carol Williams", 
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
    role: "Product Designer",
    company: "Design Studio"
  },
  { 
    id: "david_brown", 
    name: "David Brown", 
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
    role: "DevRel Engineer",
    company: "Stream"
  },
  { 
    id: "emma_davis", 
    name: "Emma Davis", 
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face",
    role: "Full-stack Developer",
    company: "StartupCo"
  }
];

// Demo user mapping for display names (maps IDs to clean names)
export const DEMO_USERS = {
  'alice_smith': {
    name: 'Alice Smith',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face',
    role: 'Frontend Developer',
    company: 'Stream'
  },
  'bob_johnson': {
    name: 'Bob Johnson',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    role: 'Backend Engineer',
    company: 'TechCorp'
  },
  'carol_williams': {
    name: 'Carol Williams',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    role: 'Product Designer',
    company: 'Design Studio'
  },
  'david_brown': {
    name: 'David Brown',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    role: 'DevRel Engineer',
    company: 'Stream'
  },
  'emma_davis': {
    name: 'Emma Davis',
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
    role: 'Full-stack Developer',
    company: 'StartupCo'
  }
} as const;

export interface SeedingContext {
  streamClient: StreamChat;
  serverFeedsClient: any;
  currentUserId: string;
}

/**
 * Resilient user management - handles hard deleted users by creating new versions
 * Special handling for demo_user_2025 to keep it as persistent demo user for video calls
 */
export async function createWorkingUsers(context: SeedingContext): Promise<any[]> {
  const { streamClient } = context;
  const workingUsers: any[] = [];
  const timestamp = Date.now();
  
  // First, ensure the demo user exists
  try {
    const demoUser = {
      id: 'demo_user_2025',
      name: 'Demo User',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
    };
    await streamClient.upsertUser(demoUser);
    console.log(`✅ Created/updated persistent demo user: ${demoUser.id}`);
    workingUsers.push(demoUser);
  } catch (error) {
    console.log(`❌ Failed to create persistent demo user demo_user_2025:`, error);
  }
  
  for (const user of SAMPLE_USERS) {
    // For sample users, create timestamped versions to avoid conflicts
    const newUser = {
      id: `${user.id}_${timestamp}`,
      name: user.name,
      image: user.image
      // Remove role and company to avoid Stream Chat validation errors
    };
    
    try {
      await streamClient.upsertUser(newUser);
      console.log(`✅ Created new user: ${newUser.id}`);
      workingUsers.push(newUser);
    } catch (error) {
      console.log(`❌ Failed to create new user for ${user.id}:`, error);
    }
  }
  
  console.log(`✅ Working with ${workingUsers.length} users (including persistent demo_user_2025)`);
  return workingUsers;
}

/**
 * Create sample chat channels
 */
export async function createChatChannels(context: SeedingContext, workingUsers: any[]): Promise<void> {
  const { streamClient, currentUserId } = context;
  
  // Create current user
  await streamClient.upsertUser({ id: currentUserId });
  
  // General channel with working users (prevent duplicates)
  try {
    const generalMembers = [currentUserId, ...workingUsers.slice(0, 4).map(u => u.id)];
    const general = streamClient.channel("messaging", "general", {
      members: generalMembers,
      created_by_id: currentUserId
    });
    await general.create();
    
    // Update channel with display name after creation
    await general.update({ name: "General" });
    
    console.log(`✅ Created general channel with ${generalMembers.length} members`);
  } catch (error) {
    console.log(`⚠️ General channel creation failed (may already exist):`, error);
  }

  // 1:1 channels with working users (prevent duplicates)
  let channelsCreated = 0;
  for (const u of workingUsers) {
    try {
      const dm = streamClient.channel("messaging", { 
        members: [currentUserId, u.id], 
        created_by_id: currentUserId 
      });
      await dm.create();

      // Update channel with display metadata after creation
      const currentName = (dm.data?.name);
      const currentImage = (dm.data?.image);
      if (!currentName || !currentImage) {
        await dm.update({ name: u.name, image: u.image });
      }
      
      channelsCreated++;
      console.log(`✅ Created DM channel with ${u.name} (${u.id})`);
    } catch (error) {
      console.log(`⚠️ DM channel creation failed for ${u.name} (may already exist):`, error);
    }
  }
  
  console.log(`✅ Chat channels created: 1 general + ${channelsCreated} DMs = ${channelsCreated + 1} total`);
}

/**
 * Create sample activity feed posts
 */
export async function createFeedActivities(context: SeedingContext, workingUsers: any[]): Promise<void> {
  const { serverFeedsClient, currentUserId } = context;
  
  // Create users in Feeds using working users
  for (const user of workingUsers) {
    try {
      await serverFeedsClient.user(user.id).create({
        name: user.name,
        profileImage: user.image
      });
    } catch (error) {
      // User might already exist, continue
    }
  }

  try {
    await serverFeedsClient.user(currentUserId).create({
      name: 'Current User',
      profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
    });
  } catch (error) {
    // User might already exist, continue
  }

  // Create dynamic sample activities using working users
  const sampleActivities: any[] = [];
  
  if (workingUsers.length >= 3) {
    sampleActivities.push(
      {
        actor: workingUsers[3]?.id || workingUsers[0]?.id, // David Brown or first available
        verb: 'post',
        object: 'post',
        text: '🚀 Just launched our new real-time activity feeds powered by @getstream! The performance is incredible - handling millions of activities with sub-100ms latency. #StreamChat #RealTime #ActivityFeeds',
        attachments: [{
          type: 'image',
          asset_url: 'https://picsum.photos/800/600?random=1',
          mime_type: 'image/jpeg',
          title: 'Stream Dashboard Analytics'
        }],
        custom: {
          likes: 47, shares: 23, comments: 18, category: 'technology',
          hashtags: ['StreamChat', 'RealTime', 'ActivityFeeds'], sentiment: 'positive'
        }
      },
      {
        actor: workingUsers[0]?.id, // Alice Smith or first available
        verb: 'post',  
        object: 'post',
        text: '✨ Demo time! This activity feed you\'re looking at is powered by Stream Feeds. Try creating a post, liking, commenting - everything is real-time and scalable. Perfect for social apps, collaboration tools, or any app needing activity streams.',
        attachments: [{
          type: 'image',
          asset_url: 'https://picsum.photos/800/600?random=2',
          mime_type: 'image/jpeg',
          title: 'Real-time Demo Interface'
        }],
        custom: {
          likes: 156, shares: 73, comments: 45, category: 'demo',
          hashtags: ['StreamFeeds', 'Demo', 'RealTime'], sentiment: 'positive', featured: true
        }
      },
      {
        actor: workingUsers[4]?.id || workingUsers[1]?.id, // Emma Davis or second available
        verb: 'post',
        object: 'post',
        text: 'Building scalable chat and feeds is no joke! 💪 Stream\'s SDK made it so much easier to implement real-time features. From prototype to production in days, not months. Highly recommend for any dev building social features!',
        custom: {
          likes: 92, shares: 41, comments: 29, category: 'technology',
          hashtags: ['GetStream', 'RealTime', 'SocialFeatures'], sentiment: 'positive'
        }
      }
    );
  }

  // Create sample activities in user feeds (prevent duplicates)
  let activitiesCreated = 0;
  for (const activity of sampleActivities) {
    try {
      const activityData = {
        actor: activity.actor,
        verb: activity.verb,
        object: activity.object,
        text: activity.text,
        attachments: activity.attachments,
        custom: activity.custom,
        // Use simpler foreign_id to avoid UUID validation issues
        foreign_id: `post_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        time: new Date().toISOString()
      };

      // Add only to user feed (timeline will distribute to followers)
      await serverFeedsClient.feed('user', activity.actor).addActivity(activityData);
      activitiesCreated++;
      
      console.log(`✅ Created activity ${activitiesCreated}: "${activity.text.substring(0, 50)}..." by ${activity.actor}`);
    } catch (error) {
      console.error(`❌ Error creating activity for ${activity.actor}:`, error);
    }
  }

  console.log(`✅ Feed activities created: ${activitiesCreated} total posts`);
}

/**
 * Create follow relationships for timeline feeds
 */
export async function createFollowRelationships(context: SeedingContext, workingUsers: any[]): Promise<void> {
  const { serverFeedsClient, currentUserId } = context;
  
  console.log('👥 Creating follow relationships...');
  const followRelationships: any[] = [];
  
  // Current user follows all working users
  for (const user of workingUsers) {
    followRelationships.push({ follower: currentUserId, following: user.id });
  }
  
  // Create cross-relationships between working users
  if (workingUsers.length >= 2) {
    followRelationships.push(
      { follower: workingUsers[0]?.id, following: workingUsers[1]?.id },
      { follower: workingUsers[1]?.id, following: workingUsers[0]?.id }
    );
  }
  
  if (workingUsers.length >= 3) {
    followRelationships.push(
      { follower: workingUsers[2]?.id, following: workingUsers[0]?.id }
    );
  }

  for (const relationship of followRelationships) {
    try {
      await serverFeedsClient.feed('timeline', relationship.follower).follow('user', relationship.following);
      console.log(`✅ ${relationship.follower} now follows ${relationship.following}`);
    } catch (error) {
      console.log(`⚠️ Follow relationship error:`, error);
    }
  }
  
  console.log('✅ Follow relationships created');
}

/**
 * Complete seeding process - creates everything needed for a working demo
 */
export async function seedStreamDemo(context: SeedingContext): Promise<{
  users: number;
  channels: number;
  activities: number;
  followRelationships: number;
}> {
  console.log('🌱 Starting unified seeding process...');
  
  try {
    // Step 1: Create resilient users
    const workingUsers = await createWorkingUsers(context);
    
    // Step 2: Create chat channels
    await createChatChannels(context, workingUsers);
    
    // Step 3: Create feed activities
    await createFeedActivities(context, workingUsers);
    
    // Step 4: Create follow relationships
    await createFollowRelationships(context, workingUsers);
    
    console.log('🎉 Unified seeding completed successfully!');
    
    return {
      users: workingUsers.length + 1, // +1 for current user
      channels: workingUsers.length + 1, // +1 for general channel
      activities: Math.min(3, workingUsers.length), // Up to 3 sample activities
      followRelationships: workingUsers.length + Math.min(3, workingUsers.length - 1) // Current user + cross relationships
    };
    
  } catch (error) {
    console.error('❌ Error in unified seeding:', error);
    throw error;
  }
}

/**
 * Aggressive cleanup - removes all data for a fresh start
 */
export async function aggressiveCleanup(context: SeedingContext): Promise<void> {
  const { streamClient, serverFeedsClient, currentUserId } = context;
  
  console.log('🧹 Starting aggressive cleanup...');
  
  try {
    // === AGGRESSIVE CHAT CLEANUP ===
    console.log('💬 Cleaning up chat data...');
    
    // Get EVERY possible channel with multiple query approaches
    const queryAttempts = [
      { type: 'messaging' },
      { members: { $in: [currentUserId] } },
      { created_by_id: currentUserId },
      { id: 'general' }, // Specifically target the general channel
      // Query for channels with any sample user (including timestamped versions)
      ...SAMPLE_USERS.map(u => ({ members: { $in: [u.id] } })),
      {},  // Get everything as fallback
    ];
    
    console.log(`🔍 Will attempt ${queryAttempts.length} different channel queries to find ALL channels`);

    let allChannels: any[] = [];
    
    for (const filter of queryAttempts) {
      try {
        const channels = await streamClient.queryChannels(filter, { created_at: -1 }, { limit: 100 });
        allChannels.push(...channels);
        console.log(`Query with filter ${JSON.stringify(filter)} found ${channels.length} channels`);
      } catch (error) {
        console.log(`Query failed for filter ${JSON.stringify(filter)}:`, error);
      }
    }

    // Remove duplicates
    const uniqueChannels = allChannels.filter((channel, index, self) => 
      index === self.findIndex(c => c.id === channel.id)
    );

    console.log(`🎯 TOTAL UNIQUE CHANNELS TO DELETE: ${uniqueChannels.length}`);
    
    // Delete EVERY channel found
    for (const channel of uniqueChannels) {
      try {
        // Force delete with hard_delete option
        await channel.delete({ hard_delete: true });
        console.log(`✅ HARD DELETED channel: ${channel.id}`);
      } catch (error) {
        console.log(`⚠️ Hard delete failed for ${channel.id}, trying soft delete:`, error);
        try {
          await channel.delete();
          console.log(`✅ Soft deleted channel: ${channel.id}`);
        } catch (softError) {
          console.log(`❌ All deletion methods failed for ${channel.id}:`, softError);
        }
      }
    }

    // HARD DELETE ALL sample users (including timestamped versions) to make them completely disappear
    // BUT PRESERVE bob_johnson for video call demo functionality
    const chatUserBaseIds = SAMPLE_USERS.map(u => u.id);
    
    // Find ALL existing timestamped versions by checking channels
    const discoveredUserIds = new Set(chatUserBaseIds);
    allChannels.forEach(channel => {
      if (channel.data?.members) {
        channel.data.members.forEach((member: any) => {
          const memberId = typeof member === 'string' ? member : member.id;
          // Add timestamped versions of sample users
          if (memberId && chatUserBaseIds.some(baseId => memberId.startsWith(baseId + '_'))) {
            discoveredUserIds.add(memberId);
          }
        });
      }
    });
    
    // Filter out the new demo user 'demo_user_2025' to preserve it for video calls
    const userIds = Array.from(discoveredUserIds).filter(id => id !== currentUserId && id !== 'demo_user_2025');
    console.log(`🗑️ HARD DELETING ${userIds.length} users (including timestamped versions, but preserving demo_user_2025):`, userIds);
    
    for (const userId of userIds) {
      try {
        await streamClient.deleteUser(userId, { 
          mark_messages_deleted: true, 
          hard_delete: true,
          delete_conversation_channels: true 
        });
        console.log(`✅ HARD DELETED user: ${userId}`);
      } catch (error) {
        console.log(`⚠️ Could not hard delete user ${userId}:`, error);
        // Try soft delete as fallback
        try {
          await streamClient.deactivateUser(userId, { mark_messages_deleted: true });
          console.log(`✅ Soft deleted user: ${userId}`);
        } catch (softError) {
          console.log(`❌ All user deletion methods failed for ${userId}`);
        }
      }
    }

    console.log('✅ Chat cleanup completed');

    // === SIMPLIFIED FEEDS CLEANUP ===
    console.log('📰 Starting simplified feeds cleanup...');
    
    // Focus only on current user and sample user feeds for faster cleanup
    // BUT PRESERVE demo_user_2025 feeds for video call demo functionality
    const targetUserIds = [currentUserId, ...SAMPLE_USERS.map(u => u.id).filter(id => id !== 'demo_user_2025')];
    
    // Add any timestamped versions we can find from chat cleanup
    allChannels.forEach(channel => {
      if (channel.data?.members) {
        channel.data.members.forEach((member: any) => {
          const memberId = typeof member === 'string' ? member : member.id;
          if (memberId && SAMPLE_USERS.some(u => memberId.startsWith(u.id + '_'))) {
            targetUserIds.push(memberId);
          }
        });
      }
    });
    
    console.log(`🎯 Cleaning feeds for ${targetUserIds.length} users (preserving demo_user_2025 feeds)`);
    
    // Only clean the essential feed types
    const feedTypes = ['user', 'timeline'];
    
    for (const feedType of feedTypes) {
      for (const userId of targetUserIds) {
        if (!userId) continue;
        
        try {
          console.log(`🧹 Cleaning ${feedType}:${userId}`);
          const feed = serverFeedsClient.feed(feedType, userId);
          
          // Get and delete in smaller, faster batches
          let attempts = 0;
          while (attempts < 3) { // Max 3 attempts per feed
            try {
              const activities = await feed.get({ limit: 25 }); // Smaller batches
              
              if (!activities.results || activities.results.length === 0) {
                console.log(`✅ Feed ${feedType}:${userId} is clean`);
                break;
              }
              
              // Delete activities directly without complex logic
              for (const activity of activities.results) {
                try {
                  if (activity.id) {
                    await feed.removeActivity(activity.id);
                  }
                } catch (deleteError) {
                  // Ignore individual deletion errors to prevent loops
                }
              }
              
              console.log(`🗑️ Cleaned ${activities.results.length} activities from ${feedType}:${userId}`);
              attempts++;
            } catch (error) {
              console.log(`⚠️ Error cleaning ${feedType}:${userId}:`, error);
              break; // Exit on error instead of retrying
            }
          }
          
          // Unfollow everyone for timeline feeds
          if (feedType === 'timeline') {
            for (const targetId of targetUserIds) {
              if (targetId !== userId) {
                try {
                  await feed.unfollow('user', targetId);
                } catch (unfollowError) {
                  // Ignore unfollow errors
                }
              }
            }
          }
          
        } catch (feedError) {
          console.log(`⚠️ Could not clean ${feedType}:${userId}:`, feedError);
        }
      }
    }

    // Hard delete feeds users
    console.log('🗑️ HARD DELETING feeds users...');
    for (const userId of userIds) {
      try {
        await serverFeedsClient.user(userId).delete();
        console.log(`✅ HARD DELETED feeds user: ${userId}`);
      } catch (error) {
        console.log(`⚠️ Could not delete feeds user ${userId}:`, error);
      }
    }

    console.log('✅ Feeds cleanup completed');
    console.log("✅ AGGRESSIVE CLEANUP COMPLETED - Everything should be GONE!");
    
  } catch (error) {
    console.error("❌ Error in aggressive cleanup:", error);
    throw error;
  }
}

// Global reset lock to prevent multiple concurrent resets
let isResetInProgress = false;

/**
 * Complete reset process - cleanup + fresh seeding
 */
export async function resetStreamDemo(context: SeedingContext): Promise<{
  users: number;
  channels: number;
  activities: number;
  followRelationships: number;
}> {
  console.log('🔄 Starting unified reset process...');
  
  // Prevent multiple concurrent resets
  if (isResetInProgress) {
    console.log('⚠️ Reset already in progress, skipping duplicate request');
    throw new Error('Reset operation already in progress');
  }
  
  isResetInProgress = true;
  
  try {
    // Step 1: Aggressive cleanup with extra wait time
    console.log('🧹 Phase 1: Aggressive cleanup...');
    await aggressiveCleanup(context);
    
    // Wait to ensure cleanup is fully propagated
    console.log('⏳ Waiting for cleanup to propagate...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Fresh seeding
    console.log('🌱 Phase 2: Fresh seeding...');
    const seedingResults = await seedStreamDemo(context);
    
    console.log('🎉 Unified reset completed successfully!');
    return seedingResults;
    
  } catch (error) {
    console.error('❌ Error in unified reset:', error);
    throw error;
  } finally {
    // Always release the lock
    isResetInProgress = false;
  }
}
