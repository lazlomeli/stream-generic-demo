import express from 'express';
import { Channel, StreamChat } from 'stream-chat';

const router = express.Router();

let streamClient: StreamChat;

export function initializeChatRoutes(streamChatClient: StreamChat) {
  streamClient = streamChatClient;
  return router;
}

/**
 * Helper function to generate sample user data
 */
function generateSampleUsers() {
  return [
    {
      id: 'sample_alice_2025',
      name: 'Alice Johnson',
      role: 'user',
      image: 'https://getstream.io/random_png/?name=Alice',
    },
    {
      id: 'sample_bob_2025',
      name: 'Bob Smith',
      role: 'user',
      image: 'https://getstream.io/random_png/?name=Bob',
    },
    {
      id: 'sample_charlie_2025',
      name: 'Charlie Brown',
      role: 'user',
      image: 'https://getstream.io/random_png/?name=Charlie',
    },
    {
      id: 'sample_diana_2025',
      name: 'Diana Prince',
      role: 'user',
      image: 'https://getstream.io/random_png/?name=Diana',
    },
    {
      id: 'sample_eve_2025',
      name: 'Eve Martinez',
      role: 'user',
      image: 'https://getstream.io/random_png/?name=Eve',
    },
  ];
}

/**
 * Reset Chat - Delete all channels (keep users intact)
 * 
 * This function only deletes channels. Sample users are permanent and never deleted.
 * They will be reused/updated during seeding.
 */
async function resetChat(
  client: StreamChat
): Promise<{ success: boolean; message: string }> {
  try {
    console.log('🔄 Starting Chat reset...');
    console.log('ℹ️ Users will NOT be deleted - only channels will be cleaned up');

    // Delete all messaging channels EXCEPT "general" (which we'll just clean up)
    const channelsResponse = await client.queryChannels({
      type: 'messaging',
    });

    console.log(`📋 Found ${channelsResponse.length} messaging channels to process`);

    // Hard delete all channels except "general"
    for (const channel of channelsResponse) {
      try {
        if (channel.id === 'general') {
          // For general channel, just truncate messages instead of deleting
          await channel.truncate();
          console.log(`✅ Cleaned up general channel (preserved)`);
        } else {
          // Delete all other channels
          await channel.delete({ hard_delete: true });
          console.log(`✅ Deleted channel: ${channel.id}`);
        }
      } catch (error: any) {
        console.error(`❌ Error processing channel ${channel.id}:`, error.message);
      }
    }

    // Delete all livestream channels
    const livestreamChannels = await client.queryChannels({
      type: 'livestream',
    });

    console.log(`📺 Found ${livestreamChannels.length} livestream channels to delete`);

    for (const channel of livestreamChannels) {
      try {
        await channel.delete({ hard_delete: true });
        console.log(`✅ Deleted livestream channel: ${channel.id}`);
      } catch (error: any) {
        console.error(`❌ Error deleting livestream channel ${channel.id}:`, error.message);
      }
    }

    console.log('✅ Chat reset completed successfully (users preserved)');
    return { success: true, message: 'Chat reset completed' };
  } catch (error) {
    console.error('❌ Error during Chat reset:', error);
    throw error;
  }
}

/**
 * Seed Chat - Create sample users, channels, and messages
 */
