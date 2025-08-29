import jwt from 'jsonwebtoken';
import { connect } from 'getstream';
import { StreamChat } from 'stream-chat';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, userId, userProfile } = req.body;

    if (!userId || !type) {
      return res.status(400).json({ error: 'userId and type are required' });
    }

    if (!['feed', 'chat'].includes(type)) {
      return res.status(400).json({ error: 'type must be "feed" or "chat"' });
    }

    // Get Stream API credentials
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('Missing Stream API credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Handle feed token generation
    if (type === 'feed') {
      // Create/update user profile in Stream Feeds if profile information is provided
      if (userProfile) {
        try {
          const streamFeedsClient = connect(apiKey, apiSecret);
          await streamFeedsClient.setUser({
            id: userId,
            name: userProfile.name,
            image: userProfile.image,
            role: userProfile.role
          });
          console.log(`✅ User profile updated for feeds: ${userId}`);
        } catch (profileError) {
          console.warn(`Failed to update user profile for feeds ${userId}:`, profileError);
          // Continue with token generation even if profile update fails
        }
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

      return res.status(200).json({
        token,
        apiKey,
        userId,
      });
    }

    // Handle chat token generation
    if (type === 'chat') {
      // Initialize Stream Chat client
      const streamClient = new StreamChat(apiKey, apiSecret);

      // Create/update user profile in Stream Chat if profile information is provided
      if (userProfile) {
        try {
          await streamClient.upsertUser({
            id: userId,
            name: userProfile.name,
            image: userProfile.image,
            role: userProfile.role
          });
          console.log(`✅ User profile updated for chat: ${userId}`);
        } catch (profileError) {
          console.warn(`Failed to update user profile for chat ${userId}:`, profileError);
          // Continue with token generation even if profile update fails
        }
      }

      // Generate Stream user token
      const streamToken = streamClient.createToken(userId);

      return res.status(200).json({
        token: streamToken,
        apiKey: apiKey,
        userId: userId
      });
    }

  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
}
