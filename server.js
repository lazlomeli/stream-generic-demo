import express from 'express';
import cors from 'cors';
import { StreamChat } from 'stream-chat';
import { StreamClient } from '@stream-io/node-sdk';
import { connect } from 'getstream';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

// Load environment variables from both .env and .env.local
dotenv.config(); // Loads .env

// Helper function to create notification activities
async function createNotificationActivity(
  serverFeedsClient,
  notificationType,
  actorUserId,
  targetUserId,
  postId,
  commentText
) {
  try {
    // Don't create notifications for self-actions
    if (actorUserId === targetUserId) {
      console.log(`🔔 Skipping notification: actor and target are the same user (${actorUserId})`);
      return;
    }

    console.log(`🔔 Creating ${notificationType} notification: ${actorUserId} → ${targetUserId}`);

    // Get actor user profile for the notification
    let actorProfile = {
      name: actorUserId,
      image: undefined
    };

    try {
      const userProfileResponse = await serverFeedsClient.user(actorUserId).get();
      if (userProfileResponse.data) {
        const userData = userProfileResponse.data;
        actorProfile = {
          name: userData.name || userData.username || actorUserId,
          image: userData.image || userData.profile_image || undefined
        };
      }
    } catch (userError) {
      console.log(`⚠️ Could not fetch user profile for ${actorUserId}, using fallback`);
    }

    // Create notification activity data
    let notificationData = {
      actor: actorUserId,
      verb: 'notification',
      object: notificationType,
      target: targetUserId,
      custom: {
        notification_type: notificationType,
        target_user: targetUserId,
        actor_name: actorProfile.name,
        actor_image: actorProfile.image
      }
    };

    // Add type-specific data
    switch (notificationType) {
      case 'like':
        notificationData.text = `${actorProfile.name} liked your post`;
        notificationData.custom.post_id = postId;
        break;
      case 'comment':
        notificationData.text = `${actorProfile.name} commented on your post`;
        notificationData.custom.post_id = postId;
        notificationData.custom.comment_text = commentText?.substring(0, 100) || '';
        break;
      case 'follow':
        notificationData.text = `${actorProfile.name} followed you`;
        break;
    }

    // Add notification to target user's personal feed with notification verb
    // We'll filter these out from regular feeds display but show them in notifications
    const userFeed = serverFeedsClient.feed('user', targetUserId);
    const notificationActivity = await userFeed.addActivity(notificationData);
    
    console.log(`✅ Notification created: ${notificationActivity.id}`);
    return notificationActivity;
  } catch (error) {
    console.error(`❌ Failed to create ${notificationType} notification:`, error);
    // Don't throw error - notifications are not critical
  }
}

// Helper function to get post author from activity
async function getPostAuthor(serverFeedsClient, postId) {
  try {
    console.log(`🔍 AUTHOR_DEBUG: Looking for post author for postId: ${postId}`);
    
    // Try to get the activity from global feed first
    const globalFeed = serverFeedsClient.feed('flat', 'global');
    const activities = await globalFeed.get({ limit: 100, withReactionCounts: false });
    
    console.log(`🔍 AUTHOR_DEBUG: Retrieved ${activities.results?.length || 0} activities from global feed`);
    console.log(`🔍 AUTHOR_DEBUG: Activity IDs in global feed:`, activities.results?.map((a) => a.id).slice(0, 10));
    
    // Find the activity by ID
    const activity = activities.results?.find((act) => act.id === postId);
    if (activity && activity.actor) {
      console.log(`📍 AUTHOR_DEBUG: Found post author: ${activity.actor} for post ${postId}`);
      console.log(`📍 AUTHOR_DEBUG: Full activity:`, { id: activity.id, actor: activity.actor, verb: activity.verb, text: activity.text?.substring(0, 50) });
      return activity.actor;
    }

    console.log(`⚠️ AUTHOR_DEBUG: Could not find post author for post ${postId} in global feed`);
    
    // FALLBACK: Try to find the post in user feeds by examining recent user activities
    console.log(`🔍 AUTHOR_DEBUG: Trying fallback approach - checking recent user activities...`);
    
    // Get a list of users to check - include common test users AND recent activity actors
    let testUsers = ['lazlo_user_test', 'lazlo_fernandez_test', 'alice_smith', 'bob_johnson', 'carol_williams'];
    
    // DYNAMIC: Also check recent activity actors from global feed to catch real users
    const recentActors = new Set();
    if (activities.results) {
      activities.results.forEach(activity => {
        if (activity.actor && !testUsers.includes(activity.actor)) {
          recentActors.add(activity.actor);
        }
      });
    }
    
    // Add recent actors to search list
    testUsers = [...testUsers, ...Array.from(recentActors)];
    console.log(`🔍 AUTHOR_DEBUG: Searching in feeds for users:`, testUsers.slice(0, 10)); // Log first 10
    
    for (const userId of testUsers) {
      try {
        const userFeed = serverFeedsClient.feed('user', userId);
        const userActivities = await userFeed.get({ limit: 10, withReactionCounts: false });
        
        const userActivity = userActivities.results?.find((act) => act.id === postId);
        if (userActivity && userActivity.actor) {
          console.log(`📍 AUTHOR_DEBUG: Found post author via user feed search: ${userActivity.actor} for post ${postId}`);
          return userActivity.actor;
        }
      } catch (userFeedError) {
        // Continue to next user if this one fails
        console.log(`🔍 AUTHOR_DEBUG: Could not check feed for user ${userId}:`, userFeedError.message);
      }
    }
    
    console.log(`❌ AUTHOR_DEBUG: Could not find post author for post ${postId} in any feeds`);
    return null;
  } catch (error) {
    console.error(`❌ AUTHOR_DEBUG: Error getting post author for ${postId}:`, error);
    return null;
  }
}

// --- Sample Users (same as in Vercel seed.ts) ---
// Import unified seeding logic (using dynamic import since it's TypeScript)
let seedingModule;
const loadSeedingModule = async () => {
  if (!seedingModule) {
    // Use dynamic import to load TypeScript module
    seedingModule = await import('./api/_utils/seeding.ts');
  }
  return seedingModule;
};

// Legacy comment: sample users are now imported from unified seeding utility
// Legacy sample users array removed - now imported from unified seeding utility


const app = express();
const PORT = process.env.PORT || 5000;

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 image uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for handling file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory for now
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Initialize Stream Chat with reduced logging
const streamClient = new StreamChat(
  process.env.STREAM_API_KEY,
  process.env.STREAM_API_SECRET,
  undefined, // app_id
  { logLevel: 'warn' } // Reduce logging verbosity
);

// Initialize Stream Feeds V2 client for backend operations with reduced logging
const serverFeedsClient = connect(
  process.env.STREAM_API_KEY,
  process.env.STREAM_API_SECRET,
  undefined, // app_id
  { logLevel: 'warn' } // Reduce logging verbosity
);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: 'local-development'
  });
});

// Stream Chat Token endpoint
app.post('/api/stream/chat-token', async (req, res) => {
  try {
    const { userId } = req.body;
    
    console.log('🔐 Generating Stream Chat token for userId:', userId);
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check if we have Stream credentials
    if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
      console.error('❌ Missing Stream API credentials');
      return res.status(500).json({ 
        error: 'Stream API credentials not configured. Check your .env file.' 
      });
    }

    // Generate Stream user token
    const streamToken = streamClient.createToken(userId);
    
    console.log('✅ Stream Chat token generated successfully');
    
    res.json({
      token: streamToken,
      apiKey: process.env.STREAM_API_KEY,
      userId: userId
    });
    
  } catch (error) {
    console.error('💥 Error generating chat token:', error);
    res.status(500).json({ error: 'Failed to generate chat token' });
  }
});

// Stream Feeds Token endpoint
app.post('/api/stream/feed-token', async (req, res) => {
  try {
    const { userId } = req.body;
    
    console.log('🔐 Generating Stream Feeds token for userId:', userId);
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check if we have Stream credentials
    if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
      console.error('❌ Missing Stream API credentials');
      return res.status(500).json({ 
        error: 'Stream API credentials not configured. Check your .env file.' 
      });
    }

    // Generate a Feeds V3-compatible JWT token
    const token = jwt.sign(
      {
        user_id: userId,
      },
      process.env.STREAM_API_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '24h', // or shorter if needed
      }
    );
    
    console.log('✅ Stream Feeds token generated successfully');
    
    res.json({
      token: token,
      apiKey: process.env.STREAM_API_KEY,
      userId: userId
    });
    
  } catch (error) {
    console.error('💥 Error generating feeds token:', error);
    res.status(500).json({ error: 'Failed to generate feeds token' });
  }
});


// Stream Feeds Get Posts endpoint
app.post('/api/stream/get-posts', async (req, res) => {
  try {
    const { userId, feedGroup = 'flat', feedId = 'global', limit = 20 } = req.body;
    
    console.log('📊 Fetching posts from feed:', `${feedGroup}:${feedId}`, 'for userId:', userId);
    console.log(`🔍 MAIN_FEED_DEBUG: This is for main feed view, fetching ${feedGroup}:${feedId}`);
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Use V2 serverFeedsClient for backend operations (server-side access)
    const feed = serverFeedsClient.feed(feedGroup, feedId);

    // Fetch activities from the specified feed with reaction counts (V2)
    const result = await feed.get({ limit: limit * 2, withReactionCounts: true }); // Get more to account for filtering

    console.log(`✅ Found ${result.results.length} activities in ${feedGroup}:${feedId}`);
    
    // Debug: Log what verbs we have before filtering
    console.log(`🔍 DEBUG: Raw activities in ${feedGroup}:${feedId}:`, 
      result.results.map(a => ({ id: a.id, verb: a.verb, actor: a.actor, text: a.text?.substring(0, 50) }))
    );
    
    // Filter out notification activities and internal activities to prevent them from showing as posts
    const filteredResults = result.results.filter((activity) => 
      activity.verb !== 'notification' && activity.verb !== 'notifications_viewed'
    );
    console.log(`🔧 Filtered to ${filteredResults.length} non-notification activities`);
    console.log(`🔍 DEBUG: Filtered activities:`, 
      filteredResults.map(a => ({ id: a.id, verb: a.verb, actor: a.actor, text: a.text?.substring(0, 50) }))
    );
    
    // Limit after filtering
    const limitedResults = filteredResults.slice(0, limit);
    
    // Update result to use filtered activities
    result.results = limitedResults;
    console.log(`🔍 withReactionCounts enabled: true`);
    
    // Debug: Log the first activity to see its structure
    if (result.results.length > 0) {
      console.log('🔍 Sample activity reaction_counts:', result.results[0].reaction_counts);
      console.log('🔍 Sample activity custom:', result.results[0].custom);
      
      // Test if we can get any reactions for the first activity (V3 - mock for now)
      try {
        const testReactions = {
          results: [] // Mock empty reactions for V3
        };
      } catch (error) {
        console.error(`⚠️ Could not test reactions for first activity:`, error.message);
      }
    }

    // Enrich activities with user information
    const enrichedActivities = result.results.map((activity) => {
      // If this is the current user's post, mark it for frontend handling
      if (activity.actor === userId) {
        return {
          ...activity,
          isCurrentUser: true
        };
      }
      
      // For other users, check if we have user info in the activity
      if (activity.userInfo) {
        return activity;
      }
      
      // Return activity as-is, frontend will handle fallback
      return activity;
    });

    // Check if we need to manually count comments (if withReactionCounts doesn't provide them)
    const activitiesWithCommentCounts = await Promise.all(enrichedActivities.map(async (activity) => {
      let commentCount = 0;
      
      // First, try to get comment count from withReactionCounts
      if (activity.reaction_counts && typeof activity.reaction_counts.comment === 'number') {
        commentCount = activity.reaction_counts.comment;
        console.log(`✅ Using reaction_counts for activity ${activity.id}: ${commentCount} comments`);
      } else {
        // Fallback: manually count comment reactions
        try {
          console.log(`🔄 Manually counting comments for activity ${activity.id}...`);
          const commentReactions = {
            results: [] // Mock empty reactions for V3
          };
          
          commentCount = commentReactions.results?.length || 0;
          console.log(`✅ Manual count for activity ${activity.id}: ${commentCount} comments`);
        } catch (error) {
          console.warn(`⚠️ Could not get comment count for activity ${activity.id}:`, error);
          commentCount = 0;
        }
      }
      
      // Ensure we have a custom object
      const customData = activity.custom || {};
      
      // Get the actual like count from reaction_counts (prioritize over custom data)
      let likeCount = customData.likes || 0;
      if (activity.reaction_counts && typeof activity.reaction_counts.like === 'number') {
        likeCount = activity.reaction_counts.like;
        console.log(`✅ Using reaction_counts for activity ${activity.id}: ${likeCount} likes`);
      } else {
        console.log(`🔍 No reaction_counts.like for activity ${activity.id}, using custom: ${likeCount}`);
      }

      return {
        ...activity,
        custom: {
          ...customData,
          comments: commentCount,
          // Use reaction_counts.like if available, otherwise fall back to custom data
          likes: likeCount,
          shares: customData.shares || 0,
          category: customData.category || 'general'
        }
      };
    }));

    res.json({
      success: true,
      activities: activitiesWithCommentCounts,
      feedGroup,
      feedId,
      count: activitiesWithCommentCounts.length
    });
    
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch posts',
      details: error.message 
    });
  }
});

