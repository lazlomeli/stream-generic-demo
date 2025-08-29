import { VercelRequest, VercelResponse } from '@vercel/node';
import { connect } from 'getstream';
import { StreamChat } from 'stream-chat';
import { verifyAuth0Token } from '../_utils/auth0';
import { standardResponse } from '../_utils/responses';

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'type is required' });
    }

    if (!['posts', 'resolve', 'chat-user'].includes(type)) {
      return res.status(400).json({ error: 'type must be "posts", "resolve", or "chat-user"' });
    }

    // Handle user posts fetching
    if (type === 'posts') {
      const { userId, targetUserId, limit = 20 } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      if (!targetUserId) {
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

      console.log(`🔍 Fetching posts for user: ${targetUserId}`);

      // Get posts from global feed filtered by target user
      const globalFeed = streamFeedsClient.feed('flat', 'global');
      const result = await globalFeed.get({
        limit: 100, // Get more to filter
        offset: 0,
        withReactionCounts: true,
        withOwnReactions: true,
      });

      // Filter posts by the target user (actor)
      const userPosts = result.results?.filter((activity: any) => 
        activity.actor === targetUserId
      ) || [];

      // Apply the requested limit
      const limitedPosts = userPosts.slice(0, limit);

      console.log(`✅ Found ${limitedPosts.length} posts for user ${targetUserId}`);

      // Get user profile information for post authors
      const userIds = Array.from(new Set([targetUserId]));
      let userProfiles: UserProfileResponse = {};

      try {
        const userPromises = userIds.map(async (id) => {
          try {
            const user = await streamFeedsClient.user(id).get();
            return { [id]: user };
          } catch (userError) {
            console.warn(`Failed to get user profile for ${id}:`, userError);
            return { [id]: { name: id } };
          }
        });

        const userResults = await Promise.all(userPromises);
        userProfiles = userResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});
      } catch (profileError) {
        console.warn('Failed to fetch user profiles:', profileError);
      }

      return res.status(200).json({
        success: true,
        posts: limitedPosts,
        userProfiles,
        count: limitedPosts.length,
        totalUserPosts: userPosts.length
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
      const streamChatClient = StreamChat.getInstance(
        process.env.VITE_STREAM_API_KEY!,
        process.env.STREAM_SECRET_KEY!
      );

      try {
        // Query all users from Stream Chat (this might need pagination for large user bases)
        const { users } = await streamChatClient.queryUsers({}, { limit: 1000 });

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
        return standardResponse(res, 401, 'Unauthorized');
      }

      const { userId } = req.body;

      if (!userId) {
        return standardResponse(res, 400, 'User ID is required');
      }

      // Initialize Stream Chat client
      const serverClient = StreamChat.getInstance(
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

          return standardResponse(res, 200, 'Success', { 
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
          return standardResponse(res, 404, 'User not found in Stream Chat', { 
            user: null 
          });
        }
      } catch (chatError: any) {
        console.warn(`Failed to fetch Stream Chat user ${userId}:`, chatError.message);
        return standardResponse(res, 404, 'User not found in Stream Chat', { 
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
