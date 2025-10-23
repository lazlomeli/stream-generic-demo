import { StreamChat } from 'stream-chat';
import { StreamClient } from '@stream-io/node-sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resetChat, seedChat } from '../../routes/utils/chat-utils.js';
import { resetFeeds, seedFeeds } from '../../routes/utils/feed-utils.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const streamChatClient = new StreamChat(apiKey, apiSecret);
    const streamFeedsClient = new StreamClient(apiKey, apiSecret);

    await resetChat(streamChatClient);

    const chatSeedResult = await seedChat(streamChatClient, userId);

    await resetFeeds(streamFeedsClient);

    const feedsSeedResult = await seedFeeds(streamFeedsClient, userId);

    res.json({
      success: true,
      message: 'App reset and seeded successfully',
      data: {
        chat: chatSeedResult.data,
        feeds: feedsSeedResult.data,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

