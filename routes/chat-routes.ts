import express from 'express';
import { Channel, StreamChat } from 'stream-chat';

const router = express.Router();

let streamClient: StreamChat;

export function initializeChatRoutes(streamChatClient: StreamChat) {
  streamClient = streamChatClient;
  return router;
}

router.post('/chat-token', async (req, res) => {
  try {
    const { user } = req.body;
    
    const userId = user.nickname;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
      console.error('[chat-routes.ts] - /chat-token: Missing Stream API credentials');
      return res.status(500).json({ 
        error: 'Stream API credentials not configured. Check your .env file.' 
      });
    }

    const streamToken = streamClient.createToken(userId);
    
    res.json({
      token: streamToken,
      apiKey: process.env.STREAM_API_KEY as string,
      userId: userId
    });
    
  } catch (error) {
    console.error('[chat-routes.ts]: Error generating chat token:', error);
    res.status(500).json({ error: 'Failed to generate chat token' });
  }
});

router.post('/get-chat-user', async (req, res) => {
  try {
    const { user } = req.body;

    const userId = user.nickname;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const serverClient = StreamChat.getInstance(
      process.env.STREAM_API_KEY as string,
      process.env.STREAM_API_SECRET as string
    );

    try {
      const response = await serverClient.queryUsers(
        { id: userId },
        { id: 1 },
        { limit: 1 }
      );

      if (response.users && response.users.length > 0) {
        const user = response.users[0];

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
        res.status(404).json({ 
          user: null,
          message: 'User not found in Stream Chat'
        });
      }
    } catch (chatError) {
      console.warn(`[chat-routes.ts]: Failed to fetch Stream Chat user ${userId}:`, chatError.message);
      res.status(404).json({ 
        user: null,
        error: chatError.message
      });
    }

  } catch (error) {
    console.error('[chat-routes.ts]: Error fetching Stream Chat user:', error);
    res.status(500).json({ error: 'Failed to fetch user from Stream Chat' });
  }
});


