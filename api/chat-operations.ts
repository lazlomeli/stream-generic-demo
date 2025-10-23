import { StreamChat } from 'stream-chat';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
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

    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('Missing Stream API credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const streamClient = new StreamChat(apiKey, apiSecret);

    if (type === 'create-channel') {

      if (apiKey.length < 10 || apiSecret.length < 10) {
        console.error('❌ Invalid Stream API credentials format');
        return res.status(500).json({ 
          error: 'Invalid API credentials format',
          details: 'API credentials appear to be malformed'
        });
      }


      const { channelName, selectedUsers, currentUserId, isDM, channelImage } = req.body;
      
      if (!selectedUsers || !currentUserId) {
        return res.status(400).json({ 
          error: 'Selected users and current user ID are required',
          received: { channelName, selectedUsers, currentUserId }
        });
      }
      
      if (!isDM && !channelName) {
        return res.status(400).json({ 
          error: 'Channel name is required for group channels',
          received: { channelName, isDM }
        });
      }

      let userIds;
      try {
        userIds = JSON.parse(selectedUsers);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid selected users format' });
      }

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'At least one user must be selected' });
      }

      const allMembers = [currentUserId, ...userIds];

      const channelData = {
        name: isDM ? undefined : channelName,
        members: allMembers,
        created_by_id: currentUserId,
        image: channelImage || undefined,
        channelType: 'chat'
      };

      const channel = streamClient.channel('messaging', null, channelData);

      await channel.create();

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

    if (type === 'add-to-general') {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      let general;
      try {
        general = streamClient.channel("messaging", "general");
        await general.watch();
      } catch (error: any) {
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
          try {
            general = streamClient.channel("messaging", "general", {
              name: "General",
              members: [userId],
              created_by_id: userId,
              channelType: 'chat'
            } as any);
            await general.create();
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
          throw error;
        }
      }
      try {
        const general = streamClient.channel("messaging", "general");
        await general.watch();
        
        const currentMembers = Object.keys(general.state.members || {});
        const isAlreadyMember = currentMembers.includes(userId);
        
        if (isAlreadyMember) {
          return res.status(200).json({
            success: true,
            message: 'User already has access to general channel'
          });
        }
        
        await general.addMembers([userId]);
        
        return res.status(200).json({
          success: true,
          message: 'User added to general channel'
        });
        
      } catch (error: any) {
        console.error('❌ Error with general channel operation:', error);
        
        
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
        const channel = streamClient.channel('livestream', channelId, {
          members: [userId],
          created_by_id: userId,
          created_by: { id: userId },
          channelType: 'livestream'
        } as any);

        await channel.create();

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

        if (error.code === 4 || error.message?.includes('already exists')) {
          try {
            const existingChannel = streamClient.channel('livestream', channelId);
            await existingChannel.watch();
            
            const currentMembers = Object.keys(existingChannel.state.members || {});
            if (!currentMembers.includes(userId)) {
              await existingChannel.addMembers([userId]);
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
        
        return res.status(500).json({
          error: 'Failed to create livestream channel',
          details: error.message || String(error),
          code: error.code || 'unknown'
        });
      }
    }

    if (type === 'leave-channel') {
      const { channelId, userId } = req.body;

      if (!channelId || !userId) {
        return res.status(400).json({ error: 'channelId and userId are required' });
      }

      try {
        const channel = streamClient.channel('messaging', channelId);
        await channel.watch();
        
        const members = channel.state?.members || {};
        if (!members[userId]) {
          return res.status(400).json({ 
            error: 'User is not a member of this channel',
            channelId,
            userId
          });
        }
        
        const memberCount = Object.keys(members).length;
        if (memberCount === 1) {
          await channel.delete();
          
          return res.status(200).json({
            success: true,
            message: 'Channel deleted as you were the last member',
            channelId,
            deleted: true
          });
        } else {
          await channel.removeMembers([userId]);
          
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

    if (type === 'cleanup-livestream-channel') {
      const { channelId, userId } = req.body;

      if (!channelId || !userId) {
        return res.status(400).json({ error: 'channelId and userId are required' });
      }

      try {
        const channel = streamClient.channel('livestream', channelId, {
          created_by_id: userId,
          created_by: { id: userId }
        });
        
        await channel.delete();

        return res.status(200).json({
          success: true,
          message: 'Livestream channel deleted successfully',
          channelId: channelId
        });

      } catch (error: any) {
        console.error(`❌ Error cleaning up livestream channel ${channelId}:`, error);
        
        if (error.code === 16 || error.message?.includes('does not exist') || error.message?.includes("Can't find channel")) {
          console.log(`⚠️ Livestream channel ${channelId} doesn't exist, already cleaned up`);
          return res.status(200).json({
            success: true,
            message: 'Livestream channel already cleaned up (did not exist)',
            channelId: channelId
          });
        }
        
        if (error.code === 9 && error.status === 429) {
          console.log(`⏳ Rate limited on cleanup for ${channelId}, treating as success`);
          return res.status(200).json({
            success: true,
            message: 'Cleanup skipped due to rate limiting (channel likely already cleaned up)',
            channelId: channelId
          });
        }
        
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
