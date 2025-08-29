import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth0Token } from '../_utils/auth0';
import { StreamChat } from 'stream-chat';

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

  } catch (error) {
    console.error('Error resolving user ID:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
