import jwt from 'jsonwebtoken';
// import { FeedsClient } from '@stream-io/feeds-client'; // Disabled - V3 alpha causing issues
import { StreamChat } from 'stream-chat';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔧 AUTH-TOKENS: Request received:', { type: req.body?.type, userId: req.body?.userId });
    
    const { type, userId, userProfile } = req.body;

    if (!userId || !type) {
      console.error('❌ AUTH-TOKENS: Missing required fields:', { userId: !!userId, type: !!type });
      return res.status(400).json({ error: 'userId and type are required' });
    }

    if (!['feed', 'chat'].includes(type)) {
      console.error('❌ AUTH-TOKENS: Invalid type:', type);
      return res.status(400).json({ error: 'type must be "feed" or "chat"' });
    }

    // Get Stream API credentials
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    console.log('🔐 AUTH-TOKENS: Environment check:', {
      hasApiKey: !!apiKey,
      hasApiSecret: !!apiSecret,
      apiKeyLength: apiKey?.length || 0
    });

    if (!apiKey || !apiSecret) {
      console.error('❌ AUTH-TOKENS: Missing Stream API credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Handle feed token generation
    if (type === 'feed') {
      console.log('🍃 AUTH-TOKENS: Generating feed token for:', userId);
      
      // Skip V3 FeedsClient connection for now - it's in alpha and causing 500 errors
      // Just generate the JWT token directly for frontend use
      if (userProfile) {
        console.log('👤 AUTH-TOKENS: User profile provided, skipping V3 connection (alpha)');
        // Note: V3 Feeds connection disabled due to alpha limitations
      }

      // Generate a Feeds V3-compatible JWT token
      console.log('🔑 AUTH-TOKENS: Generating JWT token...');
      const token = jwt.sign(
        {
          user_id: userId,
        },
        apiSecret,
        {
          algorithm: 'HS256',
          expiresIn: '24h',
        }
      );

      console.log('✅ AUTH-TOKENS: Feed token generated successfully');
      return res.status(200).json({
        token,
        apiKey,
        userId,
      });
    }

    // Handle chat token generation
    if (type === 'chat') {
      console.log('💬 AUTH-TOKENS: Generating chat token for:', userId);
      
      // Initialize Stream Chat client
      const streamClient = new StreamChat(apiKey, apiSecret);

      // Create/update user profile in Stream Chat if profile information is provided
      if (userProfile) {
        try {
          console.log('👤 AUTH-TOKENS: Updating chat user profile...');
          await streamClient.upsertUser({
            id: userId,
            name: userProfile.name,
            image: userProfile.image,
            role: userProfile.role
          });
          console.log(`✅ AUTH-TOKENS: User profile updated for chat: ${userId}`);
        } catch (profileError) {
          console.warn(`❌ AUTH-TOKENS: Failed to update user profile for chat ${userId}:`, profileError);
          // Continue with token generation even if profile update fails
        }
      }

      // Generate Stream user token
      console.log('🔑 AUTH-TOKENS: Generating chat token...');
      const streamToken = streamClient.createToken(userId);

      console.log('✅ AUTH-TOKENS: Chat token generated successfully');
      return res.status(200).json({
        token: streamToken,
        apiKey: apiKey,
        userId: userId
      });
    }

  } catch (error) {
    console.error('❌ AUTH-TOKENS: Critical error generating token:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: req.body?.type,
      userId: req.body?.userId
    });
    res.status(500).json({ 
      error: 'Failed to generate token',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
