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
        const upsertResult = await streamClient.upsertUsers([{
          id: sanitizedUserId,
          name: userProfile?.name || `User_${sanitizedUserId}`,
          image: userProfile?.image,
          role: 'admin', // EXPLICIT admin role
        }]);
        console.log('✅ AUTH-TOKENS: User upserted with admin role:', JSON.stringify(upsertResult, null, 2));
      } catch (upsertError: any) {
        console.error('❌ AUTH-TOKENS: Failed to upsert user:', upsertError?.message || upsertError);
        // Continue anyway
      }
      
      // STEP 2: If callId is provided, add user as member to that call
      const callId = req.body.callId;
      if (callId) {
        console.log(`📞 AUTH-TOKENS: Adding user ${sanitizedUserId} as member to call ${callId}`);
        try {
          const call = streamClient.video.call('default', callId);
          await call.getOrCreate({
            data: {
              members: [{ user_id: sanitizedUserId, role: 'call_member' }],
            },
          });
          console.log(`✅ AUTH-TOKENS: User added as member to call ${callId}`);
        } catch (callError: any) {
          console.error('❌ AUTH-TOKENS: Failed to add user to call:', callError?.message || callError);
        }
      } else {
        console.log('ℹ️ AUTH-TOKENS: No callId provided, skipping call membership');
      }
      
      // STEP 3: Generate token
      const now = Math.floor(Date.now() / 1000);
      
      const tokenPayload: any = {
        user_id: sanitizedUserId,
        iss: 'stream-video',
        exp: now + (24 * 60 * 60),
        iat: now,
        nbf: now,
        jti: `video_${sanitizedUserId}_${now}_${Math.random().toString(36).substr(2, 9)}`,
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
        'super-admin',
      ];
      
      tokenPayload.call_cids = ['*'];
      tokenPayload.role = 'admin';
      tokenPayload.call_role = 'admin';
      tokenPayload.livestream_role = 'admin';
      
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
      
      // Verify token payload
      const decoded = jwt.decode(videoToken) as any;
      console.log('🔍 AUTH-TOKENS: Generated token payload verification:', {
        user_id: decoded.user_id,
        role: decoded.role,
        call_role: decoded.call_role,
        livestream_role: decoded.livestream_role,
        capabilities: decoded.capabilities?.slice(0, 5),
        totalCapabilities: decoded.capabilities?.length,
        call_cids: decoded.call_cids
      });
      
      return res.status(200).json({
        token: videoToken,
        apiKey: apiKey,
        userId: sanitizedUserId,
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
