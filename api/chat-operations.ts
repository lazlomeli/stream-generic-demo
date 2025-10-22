import { StreamChat } from 'stream-chat';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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
    const { type } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'type is required' });
    }

    if (!['create-channel', 'add-to-general', 'create-livestream-channel', 'leave-channel', 'cleanup-livestream-channel'].includes(type)) {
      return res.status(400).json({ error: 'type must be "create-channel", "add-to-general", "create-livestream-channel", "leave-channel", or "cleanup-livestream-channel"' });
    }

    // Get Stream API credentials
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('Missing Stream API credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Initialize Stream Chat client
    const streamClient = new StreamChat(apiKey, apiSecret);

    // Handle channel creation
    if (type === 'create-channel') {
      console.log('🏗️ Create channel request started');
      console.log('🔑 Environment check:');
      console.log(`   - STREAM_API_KEY: ${apiKey ? 'Set' : 'NOT SET'}`);
      console.log(`   - STREAM_API_SECRET: ${apiSecret ? 'Set' : 'NOT SET'}`);
      console.log(`   - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

      // Validate API key format (basic check)
      if (apiKey.length < 10 || apiSecret.length < 10) {
        console.error('❌ Invalid Stream API credentials format');
        return res.status(500).json({ 
          error: 'Invalid API credentials format',
          details: 'API credentials appear to be malformed'
        });
      }

      console.log('✅ Stream API credentials validated');

      const { channelName, selectedUsers, currentUserId, isDM, channelImage } = req.body;
      
      console.log('🏗️ Creating new channel:', channelName);
      console.log('👥 Selected users:', selectedUsers);
      console.log('👤 Current user ID:', currentUserId);
      console.log('📝 Is DM:', isDM);
      
      // Validate required fields
      if (!selectedUsers || !currentUserId) {
        return res.status(400).json({ 
          error: 'Selected users and current user ID are required',
          received: { channelName, selectedUsers, currentUserId }
        });
      }
      
      // For group channels, channel name is required
      if (!isDM && !channelName) {
        return res.status(400).json({ 
          error: 'Channel name is required for group channels',
          received: { channelName, isDM }
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

      // Prepare channel data
      const channelData = {
        // For DM channels, don't set a name - it will be determined dynamically per user
        // For group channels, use the provided name
        name: isDM ? undefined : channelName,
        members: allMembers,
        created_by_id: currentUserId,
        image: channelImage || undefined,
        channelType: 'chat' // Mark as regular chat channel
      };

      // Create the channel using Stream Chat
      // Let Stream auto-generate the channel ID by passing null as second parameter
      const channel = streamClient.channel('messaging', null, channelData);

      await channel.create();

      console.log('✅ Channel created successfully:', channel.id);

      return res.json({
        success: true,
        message: isDM ? 'Direct message started successfully' : 'Channel created successfully',
        channelId: channel.id,
        channel: {
          id: channel.id,
          name: channelName,
          members: allMembers,
          created_by_id: currentUserId,
          image: channelImage,
          isDM: isDM
        }
      });
    }

    // Handle adding user to general channel
    if (type === 'add-to-general') {
      const { user } = req.body;

      const userId = user.nickname;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      // First, try to check if the general channel exists by attempting to query/watch it.
      let general;
      try {
        general = streamClient.channel("messaging", "general");
        await general.watch();
      } catch (error: any) {
        // If channel doesn't exist, create it
        if (
          error.code === 16 ||
          error.code === 4 ||
          error.code === 17 ||
          (error.message && (
            error.message.includes("does not exist") ||
            error.message.includes("not found") ||
            error.message.includes("Can't find channel")
          ))
        ) {
          // Channel does not exist, so create it
          try {
            general = streamClient.channel("messaging", "general", {
              name: "General",
              members: [userId],
              created_by_id: userId,
              channelType: 'chat' // Mark as regular chat channel
            } as any);
            await general.create();
            console.log('🌱 General channel created');
            // The user is already a member (since we set members above)
            return res.status(200).json({
              success: true,
              message: 'General channel created and user added as member'
            });
          } catch (createError: any) {
            console.error('❌ Failed to create general channel:', createError);
            return res.status(404).json({
              error: 'General channel does not exist and could not be created',
              message: createError.message || String(createError)
            });
          }
        } else {
          // Unexpected error trying to access the channel
          throw error;
        }
      }
      try {
        // Get the general channel and watch it to get current state
        const general = streamClient.channel("messaging", "general");
        await general.watch();
        
        // Check if user is already a member
        const currentMembers = Object.keys(general.state.members || {});
        const isAlreadyMember = currentMembers.includes(userId);
        
        if (isAlreadyMember) {
          console.log(`✅ User ${userId} is already a member of general channel`);
          return res.status(200).json({
            success: true,
            message: 'User already has access to general channel'
          });
        }
        
        // Add the user to the general channel
        await general.addMembers([userId]);
        
        console.log(`✅ Successfully added user ${userId} to general channel`);
        
        return res.status(200).json({
          success: true,
          message: 'User added to general channel'
        });
        
      } catch (error: any) {
        console.error('❌ Error with general channel operation:', error);
        
        // Check if the channel doesn't exist (common Stream error codes)
        // if (error.code === 4 || error.code === 17 || error.message?.includes('does not exist') || error.message?.includes('not found')) {
        //   console.error(`❌ General channel does not exist. Run /api/stream/seed to create it.`);
        //   return res.status(404).json({
        //     error: 'General channel does not exist',
        //     message: 'The general channel needs to be created. Please run the seed endpoint first.',
        //     suggestion: 'POST to /api/stream/seed to initialize channels and users'
        //   });
        // }
        
        // For any other error (including add member failures), return the actual error
        console.error(`❌ Unexpected error with general channel:`, error);
        return res.status(500).json({
          error: 'Failed to process general channel operation',
          details: error.message,
          code: error.code || 'unknown'
        });
      }
    }

    // Handle livestream channel creation
    if (type === 'create-livestream-channel') {
      const { channelId, userId } = req.body;

      if (!channelId || !userId) {
        return res.status(400).json({ error: 'channelId and userId are required' });
      }

      try {
        console.log(`🔴 Creating livestream channel: ${channelId} for user: ${userId}`);
        
        // Create livestream channel with user as member
        // Use 'livestream' type for better viewer permissions
        const channel = streamClient.channel('livestream', channelId, {
          members: [userId], // Add user as member
          created_by_id: userId,
          created_by: { id: userId }, // Ensure both created_by and created_by_id are set for server-side auth
          channelType: 'livestream' // Mark as livestream channel
        } as any);

        await channel.create();
        console.log(`✅ Successfully created livestream channel: ${channelId}`);

          return res.status(200).json({
            success: true,
            message: 'Livestream channel created successfully',
            channelId: channelId,
            channel: {
              id: channelId,
              type: 'livestream',
              members: [userId],
              created_by_id: userId
            }
          });

      } catch (error: any) {
        console.error(`❌ Error creating livestream channel ${channelId}:`, error);
        
        // If channel already exists, that's OK - just return success
        if (error.code === 4 || error.message?.includes('already exists')) {
          console.log(`✅ Livestream channel ${channelId} already exists - adding user as member`);
          
          try {
            // Get existing channel and ensure user is a member
            const existingChannel = streamClient.channel('livestream', channelId);
            await existingChannel.watch();
            
            // Check if user is already a member
            const currentMembers = Object.keys(existingChannel.state.members || {});
            if (!currentMembers.includes(userId)) {
              await existingChannel.addMembers([userId]);
              console.log(`✅ Added user ${userId} to existing livestream channel`);
            } else {
              console.log(`✅ User ${userId} is already a member of livestream channel`);
            }
            
            return res.status(200).json({
              success: true,
              message: 'Livestream channel ready (already existed)',
              channelId: channelId,
              channel: {
                id: channelId,
                type: 'livestream',
                members: currentMembers.includes(userId) ? currentMembers : [...currentMembers, userId],
                created_by_id: userId
              }
            });
            
          } catch (addMemberError) {
            console.error(`❌ Failed to add user to existing channel:`, addMemberError);
            return res.status(500).json({
              error: 'Failed to join existing livestream channel',
              details: addMemberError instanceof Error ? addMemberError.message : String(addMemberError)
            });
          }
        }
        
        // For any other error, return failure
        return res.status(500).json({
          error: 'Failed to create livestream channel',
          details: error.message || String(error),
          code: error.code || 'unknown'
        });
      }
    }

    // Handle leaving a channel
    if (type === 'leave-channel') {
      const { channelId, userId } = req.body;

      if (!channelId || !userId) {
        return res.status(400).json({ error: 'channelId and userId are required' });
      }

      try {
        console.log(`👋 User ${userId} leaving channel: ${channelId}`);
        
        // Get the channel
        const channel = streamClient.channel('messaging', channelId);
        await channel.watch();
        
        // Check if user is a member of the channel
        const members = channel.state?.members || {};
        if (!members[userId]) {
          return res.status(400).json({ 
            error: 'User is not a member of this channel',
            channelId,
            userId
          });
        }
        
        // Check if this is the last member
        const memberCount = Object.keys(members).length;
        if (memberCount === 1) {
          // If this is the last member, delete the channel entirely
          console.log(`🗑️ Deleting channel ${channelId} as ${userId} is the last member`);
          await channel.delete();
          
          return res.status(200).json({
            success: true,
            message: 'Channel deleted as you were the last member',
            channelId,
            deleted: true
          });
        } else {
          // Remove the user from the channel
          await channel.removeMembers([userId]);
          console.log(`✅ Successfully removed user ${userId} from channel ${channelId}`);
          
          return res.status(200).json({
            success: true,
            message: 'Successfully left the channel',
            channelId,
            deleted: false,
            remainingMembers: memberCount - 1
          });
        }
        
      } catch (error: any) {
        console.error(`❌ Error leaving channel ${channelId}:`, error);
        
        return res.status(500).json({
          error: 'Failed to leave channel',
          details: error.message || String(error),
          code: error.code || 'unknown'
        });
      }
    }

    // Handle livestream channel cleanup (destroy when stream ends)
    if (type === 'cleanup-livestream-channel') {
      const { channelId, userId } = req.body;

      if (!channelId || !userId) {
        return res.status(400).json({ error: 'channelId and userId are required' });
      }

      try {
        console.log(`🧹 Cleaning up livestream channel: ${channelId} for user: ${userId}`);
        
        // Get the livestream channel with proper created_by information
        const channel = streamClient.channel('livestream', channelId, {
          created_by_id: userId,
          created_by: { id: userId }
        });
        
        // Delete the channel directly - if user doesn't have permission, the delete will fail with proper error
        await channel.delete();
        console.log(`✅ Successfully deleted livestream channel: ${channelId}`);

        return res.status(200).json({
          success: true,
          message: 'Livestream channel deleted successfully',
          channelId: channelId
        });

      } catch (error: any) {
        console.error(`❌ Error cleaning up livestream channel ${channelId}:`, error);
        
        // If channel doesn't exist, that's OK - already cleaned up
        if (error.code === 16 || error.message?.includes('does not exist') || error.message?.includes("Can't find channel")) {
          console.log(`⚠️ Livestream channel ${channelId} doesn't exist, already cleaned up`);
          return res.status(200).json({
            success: true,
            message: 'Livestream channel already cleaned up (did not exist)',
            channelId: channelId
          });
        }
        
        // Handle rate limiting gracefully
        if (error.code === 9 && error.status === 429) {
          console.log(`⏳ Rate limited on cleanup for ${channelId}, treating as success`);
          return res.status(200).json({
            success: true,
            message: 'Cleanup skipped due to rate limiting (channel likely already cleaned up)',
            channelId: channelId
          });
        }
        
        // For any other error, return failure but don't block the user
        return res.status(500).json({
          error: 'Failed to cleanup livestream channel',
          details: error.message || String(error),
          code: error.code || 'unknown'
        });
      }
    }

  } catch (error) {
    console.error('❌ Error in chat-operations handler:', error);
    return res.status(500).json({ 
      error: 'Failed to process chat operation',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