async function seedChat(
  client: StreamChat, 
  currentUserId: string
): Promise<{ success: boolean; message: string; data: any }> {
  try {
    console.log('🌱 Starting Chat seeding...');

    // Create/update sample users (they're permanent, never deleted)
    const sampleUsers = generateSampleUsers();
    await client.upsertUsers(sampleUsers);
    console.log(`✅ Created/updated ${sampleUsers.length} sample users`);

    // Get all user IDs including the current user
    const allUserIds = [...sampleUsers.map((u) => u.id), currentUserId];

    // Setup the "General" group chat (reuse if exists, create if not)
    const groupChannelId = 'general';
    const groupChannel = client.channel('messaging', groupChannelId, {
      name: 'General',
      created_by_id: currentUserId,
      members: allUserIds,
      isDM: false,
      channelType: 'chat',
    } as any);
    
    try {
      // Try to query the existing channel first
      await groupChannel.query();
      console.log(`✅ Reusing existing general channel`);
      
      // Update members to include everyone
      await groupChannel.addMembers(allUserIds);
      console.log(`✅ Updated general channel members`);
    } catch (error: any) {
      // If channel doesn't exist, create it
      if (error.message?.includes('does not exist') || error.code === 16) {
        await groupChannel.create();
        console.log(`✅ Created new general channel`);
      } else {
        throw error;
      }
    }

    // Send a welcome message to the group
    await groupChannel.sendMessage({
      text: 'Welcome to the General channel! 👋',
      user_id: currentUserId,
    });

    // Create 1:1 DM channels between current user and each sample user
    const dmChannels: string[] = [];
    for (const sampleUser of sampleUsers) {
      const dmChannelId = `dm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const dmChannel = client.channel('messaging', dmChannelId, {
        name: undefined, // DMs don't have names
        created_by_id: currentUserId,
        members: [currentUserId, sampleUser.id],
        isDM: true,
        channelType: 'chat',
      } as any);
      await dmChannel.create();
      dmChannels.push(dmChannelId);
      console.log(`✅ Created DM channel with ${sampleUser.name}: ${dmChannelId}`);

      // Send an initial message in the DM
      await dmChannel.sendMessage({
        text: `Hi! I'm ${sampleUser.name}. Nice to meet you!`,
        user_id: sampleUser.id,
      } as any);

      // Small delay to ensure unique channel IDs
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    console.log('✅ Chat seeding completed successfully');
    return {
      success: true,
      message: 'Chat seeded successfully',
      data: {
        groupChannel: groupChannelId,
        dmChannels,
        sampleUsers: sampleUsers.map((u) => u.id),
      },
    };
  } catch (error) {
    console.error('❌ Error during Chat seeding:', error);
    throw error;
  }
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
  
      if (!selectedUsers) {
        return res.status(400).json({ error: 'selectedUsers is required for create-channel' });
      }
    
      if (!isDM && !channelName) {
        return res.status(400).json({ error: 'channelName is required for group channels' });
      }
    
      try {
        const parsedUsers = JSON.parse(selectedUsers);
        const members = [userId, ...parsedUsers].filter(Boolean);
        
        if (isDM && members.length === 2) {
          try {
            const sortedMembers = [...members].sort();
            
            const filters = {
              type: 'messaging',
              members: { $in: sortedMembers }
            };
            
            const existingChannels = await client.queryChannels(filters, {}, { limit: 20 });
            
            const exactMatch = existingChannels.find(channel => {
              const channelMemberIds = Object.keys(channel.state.members).sort();
              const isExactMemberMatch = channelMemberIds.length === 2 && 
                     channelMemberIds[0] === sortedMembers[0] && 
                     channelMemberIds[1] === sortedMembers[1];
              
              // @ts-ignore - isDM is a custom field added to channel data
              const isMarkedAsDM = channel.data?.isDM === true;
              
              return isExactMemberMatch && isMarkedAsDM;
            });
    
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
          }
        }
        
        const shortId = Math.random().toString(36).substring(2, 8);
        const channelId = isDM ? `dm_${shortId}` : `group_${shortId}`;
        
        const channelData = {
          name: isDM ? undefined : channelName,
          created_by_id: userId,
          members: members,
          isDM: isDM,
          channelType: 'chat'
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
              channelType: 'chat'
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

/**
 * API endpoint to reset Chat (delete all channels, keep users)
 */
router.post('/stream/reset', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    console.log(`🔄 [chat-routes.ts]: Reset and seed requested by user: ${userId}`);

    // Step 1: Reset (delete all channels, keep users)
    await resetChat(streamClient);

    // Step 2: Seed (create sample data)
    const seedResult = await seedChat(streamClient, userId);

    res.json({
      success: true,
      message: 'Chat reset and seeded successfully',
      data: seedResult.data,
    });
  } catch (error) {
    console.error('[chat-routes.ts]: Error in reset-and-seed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * API endpoint to only seed Chat (without reset)
 */
router.post('/stream/seed', async (req, res) => {
  try {
    const { userId } = req.body; 

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    console.log(`🌱 [chat-routes.ts]: Seed requested by user: ${userId}`);

    const result = await seedChat(streamClient, userId);
    res.json(result);
  } catch (error) {
    console.error('[chat-routes.ts]: Error in seed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
