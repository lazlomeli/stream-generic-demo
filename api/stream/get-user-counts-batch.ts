import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth0Token } from '../_utils/auth0';

const { connect } = require('getstream');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify the Auth0 token
    const user = await verifyAuth0Token(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { userId, targetUserIds } = req.body;

    if (!userId || !targetUserIds || !Array.isArray(targetUserIds)) {
      return res.status(400).json({ error: 'userId and targetUserIds array are required' });
    }

    if (targetUserIds.length === 0) {
      return res.status(200).json({ userCounts: {} });
    }

    if (targetUserIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 user IDs allowed per batch' });
    }

    console.log(`📊 Batch fetching user counts for ${targetUserIds.length} users`);

    // Initialize Stream client
    const client = connect(
      process.env.VITE_STREAM_API_KEY!,
      process.env.STREAM_SECRET_KEY!,
      process.env.VITE_STREAM_APP_ID!,
      { location: 'us-east' }
    );

    const results: Record<string, { followers: number; following: number }> = {};

    // Batch fetch counts for all users
    const countPromises = targetUserIds.map(async (targetUserId: string) => {
      try {
        // Get followers count
        const followersPromise = client.feed('timeline', targetUserId).followers({ limit: 1000 });
        
        // Get following count  
        const followingPromise = client.feed('user', targetUserId).following({ limit: 1000 });

        const [followersResponse, followingResponse] = await Promise.all([
          followersPromise.catch(() => ({ results: [] })),
          followingPromise.catch(() => ({ results: [] }))
        ]);

        const followers = followersResponse.results?.length || 0;
        const following = followingResponse.results?.length || 0;

        return {
          userId: targetUserId,
          followers,
          following
        };
      } catch (error) {
        console.warn(`Failed to fetch counts for user ${targetUserId}:`, error);
        return {
          userId: targetUserId,
          followers: 0,
          following: 0
        };
      }
    });

    // Execute all requests in parallel
    const countResults = await Promise.all(countPromises);

    // Format results
    countResults.forEach(({ userId, followers, following }) => {
      results[userId] = { followers, following };
    });

    console.log(`✅ Successfully fetched counts for ${Object.keys(results).length} users`);

    return res.status(200).json({
      userCounts: results,
      totalUsers: Object.keys(results).length
    });

  } catch (error) {
    console.error('🚨 Error in batch user counts fetch:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch user counts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
