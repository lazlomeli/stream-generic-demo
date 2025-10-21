import jwt from 'jsonwebtoken';
// import { FeedsClient } from '@stream-io/feeds-client'; // Disabled - V3 alpha causing issues
import { StreamChat } from 'stream-chat';
import { StreamClient } from '@stream-io/node-sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const sanitizeUserId = (userId: string) => {
  return userId.replace(/[^a-zA-Z0-9@_-]/g, '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔧 AUTH-TOKENS: Request received:', { 
      type: req.body?.type, 
      userId: req.body?.userId,
      userProfile: req.body?.userProfile,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });
    
    const { type, userId, userProfile } = req.body;

    if (!userId || !type) {
      console.error('❌ AUTH-TOKENS: Missing required fields:', { userId: !!userId, type: !!type });
      return res.status(400).json({ error: 'userId and type are required' });
    }

    if (!['feed', 'chat', 'video'].includes(type)) {
      console.error('❌ AUTH-TOKENS: Invalid type:', type);
      return res.status(400).json({ error: 'type must be "feed", "chat", or "video"' });
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

      console.log('STREAMCLIENTTTTT', streamClient);
      // Create/update user profile in Stream Chat if profile information is provided
      if (userProfile) {
        try {
          console.log('👤 AUTH-TOKENS: Updating chat user profile...');
          await streamClient.upsertUser({
            id: sanitizeUserId(userId),
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

    // Handle video token generation
    if (type === 'video') {
      console.log('📹 AUTH-TOKENS: Generating video token for:', userId);
      
      // Initialize Stream client for video operations
      const streamClient = new StreamClient(apiKey, apiSecret);

      // SIMPLIFIED APPROACH: Use original user ID but force admin role more aggressively
      let finalUserId = userId;
      
      // Special handling for demo users - create only if needed
      if (userId === 'demo_user_2025') {
        console.log('👥 AUTH-TOKENS: Handling demo user demo_user_2025');
        try {
          // First check if user exists by trying to query it
          const existingUser = await streamClient.queryUsers({ id: 'demo_user_2025' });
          if (existingUser.users.length === 0) {
            console.log('🔧 AUTH-TOKENS: Demo user does not exist, creating...');
            await streamClient.upsertUsers({ 
              id: 'demo_user_2025',
              name: 'Demo User',
              image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
            });
            console.log('✅ AUTH-TOKENS: Demo user demo_user_2025 created');
          } else {
            console.log('✅ AUTH-TOKENS: Demo user demo_user_2025 already exists, skipping creation');
          }
        } catch (error) {
          console.log('⚠️ AUTH-TOKENS: Error handling demo user, but continuing:', error);
        }
      }
      
      // Skip user profile updating entirely - rely on token capabilities only
      console.log('⚡ AUTH-TOKENS: SKIPPING user profile updates - using token-only approach');

      // Generate Stream video user token
      // For demo purposes, give all users admin capabilities to test livestreaming
      const userRole = 'admin'; // Demo app - all users get admin for video features
      console.log('🔑 AUTH-TOKENS: Generating video token for demo role:', userRole);
      
      // Create JWT token directly like chat tokens, but with video-specific payload
      const now = Math.floor(Date.now() / 1000);
      console.log(`🔑 AUTH-TOKENS: Generating token for user ID: ${finalUserId}`);
      
      const tokenPayload: any = {
        user_id: finalUserId, // Use the admin user ID for the token
        iss: 'stream-video',
        exp: now + (24 * 60 * 60), // 24 hours from now
        iat: now,
        nbf: now, // Not before - ensure token is valid immediately
        // Add unique identifier to force token refresh
        jti: `video_${finalUserId}_${now}_${Math.random().toString(36).substr(2, 9)}`,
        // Add video publishing capabilities
        capabilities: [
          'join-call',
          'send-audio', 
          'send-video',
          'mute-users'
        ]
      };
      
      // Complete set of video and livestream capabilities
      tokenPayload.capabilities = [
        // Basic video call capabilities
        'join-call',
        'send-audio', 
        'send-video',
        'mute-users',
        'remove-call-member',
        'update-call-settings',
        'end-call', 
        'create-call',
        'update-call-permissions',
        // Livestream specific capabilities  
        'create-livestream',
        'join-livestream',
        'end-livestream',
        'update-livestream-settings',
        'livestream-admin',
        // Additional admin capabilities
        'pin-for-everyone',
        'screenshare',
        'send-reaction',
        'manage-call-settings',
        'call-admin',
        'super-admin'
      ];
      
      tokenPayload.call_cids = ['*']; // Allow access to all calls
      tokenPayload.role = 'admin'; // FORCE admin role in token
      tokenPayload.call_role = 'admin'; // Alternative role field
      tokenPayload.livestream_role = 'admin'; // Livestream specific role
      
      // Add bypass flags
      tokenPayload.bypass_permissions = true;
      tokenPayload.is_admin = true;
      tokenPayload.grant_all_permissions = true;
      
      console.log('🔧 AUTH-TOKENS: Video token payload:', JSON.stringify(tokenPayload, null, 2));
      
      // Generate JWT token directly using the same method as chat
      const videoToken = jwt.sign(tokenPayload, apiSecret, {
        algorithm: 'HS256'
      });

      console.log('✅ AUTH-TOKENS: Video token generated successfully');
      console.log('🔧 AUTH-TOKENS: Generated token (first 50 chars):', videoToken.substring(0, 50) + '...');
      return res.status(200).json({
        token: videoToken,
        apiKey: apiKey,
        userId: finalUserId, // Return the admin user ID for frontend to use
        originalUserId: userId, // Keep original for reference
        isAdminUser: finalUserId !== userId // Flag to indicate if we created a new admin user
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
