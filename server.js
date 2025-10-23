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

const streamChatClient = new StreamChat(
  process.env.STREAM_API_KEY,
  process.env.STREAM_API_SECRET,
  undefined,
  { logLevel: 'warn' }
);

const streamFeedsClient = new StreamClient(
  process.env.STREAM_API_KEY,
  process.env.STREAM_API_SECRET
)

const chatRoutes = initializeChatRoutes(streamChatClient, streamFeedsClient);
app.use('/api', chatRoutes);

const feedRoutes = initializeFeedRoutes(streamFeedsClient);
app.use('/api', feedRoutes);

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
      if (userProfile) {
        try {
          await streamFeedsClient.upsertUsers([
            {
              id: sanitizeUserId(userId),
              name: userProfile.name,
              image: userProfile.image,
            },
          ]);
        } catch (profileError) {
          console.error('Error updating feed user profile:', profileError);
        }
      }

      try {
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
      } catch (feedGroupError) {
        console.error('Error creating feed group:', feedGroupError);
      }

      try {
        await streamFeedsClient.feeds.createFeedView({
          id: "popular-view",
          activity_selectors: [{ type: "popular" }],
        });
      } catch (feedViewError) {
        console.error('Error creating feed view:', feedViewError);
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
      if (userProfile) {
        try {
          await StreamChat.getInstance(apiKey, apiSecret).upsertUser({
            id: sanitizeUserId(userId),
            name: userProfile.name,
            image: userProfile.image
          });
        } catch (profileError) {
          console.error('Error updating chat user profile:', profileError);
        }
      }

      const streamToken = StreamChat.getInstance(apiKey, apiSecret).createToken(userId);

      return res.status(200).json({
        token: streamToken,
        apiKey: apiKey,
        userId: userId
      });
    }

    if (type === 'video') {
      const sanitizedUserId = sanitizeUserId(userId);

      try {
        await streamFeedsClient.upsertUsers([{
          id: sanitizedUserId,
          name: userProfile?.name || `User_${sanitizedUserId}`,
          image: userProfile?.image,
          role: 'admin',
        }]);
      } catch (upsertError) {
        console.error('Error upserting video user:', upsertError);
      }
      
      const callId = req.body.callId;
      if (callId) {
        try {
          const call = streamFeedsClient.video.call('default', callId);
          
          await call.updateCallMembers({
            update_members: [
              { 
                user_id: sanitizedUserId,
                role: 'admin'
              }
            ]
          });
        } catch (error) {
          console.error('Error updating call members:', error);
        }
      }
      
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
      
      const videoToken = jwt.sign(tokenPayload, apiSecret, {
        algorithm: 'HS256'
      });
      
      return res.status(200).json({
        token: videoToken,
        apiKey: apiKey,
        userId: sanitizedUserId
      });
    }

  } catch (error) {
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

app.listen(PORT, async () => {
});

export default app;
