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
import { initializeChatRoutes } from './routes/chat-routes.ts';
import { initializeFeedRoutes } from './routes/feed-routes.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5100;

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

// CHAT ROUTES (now handles both chat and feeds reset)
const chatRoutes = initializeChatRoutes(streamChatClient, streamFeedsClient);
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

const sanitizeUserId = (userId) => {
  return userId.replace(/[^a-zA-Z0-9@_-]/g, '');
}


app.post("/api/auth-tokens", async (req, res) => {
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
      
      // Create/update user in Activity Feeds if profile information is provided
      if (userProfile) {
        try {
          console.log('👤 AUTH-TOKENS: Creating/updating feed user profile...');
          await streamFeedsClient.upsertUsers([
            {
              id: sanitizeUserId(userId),
              name: userProfile.name,
              image: userProfile.image,
            },
          ]);
          console.log(`✅ AUTH-TOKENS: Feed user profile updated: ${userId}`);
        } catch (profileError) {
          console.warn(`⚠️ AUTH-TOKENS: Failed to update feed user profile ${userId}:`, profileError.message || profileError);
          console.log('ℹ️ AUTH-TOKENS: Continuing with token generation');
        }
      }

      // Setup custom feed groups and views (idempotent - safe to call multiple times)
      // Note: Core feed groups like "user" and "timeline" are created by default in Feeds V3
      try {
        console.log('🔧 AUTH-TOKENS: Setting up "popular" feed group with custom ranking...');
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
        console.log('✅ AUTH-TOKENS: Popular feed group created/verified');
      } catch (feedGroupError) {
        console.log('ℹ️ AUTH-TOKENS: Popular feed group already exists or creation skipped');
      }

      try {
        console.log('🔧 AUTH-TOKENS: Setting up feed view...');
        await streamFeedsClient.feeds.createFeedView({
          id: "popular-view",
          activity_selectors: [{ type: "popular" }],
        });
        console.log('✅ AUTH-TOKENS: Feed view created/verified');
      } catch (feedViewError) {
        console.log('ℹ️ AUTH-TOKENS: Feed view already exists or creation skipped');
      }
      
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
          await StreamChat.getInstance(apiKey, apiSecret).upsertUser({
            id: sanitizeUserId(userId),
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
      const streamToken = StreamChat.getInstance(apiKey, apiSecret).createToken(userId);

      console.log('✅ AUTH-TOKENS: Chat token generated successfully');
      return res.status(200).json({
        token: streamToken,
        apiKey: apiKey,
        userId: userId
      });
    }

    // Handle video token generation
    // Handle video token generation
if (type === 'video') {
  console.log('📹 AUTH-TOKENS: Generating video token for:', userId);
  
  const sanitizedUserId = sanitizeUserId(userId);
  
  console.log('🔧 AUTH-TOKENS: Full request body:', JSON.stringify(req.body, null, 2));
  console.log('🔧 AUTH-TOKENS: Request headers:', {
    'content-type': req.headers['content-type'],
    'cache-control': req.headers['cache-control'],
    'x-cache-buster': req.headers['x-cache-buster']
  });

  // STEP 1: Create/update user with admin role (CRITICAL!)
  console.log('👤 AUTH-TOKENS: Creating/updating user with ADMIN role:', sanitizedUserId);
  try {
    const upsertResult = await streamFeedsClient.upsertUsers([{
      id: sanitizedUserId,
      name: userProfile?.name || `User_${sanitizedUserId}`,
      image: userProfile?.image,
      role: 'admin', // EXPLICIT admin role
    }]);
    console.log('✅ AUTH-TOKENS: User upserted with admin role:', JSON.stringify(upsertResult, null, 2));
  } catch (upsertError) {
    console.error('❌ AUTH-TOKENS: Failed to upsert user:', upsertError?.message || upsertError);
    // Continue anyway
  }
  
  // STEP 2: If callId is provided, add user as member to that call
  const callId = req.body.callId;
  if (callId) {
    console.log(`📞 AUTH-TOKENS: Adding user ${sanitizedUserId} as ADMIN member to call ${callId}`);
    try {
      const call = streamFeedsClient.video.call('default', callId);
      
      // Use 'admin' role instead of 'call_member' so they can join backstage
      await call.updateCallMembers({
        update_members: [
          { 
            user_id: sanitizedUserId,
            role: 'admin'  // Changed from 'call_member' to 'admin'
          }
        ]
      });
      console.log(`✅ AUTH-TOKENS: User added as ADMIN member to call ${callId}`);
    } catch (callError) {
      console.error('❌ AUTH-TOKENS: Failed to add user to call:', callError?.message || callError);
      console.error('Full error:', callError);
    }
  } else {
    console.log('ℹ️ AUTH-TOKENS: No callId provided, skipping call membership');
  }
  
  // STEP 3: Generate token
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    user_id: sanitizedUserId,
    iss: 'stream-video',
    exp: now + (24 * 60 * 60),
    iat: now,
    nbf: now,
    jti: `video_${sanitizedUserId}_${now}_${Math.random().toString(36).substr(2, 9)}`,
    capabilities: [
      'join-call',
      'send-audio', 
      'send-video',
      'mute-users',
      'remove-call-member',
      'update-call-settings',
      'end-call',
      'create-call',
      'update-call-permissions',
      'create-livestream',
      'join-livestream',
      'end-livestream',
      'update-livestream-settings',
      'livestream-admin',
      'pin-for-everyone',
      'screenshare',
      'send-reaction',
      'manage-call-settings',
      'call-admin',
      'super-admin'
    ],
    call_cids: ['*'],
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
    userId: sanitizedUserId
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
