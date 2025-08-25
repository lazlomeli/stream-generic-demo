import jwt from 'jsonwebtoken';
import { connect } from 'getstream';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, userProfile } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const apiKey = process.env.STREAM_API_KEY;
  const apiSecret = process.env.STREAM_API_SECRET;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: 'Missing Stream credentials' });
  }

  // Create/update user profile in Stream if profile information is provided
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
      expiresIn: '24h', // or shorter if needed
    }
  );

  return res.status(200).json({
    token,
    apiKey,
    userId,
  });
}
