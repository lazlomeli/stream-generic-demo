import express from 'express';
import { StreamChat } from 'stream-chat';
import multer from 'multer';

const router = express.Router();

// Configure multer for handling file uploads (same as server.js)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Chat routes will receive streamClient as a dependency
let streamClient;

// Initialize the router with dependencies
export function initializeChatRoutes(streamChatClient) {
  streamClient = streamChatClient;
  return router;
}

// Stream Chat Token endpoint
router.post('/chat-token', async (req, res) => {
  try {
    const { userId } = req.body;
    
    console.log('🔐 Generating Stream Chat token for userId:', userId);
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check if we have Stream credentials
    if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
      console.error('❌ Missing Stream API credentials');
      return res.status(500).json({ 
        error: 'Stream API credentials not configured. Check your .env file.' 
      });
    }

    // Generate Stream user token
    const streamToken = streamClient.createToken(userId);
    
    console.log('✅ Stream Chat token generated successfully');
    
    res.json({
      token: streamToken,
      apiKey: process.env.STREAM_API_KEY,
      userId: userId
    });
    
  } catch (error) {
    console.error('💥 Error generating chat token:', error);
    res.status(500).json({ error: 'Failed to generate chat token' });
  }
});

// Stream Get Chat User endpoint
router.post('/get-chat-user', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log(`🔍 Fetching Stream Chat user data for: ${userId}`);

    // Initialize Stream Chat client
    const serverClient = StreamChat.getInstance(
      process.env.STREAM_API_KEY,
      process.env.STREAM_API_SECRET
    );

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

        res.json({ 
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
        res.status(404).json({ 
          user: null,
          message: 'User not found in Stream Chat'
        });
      }
    } catch (chatError) {
      console.warn(`Failed to fetch Stream Chat user ${userId}:`, chatError.message);
      res.status(404).json({ 
        user: null,
        error: chatError.message
      });
    }

  } catch (error) {
    console.error('❌ Error fetching Stream Chat user:', error);
    res.status(500).json({ error: 'Failed to fetch user from Stream Chat' });
  }
});

// Stream Resolve User ID endpoint
router.post('/resolve-user-id', async (req, res) => {
  try {
    const { hashedUserId } = req.body;

    if (!hashedUserId) {
      return res.status(400).json({ error: 'hashedUserId is required' });
    }

    console.log(`🔍 Resolving hashed user ID: ${hashedUserId}`);

    // Synchronous hash function (matches the one in frontend idUtils.ts)
    function createPublicUserIdSync(auth0UserId) {
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

    // Initialize Stream Chat client
    const { StreamChat } = await import('stream-chat');
    const serverClient = StreamChat.getInstance(
      process.env.STREAM_API_KEY,
      process.env.STREAM_API_SECRET
    );

    try {
      // Query all users from Stream Chat (reduced limit to avoid rate limits)
      const { users } = await serverClient.queryUsers({}, { limit: 100 });

      // Find the user whose hashed ID matches the requested one
      for (const streamUser of users) {
        const userHash = createPublicUserIdSync(streamUser.id);
        if (userHash === hashedUserId) {
          console.log(`✅ Found matching user: ${streamUser.id} -> ${userHash}`);
          return res.status(200).json({ 
            auth0UserId: streamUser.id,
            userName: streamUser.name || streamUser.id 
          });
        }
      }

      // If no match found, return error
      console.log(`❌ No user found with hashed ID: ${hashedUserId}`);
      return res.status(404).json({ 
        error: 'User not found',
        message: `No user found with hashed ID: ${hashedUserId}` 
      });

    } catch (streamError) {
      console.error('🚨 Stream Chat query error:', streamError);
      return res.status(500).json({ 
        error: 'Failed to query Stream Chat users',
        details: streamError.message || 'Unknown error'
      });
    }

  } catch (error) {
    console.error('🚨 Error resolving user ID:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message || 'Unknown error'
    });
  }
});

