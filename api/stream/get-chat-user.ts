import { VercelRequest, VercelResponse } from '@vercel/node';
import { StreamChat } from 'stream-chat';
import { verifyAuth0Token } from '../_utils/auth0';
import { standardResponse } from '../_utils/responses';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return standardResponse(res, 405, 'Method not allowed', { allowedMethods: ['POST'] });
  }

  try {
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

  } catch (error: any) {
    console.error('❌ Error fetching Stream Chat user:', error);
    return standardResponse(res, 500, 'Failed to fetch user from Stream Chat', {
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
