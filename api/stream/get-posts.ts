import { connect } from 'getstream';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, feedGroup = 'flat', feedId = 'global', limit = 20 } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Get Stream API credentials
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Missing Stream API credentials' });
    }

    // Initialize Stream Feeds client
    const streamFeedsClient = connect(apiKey, apiSecret);

    // Fetch activities from the specified feed
    const feed = streamFeedsClient.feed(feedGroup, feedId);
    console.log(`Fetching from feed: ${feedGroup}:${feedId} for user: ${userId}`);
    
    const result = await feed.get({ limit, withReactionCounts: true });
    console.log(`Found ${result.results.length} activities in ${feedGroup}:${feedId}`);

    return res.json({
      success: true,
      activities: result.results,
      feedGroup,
      feedId,
      count: result.results.length
    });

  } catch (error: any) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch posts',
      details: error.message 
    });
  }
}
