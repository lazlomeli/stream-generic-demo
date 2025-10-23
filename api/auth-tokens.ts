import jwt from 'jsonwebtoken';
import { StreamChat } from 'stream-chat';
import { StreamClient } from '@stream-io/node-sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const sanitizeUserId = (userId: string) => {
  return userId.replace(/[^a-zA-Z0-9@_-]/g, '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔧 AUTH-TOKENS: Request received:', { 
      type: req.body?.type, 
      userId: req.body?.userId,
      userProfile: req.body?.userProfile,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });
    
    const { type, userId, userProfile } = req.body;

    if (!userId || !type) {
      console.error('❌ AUTH-TOKENS: Missing required fields:', { userId: !!userId, type: !!type });
      return res.status(400).json({ error: 'userId and type are required' });
    }

    if (!['feed', 'chat', 'video'].includes(type)) {
      console.error('❌ AUTH-TOKENS: Invalid type:', type);
      return res.status(400).json({ error: 'type must be "feed", "chat", or "video"' });
    }

    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    console.log('🔐 AUTH-TOKENS: Environment check:', {
      hasApiKey: !!apiKey,
      hasApiSecret: !!apiSecret,
      apiKeyLength: apiKey?.length || 0
    });

    if (!apiKey || !apiSecret) {
      console.error('❌ AUTH-TOKENS: Missing Stream API credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (type === 'feed') {
      console.log('🍃 AUTH-TOKENS: Generating feed token for:', userId);
      
      const streamFeedsClient = new StreamClient(apiKey, apiSecret);
      
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
        } catch (profileError: any) {
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

      console.log('🔑 AUTH-TOKENS: Generating JWT token...');
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

    if (type === 'chat') {
      console.log('💬 AUTH-TOKENS: Generating chat token for:', userId);
      
      const streamClient = new StreamChat(apiKey, apiSecret);

      console.log('STREAMCLIENTTTTT', streamClient);
      if (userProfile) {
        try {
          console.log('👤 AUTH-TOKENS: Updating chat user profile...');
          await streamClient.upsertUser({
            id: sanitizeUserId(userId),
            name: userProfile.name,
            image: userProfile.image,
            role: userProfile.role
          });
          console.log(`✅ AUTH-TOKENS: User profile updated for chat: ${userId}`);
        } catch (profileError) {
          console.warn(`❌ AUTH-TOKENS: Failed to update user profile for chat ${userId}:`, profileError);
        }
      }

      console.log('🔑 AUTH-TOKENS: Generating chat token...');
      const streamToken = streamClient.createToken(userId);

      console.log('✅ AUTH-TOKENS: Chat token generated successfully');
      return res.status(200).json({
        token: streamToken,
        apiKey: apiKey,
        userId: userId
      });
    }

    if (type === 'video') {
      console.log('📹 AUTH-TOKENS: Generating video token for:', userId);
      
      const streamClient = new StreamClient(apiKey, apiSecret);

      let finalUserId = userId;
      
      if (userId === 'demo_user_2025') {
        console.log('👥 AUTH-TOKENS: Handling demo user demo_user_2025');
        try {
          // @ts-ignore
          const existingUser = await streamClient.queryUsers({ id: 'demo_user_2025' });
          if (existingUser.users.length === 0) {
            console.log('🔧 AUTH-TOKENS: Demo user does not exist, creating...');
            await streamClient.upsertUsers({ 
              // @ts-ignore
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
      
      console.log('⚡ AUTH-TOKENS: SKIPPING user profile updates - using token-only approach');

      const userRole = 'admin';
      console.log('🔑 AUTH-TOKENS: Generating video token for demo role:', userRole);
      
      const now = Math.floor(Date.now() / 1000);
      console.log(`🔑 AUTH-TOKENS: Generating token for user ID: ${finalUserId}`);
      
      const tokenPayload: any = {
        user_id: finalUserId,
        iss: 'stream-video',
        exp: now + (24 * 60 * 60),
        iat: now,
        nbf: now,
        jti: `video_${finalUserId}_${now}_${Math.random().toString(36).substr(2, 9)}`,
        capabilities: [
          'join-call',
          'send-audio', 
          'send-video',
          'mute-users'
        ]
      };
      
      tokenPayload.capabilities = [
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
        'pin-for-everyone',
        'screenshare',
        'send-reaction',
        'manage-call-settings',
        'call-admin',
        'super-admin'
      ];
      
      tokenPayload.call_cids = ['*'];
      tokenPayload.role = 'admin';
      tokenPayload.call_role = 'admin';
      tokenPayload.livestream_role = 'admin';
      
      tokenPayload.bypass_permissions = true;
      tokenPayload.is_admin = true;
      tokenPayload.grant_all_permissions = true;
      
      console.log('🔧 AUTH-TOKENS: Video token payload:', JSON.stringify(tokenPayload, null, 2));
      
      const videoToken = jwt.sign(tokenPayload, apiSecret, {
        algorithm: 'HS256'
      });

      console.log('✅ AUTH-TOKENS: Video token generated successfully');
      console.log('🔧 AUTH-TOKENS: Generated token (first 50 chars):', videoToken.substring(0, 50) + '...');
      return res.status(200).json({
        token: videoToken,
        apiKey: apiKey,
        userId: finalUserId,
        originalUserId: userId,
        isAdminUser: finalUserId !== userId
      });
    }

  } catch (error) {
    console.error('❌ AUTH-TOKENS: Critical error generating token:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: req.body?.type,
      userId: req.body?.userId
    });
    res.status(500).json({ 
      error: 'Failed to generate token',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
