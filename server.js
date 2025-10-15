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
import { initializeChatRoutes } from './routes/chat-routes.js';
import { initializeFeedRoutes } from './routes/feed-routes.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


// STREAM CHAT CLIENT
const streamChatClient = new StreamChat(
  process.env.STREAM_API_KEY,
  process.env.STREAM_API_SECRET,
  undefined, // app_id
  { logLevel: 'warn' } // Reduce logging verbosity
);

const streamFeedsClient = new StreamClient(
  process.env.STREAM_API_KEY,
  process.env.STREAM_API_SECRET
)

// CHAT ROUTES
const chatRoutes = initializeChatRoutes(streamChatClient);
app.use('/api', chatRoutes);

// FEED ROUTES
const feedRoutes = initializeFeedRoutes(streamFeedsClient);
app.use('/api', feedRoutes);

// HEALTH CHECK
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: 'local-development'
  });
});


// app.post("/api/stream/seed", async (req, res) => {
//   try {
//     const { userId } = req.body;
//     if (!userId) {
//       return res.status(400).json({ error: "userId is required" });
//     }

//     const me = userId.replace(/[^a-zA-Z0-9@_-]/g, "_").slice(0, 64);

//     console.log('🌱 Using unified seeding for user:', me);

//     // Create seeding context
//     const context = {
//       streamClient: streamClient,
//       serverFeedsClient: serverFeedsClient,
//       currentUserId: me
//     };

//     // Use unified seeding logic with dynamic import
//     const { seedStreamDemo } = await loadSeedingModule();
//     const results = await seedStreamDemo(context);

//     console.log('🎉 Unified seeding completed successfully!');

//     res.json({ 
//       ok: true, 
//       message: "Chat and Feeds data seeded successfully using unified logic",
//       chat: { users: results.users, channels: results.channels },
//       feeds: { 
//         users: results.users,
//         activities: results.activities, 
//         followRelationships: results.followRelationships 
//       }
//     });

//   } catch (err) {
//     console.error("❌ Error in unified seeding:", err);
//     res.status(500).json({ error: "Failed to seed Stream data using unified logic" });
//   }
// });



// app.post("/api/stream/reset", async (req, res) => {
//   try {
//     const { userId } = req.body;
//     if (!userId) {
//       return res.status(400).json({ error: "userId is required" });
//     }

//     const me = userId.replace(/[^a-zA-Z0-9@_-]/g, "_").slice(0, 64);
//     console.log('🔄 Starting unified reset for user:', me);

//     // Create reset context
//     const context = {
//       streamClient: streamClient,
//       serverFeedsClient: serverFeedsClient,
//       currentUserId: me
//     };

//     // Use unified reset logic (cleanup + fresh seeding) with dynamic import
//     const { resetStreamDemo } = await loadSeedingModule();
//     const results = await resetStreamDemo(context);

//     console.log('🎉 Unified reset completed successfully!');

//     res.json({ 
//       ok: true, 
//       message: "App reset and seeded successfully with fresh sample data",
//       chat: { users: results.users, channels: results.channels },
//       feeds: { 
//         users: results.users,
//         activities: results.activities, 
//         followRelationships: results.followRelationships 
//       }
//     });

//   } catch (err) {
//     console.error("❌ Error in unified reset:", err);
//     res.status(500).json({ 
//       error: "Failed to reset app using unified logic",
//       details: err instanceof Error ? err.message : String(err)
//     });
//   }
// });


// app.post("/api/stream/configure-call-permissions", async (req, res) => {
//   try {
//     console.log('🔧 CONFIGURE-PERMISSIONS: Configuring call type permissions for livestream...');

//     const apiKey = process.env.STREAM_API_KEY;
//     const apiSecret = process.env.STREAM_API_SECRET;

//     if (!apiKey || !apiSecret) {
//       return res.status(500).json({ error: 'Missing Stream API credentials' });
//     }

//     // Initialize Stream Video client
//     const { StreamClient } = await import('@stream-io/node-sdk');
//     const streamClient = new StreamClient(apiKey, apiSecret);

//     try {
//       // First, let's see what call types exist and their current permissions
//       console.log('🔍 CONFIGURE-PERMISSIONS: Checking existing call types...');
      
//       const callTypes = await streamClient.video.listCallTypes();
//       console.log('📋 CONFIGURE-PERMISSIONS: Existing call types:', callTypes.call_types ? Object.keys(callTypes.call_types) : 'none');
      
//       // Configure the 'livestream' call type to give 'user' role the necessary permissions
//       const callTypeName = 'livestream';
      
//       // Get current call type configuration
//       let currentCallType;
//       try {
//         currentCallType = callTypes.call_types && callTypes.call_types[callTypeName];
//         console.log('🔍 CONFIGURE-PERMISSIONS: Current livestream call type config:', currentCallType ? 'exists' : 'not found');
//       } catch (e) {
//         console.log('⚠️ CONFIGURE-PERMISSIONS: Livestream call type may not exist, will create/update...');
//       }

