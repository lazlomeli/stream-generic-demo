import { StreamChat } from 'stream-chat';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Get Stream API key and secret from environment variables
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('Missing Stream API credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Initialize Stream Chat client
    const streamClient = new StreamChat(apiKey, apiSecret);

    // Generate Stream user token
    const streamToken = streamClient.createToken(userId);

    // Return the token and API key
    res.status(200).json({
      token: streamToken,
      apiKey: apiKey,
      userId: userId
    });

  } catch (error) {
    console.error('Error generating chat token:', error);
    res.status(500).json({ error: 'Failed to generate chat token' });
  }
}
