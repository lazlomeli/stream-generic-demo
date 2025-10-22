import { StreamClient } from '@stream-io/node-sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resetFeeds, seedFeeds } from '../../routes/utils/feed-utils.js';

/**
 * Vercel serverless function to reset and seed Feeds
 * Matches the /api/feeds/reset endpoint from feed-routes.ts
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS
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

    console.log(`🔄 [Vercel feeds/reset]: Feeds reset and seed requested by user: ${userId}`);

    // Get Stream API credentials
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('Missing Stream API credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Initialize Stream Feeds client
    const streamFeedsClient = new StreamClient(apiKey, apiSecret);

    // Step 1: Reset Feeds
    await resetFeeds(streamFeedsClient);

    // Step 2: Seed Feeds
    const seedResult = await seedFeeds(streamFeedsClient, userId);

    res.json({
      success: true,
      message: 'Feeds reset and seeded successfully',
      data: seedResult.data,
    });
  } catch (error) {
    console.error('[Vercel feeds/reset]: Error in reset-and-seed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

