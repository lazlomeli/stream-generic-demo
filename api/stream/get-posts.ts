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

    // Enrich activities with user information
    const enrichedActivities = await Promise.all(
      result.results.map(async (activity: any) => {
        try {
          // Get user profile information
          if (streamFeedsClient.getUsers) {
            const userProfile = await streamFeedsClient.getUsers([activity.actor]);
            const userData = userProfile[activity.actor];
            
            if (userData) {
              // Enrich the activity with user information
              return {
                ...activity,
                userInfo: {
                  name: userData.name || userData.username || activity.actor,
                  image: userData.image || userData.profile_image || undefined,
                  role: userData.role || undefined,
                  company: userData.company || undefined
                }
              };
            }
          }
          
          // Return activity without user enrichment if user fetch fails or method not available
          return {
            ...activity,
            userInfo: {
              name: activity.actor,
              image: undefined,
              role: undefined,
              company: undefined
            }
          };
        } catch (userError) {
          console.warn(`Failed to fetch user profile for ${activity.actor}:`, userError);
          // Return activity without user enrichment if user fetch fails
          return {
            ...activity,
            userInfo: {
              name: activity.actor,
              image: undefined,
              role: undefined,
              company: undefined
            }
          };
        }
      })
    );

    return res.json({
      success: true,
      activities: enrichedActivities,
      feedGroup,
      feedId,
      count: enrichedActivities.length
    });

  } catch (error: any) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch posts',
      details: error.message 
    });
  }
}