//       // Define the permissions we need for 'user' role
//       const requiredUserPermissions = [
//         'create-call',
//         'join-call',
//         'send-audio',
//         'send-video',
//         'update-call-settings',
//         'update-call-permissions',
//         'mute-users',
//         'remove-call-member',
//         'end-call'
//       ];

//       // Get existing user grants or start with empty array
//       const currentUserGrants = currentCallType?.grants?.user || [];
//       console.log('📋 CONFIGURE-PERMISSIONS: Current user grants:', currentUserGrants);
      
//       // Merge required permissions with existing ones (avoiding duplicates)
//       const updatedUserGrants = [...new Set([...currentUserGrants, ...requiredUserPermissions])];
//       console.log('📋 CONFIGURE-PERMISSIONS: Updated user grants:', updatedUserGrants);

//       // Update the call type with enhanced permissions
//       await streamClient.video.updateCallType({
//         name: callTypeName,
//         grants: {
//           user: updatedUserGrants,
//           // Keep existing grants for other roles if they exist
//           ...(currentCallType?.grants && Object.fromEntries(
//             Object.entries(currentCallType.grants).filter(([role]) => role !== 'user')
//           ))
//         },
//       });

//       console.log('✅ CONFIGURE-PERMISSIONS: Successfully updated livestream call type permissions');
      
//       // Also configure 'default' call type for good measure
//       try {
//         await streamClient.video.updateCallType({
//           name: 'default',
//           grants: {
//             user: updatedUserGrants,
//           },
//         });
//         console.log('✅ CONFIGURE-PERMISSIONS: Successfully updated default call type permissions');
//       } catch (defaultError) {
//         console.warn('⚠️ CONFIGURE-PERMISSIONS: Could not update default call type:', defaultError.message);
//       }

//       return res.status(200).json({
//         success: true,
//         message: 'Call type permissions configured successfully',
//         callType: callTypeName,
//         userPermissions: updatedUserGrants
//       });

//     } catch (configError) {
//       console.error('❌ CONFIGURE-PERMISSIONS: Error configuring call type:', configError);
//       return res.status(500).json({
//         error: 'Failed to configure call type permissions',
//         details: configError.message
//       });
//     }

//   } catch (error) {
//     console.error('❌ CONFIGURE-PERMISSIONS: Critical error:', error);
//     return res.status(500).json({
//       error: 'Internal server error configuring permissions',
//       details: error.message
//     });
//   }
// });


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


app.use(express.static(path.join(__dirname, 'dist')));


app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});


// async function configureCallTypePermissions() {
//   try {
//     console.log('🔧 AUTO-CONFIGURE: Setting up video call type permissions on startup...');
    
//     const apiKey = process.env.STREAM_API_KEY;
//     const apiSecret = process.env.STREAM_API_SECRET;

//     if (!apiKey || !apiSecret) {
//       console.warn('⚠️ AUTO-CONFIGURE: Missing Stream API credentials, skipping call type configuration');
//       return;
//     }

//     // Initialize Stream Video client
//     const { StreamClient } = await import('@stream-io/node-sdk');
//     const streamClient = new StreamClient(apiKey, apiSecret);

//     // Configure permissions for both livestream and default call types
//     const callTypes = ['livestream', 'default'];
//     const requiredUserPermissions = [
//       'create-call',
//       'join-call',
//       'send-audio',
//       'send-video',
//       'update-call-settings',
//       'update-call-permissions',
//       'mute-users',
//       'remove-call-member',
//       'end-call'
//     ];

//     for (const callTypeName of callTypes) {
//       try {
//         await streamClient.video.updateCallType({
//           name: callTypeName,
//           grants: {
//             user: requiredUserPermissions,
//           },
//         });
//         console.log(`✅ AUTO-CONFIGURE: Updated ${callTypeName} call type permissions`);
//       } catch (error) {
//         console.warn(`⚠️ AUTO-CONFIGURE: Could not update ${callTypeName} call type:`, error.message);
//       }
//     }

//     console.log('✅ AUTO-CONFIGURE: Call type permissions configuration completed');
//   } catch (error) {
//     console.warn('⚠️ AUTO-CONFIGURE: Error setting up call type permissions:', error.message);
//   }
// }

// Start server
app.listen(PORT, async () => {
  console.log('🔧 Environment Variables Debug:');
  console.log(`   PORT: ${process.env.PORT || '5000 (default)'}`);
  console.log(`   STREAM_API_KEY: ${process.env.STREAM_API_KEY ? '✅ Set' : '❌ NOT SET'}`);
  console.log(`   STREAM_API_SECRET: ${process.env.STREAM_API_SECRET ? '✅ Set' : '❌ NOT SET'}`);
  console.log('');
  if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
    console.log('⚠️  WARNING: Missing Stream API credentials!');
  } else {
    // Configure call type permissions after server starts
    // await configureCallTypePermissions(); // Function is commented out
  }
});

export default app;