router.post('/create-channel', async (req, res) => {
  try {
    const { channelName, selectedUsers, currentUserId } = req.body;

    if (!channelName || !selectedUsers || !currentUserId) {
      return res.status(400).json({ 
        error: 'Channel name, selected users, and current user ID are required',
        received: { channelName, selectedUsers, currentUserId }
      });
    }

    if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
      console.error('[chat-routes.ts] - /create-channel: Missing Stream API credentials');
      return res.status(500).json({ 
        error: 'Stream API credentials not configured. Check your .env file.' 
      });
    }

    let userIds: string[];

    try {
      userIds = JSON.parse(selectedUsers);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid selected users format' });
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'At least one user must be selected' });
    }

    const allMembers = [currentUserId, ...userIds];

    try {
      await streamClient.upsertUser({ id: currentUserId });
      
      for (const userId of userIds) {
        await streamClient.upsertUser({ id: userId });
      }
    } catch (upsertError) {
      return res.status(500).json({ 
        error: 'Failed to create users in Stream Chat',
        details: upsertError.message 
      });
    }

    const channelData = {
      name: channelName,
      members: allMembers,
      created_by_id: currentUserId,
    };

    const channel = streamClient.channel('messaging', channelData);

    await channel.create();
    
    try {
      const createdChannel = streamClient.channel('messaging', channel.id);
      await createdChannel.watch();
      
      const userChannel = streamClient.channel('messaging', channel.id);
      await userChannel.watch();
    } catch (retrieveError) {
      console.error('[chat-routes.ts]: Could not retrieve created channel:', retrieveError);
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
        image: ""
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

router.post('/chat-operations', async (req, res) => {
  try {
    const { type, userId, channelId, channelName, selectedUsers, isDM } = req.body;

    if (!userId || !type) {
      console.error('[chat-routes.ts]: Missing required fields:', { userId: !!userId, type: !!type });
      return res.status(400).json({ error: 'userId and type are required' });
    }

    if (!['create-livestream-channel', 'create-channel', 'add-to-general', 'leave-channel'].includes(type)) {
      console.error('[chat-routes.ts]: Invalid type:', type);
      return res.status(400).json({ error: 'Invalid operation type' });
    }

    if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
      console.error('[chat-routes.ts] - /chat-operations: Missing Stream API credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const client = StreamChat.getInstance(process.env.STREAM_API_KEY as string, process.env.STREAM_API_SECRET as string);

    // CREATE LIVE
    if (type === 'create-livestream-channel') {
      
      if (!channelId) {
        return res.status(400).json({ error: 'channelId is required for create-livestream-channel' });
      }

      try {
        // Create livestream channel
        const channel = client.channel('livestream', channelId, {
          // name: `Live Stream ${channelId}`,
          created_by_id: userId,
          members: [userId],
          channelType: 'livestream' // Mark as livestream channel
        } as any);

        await channel.create();

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
  
      // Validate required fields
      if (!selectedUsers) {
        return res.status(400).json({ error: 'selectedUsers is required for create-channel' });
      }
      
      // For group channels, channel name is required
      if (!isDM && !channelName) {
        return res.status(400).json({ error: 'channelName is required for group channels' });
      }
    
      try {
        const parsedUsers = JSON.parse(selectedUsers);
        const members = [userId, ...parsedUsers].filter(Boolean);
        
        // For DMs, check if a channel already exists between these exact members
        if (isDM && members.length === 2) {
          try {
            // Sort members to ensure consistent ordering for comparison
            const sortedMembers = [...members].sort();
            
            // Query for channels containing both users
            const filters = {
              type: 'messaging',
              members: { $in: sortedMembers }
            };
            
            const existingChannels = await client.queryChannels(filters, {}, { limit: 20 });
            
            // Filter to find DM channels with exactly these 2 members (no more, no less)
            // IMPORTANT: Only match channels that are marked as DM, not group channels with 2 members
            const exactMatch = existingChannels.find(channel => {
              const channelMemberIds = Object.keys(channel.state.members).sort();
              const isExactMemberMatch = channelMemberIds.length === 2 && 
                     channelMemberIds[0] === sortedMembers[0] && 
                     channelMemberIds[1] === sortedMembers[1];
              
              // Also check that the channel is marked as a DM
              // @ts-ignore - isDM is a custom field we add to channel data
              const isMarkedAsDM = channel.data?.isDM === true;
              
              return isExactMemberMatch && isMarkedAsDM;
            });
    
            // If a DM already exists, return it instead of creating a new one
            if (exactMatch) {
              console.log('[chat-routes.ts]: Found existing DM channel:', exactMatch.id);
              
              return res.status(200).json({
                success: true,
                channelId: exactMatch.id,
                message: 'Using existing DM channel',
                existing: true
              });
            }
          } catch (queryError) {
            console.warn('[chat-routes.ts]: Error querying for existing DM:', queryError);
            // Continue to create new channel if query fails
          }
        }
        
        // Create new channel if no existing DM found (or if it's a group channel)
        const shortId = Math.random().toString(36).substring(2, 8);
        const channelId = isDM ? `dm_${shortId}` : `group_${shortId}`;
        
        const channelData = {
          // For DM channels, don't set a name - it will be determined dynamically per user
          // For group channels, use the provided name
          name: isDM ? undefined : channelName,
          created_by_id: userId,
          members: members,
          isDM: isDM,
          channelType: 'chat' // Mark as regular chat channel
        };
    
        const channel = client.channel('messaging', channelId, channelData);
        await channel.create();
        console.log('[chat-routes.ts]: Created new channel:', channel.id);
    
        return res.status(200).json({
          success: true,
          channelId: channel.id,
          message: 'Channel created successfully',
          existing: false
        });
      } catch (error) {
        console.error('[chat-routes.ts]: Error creating channel:', error);
        return res.status(500).json({ 
          error: 'Failed to create channel',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (type === 'add-to-general') {
      
      let channel: Channel;
      let channelJustCreated = false;
    
      try {
        channel = client.channel('messaging', 'general', {
          // @ts-ignore
          name: 'General',
          created_by_id: userId
        });

        await channel.query();

      } catch (queryError) {
        if (
          queryError.code === 16 ||
          (queryError.message && (queryError.message.includes('does not exist') || queryError.message.includes("Can't find channel")))
        ) {
          try {
            channel = client.channel('messaging', 'general', {
              // @ts-ignore
              name: 'General',
              members: [userId],
              created_by_id: userId,
              channelType: 'chat' // Mark as regular chat channel
            });
            await channel.create();
            channelJustCreated = true;
          } catch (createError) {
            console.error('[chat-routes.ts]: Failed to create general channel:', createError);
            return res.status(500).json({
              error: "General channel does not exist and could not be created",
              message: createError instanceof Error ? createError.message : String(createError)
            });
          }
        } else {
          console.error('[chat-routes.ts]: Error querying general channel:', queryError);
          return res.status(500).json({
            error: "General channel lookup failed",
            message: queryError instanceof Error ? queryError.message : String(queryError)
          });
        }
      }
    
      if (!channelJustCreated) {
        try {
          await channel.addMembers([userId]);
        } catch (error) {
          console.error('[chat-routes.ts]: Error adding user to general:', error);
          return res.status(500).json({ 
            error: 'Failed to add user to general channel',
            details: error instanceof Error ? error.message : String(error)
          });
        }
      }
    
      return res.status(200).json({
        success: true,
        message: channelJustCreated 
          ? 'General channel created successfully' 
          : 'User added to general channel successfully'
      });
    }

    if (type === 'leave-channel') {
      
      if (!channelId) {
        return res.status(400).json({ error: 'channelId is required for leave-channel' });
      }

      try {
        const channel = client.channel('messaging', channelId);
        await channel.removeMembers([userId]);

        return res.status(200).json({
          success: true,
          message: 'User removed from channel successfully'
        });
      } catch (error) {
        console.error('[chat-routes.ts]: Error removing user from channel:', error);  
        return res.status(500).json({ 
          error: 'Failed to remove user from channel',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

  } catch (error) {
    console.error('[chat-routes.ts]: Critical error:', {
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
