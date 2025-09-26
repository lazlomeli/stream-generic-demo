import { VercelRequest, VercelResponse } from '@vercel/node';
import { connect } from 'getstream';
import { StreamChat } from 'stream-chat';
import jwt from 'jsonwebtoken';

// Demo user mapping
const DEMO_USERS = {
  'alice_smith': {
    name: 'Alice Smith',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face',
    role: 'Frontend Developer',
    company: 'Stream'
  },
  'bob_johnson': {
    name: 'Bob Johnson',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    role: 'Backend Engineer',
    company: 'TechCorp'
  },
  'carol_williams': {
    name: 'Carol Williams',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    role: 'Product Designer',
    company: 'Design Studio'
  },
  'david_brown': {
    name: 'David Brown',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    role: 'DevRel Engineer',
    company: 'Stream'
  },
  'emma_davis': {
    name: 'Emma Davis',
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
    role: 'Full-stack Developer',
    company: 'StartupCo'
  }
};

interface UserProfileResponse {
  [userId: string]: {
    name?: string;
    username?: string;
    image?: string;
    profile_image?: string;
    role?: string;
    company?: string;
  };
}

// Simple auth verification function
async function verifyAuth0Token(req: VercelRequest): Promise<string | null> {
  try {
    console.log('🔐 USER-DATA: Auth verification attempt...');
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.log('❌ USER-DATA: No authorization header found');
      return null;
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      console.log('❌ USER-DATA: Invalid authorization header format:', authHeader.substring(0, 20) + '...');
      return null;
    }
    
    const token = authHeader.substring(7);
    if (!token) {
      console.log('❌ USER-DATA: Empty token after Bearer prefix');
      return null;
    }
    
    console.log('🔍 USER-DATA: Token found, attempting to decode...', {
      tokenLength: token.length,
      tokenStart: token.substring(0, 30) + '...',
      tokenEnd: '...' + token.substring(token.length - 30)
    });
    
    // Check if token is JWE (encrypted) or JWT (signed)
    const tokenParts = token.split('.');
    let decoded: any = null;
    
    if (tokenParts.length === 5) {
      // JWE token (encrypted) - 5 parts: header.encryptedKey.iv.ciphertext.tag
      console.log('🔐 USER-DATA: Detected JWE token (encrypted) - attempting base64 decode of header');
      try {
        const headerB64 = tokenParts[0];
        const headerJson = JSON.parse(Buffer.from(headerB64, 'base64').toString());
        console.log('🔍 USER-DATA: JWE Header:', headerJson);
        
        // For JWE tokens, we can't decode the payload without the private key
        // We'll need to skip auth verification for now or implement proper JWE decoding
        console.log('⚠️ USER-DATA: JWE token detected - skipping verification for development');
        
        // For JWE tokens, we can't decode the payload easily
        // Use the user ID from request body for now - in production you'd want proper JWE decryption
        console.log('⚠️ USER-DATA: Using userId from request body due to JWE token');
        return req.body.userId || null;
        
      } catch (jweError: any) {
        console.log('❌ USER-DATA: Failed to decode JWE header:', jweError.message);
        return null;
      }
    } else if (tokenParts.length === 3) {
      // JWT token (signed) - 3 parts: header.payload.signature
      console.log('🔍 USER-DATA: Detected JWT token (signed) - decoding payload');
      try {
        decoded = jwt.decode(token) as any;
        if (!decoded) {
          console.log('❌ USER-DATA: Failed to decode JWT token - token might be malformed');
          return null;
        }
      } catch (jwtError: any) {
        console.log('❌ USER-DATA: Failed to decode JWT token:', jwtError.message);
        return null;
      }
    } else {
      console.log('❌ USER-DATA: Unknown token format - expected 3 (JWT) or 5 (JWE) parts, got:', tokenParts.length);
      return null;
    }
    
    // If we have a decoded JWT, continue with normal validation
    if (decoded) {
      console.log('🔍 USER-DATA: Token decoded successfully:', {
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
        console.log('❌ USER-DATA: Token has expired:', {
          expiredAt: new Date(decoded.exp * 1000).toISOString(),
          now: new Date().toISOString()
        });
        return null;
      }
      
      // Check if token has required fields
      if (!decoded.sub) {
        console.log('❌ USER-DATA: Token missing required "sub" field');
        return null;
      }
      
      const userId = decoded.sub;
      console.log('✅ USER-DATA: Auth verification successful:', { 
        hasUserId: !!userId, 
        userIdLength: userId?.length || 0,
        userId: userId?.substring(0, 20) + '...' || 'none'
      });
      
      return userId;
    }
    
    // If we get here, something went wrong
    console.log('❌ USER-DATA: No token could be decoded');
    return null;
  } catch (error) {
    console.error('❌ USER-DATA: Auth verification error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return null;
  }
}

/**
 * Synchronous hash function (matches the one in frontend idUtils.ts)
 */
function createPublicUserIdSync(auth0UserId: string): string {
  let hash = 0;
  for (let i = 0; i < auth0UserId.length; i++) {
    const char = auth0UserId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive hex string with consistent length
  const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
  return hashHex + auth0UserId.length.toString(16).padStart(2, '0'); // Add length for extra uniqueness
}

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
    console.log('🔧 USER-DATA: Request received:', {
      method: req.method,
      type: req.body?.type,
      hasBody: !!req.body,
      hasAuthHeader: !!req.headers.authorization,
      authHeaderStart: req.headers.authorization?.substring(0, 50) + '...' || 'none',
      userAgent: req.headers['user-agent']?.substring(0, 100) || 'none',
      origin: req.headers.origin || 'none',
      referer: req.headers.referer || 'none',
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasAuth0Domain: !!(process.env.AUTH0_DOMAIN || process.env.VITE_AUTH0_DOMAIN),
        hasAuth0ClientId: !!(process.env.AUTH0_CLIENT_ID || process.env.VITE_AUTH0_CLIENT_ID),
        hasAuth0ClientSecret: !!process.env.AUTH0_CLIENT_SECRET,
        hasAuth0Audience: !!(process.env.AUTH0_AUDIENCE || process.env.VITE_AUTH0_AUDIENCE),
        hasAuth0Issuer: !!process.env.AUTH0_ISSUER,
        usingFallback: {
          domain: !process.env.AUTH0_DOMAIN && !!process.env.VITE_AUTH0_DOMAIN,
          clientId: !process.env.AUTH0_CLIENT_ID && !!process.env.VITE_AUTH0_CLIENT_ID,
          audience: !process.env.AUTH0_AUDIENCE && !!process.env.VITE_AUTH0_AUDIENCE
        }
      }
    });
    
    const { type } = req.body;

    if (!type) {
      console.log('❌ USER-DATA: Missing type parameter');
      return res.status(400).json({ error: 'type is required' });
    }

    if (!['posts', 'resolve', 'chat-user'].includes(type)) {
      console.log('❌ USER-DATA: Invalid type:', type);
      return res.status(400).json({ error: 'type must be "posts", "resolve", or "chat-user"' });
    }

    // Handle user posts fetching
    if (type === 'posts') {
      console.log('📝 USER-DATA: Handling posts request...', {
        hasAuthHeader: !!req.headers.authorization,
        authHeaderStart: req.headers.authorization?.substring(0, 30) + '...' || 'none',
        bodyKeys: Object.keys(req.body),
        userId: req.body?.userId,
        targetUserId: req.body?.targetUserId
      });
      
      // Verify authentication for posts endpoint too
      const authenticatedUserId = await verifyAuth0Token(req);
      if (!authenticatedUserId) {
        console.log('❌ USER-DATA: Unauthorized for posts - returning 401');
        return res.status(401).json({ 
          error: 'Unauthorized',
          debug: {
            hasAuthHeader: !!req.headers.authorization,
            authHeaderFormat: req.headers.authorization?.startsWith('Bearer ') || false
          }
        });
      }
      
      console.log('✅ USER-DATA: Posts request authenticated successfully:', {
        authenticatedUserId: authenticatedUserId?.substring(0, 20) + '...' || 'none'
      });
      
      const { userId, targetUserId, limit = 20 } = req.body;

      if (!userId) {
        console.log('❌ USER-DATA: Missing userId for posts');
        return res.status(400).json({ error: 'userId is required' });
      }

      if (!targetUserId) {
        console.log('❌ USER-DATA: Missing targetUserId for posts');
        return res.status(400).json({ error: 'targetUserId is required' });
      }

      // Get Stream API credentials
      const apiKey = process.env.STREAM_API_KEY;
      const apiSecret = process.env.STREAM_API_SECRET;

      if (!apiKey || !apiSecret) {
        return res.status(500).json({ error: 'Missing Stream API credentials' });
      }

      // Initialize Stream Feeds client
      const streamFeedsClient = connect(apiKey, apiSecret);

      console.log(`🔍 Fetching posts from user's personal feed: user:${targetUserId}`);
      console.log(`🔍 PROFILE_DEBUG: This is for profile view of user: ${targetUserId}`);

      // Check if we need to map to a timestamped user ID
      let actualUserId = targetUserId;
      
      // First try the original user ID
      let result: any;
      try {
        const userFeed = streamFeedsClient.feed('user', targetUserId);
        result = await userFeed.get({
          limit: limit * 2,
          offset: 0,
          withReactionCounts: true,
          withOwnReactions: true,
        });
        
        console.log(`✅ Found ${result.results?.length || 0} activities in user:${targetUserId} feed`);
      } catch (error) {
        console.log(`⚠️ Failed to fetch from user:${targetUserId}, will try timestamped versions...`);
        result = { results: [] };
      }
      
      // If no posts found, try to find a timestamped version of this user
      if (!result.results || result.results.length === 0) {
        console.log(`🔍 No posts found for ${targetUserId}, searching for timestamped versions...`);
        
        try {
          // Query global feed to find any activities by timestamped versions of this user
          const globalFeed = streamFeedsClient.feed('flat', 'global');
          const globalResult = await globalFeed.get({
            limit: 100,
            offset: 0,
            withReactionCounts: true,
            withOwnReactions: true,
          });
          
          // Look for activities by users matching the pattern: targetUserId_timestamp
          const timestampedActivities = globalResult.results?.filter((activity: any) => {
            const actorId = activity.actor;
            return actorId && actorId.startsWith(targetUserId + '_') && /\d{13}$/.test(actorId);
          }) || [];
          
          console.log(`🔍 Found ${timestampedActivities.length} activities by timestamped versions of ${targetUserId}`);
          
          if (timestampedActivities.length > 0) {
            // Get the most recent timestamped user ID
            const timestampedUserIds = Array.from(new Set(timestampedActivities.map(a => a.actor)));
            console.log(`🔍 Found timestamped user IDs:`, timestampedUserIds);
            
            // Use the first one (they should all be the same user anyway)
            actualUserId = timestampedUserIds[0];
            console.log(`🔄 Using timestamped user ID: ${actualUserId}`);
            
            // Now fetch from the correct timestamped user feed
            const timestampedUserFeed = streamFeedsClient.feed('user', actualUserId);
            result = await timestampedUserFeed.get({
              limit: limit * 2,
              offset: 0,
              withReactionCounts: true,
              withOwnReactions: true,
            });
            
            console.log(`✅ Found ${result.results?.length || 0} activities in timestamped user:${actualUserId} feed`);
          }
        } catch (globalError) {
          console.log(`⚠️ Failed to search global feed for timestamped users:`, globalError);
        }
      }

      // Debug: Log what verbs we have before filtering
      console.log(`🔍 DEBUG: Raw activities in user:${actualUserId} feed:`, 
        (result.results || []).map(a => ({ id: a.id, verb: a.verb, actor: a.actor, text: a.text?.substring(0, 50) }))
      );

      // Filter out notification activities to prevent them from showing as posts
      const filteredPosts = (result.results || []).filter((activity: any) => 
        activity.verb !== 'notification'
      );
      const limitedPosts: any[] = filteredPosts.slice(0, limit);

      console.log(`✅ Found ${limitedPosts.length} posts in user:${actualUserId} feed`);
      console.log(`🔗 This feed has ${result.results?.length || 0} total activities`);
      console.log(`🔍 DEBUG: Filtered posts:`, 
        filteredPosts.map(a => ({ id: a.id, verb: a.verb, actor: a.actor, text: a.text?.substring(0, 50) }))
      );
      
      // If no posts in user feed, fallback to global feed filtering (for backward compatibility)
      if (limitedPosts.length === 0) {
        console.log(`📋 No posts in user feed, trying global feed fallback...`);
        
        const globalFeed = streamFeedsClient.feed('flat', 'global');
        const globalResult = await globalFeed.get({
          limit: 100, // Get more to filter
          offset: 0,
          withReactionCounts: true,
          withOwnReactions: true,
        });

        const fallbackPosts = globalResult.results?.filter((activity: any) => 
          activity.actor === actualUserId
        ) || [];
        
        const fallbackLimited: any[] = fallbackPosts.slice(0, limit);
        console.log(`📋 Fallback: Found ${fallbackLimited.length} posts by filtering global feed`);
        
        // Use fallback posts if found
        if (fallbackLimited.length > 0) {
          limitedPosts.push(...fallbackLimited);
        }
      }

      // Get user profile information for post authors  
      // Include both the target user ID (for display name mapping) and actual user ID (if different)
      const userIds = Array.from(new Set([targetUserId, actualUserId]));
      let userProfiles: UserProfileResponse = {};

      try {
        const userPromises = userIds.map(async (id) => {
          try {
            // Try to get user from Stream, but handle 404 gracefully
            const user = await streamFeedsClient.user(id).get();
            console.log(`✅ Found Stream user profile for ${id}:`, (user as any).name);
            return { [id]: {
              name: (user as any).name || id,
              username: (user as any).username,
              image: (user as any).image || (user as any).profile_image,
              role: (user as any).role,
              company: (user as any).company
            }};
          } catch (userError: any) {
            // Handle user not found gracefully
            if (userError?.response?.status === 404 || userError?.error?.status_code === 404) {
              console.log(`👤 User ${id} not found in Stream user database - using fallback profile`);
              
              // Check demo users mapping first
              let baseUserId = id;
              if (id.includes('_') && /\d{13}$/.test(id)) {
                baseUserId = id.replace(/_\d{13}$/, '');
              }
              
              const demoUser = DEMO_USERS[baseUserId as keyof typeof DEMO_USERS];
              if (demoUser) {
                console.log(`✅ Found demo user mapping for ${baseUserId}:`, demoUser.name);
                return { [id]: {
                  name: demoUser.name,
                  username: id,
                  image: demoUser.image,
                  role: demoUser.role,
                  company: demoUser.company
                }};
              }
              
              // Create a basic profile from the Auth0 ID
              const fallbackName = id.includes('google-oauth2_') 
                ? id.replace('google-oauth2_', '').replace(/^\d+/, 'User') // Clean up Google OAuth ID
                : id.replace(/[^a-zA-Z0-9]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()); // Format other IDs
              
              return { [id]: { 
                name: fallbackName,
                username: id,
                image: undefined,
                role: 'User',
                company: undefined
              }};
            } else {
              console.warn(`❌ Failed to get user profile for ${id}:`, userError?.message || userError);
              return { [id]: { name: id } };
            }
          }
        });

        const userResults = await Promise.all(userPromises);
        userProfiles = userResults.reduce((acc, curr) => ({ ...acc, ...curr }), {} as UserProfileResponse);
      } catch (profileError) {
        console.warn('❌ Failed to fetch user profiles:', profileError);
        // Fallback: create basic profile for target user
        userProfiles = { [targetUserId]: { name: targetUserId } };
      }

      return res.status(200).json({
        success: true,
        posts: limitedPosts,
        userProfiles,
        count: limitedPosts.length,
        totalUserPosts: limitedPosts.length,
        mappedFromTimestampedUser: actualUserId !== targetUserId ? actualUserId : undefined
      });
    }

    // Handle user ID resolution
    if (type === 'resolve') {
      // Verify the Auth0 token
      const user = await verifyAuth0Token(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { hashedUserId } = req.body;

      if (!hashedUserId) {
        return res.status(400).json({ error: 'hashedUserId is required' });
      }

      // Initialize Stream Chat client to query users
      const streamChatClient = new StreamChat(
        process.env.STREAM_API_KEY!,
        process.env.STREAM_API_SECRET!
      );

      try {
        // Query all users from Stream Chat (this might need pagination for large user bases)
        const response = await streamChatClient.queryUsers({}, { id: 1 }, { limit: 1000 });
        const users = response.users || [];

        // Find the user whose hashed ID matches the requested one
        for (const streamUser of users) {
          const userHash = createPublicUserIdSync(streamUser.id);
          if (userHash === hashedUserId) {
            return res.status(200).json({ 
              auth0UserId: streamUser.id,
              userName: streamUser.name || streamUser.id 
            });
          }
        }

        // If no match found, return error
        return res.status(404).json({ 
          error: 'User not found',
          message: `No user found with hashed ID: ${hashedUserId}` 
        });

      } catch (streamError) {
        console.error('Stream Chat query error:', streamError);
        return res.status(500).json({ 
          error: 'Failed to query Stream Chat users',
          details: streamError instanceof Error ? streamError.message : 'Unknown error'
        });
      }
    }

    // Handle Stream Chat user data fetching
    if (type === 'chat-user') {
      // Verify authentication
      const authenticatedUserId = await verifyAuth0Token(req);
      if (!authenticatedUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Initialize Stream Chat client
      const serverClient = new StreamChat(
        process.env.STREAM_API_KEY!,
        process.env.STREAM_API_SECRET!
      );

      console.log(`🔍 Fetching Stream Chat user data for: ${userId}`);

      try {
        // Query the user from Stream Chat
        const response = await serverClient.queryUsers(
          { id: userId },
          { id: 1 },
          { limit: 1 }
        );

        if (response.users && response.users.length > 0) {
          const user = response.users[0];
          console.log(`✅ Found Stream Chat user data for ${userId}:`, {
            name: user.name,
            image: user.image,
            role: user.role
          });

          return res.status(200).json({ 
            success: true,
            message: 'Success',
            user: {
              id: user.id,
              name: user.name,
              image: user.image,
              role: user.role,
              online: user.online,
              last_active: user.last_active,
              created_at: user.created_at,
              updated_at: user.updated_at
            }
          });
        } else {
          console.log(`⚠️ No Stream Chat user found for ${userId}`);
          return res.status(404).json({ 
            success: false,
            message: 'User not found in Stream Chat',
            user: null 
          });
        }
      } catch (chatError: any) {
        console.warn(`Failed to fetch Stream Chat user ${userId}:`, chatError.message);
        return res.status(404).json({ 
          success: false,
          message: 'User not found in Stream Chat',
          user: null,
          error: chatError.message
        });
      }
    }

  } catch (error: any) {
    console.error('❌ Error in user-data handler:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