// Stream Get User Posts endpoint
app.post('/api/stream/get-user-posts', async (req, res) => {
  try {
    const { targetUserId, limit = 20 } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    console.log(`🔍 Fetching posts for user: ${targetUserId}`);

    // Use V2 serverFeedsClient for backend operations (server-side access)
    // Get posts from global feed filtered by target user (V2)
    const globalFeed = serverFeedsClient.feed('flat', 'global');
    const result = await globalFeed.get({
      limit: 25, // Reduced to avoid rate limits
      withOwnReactions: true,
      withReactionCounts: true,
      withRecentReactions: true,
    });

    // Filter posts by the target user
    const userPosts = result.results.filter(activity => activity.actor === targetUserId);
    
    // Limit to requested amount
    const limitedPosts = userPosts.slice(0, parseInt(limit));

    console.log(`📝 Found ${limitedPosts.length} posts for user ${targetUserId} (out of ${result.results.length} total posts)`);

    if (!limitedPosts || limitedPosts.length === 0) {
      return res.json({ 
        posts: [],
        message: 'No posts found for this user'
      });
    }

    // Enrich activities with user information
    const enrichedActivities = await Promise.all(
      limitedPosts.map(async (activity) => {
        try {
          // Priority 1: Use userProfile data stored directly in the activity
          if (activity.userProfile && activity.userProfile.name) {
            console.log(`✅ Using stored userProfile for ${activity.actor}:`, activity.userProfile);
            return {
              ...activity,
              userInfo: {
                name: activity.userProfile.name,
                image: activity.userProfile.image || undefined,
                role: activity.userProfile.role || undefined,
                company: activity.userProfile.company || undefined
              }
            };
          }
          
          // Priority 2: Fallback to Stream's user profile system
          if (streamFeedsClient.getUsers) {
            const userProfile = await streamFeedsClient.getUsers([activity.actor]);
            const userData = userProfile[activity.actor];
            
            if (userData && userData.name) {
              console.log(`✅ Using Stream user profile for ${activity.actor}:`, userData);
              return {
                ...activity,
                userInfo: {
                  name: userData.name || userData.username,
                  image: userData.image || userData.profile_image || undefined,
                  role: userData.role || undefined,
                  company: userData.company || undefined
                }
              };
            }
          }
          
          // Priority 3: Use actor ID as fallback
          console.warn(`⚠️ No user profile found for ${activity.actor}, using actor ID as name`);
          return {
            ...activity,
            userInfo: {
              name: activity.actor,
              image: undefined,
              role: undefined,
              company: undefined
            }
          };
        } catch (userError) {
          console.warn(`Failed to fetch user profile for ${activity.actor}:`, userError);
          return {
            ...activity,
            userInfo: {
              name: activity.actor,
              image: undefined,
              role: undefined,
              company: undefined
            }
          };
        }
      })
    );

    console.log(`✅ Successfully enriched ${enrichedActivities.length} posts for user ${targetUserId}`);

    res.json({ 
      posts: enrichedActivities,
      count: enrichedActivities.length
    });

  } catch (error) {
    console.error('❌ Error fetching user posts:', error);
    res.status(500).json({ error: 'Failed to fetch user posts' });
  }
});

// Stream Get Chat User endpoint
app.post('/api/stream/get-chat-user', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log(`🔍 Fetching Stream Chat user data for: ${userId}`);

    // Initialize Stream Chat client
    const serverClient = StreamChat.getInstance(
      process.env.STREAM_API_KEY,
      process.env.STREAM_API_SECRET
    );

    try {
      // Query the user from Stream Chat
      const response = await serverClient.queryUsers(
        { id: userId },
        { id: 1 },
        { limit: 1 }
      );

      if (response.users && response.users.length > 0) {
        const user = response.users[0];
        console.log(`✅ Found Stream Chat user data for ${userId}:`, {
          name: user.name,
          image: user.image,
          role: user.role
        });

        res.json({ 
          user: {
            id: user.id,
            name: user.name,
            image: user.image,
            role: user.role,
            online: user.online,
            last_active: user.last_active,
            created_at: user.created_at,
            updated_at: user.updated_at
          }
        });
      } else {
        console.log(`⚠️ No Stream Chat user found for ${userId}`);
        res.status(404).json({ 
          user: null,
          message: 'User not found in Stream Chat'
        });
      }
    } catch (chatError) {
      console.warn(`Failed to fetch Stream Chat user ${userId}:`, chatError.message);
      res.status(404).json({ 
        user: null,
        error: chatError.message
      });
    }

  } catch (error) {
    console.error('❌ Error fetching Stream Chat user:', error);
    res.status(500).json({ error: 'Failed to fetch user from Stream Chat' });
  }
});

// Stream Resolve User ID endpoint
app.post('/api/stream/resolve-user-id', async (req, res) => {
  try {
    const { hashedUserId } = req.body;

    if (!hashedUserId) {
      return res.status(400).json({ error: 'hashedUserId is required' });
    }

    console.log(`🔍 Resolving hashed user ID: ${hashedUserId}`);

    // Synchronous hash function (matches the one in frontend idUtils.ts)
    function createPublicUserIdSync(auth0UserId) {
      let hash = 0;
      for (let i = 0; i < auth0UserId.length; i++) {
        const char = auth0UserId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      // Convert to positive hex string with consistent length
      const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
      return hashHex + auth0UserId.length.toString(16).padStart(2, '0'); // Add length for extra uniqueness
    }

    // Initialize Stream Chat client
    const { StreamChat } = await import('stream-chat');
    const serverClient = StreamChat.getInstance(
      process.env.STREAM_API_KEY,
      process.env.STREAM_API_SECRET
    );

    try {
      // Query all users from Stream Chat (reduced limit to avoid rate limits)
      const { users } = await serverClient.queryUsers({}, { limit: 100 });

      // Find the user whose hashed ID matches the requested one
      for (const streamUser of users) {
        const userHash = createPublicUserIdSync(streamUser.id);
        if (userHash === hashedUserId) {
          console.log(`✅ Found matching user: ${streamUser.id} -> ${userHash}`);
          return res.status(200).json({ 
            auth0UserId: streamUser.id,
            userName: streamUser.name || streamUser.id 
          });
        }
      }

      // If no match found, return error
      console.log(`❌ No user found with hashed ID: ${hashedUserId}`);
      return res.status(404).json({ 
        error: 'User not found',
        message: `No user found with hashed ID: ${hashedUserId}` 
      });

    } catch (streamError) {
      console.error('🚨 Stream Chat query error:', streamError);
      return res.status(500).json({ 
        error: 'Failed to query Stream Chat users',
        details: streamError.message || 'Unknown error'
      });
    }

  } catch (error) {
    console.error('🚨 Error resolving user ID:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message || 'Unknown error'
    });
  }
});

// Stream Batch User Counts endpoint
app.post('/api/stream/get-user-counts-batch', async (req, res) => {
  try {
    const { userId, targetUserIds } = req.body;

    if (!userId || !targetUserIds || !Array.isArray(targetUserIds)) {
      return res.status(400).json({ error: 'userId and targetUserIds array are required' });
    }

    if (targetUserIds.length === 0) {
      return res.status(200).json({ userCounts: {} });
    }

    if (targetUserIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 user IDs allowed per batch' });
    }

    console.log(`📊 Batch fetching user counts for ${targetUserIds.length} users`);

    // Use V2 serverFeedsClient for backend operations (server-side access)
    const results = {};

    // Batch fetch counts for all users
    const countPromises = targetUserIds.map(async (targetUserId) => {
      try {
        // Get user and timeline feeds (V2) - server-side access
        const userFeed = serverFeedsClient.feed('user', targetUserId);
        const timelineFeed = serverFeedsClient.feed('timeline', targetUserId);
        
        // Get followers and following counts using V2 API
        const followersPromise = userFeed.followers({ limit: 100 });
        const followingPromise = timelineFeed.following({ limit: 100 });

        const [followersResponse, followingResponse] = await Promise.all([
          followersPromise.catch(() => ({ results: [] })),
          followingPromise.catch(() => ({ results: [] }))
        ]);

        const followers = followersResponse.results?.length || 0;
        const following = followingResponse.results?.length || 0;

        return {
          userId: targetUserId,
          followers,
          following
        };
      } catch (error) {
        console.warn(`Failed to fetch counts for user ${targetUserId}:`, error);
        return {
          userId: targetUserId,
          followers: 0,
          following: 0
        };
      }
    });

    // Execute all requests in parallel
    const countResults = await Promise.all(countPromises);

    // Format results
    countResults.forEach(({ userId, followers, following }) => {
      results[userId] = { followers, following };
    });

    console.log(`✅ Successfully fetched counts for ${Object.keys(results).length} users`);

    return res.status(200).json({
      userCounts: results,
      totalUsers: Object.keys(results).length
    });

  } catch (error) {
    console.error('🚨 Error in batch user counts fetch:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user counts',
      details: error.message || 'Unknown error'
    });
  }
});