// Stream Chat Create Channel endpoint
router.post('/create-channel', upload.single('channelImage'), async (req, res) => {
  try {
    console.log('🏗️ Create channel request body:', req.body);
    console.log('🏗️ Create channel request files:', req.file);
    console.log('🏗️ Create channel request headers:', req.headers);
    console.log('🏗️ Raw request body keys:', Object.keys(req.body));
    console.log('🏗️ Raw request body values:', Object.values(req.body));
    
    const { channelName, selectedUsers, currentUserId } = req.body;
    
    console.log('🏗️ Creating new channel:', channelName);
    console.log('👥 Selected users:', selectedUsers);
    console.log('👤 Current user ID:', currentUserId);
    
    if (!channelName || !selectedUsers || !currentUserId) {
      return res.status(400).json({ 
        error: 'Channel name, selected users, and current user ID are required',
        received: { channelName, selectedUsers, currentUserId }
      });
    }

    // Check if we have Stream credentials
    if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
      console.error('❌ Missing Stream API credentials');
      return res.status(500).json({ 
        error: 'Stream API credentials not configured. Check your .env file.' 
      });
    }

    // Parse selected users
    let userIds;
    try {
      userIds = JSON.parse(selectedUsers);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid selected users format' });
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'At least one user must be selected' });
    }

    // Add current user to the channel members
    const allMembers = [currentUserId, ...userIds];
    
    console.log('👥 Channel members:', allMembers);
    console.log('👤 Current user ID:', currentUserId);
    console.log('👥 Selected user IDs:', userIds);

    // Ensure all users exist in Stream Chat before creating the channel
    console.log('👥 Upserting users in Stream Chat...');
    try {
      // Upsert the current user
      await streamClient.upsertUser({ id: currentUserId });
      console.log('✅ Current user upserted:', currentUserId);
      
      // Upsert the selected users
      for (const userId of userIds) {
        await streamClient.upsertUser({ id: userId });
        console.log('✅ User upserted:', userId);
      }
    } catch (upsertError) {
      console.error('❌ Error upserting users:', upsertError);
      return res.status(500).json({ 
        error: 'Failed to create users in Stream Chat',
        details: upsertError.message 
      });
    }

    // Prepare channel data
    const channelData = {
      name: channelName,
      members: allMembers,
      created_by_id: currentUserId,
    };
    
    console.log('🏗️ Channel data to be created:', channelData);

    // Handle channel image if uploaded
    if (req.file) {
      console.log('📸 Channel image uploaded:', req.file.originalname);
      console.log('📸 File size:', req.file.size, 'bytes');
      console.log('📸 MIME type:', req.file.mimetype);
      
      // Validate image file
      if (!req.file.mimetype.startsWith('image/')) {
        console.error('❌ Invalid file type:', req.file.mimetype);
        return res.status(400).json({ 
          error: 'Invalid file type. Only image files are allowed.',
          receivedType: req.file.mimetype
        });
      }
      
      // Check file size (limit to 5MB)
      if (req.file.size > 5 * 1024 * 1024) {
        console.error('❌ File too large:', req.file.size, 'bytes');
        return res.status(400).json({ 
          error: 'File too large. Maximum size is 5MB.',
          receivedSize: req.file.size,
          maxSize: 5 * 1024 * 1024
        });
      }
      
      try {
        // Convert the uploaded image to a data URL for immediate display
        const base64Image = req.file.buffer.toString('base64');
        const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;
        
        // Store the data URL in the channel data
        channelData.image = dataUrl;
        
        console.log('✅ Image converted to data URL successfully');
      } catch (imageError) {
        console.error('❌ Error processing image:', imageError);
        // Continue without image if processing fails
        channelData.image = undefined;
      }
    }

    // Create the channel using Stream Chat
    const channel = streamClient.channel('messaging', channelData);

    await channel.create();

    console.log('✅ Channel created successfully:', channel.id);
    console.log('🔍 Created channel data:', channel.data);
    console.log('🔍 Channel members after creation:', channel.state?.members);
    
    // Verify the channel was created with the correct members
    try {
      const createdChannel = streamClient.channel('messaging', channel.id);
      await createdChannel.watch();
      console.log('🔍 Retrieved channel data:', createdChannel.data);
      console.log('🔍 Retrieved channel members:', createdChannel.state?.members);
      
      // Also try to get the channel with the current user context
      const userChannel = streamClient.channel('messaging', channel.id);
      await userChannel.watch();
      console.log('🔍 User channel data:', userChannel.data);
      console.log('🔍 User channel members:', userChannel.state?.members);
    } catch (retrieveError) {
      console.error('⚠️ Could not retrieve created channel:', retrieveError);
    }

    res.json({
      success: true,
      message: 'Channel created successfully',
      channelId: channel.id,
      channel: {
        id: channel.id,
        name: channelName,
        members: allMembers,
        created_by_id: currentUserId,
        image: channelData.image
      }
    });
    
  } catch (error) {
    console.error('Error creating channel:', error);
    res.status(500).json({ 
      error: 'Failed to create channel',
      details: error.message 
    });
  }
});

