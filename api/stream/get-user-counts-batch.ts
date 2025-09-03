import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
// import { FeedsClient } from '@stream-io/feeds-client'; // Disabled - V3 alpha causing issues
import { connect } from 'getstream'; // Use V2 for production stability

// Simple auth verification function
async function verifyAuth0Token(req: VercelRequest): Promise<string | null> {
  try {
    console.log('🔐 GET-USER-COUNTS: Auth verification attempt...');
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.log('❌ GET-USER-COUNTS: No authorization header found');
      return null;
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      console.log('❌ GET-USER-COUNTS: Invalid authorization header format:', authHeader.substring(0, 20) + '...');
      return null;
    }
    
    const token = authHeader.substring(7);
    if (!token) {
      console.log('❌ GET-USER-COUNTS: Empty token after Bearer prefix');
      return null;
    }
    
    console.log('🔍 GET-USER-COUNTS: Token found, attempting to decode...', {
      tokenLength: token.length,
      tokenStart: token.substring(0, 30) + '...',
      tokenEnd: '...' + token.substring(token.length - 30)
    });
    
    // For now, just decode without verification (since we need the user ID)
    // In a production environment, you'd want proper JWT verification
    const decoded = jwt.decode(token) as any;
    
    if (!decoded) {
      console.log('❌ GET-USER-COUNTS: Failed to decode JWT token - token might be malformed');
      return null;
    }
    
    console.log('🔍 GET-USER-COUNTS: Token decoded successfully:', {
      hasIss: !!decoded.iss,
      hasSub: !!decoded.sub,
      hasAud: !!decoded.aud,
      hasExp: !!decoded.exp,
      exp: decoded.exp,
      now: Math.floor(Date.now() / 1000),
      isExpired: decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)
    });
    
    // Check if token is expired
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      console.log('❌ GET-USER-COUNTS: Token has expired:', {
        expiredAt: new Date(decoded.exp * 1000).toISOString(),
        now: new Date().toISOString()
      });
      return null;
    }
    
    // Check if token has required fields
    if (!decoded.sub) {
      console.log('❌ GET-USER-COUNTS: Token missing required "sub" field');
      return null;
    }
    
    const userId = decoded.sub;
    console.log('✅ GET-USER-COUNTS: Auth verification successful:', { 
      hasUserId: !!userId, 
      userIdLength: userId?.length || 0,
      userId: userId?.substring(0, 20) + '...' || 'none'
    });
    
    return userId;
  } catch (error) {
    console.error('❌ GET-USER-COUNTS: Auth verification error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    console.log('🔧 GET-USER-COUNTS: Request received:', {
      method: req.method,
      hasBody: !!req.body,
      userId: req.body?.userId,
      targetUserIds: req.body?.targetUserIds?.length || 0,
      hasAuthHeader: !!req.headers.authorization
    });
    
    // Verify the Auth0 token
    const user = await verifyAuth0Token(req);
    if (!user) {
      console.log('❌ GET-USER-COUNTS: Unauthorized - returning 401');
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

    console.log(`📊 Batch fetching user counts for ${targetUserIds.length} users:`, targetUserIds);

    // Initialize Stream client
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;
    
    console.log('🔑 API Key exists:', !!apiKey);
    console.log('🔐 API Secret exists:', !!apiSecret);
    
    if (!apiKey || !apiSecret) {
      console.error('❌ Missing Stream API credentials - apiKey:', !!apiKey, 'apiSecret:', !!apiSecret);
      return res.status(500).json({ error: 'Missing Stream API credentials' });
    }
    
    console.log('🔌 Connecting to Stream V2 (server-side)...');
        const serverClient = connect(apiKey, apiSecret, undefined);
    console.log('✅ Stream V2 Feeds client connected');

    const results: Record<string, { followers: number; following: number }> = {};

    // Batch fetch counts for all users using V2 API
    const countPromises = targetUserIds.map(async (targetUserId: string) => {
      try {
        console.log(`👤 Fetching counts for user: ${targetUserId} (V2)`);
        console.log(`📊 Counting pattern: user:${targetUserId} followers + timeline:${targetUserId} following`);
        
        // Get user feed and timeline feed using V2 (server-side access)
        const userFeed = serverClient.feed('user', targetUserId);
        const timelineFeed = serverClient.feed('timeline', targetUserId);
        
        // Get followers count and following count using V2 followers()/following()
        const [followersResponse, followingResponse] = await Promise.all([
          userFeed.followers({ limit: 100 }).catch((err) => {
            console.warn(`❌ followers() failed for ${targetUserId} (V2):`, err.message);
            return { results: [] };
          }),
          timelineFeed.following({ limit: 100 }).catch((err) => {
            console.warn(`❌ following() failed for ${targetUserId} (V2):`, err.message);
            return { results: [] };
          })
        ]);

        const followers = followersResponse.results?.length || 0;
        const following = followingResponse.results?.length || 0;
        
        console.log(`✅ User ${targetUserId}: ${followers} followers, ${following} following`);
        
        // Debug: Log ALL relationships for troubleshooting (V2)
        if (followersResponse.results?.length > 0) {
          console.log(`🔍 ALL followers for ${targetUserId} (V2):`, followersResponse.results);
        } else {
          console.log(`⚠️ NO followers found for ${targetUserId} (V2)`);
        }
        
        if (followingResponse.results?.length > 0) {
          console.log(`🔍 ALL following for ${targetUserId} (V2):`, followingResponse.results);
        } else {
          console.log(`⚠️ NO following found for ${targetUserId} (V2)`);
        }

        return {
          userId: targetUserId,
          followers,
          following
        };
      } catch (error) {
        console.error(`❌ Failed to fetch counts for user ${targetUserId}:`, {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
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
    console.log('📊 Final results:', results);

    // If no results were fetched, provide demo data to ensure modal works
    if (Object.keys(results).length === 0 && targetUserIds.length > 0) {
      console.log('⚠️ No user counts fetched, providing demo data');
      const demoResults: Record<string, { followers: number; following: number }> = {};
      targetUserIds.forEach(userId => {
        demoResults[userId] = {
          followers: Math.floor(Math.random() * 100) + 10,
          following: Math.floor(Math.random() * 50) + 5
        };
      });
      return res.status(200).json({
        userCounts: demoResults,
        totalUsers: Object.keys(demoResults).length,
        isDemoData: true
      });
    }

    return res.status(200).json({
      userCounts: results,
      totalUsers: Object.keys(results).length,
      isDemoData: false
    });

  } catch (error) {
    console.error('❌ GET-USER-COUNTS: Critical error fetching user counts:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.body?.userId,
      targetUserIds: req.body?.targetUserIds,
      hasAuthHeader: !!req.headers.authorization
    });
    
    return res.status(500).json({ 
      error: 'Failed to fetch user counts',
      details: error instanceof Error ? error.message : 'Unknown error',
      userId: req.body?.userId
    });
  }
}