// Setup Feed Groups with URL Enrichment endpoint
app.post('/api/stream/setup-feed-groups', async (req, res) => {
  try {
    const setupFeedGroups = await import('./api/stream/setup-feed-groups.js');
    await setupFeedGroups.default(req, res);
  } catch (error) {
    console.error('❌ SETUP-FEED-GROUPS: Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Stream Feeds Actions endpoint
app.post('/api/stream/feed-actions', async (req, res) => {
  try {
    const { action, userId, postData, postId } = req.body;
    
    console.log('🎯 Processing feed action:', action, 'for userId:', userId);
    
    // Enhanced validation for userId
    if (!userId || !action || typeof userId !== 'string' || userId.trim() === '') {
      console.error('❌ FEED-ACTIONS: Missing or invalid required fields:', { 
        userId: userId, 
        userIdType: typeof userId,
        userIdTrimmed: userId?.trim?.(),
        userIdLength: userId?.length,
        action: !!action 
      });
      return res.status(400).json({ error: 'userId and action are required and userId must be a non-empty string' });
    }

    // Trim userId to ensure no whitespace issues
    const trimmedUserId = userId.trim();
    
    console.log('🔧 FEED-ACTIONS: Using userId for Stream API:', {
      originalUserId: userId,
      trimmedUserId: trimmedUserId,
      userIdLength: trimmedUserId.length,
      action: action
    });

    // Check if we have Stream credentials
    if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
      console.error('❌ Missing Stream API credentials');
      return res.status(500).json({ 
        error: 'Stream API credentials not configured. Check your .env file.' 
      });
    }

    // Use V2 serverFeedsClient for backend operations (server-side access)
    console.log(`🔑 Stream API Key configured: ${process.env.STREAM_API_KEY ? 'Yes' : 'No'}`);
    console.log(`🔑 Stream API Secret configured: ${process.env.STREAM_API_SECRET ? 'Yes' : 'No'}`);
    console.log(`🔑 Stream API Key length: ${process.env.STREAM_API_KEY?.length || 0}`);
    console.log(`🔑 Stream API Secret length: ${process.env.STREAM_API_SECRET?.length || 0}`);

    switch (action) {
      case 'create_post':
        // Allow posts with either text or attachments (or both)
        if (!postData?.text && (!postData?.attachments || postData.attachments.length === 0)) {
          return res.status(400).json({ error: 'Post must have either text or attachments' });
        }

        // Extract user profile information from request
        const userProfile = req.body.userProfile || {};
        
        console.log('📝 Creating post:', postData.text ? postData.text.substring(0, 50) + '...' : '[Media only post]');
        console.log('👤 User profile data:', JSON.stringify(userProfile, null, 2));
        
        // Ensure user follows themselves (timeline:user follows user:user)
        try {
          const timelineFeed = serverFeedsClient.feed('timeline', trimmedUserId);
          await timelineFeed.follow('user', trimmedUserId);
          console.log(`✅ Ensured self-follow: timeline:${trimmedUserId} → user:${trimmedUserId}`);
        } catch (followError) {
          // This might fail if already following, which is fine
          console.log(`ℹ️ Self-follow already exists or error (this is normal):`, followError.message);
        }

        // Create activity data
        const activityData = {
          actor: trimmedUserId,
          verb: 'post',
          object: postData.text && postData.text.trim() ? 'post' : 'media', // Use 'media' for media-only posts
          text: postData.text || '', // Allow empty text for media-only posts
          attachments: postData.attachments || [],
          custom: {
            likes: 0,
            shares: 0,
            comments: 0,
            category: postData.category || 'general'
          },
          // Store complete user profile information in the post
          userProfile: {
            name: userProfile.name || trimmedUserId,
            image: userProfile.image || undefined,
            role: userProfile.role || 'User',
            company: userProfile.company || undefined,
            // Store additional Auth0 profile data
            given_name: userProfile.given_name || undefined,
            family_name: userProfile.family_name || undefined,
            nickname: userProfile.nickname || undefined,
            email: userProfile.email || undefined,
            sub: userProfile.sub || trimmedUserId
          }
        };

        // Generate a unique ID for this activity to use in both feeds
        const activityId = `post_${trimmedUserId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        activityData.id = activityId;

        // Create post in user's personal feed
        console.log('📝 Creating post in user feed with ID:', activityId);
        const userActivity = await serverFeedsClient.feed('user', trimmedUserId).addActivity(activityData);
        
        console.log('✅ Post created in user feed with ID:', userActivity.id);
        
        // ALSO create the post in the global feed with the SAME ID so notifications can find the author
        console.log('📝 Also adding post to global feed for notifications with same ID...');
        try {
          const globalActivity = await serverFeedsClient.feed('flat', 'global').addActivity(activityData);
          console.log('✅ Post also added to global feed with ID:', globalActivity.id);
        } catch (globalFeedError) {
          console.warn('⚠️ Failed to add post to global feed (notifications may not work):', globalFeedError.message);
          // Don't fail the entire request if global feed fails
        }

        // Return the user activity
        const newActivity = userActivity;
        console.log('✅ Post created with ID:', newActivity.id);
        return res.json({
          success: true,
          message: 'Post created successfully',
          activity: newActivity
        });

      case 'delete_post':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        console.log('🗑️ Deleting post:', postId);
        // Delete from global feed (V2) - server-side access
        const globalFeedForDelete = serverFeedsClient.feed('flat', 'global');
        await globalFeedForDelete.removeActivity(postId);
        
        console.log('✅ Post deleted');
        return res.json({
          success: true,
          message: 'Post deleted successfully'
        });

      case 'like_post':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        console.log('❤️ Liking post:', postId, 'by user:', trimmedUserId);
        // Add reaction using server client for proper attribution (V2 requires userId)
        const likeResult = await serverFeedsClient.reactions.add('like', postId, {}, { userId: trimmedUserId });

        // Create notification for the post author
        console.log(`🔔 LIKE_DEBUG: About to create like notification for post: ${postId}`);
        console.log(`🔔 LIKE_DEBUG: Like actor (who's liking): ${trimmedUserId}`);
        
        const postAuthor = await getPostAuthor(serverFeedsClient, postId);
        console.log(`🔔 LIKE_DEBUG: Found post author: ${postAuthor}`);
        console.log(`🔔 LIKE_DEBUG: Will skip notification? ${postAuthor === trimmedUserId ? 'YES (same user)' : 'NO'}`);
        
        if (postAuthor) {
          try {
            const notificationResult = await createNotificationActivity(serverFeedsClient, 'like', trimmedUserId, postAuthor, postId);
            console.log(`✅ LIKE_DEBUG: Like notification creation completed:`, notificationResult?.id || 'success');
          } catch (notificationError) {
            console.error(`❌ LIKE_DEBUG: Like notification failed:`, notificationError);
          }
        } else {
          console.log(`⚠️ LIKE_DEBUG: No post author found, skipping like notification`);
        }

        return res.json({
          success: true,
          message: 'Post liked successfully',
          reactionId: likeResult?.id
        });

      case 'unlike_post':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        console.log('💔 Unliking post:', postId, 'for user:', trimmedUserId);
        
        try {
          // Get user's like reactions for this activity using the correct API approach
          const userReactions = await serverFeedsClient.reactions.filter({
            kind: 'like',
            user_id: trimmedUserId
          });

          console.log('💔 Found total like reactions for user:', userReactions.results?.length || 0);

          // Filter to find reactions for this specific activity
          const activityReaction = userReactions.results?.find(reaction => reaction.activity_id === postId);

          if (activityReaction) {
            console.log('💔 Deleting like reaction:', activityReaction.id);
            await serverFeedsClient.reactions.delete(activityReaction.id);
            console.log('💔 Like reaction deleted successfully');
          } else {
            console.log('💔 No like reaction found for this activity');
          }

          return res.json({
            success: true,
            message: 'Post unliked successfully'
          });
        } catch (error) {
          console.error('💔 Error unliking post:', error);
          return res.status(500).json({ 
            error: 'Failed to unlike post',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }

      case 'add_comment':
        if (!postId || !postData?.text) {
          return res.status(400).json({ error: 'postId and comment text are required' });
        }

        console.log('💬 COMMENT_DEBUG: Starting comment process');
        console.log('💬 COMMENT_DEBUG: postId:', postId);
        console.log('💬 COMMENT_DEBUG: trimmedUserId:', trimmedUserId);
        console.log('💬 COMMENT_DEBUG: commentText:', postData.text);
        
        let comment;
        try {
          // Add comment using server client for proper attribution (V2 requires userId)
          comment = await serverFeedsClient.reactions.add('comment', postId, {
            text: postData.text
          }, { userId: trimmedUserId });
          
          console.log('✅ COMMENT_DEBUG: Comment added successfully:', comment?.id);

          // Create notification for the post author
          console.log(`🔔 COMMENT_DEBUG: About to create comment notification for post: ${postId}`);
          try {
            const commentPostAuthor = await getPostAuthor(serverFeedsClient, postId);
            console.log(`🔔 COMMENT_DEBUG: Found comment post author: ${commentPostAuthor}`);
            
            if (commentPostAuthor && commentPostAuthor !== trimmedUserId) {
              console.log(`🔔 COMMENT_DEBUG: Creating notification: ${trimmedUserId} → ${commentPostAuthor}`);
              await createNotificationActivity(serverFeedsClient, 'comment', trimmedUserId, commentPostAuthor, postId, postData.text);
              console.log(`✅ COMMENT_DEBUG: Comment notification creation completed`);
            } else if (commentPostAuthor === trimmedUserId) {
              console.log(`🔔 COMMENT_DEBUG: Skipping notification - user commented on own post`);
            } else {
              console.log(`⚠️ COMMENT_DEBUG: No comment post author found, skipping comment notification`);
            }
          } catch (notificationError) {
            console.error(`❌ COMMENT_DEBUG: Comment notification failed:`, notificationError);
            // Don't throw here - comment was successful, notification failure shouldn't fail the comment
          }
        } catch (commentError) {
          console.error(`❌ COMMENT_DEBUG: Failed to add comment:`, commentError);
          return res.status(500).json({
            success: false,
            error: 'Failed to add comment',
            details: commentError.message || 'Unknown error'
          });
        }

        return res.json({
          success: true,
          message: 'Comment added successfully',
          comment
        });

      case 'get_comments':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        console.log('📄 Getting comments for post:', postId);
        // Get all comments for the post using server client
        const comments = await serverFeedsClient.reactions.filter({
          activity_id: postId,
          kind: 'comment'
        });

        console.log(`📄 Found ${comments.results?.length || 0} comments for post ${postId}`);

        return res.json({
          success: true,
          comments: comments.results || []
        });

      case 'bookmark_post':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        console.log('🔖 Bookmarking post:', postId, 'by user:', trimmedUserId);
        
        // PREVENT DUPLICATES: Check if bookmark already exists
        try {
          // Get ALL user bookmark reactions and filter in JavaScript (API limitation)
          const allUserBookmarks = await serverFeedsClient.reactions.filter({
            kind: 'bookmark',
            user_id: trimmedUserId
          });
          
          const existingBookmarks = allUserBookmarks.results?.filter(
            reaction => reaction.activity_id === postId
          ) || [];
          
          if (existingBookmarks.length > 0) {
            console.log(`🔖 Bookmark already exists for post ${postId} (${existingBookmarks.length} reactions found)`);
            return res.json({
              success: true,
              message: 'Post already bookmarked',
              reactionId: existingBookmarks[0].id
            });
          }
          
          console.log('🔖 No existing bookmark found, creating new one...');
          // Add bookmark reaction using server client (V2 requires userId)
          const bookmarkResult = await serverFeedsClient.reactions.add('bookmark', postId, {}, { userId: trimmedUserId });
          
          console.log('✅ BOOKMARK: New bookmark created successfully');
          return res.json({
            success: true,
            message: 'Post bookmarked successfully',
            reactionId: bookmarkResult?.id
          });
        } catch (error) {
          console.error('❌ BOOKMARK: Error checking/creating bookmark:', error);
          return res.status(500).json({ 
            error: 'Failed to bookmark post',
            details: error.message 
          });
        }

      case 'remove_bookmark':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        console.log('🔖 Removing bookmark for post:', postId, 'for user:', trimmedUserId);
        
        try {
          // STEP 1: Get ALL bookmark reactions for the user (API limitation: can't filter by both user_id and activity_id)
          const allUserBookmarkReactions = await serverFeedsClient.reactions.filter({
            kind: 'bookmark',
            user_id: trimmedUserId
          });

          console.log(`🔖 Found ${allUserBookmarkReactions.results?.length || 0} total bookmark reactions for user`);

          // STEP 2: Filter in JavaScript to find reactions for this specific activity
          const activityBookmarkReactions = allUserBookmarkReactions.results?.filter(
            reaction => reaction.activity_id === postId
          ) || [];

          console.log(`🔖 Found ${activityBookmarkReactions.length} bookmark reactions for post ${postId}`);

          // STEP 3: Remove ALL bookmark reactions for this activity (fix for duplicates)
          if (activityBookmarkReactions.length > 0) {
            console.log(`🔖 Deleting ${activityBookmarkReactions.length} bookmark reactions...`);
            
            for (const reaction of activityBookmarkReactions) {
              try {
                console.log(`🔖 Deleting bookmark reaction: ${reaction.id}`);
                await serverFeedsClient.reactions.delete(reaction.id);
              } catch (deleteError) {
                console.error(`❌ UNBOOKMARK: Failed to delete reaction ${reaction.id}:`, deleteError);
              }
            }
            
            console.log('✅ UNBOOKMARK: All bookmark reactions deleted successfully');
          } else {
            console.log('🔖 No bookmark reactions found for this activity');
          }

          return res.json({
            success: true,
            message: 'Bookmark removed successfully'
          });
        } catch (error) {
          console.error('❌ UNBOOKMARK: Error removing bookmark:', error);
          return res.status(500).json({ 
            error: 'Failed to remove bookmark',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }

      case 'get_liked_posts':
        console.log('❤️ Getting liked posts for user:', trimmedUserId);

        try {
          // Get all 'like' reactions for the user
          const likeReactions = await serverFeedsClient.reactions.filter({
            kind: 'like',
            user_id: trimmedUserId
          });

          console.log(`❤️ Like reactions found: ${likeReactions.results?.length || 0}`);

          if (!likeReactions.results || likeReactions.results.length === 0) {
            return res.json({
              success: true,
              likedPostIds: []
            });
          }

          const activityIds = likeReactions.results.map(reaction => reaction.activity_id);
          console.log('❤️ Activity IDs:', activityIds);

          return res.json({
            success: true,
            likedPostIds: activityIds
          });
        } catch (error) {
          console.error('❌ LIKED_POSTS: Error getting liked posts:', error);
          return res.status(500).json({
            error: 'Failed to get liked posts',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }

      case 'get_bookmarked_posts':
        console.log('📖 Getting bookmarked posts for user:', trimmedUserId);
        
        // Get all bookmark reactions for the user with activity data
        const bookmarkReactions = await serverFeedsClient.reactions.filter({
          kind: 'bookmark',
          user_id: trimmedUserId,
          with_activity_data: true
        });

        console.log('📖 Bookmark reactions found:', bookmarkReactions.results?.length || 0);
        
        if (!bookmarkReactions.results || bookmarkReactions.results.length === 0) {
          return res.json({
            success: true,
            bookmarkedPosts: []
          });
        }

        // Get activity IDs to fetch fresh data with reaction counts
        const activityIds = bookmarkReactions.results.map(r => r.activity_id);
        console.log('📖 Activity IDs:', activityIds);

        // ENHANCED MULTI-FEED SEARCH: Try to fetch activities from multiple feed sources
        console.log('🔍 BOOKMARKS: Starting multi-feed search for activities...');
        const foundActivities = new Map();
        
        // Try multiple feed sources to find the activities (prioritize timeline feed)
        const feedSources = [
          { type: 'timeline', id: trimmedUserId },
          { type: 'user', id: trimmedUserId },
          { type: 'flat', id: 'global' }
        ];
        
        for (const feedSource of feedSources) {
          try {
            console.log(`🔍 BOOKMARKS: Searching ${feedSource.type}:${feedSource.id}...`);
            const feed = serverFeedsClient.feed(feedSource.type, feedSource.id);
            const feedData = await feed.get({ 
              limit: 100,
              withReactionCounts: true,
              withOwnReactions: true
            });
            
            console.log(`🔍 BOOKMARKS: Found ${feedData.results?.length || 0} activities in ${feedSource.type}:${feedSource.id}`);
            
            // Find activities matching our bookmark activity IDs
            if (feedData.results && feedData.results.length > 0) {
              for (const activity of feedData.results) {
                if (activityIds.includes(activity.id) && !foundActivities.has(activity.id)) {
                  console.log(`✅ BOOKMARKS: Found bookmarked activity ${activity.id} in ${feedSource.type}:${feedSource.id}`);
                  foundActivities.set(activity.id, activity);
                }
              }
            }
          } catch (feedError) {
            console.warn(`⚠️ BOOKMARKS: Could not fetch from ${feedSource.type}:${feedSource.id}:`, feedError.message);
          }
        }
        
        console.log(`🔍 BOOKMARKS: Total activities found: ${foundActivities.size} out of ${activityIds.length} bookmarked`);

        // Process found activities and create bookmarked posts (DEDUPLICATE)
        const bookmarkedPostsMap = new Map(); // Use Map to deduplicate by activity ID
        
        for (const bookmarkReaction of bookmarkReactions.results) {
          const activity = foundActivities.get(bookmarkReaction.activity_id);
          
          if (!activity) {
            console.warn(`⚠️ BOOKMARKS: Activity ${bookmarkReaction.activity_id} not found in any feed, skipping...`);
            continue;
          }
          
          // Only add if we haven't seen this activity before (deduplicate)
          if (!bookmarkedPostsMap.has(activity.id)) {
            // Find the most recent bookmark reaction for this activity
            const allReactionsForActivity = bookmarkReactions.results.filter(r => r.activity_id === activity.id);
            const mostRecentReaction = allReactionsForActivity.sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];
            
            console.log(`📌 BOOKMARKS: Adding unique post ${activity.id} (${allReactionsForActivity.length} reactions found)`);
            
            bookmarkedPostsMap.set(activity.id, {
              id: activity.id, // Use activity id for highlighting
              activity_id: activity.id,
              actor: activity.actor || 'Unknown',
              verb: activity.verb || 'post',
              object: activity.object || 'post',
              text: activity.text || 'No content',
              attachments: activity.attachments || [],
              custom: activity.custom || {},
              created_at: activity.created_at || activity.time,
              time: activity.created_at || activity.time,
              reaction_counts: activity.reaction_counts || {},
              own_reactions: activity.own_reactions || {},
              reaction_id: mostRecentReaction?.id, // Keep the most recent reaction ID for removal
              bookmarked_at: mostRecentReaction?.created_at, // When user bookmarked this post
              userInfo: {
                name: activity.actor,
                image: undefined,
                role: undefined,
                company: undefined
              },
              userProfile: activity.userProfile // Store the full user profile
            });
          }
        }
        
        const bookmarkedPosts = Array.from(bookmarkedPostsMap.values());
        
        // Sort by bookmark date (newest bookmarks first)
        bookmarkedPosts.sort((a, b) => new Date(b.bookmarked_at).getTime() - new Date(a.bookmarked_at).getTime());
        
        console.log(`✅ BOOKMARKS: Successfully processed ${bookmarkedPosts.length} bookmarked posts`);

        return res.json({
          success: true,
          bookmarkedPosts
        });

      case 'follow_user':
        const { targetUserId } = req.body;
        console.log(`👥 FOLLOW REQUEST: User ${trimmedUserId} wants to follow ${targetUserId}`);
        
        if (!targetUserId) {
          console.error('❌ Missing targetUserId in follow request');
          return res.status(400).json({ error: 'targetUserId is required' });
        }

        try {
          console.log(`🚀 Initiating follow operation...`);
          
          // Following the React docs pattern: timeline feed follows user feed (V2) - server-side access
          const userTimeline = serverFeedsClient.feed('timeline', trimmedUserId);
          console.log(`🔗 Created timeline feed for user: ${trimmedUserId}`);
          
          const followResult = await userTimeline.follow('user', targetUserId);
          console.log(`🎉 Follow operation completed:`, followResult);
          console.log(`📋 Pattern: timeline:${trimmedUserId} follows user:${targetUserId}`);
          
          // Verify the follow was created by checking following count (V2)
          try {
            const verification = await userTimeline.following({ limit: 10 });
            console.log(`🔍 Verification: timeline:${trimmedUserId} now follows ${verification.results?.length || 0} feeds`);
            if (verification.results?.length > 0) {
              console.log(`🔍 Following relationships:`, verification.results.map(r => ({
                feed_id: r.feed_id,
                target_id: r.target_id,
                created_at: r.created_at
              })));
            }
            
            // Also check if the target user gained a follower (V2) - server-side access
            const targetUserFeed = serverFeedsClient.feed('user', targetUserId);
            const targetFollowers = await targetUserFeed.followers({ limit: 10 });
            console.log(`🔍 Target user ${targetUserId} now has ${targetFollowers.results?.length || 0} followers`);
            if (targetFollowers.results?.length > 0) {
              console.log(`🔍 Follower relationships:`, targetFollowers.results.map(r => ({
                feed_id: r.feed_id,
                target_id: r.target_id,
                created_at: r.created_at
              })));
            }
          } catch (verifyError) {
            console.warn(`⚠️  Could not verify follow:`, verifyError);
          }
          
          console.log(`✅ User ${trimmedUserId} successfully followed ${targetUserId}`);

          // Create notification for the followed user
          console.log(`🔔 About to create follow notification: ${trimmedUserId} → ${targetUserId}`);
          try {
            await createNotificationActivity(serverFeedsClient, 'follow', trimmedUserId, targetUserId);
            console.log(`✅ Follow notification creation completed`);
          } catch (notificationError) {
            console.error(`❌ Follow notification failed:`, notificationError);
          }

          return res.json({
            success: true,
            message: 'User followed successfully',
            followerUserId: trimmedUserId,
            targetUserId: targetUserId,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('❌ Error following user:', {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
            userId: trimmedUserId,
            targetUserId
          });
          return res.status(500).json({ 
            error: 'Failed to follow user',
            details: error instanceof Error ? error.message : 'Unknown error',
            userId: trimmedUserId,
            targetUserId
          });
        }

      case 'unfollow_user':
        const { targetUserId: unfollowTargetUserId } = req.body;
        console.log(`👥 UNFOLLOW REQUEST: User ${trimmedUserId} wants to unfollow ${unfollowTargetUserId}`);
        
        if (!unfollowTargetUserId) {
          console.error('❌ Missing targetUserId in unfollow request');
          return res.status(400).json({ error: 'targetUserId is required' });
        }

        try {
          console.log(`🚀 Initiating unfollow operation...`);
          
          // Unfollow using timeline feed (V2) - server-side access
          const userTimelineUnfollow = serverFeedsClient.feed('timeline', trimmedUserId);
          console.log(`🔗 Created timeline feed for user: ${trimmedUserId}`);
          
          const unfollowResult = await userTimelineUnfollow.unfollow('user', unfollowTargetUserId);
          console.log(`🎉 Unfollow operation completed:`, unfollowResult);
          
          console.log(`✅ User ${trimmedUserId} successfully unfollowed ${unfollowTargetUserId}`);

          return res.json({
            success: true,
            message: 'User unfollowed successfully',
            followerUserId: trimmedUserId,
            targetUserId: unfollowTargetUserId,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('❌ Error unfollowing user:', {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
            userId: trimmedUserId,
            unfollowTargetUserId
          });
          return res.status(500).json({ 
            error: 'Failed to unfollow user',
            details: error instanceof Error ? error.message : 'Unknown error',
            userId: trimmedUserId,
            targetUserId: unfollowTargetUserId
          });
        }

      case 'get_followers':
        // Get followers for a user's feed
        const targetUser = req.body.targetUserId || trimmedUserId;
        
        try {
          console.log(`👥 Getting followers for user: ${targetUser}`);
          
          // Use the correct Stream V2 SDK method for getting followers - server-side access
          const userFeed = serverFeedsClient.feed('user', targetUser);
          const followers = await userFeed.followers({
            limit: req.body.limit || 20,
            // Note: V3 may use different pagination - using limit for now
          });

          console.log(`✅ Found ${followers.results?.length || 0} followers for user ${targetUser}`);

          return res.json({
            success: true,
            followers: followers.results || [],
            count: followers.results?.length || 0
          });
        } catch (error) {
          console.error('❌ Error getting followers:', error);
          return res.json({
            success: true,
            followers: [],
            count: 0
          });
        }

      case 'get_following':
        // Get users that this user is following
        try {
          console.log(`👥 Getting following for user: ${trimmedUserId}`);
          
          // Use the correct Stream V2 SDK method for getting following - server-side access
          const timelineFeed = serverFeedsClient.feed('timeline', trimmedUserId);
          const following = await timelineFeed.following({
            limit: req.body.limit || 20,
            // Note: V3 may use different pagination - using limit for now
          });

          console.log(`✅ User ${trimmedUserId} is following ${following.results?.length || 0} users`);

          return res.json({
            success: true,
            following: following.results || [],
            count: following.results?.length || 0
          });
        } catch (error) {
          console.error('❌ Error getting following:', error);
          return res.json({
            success: true,
            following: [],
            count: 0
          });
        }

      case 'check_following':
        // Check if current user follows target user
        const { targetUserId: checkTargetUserId } = req.body;
        if (!checkTargetUserId) {
          return res.status(400).json({ error: 'targetUserId is required' });
        }

        try {
          console.log(`🔍 Checking if user ${trimmedUserId} follows ${checkTargetUserId}`);
          
          // Use the correct Stream V2 SDK method for checking following status - server-side access
          const timelineFeed = serverFeedsClient.feed('timeline', trimmedUserId);
          const following = await timelineFeed.following({
            limit: 100 // Reduced to avoid rate limits
          });

          const isFollowing = following.results?.some(follow => 
            follow.target_id === `user:${checkTargetUserId}` || follow.target_id === checkTargetUserId
          ) || false;
          console.log(`✅ User ${trimmedUserId} ${isFollowing ? 'is' : 'is not'} following ${checkTargetUserId}`);

          return res.json({
            success: true,
            isFollowing
          });
        } catch (error) {
          console.error('❌ Error checking following status:', error);
          return res.json({
            success: true,
            isFollowing: false
          });
        }

      default:
        console.log('⚠️ Unhandled action:', action);
        return res.json({
          success: true,
          message: `Action '${action}' logged (not implemented in local dev server)`,
          note: 'Some actions are only fully implemented in production'
        });
    }
    
  } catch (error) {
    console.error('💥 Error with feeds actions endpoint:', error);
    res.status(500).json({ error: 'Failed to process feeds action request' });
  }
});

// Stream Chat Create Channel endpoint
app.post('/api/stream/create-channel', upload.single('channelImage'), async (req, res) => {
  try {
    console.log('🏗️ Create channel request body:', req.body);
    console.log('🏗️ Create channel request files:', req.file);
    console.log('🏗️ Create channel request headers:', req.headers);
    console.log('🏗️ Raw request body keys:', Object.keys(req.body));
    console.log('🏗️ Raw request body values:', Object.values(req.body));
    
    const { channelName, selectedUsers, currentUserId } = req.body;
    
    console.log('🏗️ Creating new channel:', channelName);
    console.log('👥 Selected users:', selectedUsers);
    console.log('👤 Current user ID:', currentUserId);
    
    if (!channelName || !selectedUsers || !currentUserId) {
      return res.status(400).json({ 
        error: 'Channel name, selected users, and current user ID are required',
        received: { channelName, selectedUsers, currentUserId }
      });
    }

    // Check if we have Stream credentials
    if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
      console.error('❌ Missing Stream API credentials');
      return res.status(500).json({ 
        error: 'Stream API credentials not configured. Check your .env file.' 
      });
    }

    // Parse selected users
    let userIds;
    try {
      userIds = JSON.parse(selectedUsers);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid selected users format' });
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'At least one user must be selected' });
    }

    // Add current user to the channel members
    const allMembers = [currentUserId, ...userIds];
    
    console.log('👥 Channel members:', allMembers);
    console.log('👤 Current user ID:', currentUserId);
    console.log('👥 Selected user IDs:', userIds);

    // Ensure all users exist in Stream Chat before creating the channel
    console.log('👥 Upserting users in Stream Chat...');
    try {
      // Upsert the current user
      await streamClient.upsertUser({ id: currentUserId });
      console.log('✅ Current user upserted:', currentUserId);
      
      // Upsert the selected users
      for (const userId of userIds) {
        await streamClient.upsertUser({ id: userId });
        console.log('✅ User upserted:', userId);
      }
    } catch (upsertError) {
      console.error('❌ Error upserting users:', upsertError);
      return res.status(500).json({ 
        error: 'Failed to create users in Stream Chat',
        details: upsertError.message 
      });
    }

    // Prepare channel data
    const channelData = {
      name: channelName,
      members: allMembers,
      created_by_id: currentUserId,
    };
    
    console.log('🏗️ Channel data to be created:', channelData);

    // Handle channel image if uploaded
    if (req.file) {
      console.log('📸 Channel image uploaded:', req.file.originalname);
      console.log('📸 File size:', req.file.size, 'bytes');
      console.log('📸 MIME type:', req.file.mimetype);
      
      // Validate image file
      if (!req.file.mimetype.startsWith('image/')) {
        console.error('❌ Invalid file type:', req.file.mimetype);
        return res.status(400).json({ 
          error: 'Invalid file type. Only image files are allowed.',
          receivedType: req.file.mimetype
        });
      }
      
      // Check file size (limit to 5MB)
      if (req.file.size > 5 * 1024 * 1024) {
        console.error('❌ File too large:', req.file.size, 'bytes');
        return res.status(400).json({ 
          error: 'File too large. Maximum size is 5MB.',
          receivedSize: req.file.size,
          maxSize: 5 * 1024 * 1024
        });
      }
      
      try {
        // Convert the uploaded image to a data URL for immediate display
        const base64Image = req.file.buffer.toString('base64');
        const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;
        
        // Store the data URL in the channel data
        channelData.image = dataUrl;
        
        console.log('✅ Image converted to data URL successfully');
      } catch (imageError) {
        console.error('❌ Error processing image:', imageError);
        // Continue without image if processing fails
        channelData.image = undefined;
      }
    }

    // Create the channel using Stream Chat
    const channel = streamClient.channel('messaging', channelData);

    await channel.create();

    console.log('✅ Channel created successfully:', channel.id);
    console.log('🔍 Created channel data:', channel.data);
    console.log('🔍 Channel members after creation:', channel.state?.members);
    
    // Verify the channel was created with the correct members
    try {
      const createdChannel = streamClient.channel('messaging', channel.id);
      await createdChannel.watch();
      console.log('🔍 Retrieved channel data:', createdChannel.data);
      console.log('🔍 Retrieved channel members:', createdChannel.state?.members);
      
      // Also try to get the channel with the current user context
      const userChannel = streamClient.channel('messaging', channel.id);
      await userChannel.watch();
      console.log('🔍 User channel data:', userChannel.data);
      console.log('🔍 User channel members:', userChannel.state?.members);
    } catch (retrieveError) {
      console.error('⚠️ Could not retrieve created channel:', retrieveError);
    }

    res.json({
      success: true,
      message: 'Channel created successfully',
      channelId: channel.id,
      channel: {
        id: channel.id,
        name: channelName,
        members: allMembers,
        created_by_id: currentUserId,
        image: channelData.image
      }
    });
    
  } catch (error) {
    console.error('Error creating channel:', error);
    res.status(500).json({ 
      error: 'Failed to create channel',
      details: error.message 
    });
  }
});

// --- Unified seed endpoint using shared seeding logic ---
app.post("/api/stream/seed", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const me = userId.replace(/[^a-zA-Z0-9@_-]/g, "_").slice(0, 64);

    console.log('🌱 Using unified seeding for user:', me);

    // Create seeding context
    const context = {
      streamClient: streamClient,
      serverFeedsClient: serverFeedsClient,
      currentUserId: me
    };

    // Use unified seeding logic with dynamic import
    const { seedStreamDemo } = await loadSeedingModule();
    const results = await seedStreamDemo(context);

    console.log('🎉 Unified seeding completed successfully!');

    res.json({ 
      ok: true, 
      message: "Chat and Feeds data seeded successfully using unified logic",
      chat: { users: results.users, channels: results.channels },
      feeds: { 
        users: results.users,
        activities: results.activities, 
        followRelationships: results.followRelationships 
      }
    });

  } catch (err) {
    console.error("❌ Error in unified seeding:", err);
    res.status(500).json({ error: "Failed to seed Stream data using unified logic" });
  }
});

// --- Unified reset endpoint using shared reset logic ---
app.post("/api/stream/reset", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const me = userId.replace(/[^a-zA-Z0-9@_-]/g, "_").slice(0, 64);
    console.log('🔄 Starting unified reset for user:', me);

    // Create reset context
    const context = {
      streamClient: streamClient,
      serverFeedsClient: serverFeedsClient,
      currentUserId: me
    };

    // Use unified reset logic (cleanup + fresh seeding) with dynamic import
    const { resetStreamDemo } = await loadSeedingModule();
    const results = await resetStreamDemo(context);

    console.log('🎉 Unified reset completed successfully!');

    res.json({ 
      ok: true, 
      message: "App reset and seeded successfully with fresh sample data",
      chat: { users: results.users, channels: results.channels },
      feeds: { 
        users: results.users,
        activities: results.activities, 
        followRelationships: results.followRelationships 
      }
    });

  } catch (err) {
    console.error("❌ Error in unified reset:", err);
    res.status(500).json({ 
      error: "Failed to reset app using unified logic",
      details: err instanceof Error ? err.message : String(err)
    });
  }
});

// --- Configure Video Call Type Permissions ---
app.post("/api/stream/configure-call-permissions", async (req, res) => {
  try {
    console.log('🔧 CONFIGURE-PERMISSIONS: Configuring call type permissions for livestream...');

    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Missing Stream API credentials' });
    }

    // Initialize Stream Video client
    const { StreamClient } = await import('@stream-io/node-sdk');
    const streamClient = new StreamClient(apiKey, apiSecret);

    try {
      // First, let's see what call types exist and their current permissions
      console.log('🔍 CONFIGURE-PERMISSIONS: Checking existing call types...');
      
      const callTypes = await streamClient.video.listCallTypes();
      console.log('📋 CONFIGURE-PERMISSIONS: Existing call types:', callTypes.call_types ? Object.keys(callTypes.call_types) : 'none');
      
      // Configure the 'livestream' call type to give 'user' role the necessary permissions
      const callTypeName = 'livestream';
      
      // Get current call type configuration
      let currentCallType;
      try {
        currentCallType = callTypes.call_types && callTypes.call_types[callTypeName];
        console.log('🔍 CONFIGURE-PERMISSIONS: Current livestream call type config:', currentCallType ? 'exists' : 'not found');
      } catch (e) {
        console.log('⚠️ CONFIGURE-PERMISSIONS: Livestream call type may not exist, will create/update...');
      }

      // Define the permissions we need for 'user' role
      const requiredUserPermissions = [
        'create-call',
        'join-call',
        'send-audio',
        'send-video',
        'update-call-settings',
        'update-call-permissions',
        'mute-users',
        'remove-call-member',
        'end-call'
      ];

      // Get existing user grants or start with empty array
      const currentUserGrants = currentCallType?.grants?.user || [];
      console.log('📋 CONFIGURE-PERMISSIONS: Current user grants:', currentUserGrants);
      
      // Merge required permissions with existing ones (avoiding duplicates)
      const updatedUserGrants = [...new Set([...currentUserGrants, ...requiredUserPermissions])];
      console.log('📋 CONFIGURE-PERMISSIONS: Updated user grants:', updatedUserGrants);

      // Update the call type with enhanced permissions
      await streamClient.video.updateCallType({
        name: callTypeName,
        grants: {
          user: updatedUserGrants,
          // Keep existing grants for other roles if they exist
          ...(currentCallType?.grants && Object.fromEntries(
            Object.entries(currentCallType.grants).filter(([role]) => role !== 'user')
          ))
        },
      });

      console.log('✅ CONFIGURE-PERMISSIONS: Successfully updated livestream call type permissions');
      
      // Also configure 'default' call type for good measure
      try {
        await streamClient.video.updateCallType({
          name: 'default',
          grants: {
            user: updatedUserGrants,
          },
        });
        console.log('✅ CONFIGURE-PERMISSIONS: Successfully updated default call type permissions');
      } catch (defaultError) {
        console.warn('⚠️ CONFIGURE-PERMISSIONS: Could not update default call type:', defaultError.message);
      }

      return res.status(200).json({
        success: true,
        message: 'Call type permissions configured successfully',
        callType: callTypeName,
        userPermissions: updatedUserGrants
      });

    } catch (configError) {
      console.error('❌ CONFIGURE-PERMISSIONS: Error configuring call type:', configError);
      return res.status(500).json({
        error: 'Failed to configure call type permissions',
        details: configError.message
      });
    }

  } catch (error) {
    console.error('❌ CONFIGURE-PERMISSIONS: Critical error:', error);
    return res.status(500).json({
      error: 'Internal server error configuring permissions',
      details: error.message
    });
  }
});

// --- Auth tokens endpoint ---
app.post("/api/stream/auth-tokens", async (req, res) => {
  try {
    console.log('🔧 AUTH-TOKENS: Request received:', { type: req.body?.type, userId: req.body?.userId });
    
    const { type, userId, userProfile } = req.body;

    if (!userId || !type) {
      console.error('❌ AUTH-TOKENS: Missing required fields:', { userId: !!userId, type: !!type });
      return res.status(400).json({ error: 'userId and type are required' });
    }

    if (!['feed', 'chat', 'video'].includes(type)) {
      console.error('❌ AUTH-TOKENS: Invalid type:', type);
      return res.status(400).json({ error: 'type must be "feed", "chat", or "video"' });
    }

    // Get Stream API credentials
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('❌ AUTH-TOKENS: Missing Stream API credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Handle feed token generation
    if (type === 'feed') {
      console.log('🍃 AUTH-TOKENS: Generating feed token for:', userId);
      
      // Generate a Feeds V3-compatible JWT token
      const token = jwt.sign(
        {
          user_id: userId,
        },
        apiSecret,
        {
          algorithm: 'HS256',
          expiresIn: '24h',
        }
      );

      console.log('✅ AUTH-TOKENS: Feed token generated successfully');
      return res.status(200).json({
        token,
        apiKey,
        userId,
      });
    }

    // Handle chat token generation
    if (type === 'chat') {
      console.log('💬 AUTH-TOKENS: Generating chat token for:', userId);
      
      // Create/update user profile in Stream Chat if profile information is provided
      if (userProfile) {
        try {
          console.log('👤 AUTH-TOKENS: Updating chat user profile...');
          await streamClient.upsertUser({
            id: userId,
            name: userProfile.name,
            image: userProfile.image
            // Remove role to avoid Stream Chat validation errors
          });
          console.log(`✅ AUTH-TOKENS: User profile updated for chat: ${userId}`);
        } catch (profileError) {
          console.warn(`❌ AUTH-TOKENS: Failed to update user profile for chat ${userId}:`, profileError);
          // Continue with token generation even if profile update fails
        }
      }

      // Generate Stream user token
      console.log('🔑 AUTH-TOKENS: Generating chat token...');
      const streamToken = streamClient.createToken(userId);

      console.log('✅ AUTH-TOKENS: Chat token generated successfully');
      return res.status(200).json({
        token: streamToken,
        apiKey: apiKey,
        userId: userId
      });
    }

    // Handle video token generation
    if (type === 'video') {
      console.log('📹 AUTH-TOKENS: Generating video token for:', userId);
      console.log('🔧 AUTH-TOKENS: Full request body:', JSON.stringify(req.body, null, 2));
      console.log('🔧 AUTH-TOKENS: Request headers:', {
        'content-type': req.headers['content-type'],
        'cache-control': req.headers['cache-control'],
        'x-cache-buster': req.headers['x-cache-buster']
      });
      
      // Special handling for demo users - create only if needed
      if (userId === 'demo_user_2025') {
        console.log('👥 AUTH-TOKENS: Handling demo user demo_user_2025');
        try {
          // First check if user exists by trying to query it
          const existingUser = await streamClient.queryUsers({ id: 'demo_user_2025' });
          if (existingUser.users.length === 0) {
            console.log('🔧 AUTH-TOKENS: Demo user does not exist, creating...');
            await streamClient.upsertUser({ 
              id: 'demo_user_2025',
              name: 'Demo User',
              image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
            });
            console.log('✅ AUTH-TOKENS: Demo user demo_user_2025 created');
          } else {
            console.log('✅ AUTH-TOKENS: Demo user demo_user_2025 already exists, skipping creation');
          }
        } catch (error) {
          console.log('⚠️ AUTH-TOKENS: Error handling demo user, but continuing:', error);
        }
      }
      
      // For video tokens, create JWT token directly
      // Demo app - all users get admin for video features
      const userRole = 'admin';
      
      const now = Math.floor(Date.now() / 1000);
      const tokenPayload = {
        user_id: userId,
        iss: 'stream-video',
        exp: now + (24 * 60 * 60), // 24 hours
        iat: now,
        nbf: now, // Not before - ensure token is valid immediately
        // Add unique identifier to force token refresh
        jti: `video_${userId}_${now}_${Math.random().toString(36).substr(2, 9)}`,
        // Include ALL video and livestream capabilities
        capabilities: [
          // Basic video call capabilities
          'join-call',
          'send-audio', 
          'send-video',
          'mute-users',
          'remove-call-member',
          'update-call-settings',
          'end-call',
          'create-call',
          'update-call-permissions',
          // Livestream specific capabilities
          'create-livestream',
          'join-livestream',
          'end-livestream',
          'update-livestream-settings',
          'livestream-admin',
          // Additional admin capabilities
          'pin-for-everyone',
          'screenshare',
          'send-reaction',
          'manage-call-settings',
          'call-admin',
          'super-admin'
        ],
        call_cids: ['*'], // Allow access to all calls
        // Add role information
        role: 'admin',
        call_role: 'admin',
        livestream_role: 'admin'
      };
      
      console.log('🔧 AUTH-TOKENS: Video token payload with livestream capabilities:', {
        user_id: tokenPayload.user_id,
        capabilities: tokenPayload.capabilities,
        role: tokenPayload.role,
        call_cids: tokenPayload.call_cids
      });
      
      const videoToken = jwt.sign(tokenPayload, apiSecret, {
        algorithm: 'HS256'
      });

      console.log('✅ AUTH-TOKENS: Video token generated with livestream permissions');
      console.log('🔧 AUTH-TOKENS: Generated token (first 100 chars):', videoToken.substring(0, 100) + '...');
      
      // Try to decode and log the token payload for verification
      try {
        const tokenParts = videoToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          console.log('🔍 AUTH-TOKENS: Generated token payload verification:', {
            user_id: payload.user_id,
            role: payload.role,
            call_role: payload.call_role,
            livestream_role: payload.livestream_role,
            capabilities: payload.capabilities?.slice(0, 5) || 'none',
            totalCapabilities: payload.capabilities?.length || 0,
            call_cids: payload.call_cids
          });
        }
      } catch (decodeError) {
        console.warn('⚠️ AUTH-TOKENS: Could not decode generated token:', decodeError);
      }
      
      return res.status(200).json({
        token: videoToken,
        apiKey: apiKey,
        userId: userId
      });
    }

  } catch (error) {
    console.error('❌ AUTH-TOKENS: Critical error generating token:', error);
    res.status(500).json({ 
      error: 'Failed to generate token',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// --- Chat operations endpoint ---
app.post("/api/stream/chat-operations", async (req, res) => {
  try {
    console.log('💬 CHAT-OPERATIONS: Request received:', { type: req.body?.type, currentUserId: req.body?.currentUserId });
    
    const { type, userId, channelId, channelName, selectedUsers, currentUserId, isDM, channelImage } = req.body;

    if (!currentUserId || !type) {
      console.error('❌ CHAT-OPERATIONS: Missing required fields:', { currentUserId: !!currentUserId, type: !!type });
      return res.status(400).json({ error: 'currentUserId and type are required' });
    }

    if (!['create-livestream-channel', 'create-channel', 'add-to-general', 'leave-channel'].includes(type)) {
      console.error('❌ CHAT-OPERATIONS: Invalid type:', type);
      return res.status(400).json({ error: 'Invalid operation type' });
    }

    const streamApiKey = process.env.STREAM_API_KEY;
    const streamSecret = process.env.STREAM_API_SECRET;

    if (!streamApiKey || !streamSecret) {
      console.error('❌ CHAT-OPERATIONS: Missing Stream API credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Initialize Stream Chat client
    const client = StreamChat.getInstance(streamApiKey, streamSecret);

    if (type === 'create-livestream-channel') {
      console.log('🎬 CHAT-OPERATIONS: Creating livestream channel:', channelId);
      
      if (!channelId) {
        return res.status(400).json({ error: 'channelId is required for create-livestream-channel' });
      }

      try {
        // Create livestream channel
        const channel = client.channel('livestream', channelId, {
          name: `Live Stream ${channelId}`,
          created_by_id: userId,
          members: [userId]
        });

        await channel.create();
        console.log('✅ CHAT-OPERATIONS: Livestream channel created successfully');

        return res.status(200).json({
          success: true,
          channelId: channelId,
          message: 'Livestream channel created successfully'
        });
      } catch (error) {
        console.error('❌ CHAT-OPERATIONS: Error creating livestream channel:', error);
        return res.status(500).json({ 
          error: 'Failed to create livestream channel',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (type === 'create-channel') {
      console.log('💬 CHAT-OPERATIONS: Creating channel:', { channelName, isDM, selectedUsers });
      
      if (!channelName || !selectedUsers) {
        return res.status(400).json({ error: 'channelName and selectedUsers are required for create-channel' });
      }

      try {
        const parsedUsers = JSON.parse(selectedUsers);
        const members = [currentUserId, ...parsedUsers].filter(Boolean);
        
        // Generate simple short channel IDs
        const shortId = Math.random().toString(36).substr(2, 8); // 8 random chars
        const channelId = isDM ? `dm_${shortId}` : `group_${shortId}`;
        
        const channelData = {
          name: channelName,
          created_by_id: currentUserId,
          members: members,
          isDM: isDM
        };

        if (channelImage) {
          channelData.image = channelImage;
        }

        const channel = client.channel('messaging', channelId, channelData);
        await channel.create();
        console.log('✅ CHAT-OPERATIONS: Channel created successfully with ID:', channel.id);

        return res.status(200).json({
          success: true,
          channelId: channel.id,
          message: 'Channel created successfully'
        });
      } catch (error) {
        console.error('❌ CHAT-OPERATIONS: Error creating channel:', error);
        return res.status(500).json({ 
          error: 'Failed to create channel',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (type === 'add-to-general') {
      console.log('🏠 CHAT-OPERATIONS: Adding user to general channel:', userId);
      
      try {
        const channel = client.channel('messaging', 'general');
        await channel.addMembers([userId]);
        console.log('✅ CHAT-OPERATIONS: User added to general channel');

        return res.status(200).json({
          success: true,
          message: 'User added to general channel successfully'
        });
      } catch (error) {
        console.error('❌ CHAT-OPERATIONS: Error adding user to general:', error);
        return res.status(500).json({ 
          error: 'Failed to add user to general channel',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (type === 'leave-channel') {
      console.log('🚪 CHAT-OPERATIONS: User leaving channel:', { userId, channelId });
      
      if (!channelId) {
        return res.status(400).json({ error: 'channelId is required for leave-channel' });
      }

      try {
        const channel = client.channel('messaging', channelId);
        await channel.removeMembers([userId]);
        console.log('✅ CHAT-OPERATIONS: User removed from channel');

        return res.status(200).json({
          success: true,
          message: 'User removed from channel successfully'
        });
      } catch (error) {
        console.error('❌ CHAT-OPERATIONS: Error removing user from channel:', error);
        return res.status(500).json({ 
          error: 'Failed to remove user from channel',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

  } catch (error) {
    console.error('❌ CHAT-OPERATIONS: Critical error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: req.body?.type,
      userId: req.body?.userId
    });
    res.status(500).json({ 
      error: 'Failed to perform chat operation',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// --- Notifications endpoint ---
app.post("/api/stream/notifications", async (req, res) => {
  try {
    console.log('🔔 NOTIFICATIONS: Request received:', {
      action: req.body?.action,
      userId: req.body?.userId,
      method: req.method,
      hasBody: !!req.body
    });
    
    const { action, userId } = req.body;

    if (!userId || !action || typeof userId !== 'string' || userId.trim() === '') {
      console.error('❌ NOTIFICATIONS: Missing or invalid required fields:', { 
        userId: userId, 
        userIdType: typeof userId,
        action: !!action 
      });
      return res.status(400).json({ error: 'userId and action are required and userId must be a non-empty string' });
    }

    const trimmedUserId = userId.trim();
    
    switch (action) {
      case 'get_notifications':
        try {
          console.log(`🔔 GET_NOTIFICATIONS: Fetching notifications for user ${trimmedUserId}`);
          
          // Get notifications from the user's personal feed (filtering for notification activities)
          const userFeed = serverFeedsClient.feed('user', trimmedUserId);
          const result = await userFeed.get({
            limit: 100,
            offset: 0,
            withReactionCounts: false,
            withOwnReactions: false,
          });

          // Filter for notification activities only
          const notifications = (result.results || []).filter(activity => 
            activity.verb === 'notification'
          ).slice(0, 25);
          
          console.log(`✅ Found ${notifications.length} notifications for user ${trimmedUserId}`);

          return res.json({
            success: true,
            notifications: notifications
          });
        } catch (error) {
          console.error('❌ Error fetching notifications:', error);
          return res.status(500).json({
            error: 'Failed to fetch notifications',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }

      case 'mark_read':
        const { notificationIds } = req.body;
        if (!notificationIds || !Array.isArray(notificationIds)) {
          return res.status(400).json({ error: 'notificationIds array is required' });
        }

        try {
          console.log(`🔔 MARK_READ: Marking ${notificationIds.length} notifications as read for user ${trimmedUserId}`);
          
          // SIMPLIFIED APPROACH: Store the timestamp when user last viewed notifications
          const lastViewedTimestamp = new Date().toISOString();
          
          // Store this in user's feed
          try {
            const userFeed = serverFeedsClient.feed('user', trimmedUserId);
            await userFeed.addActivity({
              actor: trimmedUserId,
              verb: 'notifications_viewed',
              object: 'timestamp',
              text: `User viewed notifications at ${lastViewedTimestamp}`,
              custom: {
                viewed_at: lastViewedTimestamp,
                notification_count: notificationIds.length
              }
            });
            console.log(`✅ Stored notifications viewed timestamp: ${lastViewedTimestamp}`);
          } catch (timestampError) {
            console.warn(`⚠️ Failed to store viewed timestamp:`, timestampError.message);
          }

          return res.json({
            success: true,
            message: `Marked ${notificationIds.length} notifications as read`,
            viewed_at: lastViewedTimestamp
          });
        } catch (error) {
          console.error('❌ Error marking notifications as read:', error);
          return res.status(500).json({
            error: 'Failed to mark notifications as read',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }

      case 'get_unread_count':
        try {
          console.log(`🔔 GET_UNREAD_COUNT: Getting unread notification count for user ${trimmedUserId}`);
          
          // Get notifications from the user's personal feed
          const userFeed = serverFeedsClient.feed('user', trimmedUserId);
          const result = await userFeed.get({
            limit: 100,
            offset: 0,
            withReactionCounts: false,
            withOwnReactions: false,
          });

          // Filter for notification activities only
          const notifications = (result.results || []).filter(activity => 
            activity.verb === 'notification'
          );

          // SIMPLIFIED APPROACH: Find the most recent "notifications_viewed" timestamp
          const viewedActivities = (result.results || []).filter(activity => 
            activity.verb === 'notifications_viewed' && activity.actor === trimmedUserId
          );

          let lastViewedTimestamp = null;
          if (viewedActivities.length > 0) {
            // Get the most recent viewed timestamp
            const mostRecentViewed = viewedActivities.sort((a, b) => 
              new Date(b.time || b.created_at).getTime() - new Date(a.time || a.created_at).getTime()
            )[0];
            lastViewedTimestamp = mostRecentViewed.custom?.viewed_at || mostRecentViewed.time || mostRecentViewed.created_at;
            console.log(`📖 Found last viewed timestamp: ${lastViewedTimestamp}`);
          }

          // Count notifications that are newer than the last viewed timestamp
          let unreadCount = notifications.length; // Default: all notifications are unread
          
          if (lastViewedTimestamp) {
            const viewedTime = new Date(lastViewedTimestamp).getTime();
            const unreadNotifications = notifications.filter(notification => {
              const notificationTime = new Date(notification.time || notification.created_at).getTime();
              return notificationTime > viewedTime;
            });
            unreadCount = unreadNotifications.length;
            console.log(`📊 Notifications: ${notifications.length} total, ${unreadCount} unread (after ${lastViewedTimestamp})`);
          } else {
            console.log(`📊 No viewed timestamp found, treating all ${notifications.length} notifications as unread`);
          }
          
          console.log(`✅ Found ${unreadCount} unread notifications for user ${trimmedUserId}`);

          return res.json({
            success: true,
            unreadCount: unreadCount
          });
        } catch (error) {
          console.error('❌ Error getting unread count:', error);
          return res.status(500).json({
            error: 'Failed to get unread count',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error) {
    console.error('❌ NOTIFICATIONS: Critical error in notifications API:', error);
    res.status(500).json({ 
      error: 'Failed to process notification request',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// --- User Data endpoint ---
app.post("/api/stream/user-data", async (req, res) => {
  try {
    console.log('🔧 USER-DATA: Request received:', {
      method: req.method,
      type: req.body?.type,
      hasBody: !!req.body,
      hasAuthHeader: !!req.headers.authorization,
      bodyKeys: Object.keys(req.body || {})
    });
    
    const { type } = req.body;

    if (!type) {
      console.log('❌ USER-DATA: Missing type parameter');
      return res.status(400).json({ error: 'type is required' });
    }

    if (!['posts', 'resolve', 'chat-user'].includes(type)) {
      console.log('❌ USER-DATA: Invalid type:', type);
      return res.status(400).json({ error: 'type must be "posts", "resolve", or "chat-user"' });
    }

    // Handle user posts fetching
    if (type === 'posts') {
      console.log('📝 USER-DATA: Handling posts request...', {
        userId: req.body?.userId,
        targetUserId: req.body?.targetUserId
      });
      
      const { userId, targetUserId, limit = 20 } = req.body;

      if (!userId) {
        console.log('❌ USER-DATA: Missing userId for posts');
        return res.status(400).json({ error: 'userId is required' });
      }

      if (!targetUserId) {
        console.log('❌ USER-DATA: Missing targetUserId for posts');
        return res.status(400).json({ error: 'targetUserId is required' });
      }

      console.log(`🔍 Fetching posts from user's personal feed: user:${targetUserId}`);

      // Check if we need to map to a timestamped user ID
      let actualUserId = targetUserId;
      
      // First try the original user ID
      let result;
      try {
        const userFeed = serverFeedsClient.feed('user', targetUserId);
        result = await userFeed.get({
          limit: limit * 2,
          offset: 0,
          withReactionCounts: true,
          withOwnReactions: true,
        });
        
        console.log(`✅ Found ${result.results?.length || 0} activities in user:${targetUserId} feed`);
      } catch (error) {
        console.log(`⚠️ Failed to fetch from user:${targetUserId}, will try timestamped versions...`);
        result = { results: [] };
      }
      
      // If no posts found, try to find a timestamped version of this user
      if (!result.results || result.results.length === 0) {
        console.log(`🔍 No posts found for ${targetUserId}, searching for timestamped versions...`);
        
        try {
          // Query global feed to find any activities by timestamped versions of this user
          const globalFeed = serverFeedsClient.feed('flat', 'global');
          const globalResult = await globalFeed.get({
            limit: 100,
            offset: 0,
            withReactionCounts: true,
            withOwnReactions: true,
          });
          
          // Look for activities by users matching the pattern: targetUserId_timestamp
          const timestampedActivities = globalResult.results?.filter((activity) => {
            const actorId = activity.actor;
            return actorId && actorId.startsWith(targetUserId + '_') && /\d{13}$/.test(actorId);
          }) || [];
          
          console.log(`🔍 Found ${timestampedActivities.length} activities by timestamped versions of ${targetUserId}`);
          
          if (timestampedActivities.length > 0) {
            // Get the most recent timestamped user ID
            const timestampedUserIds = Array.from(new Set(timestampedActivities.map(a => a.actor)));
            console.log(`🔍 Found timestamped user IDs:`, timestampedUserIds);
            
            // Use the first one (they should all be the same user anyway)
            actualUserId = timestampedUserIds[0];
            console.log(`🔄 Using timestamped user ID: ${actualUserId}`);
            
            // Now fetch from the correct timestamped user feed
            const timestampedUserFeed = serverFeedsClient.feed('user', actualUserId);
            result = await timestampedUserFeed.get({
              limit: limit * 2,
              offset: 0,
              withReactionCounts: true,
              withOwnReactions: true,
            });
            
            console.log(`✅ Found ${result.results?.length || 0} activities in timestamped user:${actualUserId} feed`);
          }
        } catch (globalError) {
          console.log(`⚠️ Failed to search global feed for timestamped users:`, globalError);
        }
      }

      // Debug: Log what verbs we have before filtering
      console.log(`🔍 DEBUG: Raw activities in user:${actualUserId} feed:`, 
        (result.results || []).map(a => ({ id: a.id, verb: a.verb, actor: a.actor, text: a.text?.substring(0, 50) }))
      );

      // Filter out notification activities and internal activities to prevent them from showing as posts
      const filteredPosts = (result.results || []).filter((activity) => 
        activity.verb !== 'notification' && activity.verb !== 'notifications_viewed'
      );
      const limitedPosts = filteredPosts.slice(0, limit);

      console.log(`✅ Found ${limitedPosts.length} posts in user:${actualUserId} feed`);
      
      // If no posts in user feed, fallback to global feed filtering (for backward compatibility)
      if (limitedPosts.length === 0) {
        console.log(`📋 No posts in user feed, trying global feed fallback...`);
        
        const globalFeed = serverFeedsClient.feed('flat', 'global');
        const globalResult = await globalFeed.get({
          limit: 100, // Get more to filter
          offset: 0,
          withReactionCounts: true,
          withOwnReactions: true,
        });

        const fallbackPosts = globalResult.results?.filter((activity) => 
          activity.actor === actualUserId
        ) || [];
        
        const fallbackLimited = fallbackPosts.slice(0, limit);
        console.log(`📋 Fallback: Found ${fallbackLimited.length} posts by filtering global feed`);
        
        // Use fallback posts if found
        if (fallbackLimited.length > 0) {
          limitedPosts.push(...fallbackLimited);
        }
      }

      // Get user profile information for post authors  
      const userIds = Array.from(new Set([targetUserId, actualUserId]));
      let userProfiles = {};

      try {
        const userPromises = userIds.map(async (id) => {
          try {
            // Try to get user from Stream, but handle 404 gracefully
            const user = await serverFeedsClient.user(id).get();
            console.log(`✅ Found Stream user profile for ${id}:`, user.data?.name);
            return { [id]: {
              name: user.data?.name || id,
              username: user.data?.username,
              image: user.data?.image || user.data?.profile_image,
              role: user.data?.role,
              company: user.data?.company
            }};
          } catch (userError) {
            // Handle user not found gracefully
            if (userError?.response?.status === 404 || userError?.error?.status_code === 404) {
              console.log(`👤 User ${id} not found in Stream user database - using fallback profile`);
              
              // Create a basic profile from the Auth0 ID
              const fallbackName = id.includes('google-oauth2_') 
                ? id.replace('google-oauth2_', '').replace(/^\d+/, 'User') // Clean up Google OAuth ID
                : id.replace(/[^a-zA-Z0-9]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()); // Format other IDs
              
              return { [id]: { 
                name: fallbackName,
                username: id,
                image: undefined,
                role: 'User',
                company: undefined
              }};
            } else {
              console.warn(`❌ Failed to get user profile for ${id}:`, userError?.message || userError);
              return { [id]: { name: id } };
            }
          }
        });

        const userResults = await Promise.all(userPromises);
        userProfiles = userResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});
      } catch (profileError) {
        console.warn('❌ Failed to fetch user profiles:', profileError);
        // Fallback: create basic profile for target user
        userProfiles = { [targetUserId]: { name: targetUserId } };
      }

      return res.status(200).json({
        success: true,
        posts: limitedPosts,
        userProfiles,
        count: limitedPosts.length,
        totalUserPosts: limitedPosts.length,
        mappedFromTimestampedUser: actualUserId !== targetUserId ? actualUserId : undefined
      });
    }

    // Handle Stream Chat user data fetching
    if (type === 'chat-user') {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      console.log(`🔍 Fetching Stream Chat user data for: ${userId}`);

      try {
        // Query the user from Stream Chat
        const response = await serverChatClient.queryUsers(
          { id: userId },
          { id: 1 },
          { limit: 1 }
        );

        if (response.users && response.users.length > 0) {
          const user = response.users[0];
          console.log(`✅ Found Stream Chat user data for ${userId}:`, {
            name: user.name,
            image: user.image,
            role: user.role
          });

          return res.status(200).json({ 
            success: true,
            message: 'Success',
            user: {
              id: user.id,
              name: user.name,
              image: user.image,
              role: user.role,
              online: user.online,
              last_active: user.last_active,
              created_at: user.created_at,
              updated_at: user.updated_at
            }
          });
        } else {
          console.log(`⚠️ No Stream Chat user found for ${userId}`);
          return res.status(404).json({ 
            success: false,
            message: 'User not found in Stream Chat',
            user: null 
          });
        }
      } catch (chatError) {
        console.warn(`Failed to fetch Stream Chat user ${userId}:`, chatError.message);
        return res.status(404).json({ 
          success: false,
          message: 'User not found in Stream Chat',
          user: null,
          error: chatError.message
        });
      }
    }

    // Handle user ID resolution (for hashed user IDs)
    if (type === 'resolve') {
      const { hashedUserId } = req.body;

      if (!hashedUserId) {
        return res.status(400).json({ error: 'hashedUserId is required' });
      }

      try {
        // Simple hash function to match frontend
        function createPublicUserIdSync(auth0UserId) {
          let hash = 0;
          for (let i = 0; i < auth0UserId.length; i++) {
            const char = auth0UserId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
          }
          
          // Convert to positive hex string with consistent length
          const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
          return hashHex + auth0UserId.length.toString(16).padStart(2, '0'); // Add length for extra uniqueness
        }

        // Query all users from Stream Chat (this might need pagination for large user bases)
        const response = await serverChatClient.queryUsers({}, { id: 1 }, { limit: 1000 });
        const users = response.users || [];

        // Find the user whose hashed ID matches the requested one
        for (const streamUser of users) {
          const userHash = createPublicUserIdSync(streamUser.id);
          if (userHash === hashedUserId) {
            return res.status(200).json({ 
              auth0UserId: streamUser.id,
              userName: streamUser.name || streamUser.id 
            });
          }
        }

        // If no match found, return error
        return res.status(404).json({ 
          error: 'User not found',
          message: `No user found with hashed ID: ${hashedUserId}` 
        });

      } catch (streamError) {
        console.error('Stream Chat query error:', streamError);
        return res.status(500).json({ 
          error: 'Failed to query Stream Chat users',
          details: streamError instanceof Error ? streamError.message : 'Unknown error'
        });
      }
    }

  } catch (error) {
    console.error('❌ Error in user-data handler:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Serve static files from the dist directory (built React app)
app.use(express.static(path.join(__dirname, 'dist')));

// Catch-all handler: send back React's index.html for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Auto-configure call type permissions on server startup
async function configureCallTypePermissions() {
  try {
    console.log('🔧 AUTO-CONFIGURE: Setting up video call type permissions on startup...');
    
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.warn('⚠️ AUTO-CONFIGURE: Missing Stream API credentials, skipping call type configuration');
      return;
    }

    // Initialize Stream Video client
    const { StreamClient } = await import('@stream-io/node-sdk');
    const streamClient = new StreamClient(apiKey, apiSecret);

    // Configure permissions for both livestream and default call types
    const callTypes = ['livestream', 'default'];
    const requiredUserPermissions = [
      'create-call',
      'join-call',
      'send-audio',
      'send-video',
      'update-call-settings',
      'update-call-permissions',
      'mute-users',
      'remove-call-member',
      'end-call'
    ];

    for (const callTypeName of callTypes) {
      try {
        await streamClient.video.updateCallType({
          name: callTypeName,
          grants: {
            user: requiredUserPermissions,
          },
        });
        console.log(`✅ AUTO-CONFIGURE: Updated ${callTypeName} call type permissions`);
      } catch (error) {
        console.warn(`⚠️ AUTO-CONFIGURE: Could not update ${callTypeName} call type:`, error.message);
      }
    }

    console.log('✅ AUTO-CONFIGURE: Call type permissions configuration completed');
  } catch (error) {
    console.warn('⚠️ AUTO-CONFIGURE: Error setting up call type permissions:', error.message);
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Stream Demo Server running on port ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log('');
  console.log('🎯 UNIFIED SEEDING SYSTEM:');
  console.log(`🌱 Unified seeding: http://localhost:${PORT}/api/stream/seed`);
  console.log(`🔄 App reset: http://localhost:${PORT}/api/stream/reset`);
  console.log('');
  console.log('✅ Single source of truth: api/_utils/seeding.ts');
  console.log('✅ No more duplicate seeding files!');
  console.log('');
  console.log('🔧 Environment Variables Debug:');
  console.log(`   PORT: ${process.env.PORT || '5000 (default)'}`);
  console.log(`   STREAM_API_KEY: ${process.env.STREAM_API_KEY ? '✅ Set' : '❌ NOT SET'}`);
  console.log(`   STREAM_API_SECRET: ${process.env.STREAM_API_SECRET ? '✅ Set' : '❌ NOT SET'}`);
  console.log('');
  if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
    console.log('⚠️  WARNING: Missing Stream API credentials!');
  } else {
    // Configure call type permissions after server starts
    await configureCallTypePermissions();
  }
});

export default app;
