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
    const { type, userId, userProfile } = req.body;

    if (!userId || !type) {
      return res.status(400).json({ error: 'userId and type are required' });
    }

    if (!['feed', 'chat', 'video'].includes(type)) {
      return res.status(400).json({ error: 'type must be "feed", "chat", or "video"' });
    }

    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;


    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (type === 'feed') {
      
      const streamFeedsClient = new StreamClient(apiKey, apiSecret);
      
      if (userProfile) {
        try {
          await streamFeedsClient.upsertUsers([
            {
              id: sanitizeUserId(userId),
              name: userProfile.name,
              image: userProfile.image,
            },
          ]);
        } catch (profileError: any) {
        }
      }

      try {
        await streamFeedsClient.feeds.createFeedGroup({
          id: "popular-feed-group",
          activity_selectors: [{ type: "popular", cutoff_time: new Date(Date.now() + 31536000000) }], // 1 year from creation time
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
      } catch (feedGroupError) {
        console.log('ℹ️ AUTH-TOKENS: Popular feed group already exists or creation skipped');
      }

      try {
        await streamFeedsClient.feeds.createFeedView({
          id: "popular-view",
          activity_selectors: [{ type: "popular" }],
        });
      } catch (feedViewError) {
        console.log('ℹ️ AUTH-TOKENS: Feed view already exists or creation skipped');
      }

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

      return res.status(200).json({
        token,
        apiKey,
        userId,
      });
    }

    if (type === 'chat') {
      
      const streamClient = new StreamChat(apiKey, apiSecret);

      if (userProfile) {
        try {
          await streamClient.upsertUser({
            id: sanitizeUserId(userId),
            name: userProfile.name,
            image: userProfile.image,
            role: userProfile.role
          });
        } catch (profileError) {
          console.warn(`❌ AUTH-TOKENS: Failed to update user profile for chat ${userId}:`, profileError);
        }
      }

      const streamToken = streamClient.createToken(userId);

      return res.status(200).json({
        token: streamToken,
        apiKey: apiKey,
        userId: userId
      });
    }

    if (type === 'video') {
      
      const streamClient = new StreamClient(apiKey, apiSecret);
      const sanitizedUserId = sanitizeUserId(userId);
    
    
      try {
        const upsertResult = await streamClient.upsertUsers([{
          id: sanitizedUserId,
          name: userProfile?.name || `User_${sanitizedUserId}`,
          image: userProfile?.image,
          role: 'admin', // EXPLICIT admin role
        }]);
      } catch (upsertError: any) {
        console.error('❌ AUTH-TOKENS: Failed to upsert user:', upsertError?.message || upsertError);
      }
      
      const callId = req.body.callId;
      if (callId) {
        try {
          const call = streamClient.video.call('default', callId);
          await call.getOrCreate({
            data: {
              members: [{ user_id: sanitizedUserId, role: 'call_member' }],
            },
          });
        } catch (callError: any) {
          console.error('❌ AUTH-TOKENS: Failed to add user to call:', callError?.message || callError);
        }
      } else {
      }
      
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
      
      const videoToken = jwt.sign(tokenPayload, apiSecret, {
        algorithm: 'HS256'
      });
      
      return res.status(200).json({
        token: videoToken,
        apiKey: apiKey,
        userId: sanitizedUserId,
      });
    }

  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to generate token',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
