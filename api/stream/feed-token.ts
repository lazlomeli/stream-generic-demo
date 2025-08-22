import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const apiKey = process.env.STREAM_API_KEY;
  const apiSecret = process.env.STREAM_API_SECRET;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: 'Missing Stream credentials' });
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
