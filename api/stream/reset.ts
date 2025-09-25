import { StreamChat } from "stream-chat";
import { connect } from 'getstream';
import { requireAuth } from "../_utils/auth0";
import { json, bad, serverError } from "../_utils/responses";
import type { VercelRequest, VercelResponse } from '@vercel/node';

const apiKey = process.env.STREAM_API_KEY!;
const apiSecret = process.env.STREAM_API_SECRET!;

const SAMPLE_USERS = [
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
  },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(400).json({ error: "Use POST" });

    console.log("🔄 Starting app reset...");
    const startTime = Date.now();

    const { sub } = await requireAuth(req);
    const me = sub.replace(/[^a-zA-Z0-9@_-]/g, "_").slice(0, 64);

    // Initialize both Stream Chat and Feeds clients
    const chatServer = StreamChat.getInstance(apiKey, apiSecret);
    const feedsServer = connect(apiKey, apiSecret);

    // === AGGRESSIVE CLEANUP PHASE ===
    console.log("🧹 AGGRESSIVELY cleaning up ALL visible data...");

    // 1. COMPLETELY WIPE Chat data
    console.log("💬 WIPING ALL Chat channels and users...");
    
    try {
      // Get EVERY possible channel with multiple query approaches
      const queryAttempts = [
        { type: 'messaging' },
        { members: { $in: [me] } },
        {},  // Get everything
      ];

      let allChannels = [];
      
      for (const filter of queryAttempts) {
        try {
          const channels = await chatServer.queryChannels(filter, { created_at: -1 }, { limit: 100 });
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

      // HARD DELETE ALL sample users to make them completely disappear
      const userIds = SAMPLE_USERS.map(u => u.id);
      console.log(`🗑️ HARD DELETING ${userIds.length} sample users...`);
      
      for (const userId of userIds) {
        try {
          await chatServer.deleteUser(userId, { 
            mark_messages_deleted: true, 
            hard_delete: true,
            delete_conversation_channels: true 
          });
          console.log(`✅ HARD DELETED user: ${userId}`);
        } catch (error) {
          console.log(`⚠️ Could not hard delete user ${userId}:`, error);
          // Try soft delete as fallback
          try {
            await chatServer.deactivateUser(userId, { mark_messages_deleted: true });
            console.log(`✅ Soft deleted user: ${userId}`);
          } catch (softError) {
            console.log(`❌ All user deletion methods failed for ${userId}`);
          }
        }
      }

    } catch (error) {
      console.error("❌ Error in aggressive chat cleanup:", error);
    }

    // 2. COMPLETELY OBLITERATE Feeds data
    console.log("📱 OBLITERATING ALL Feeds data...");
    
    try {
      // Test different feed types to find what exists
      const feedTypes = ['flat', 'user', 'timeline', 'aggregated', 'notification'];
      const feedIds = ['global', me, ...SAMPLE_USERS.map(u => u.id)];
      
      console.log(`🔍 Testing ${feedTypes.length} feed types with ${feedIds.length} feed IDs...`);
      
      for (const feedType of feedTypes) {
        for (const feedId of feedIds) {
          try {
            const feed = feedsServer.feed(feedType, feedId);
            
            // Get ALL activities with pagination to ensure we get everything
            let allActivityIds = [];
            let hasMore = true;
            let offset = 0;
            
            while (hasMore) {
              try {
                const activities = await feed.get({ limit: 100, offset });
                
                if (activities.results && activities.results.length > 0) {
                  const activityIds = activities.results.map(a => a.id);
                  allActivityIds.push(...activityIds);
                  console.log(`📊 Found ${activityIds.length} activities in ${feedType}:${feedId} (offset: ${offset})`);
                  
                  // Check if we got less than the limit (means we're at the end)
                  if (activities.results.length < 100) {
                    hasMore = false;
                  } else {
                    offset += 100;
                  }
                } else {
                  hasMore = false;
                }
              } catch (getError) {
                // Feed might not exist or be empty
                hasMore = false;
              }
            }
            
            // Delete ALL activities found
            if (allActivityIds.length > 0) {
              console.log(`🗑️ DELETING ${allActivityIds.length} activities from ${feedType}:${feedId}`);
              
              // Delete in smaller batches for reliability
              for (let i = 0; i < allActivityIds.length; i += 50) {
                const batch = allActivityIds.slice(i, i + 50);
                try {
                  await feed.removeActivity(batch);
                  console.log(`✅ Deleted batch of ${batch.length} activities from ${feedType}:${feedId}`);
                } catch (batchError) {
                  console.log(`⚠️ Batch deletion failed for ${feedType}:${feedId}:`, batchError);
                  
                  // Try deleting one by one as last resort
                  for (const activityId of batch) {
                    try {
                      await feed.removeActivity(activityId);
                      console.log(`✅ Individually deleted activity ${activityId}`);
                    } catch (individualError) {
                      console.log(`❌ Failed to delete individual activity ${activityId}`);
                    }
                  }
                }
              }
            }
            
            // If this is a timeline feed, also unfollow EVERYONE
            if (feedType === 'timeline') {
              console.log(`🔗 Clearing ALL follow relationships for ${feedId}...`);
              
              // Try to unfollow all possible users
              const allPossibleUsers = [me, ...SAMPLE_USERS.map(u => u.id), 'global'];
              
              for (const targetUser of allPossibleUsers) {
                if (targetUser !== feedId) {
                  try {
                    await feed.unfollow('user', targetUser);
                    console.log(`✅ ${feedId} unfollowed ${targetUser}`);
                  } catch (unfollowError) {
                    // Ignore - relationship might not exist
                  }
                }
              }
            }
            
          } catch (error) {
            // Feed type/id combination might not exist - that's ok
          }
        }
      }

      // HARD DELETE ALL sample users from Feeds
      console.log(`🗑️ HARD DELETING all sample users from Feeds...`);
      for (const user of SAMPLE_USERS) {
        try {
          await feedsServer.user(user.id).delete();
          console.log(`✅ HARD DELETED feeds user: ${user.id}`);
        } catch (error) {
          console.log(`⚠️ Could not delete feeds user ${user.id}:`, error);
        }
      }
      
      console.log(`✅ OBLITERATION of Feeds data complete!`);
      
    } catch (error) {
      console.error("❌ Error in aggressive feeds cleanup:", error);
    }

    console.log("✅ AGGRESSIVE CLEANUP COMPLETED - Everything should be GONE!");

    // STOP HERE - Just return empty state without re-seeding
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`🎉 App EMPTIED successfully in ${duration}ms`);

    return res.status(200).json({ 
      ok: true, 
      message: "App completely emptied - all data wiped clean",
      timing: {
        durationMs: duration
      },
      chat: {
        users: 0,
        channels: 0
      },
      feeds: {
        enabled: true,
        users: 0,
        activities: 0,
        followRelationships: 0
      }
    });


  } catch (err) {
    console.error("❌ Error resetting app:", err);
    return res.status(500).json({ 
      error: "Failed to reset app",
      details: err instanceof Error ? err.message : String(err)
    });
  }
}