// Chat Operations endpoint
router.post('/chat-operations', async (req, res) => {
  try {
    console.log('💬 CHAT-OPERATIONS: Request received:', { type: req.body?.type, currentUserId: req.body?.currentUserId });
    
    const { type, userId, channelId, channelName, selectedUsers, currentUserId, isDM, channelImage } = req.body;

    if (!currentUserId || !type) {
      console.error('❌ CHAT-OPERATIONS: Missing required fields:', { currentUserId: !!currentUserId, type: !!type });
      return res.status(400).json({ error: 'currentUserId and type are required' });
    }

    if (!['create-livestream-channel', 'create-channel', 'add-to-general', 'leave-channel'].includes(type)) {
      console.error('❌ CHAT-OPERATIONS: Invalid type:', type);
      return res.status(400).json({ error: 'Invalid operation type' });
    }

    const streamApiKey = process.env.STREAM_API_KEY;
    const streamSecret = process.env.STREAM_API_SECRET;

    if (!streamApiKey || !streamSecret) {
      console.error('❌ CHAT-OPERATIONS: Missing Stream API credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Initialize Stream Chat client
    const client = StreamChat.getInstance(streamApiKey, streamSecret);

    if (type === 'create-livestream-channel') {
      console.log('🎬 CHAT-OPERATIONS: Creating livestream channel:', channelId);
      
      if (!channelId) {
        return res.status(400).json({ error: 'channelId is required for create-livestream-channel' });
      }

      try {
        // Create livestream channel
        const channel = client.channel('livestream', channelId, {
          name: `Live Stream ${channelId}`,
          created_by_id: userId,
          members: [userId]
        });

        await channel.create();
        console.log('✅ CHAT-OPERATIONS: Livestream channel created successfully');

        return res.status(200).json({
          success: true,
          channelId: channelId,
          message: 'Livestream channel created successfully'
        });
      } catch (error) {
        console.error('❌ CHAT-OPERATIONS: Error creating livestream channel:', error);
        return res.status(500).json({ 
          error: 'Failed to create livestream channel',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (type === 'create-channel') {
      console.log('💬 CHAT-OPERATIONS: Creating channel:', { channelName, isDM, selectedUsers });
      
      if (!channelName || !selectedUsers) {
        return res.status(400).json({ error: 'channelName and selectedUsers are required for create-channel' });
      }

      try {
        const parsedUsers = JSON.parse(selectedUsers);
        const members = [currentUserId, ...parsedUsers].filter(Boolean);
        
        // Generate simple short channel IDs
        const shortId = Math.random().toString(36).substr(2, 8); // 8 random chars
        const channelId = isDM ? `dm_${shortId}` : `group_${shortId}`;
        
        const channelData = {
          name: channelName,
          created_by_id: currentUserId,
          members: members,
          isDM: isDM
        };

        if (channelImage) {
          channelData.image = channelImage;
        }

        const channel = client.channel('messaging', channelId, channelData);
        await channel.create();
        console.log('✅ CHAT-OPERATIONS: Channel created successfully with ID:', channel.id);

        return res.status(200).json({
          success: true,
          channelId: channel.id,
          message: 'Channel created successfully'
        });
      } catch (error) {
        console.error('❌ CHAT-OPERATIONS: Error creating channel:', error);
        return res.status(500).json({ 
          error: 'Failed to create channel',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (type === 'add-to-general') {
      console.log('🏠 CHAT-OPERATIONS: Adding user to general channel:', userId);
      
      try {
        const channel = client.channel('messaging', 'general');
        await channel.addMembers([userId]);
        console.log('✅ CHAT-OPERATIONS: User added to general channel');

        return res.status(200).json({
          success: true,
          message: 'User added to general channel successfully'
        });
      } catch (error) {
        console.error('❌ CHAT-OPERATIONS: Error adding user to general:', error);
        return res.status(500).json({ 
          error: 'Failed to add user to general channel',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (type === 'leave-channel') {
      console.log('🚪 CHAT-OPERATIONS: User leaving channel:', { userId, channelId });
      
      if (!channelId) {
        return res.status(400).json({ error: 'channelId is required for leave-channel' });
      }

      try {
        const channel = client.channel('messaging', channelId);
        await channel.removeMembers([userId]);
        console.log('✅ CHAT-OPERATIONS: User removed from channel');

        return res.status(200).json({
          success: true,
          message: 'User removed from channel successfully'
        });
      } catch (error) {
        console.error('❌ CHAT-OPERATIONS: Error removing user from channel:', error);
        return res.status(500).json({ 
          error: 'Failed to remove user from channel',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

  } catch (error) {
    console.error('❌ CHAT-OPERATIONS: Critical error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: req.body?.type,
      userId: req.body?.userId
    });
    res.status(500).json({ 
      error: 'Failed to perform chat operation',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
