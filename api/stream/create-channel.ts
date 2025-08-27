import { StreamChat } from 'stream-chat';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Configure multer for handling file uploads
// Note: Vercel doesn't support multer directly, so we'll handle multipart data manually
// or use a different approach for file uploads

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🏗️ Create channel request started');
    console.log('🔑 Environment check:');
    console.log(`   - STREAM_API_KEY: ${process.env.STREAM_API_KEY ? 'Set' : 'NOT SET'}`);
    console.log(`   - STREAM_API_SECRET: ${process.env.STREAM_API_SECRET ? 'Set' : 'NOT SET'}`);
    console.log(`   - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

    // Get Stream API credentials
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('❌ Missing Stream API credentials');
      return res.status(500).json({ 
        error: 'Stream API credentials not configured. Check your environment variables.' 
      });
    }

    // Validate API key format (basic check)
    if (apiKey.length < 10 || apiSecret.length < 10) {
      console.error('❌ Invalid Stream API credentials format');
      return res.status(500).json({ 
        error: 'Invalid API credentials format',
        details: 'API credentials appear to be malformed'
      });
    }

    console.log('✅ Stream API credentials validated');

    // Initialize Stream Chat client
    const streamClient = new StreamChat(apiKey, apiSecret);

    // For Vercel deployment, we'll need to handle multipart form data differently
    // Since multer isn't available, we'll need to either:
    // 1. Use a different file upload approach
    // 3. Use a cloud storage service

    // For now, let's handle the case where image data is sent as base64 in the request body
    const { channelName, selectedUsers, currentUserId, isDM, channelImage } = req.body;
    
    console.log('🏗️ Creating new channel:', channelName);
    console.log('👥 Selected users:', selectedUsers);
    console.log('👤 Current user ID:', currentUserId);
    
    if (!channelName || !selectedUsers || !currentUserId) {
      return res.status(400).json({ 
        error: 'Channel name, selected users, and current user ID are required',
        received: { channelName, selectedUsers, currentUserId }
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
      name: channelName,
      members: allMembers,
      created_by_id: currentUserId,
      image: channelImage || undefined
    };

    // Create the channel using Stream Chat
    // Let Stream auto-generate the channel ID by passing null as second parameter
    const channel = streamClient.channel('messaging', null, channelData);

    await channel.create();

    console.log('✅ Channel created successfully:', channel.id);

    res.json({
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
    
  } catch (error) {
    console.error('❌ Error creating channel:', error);
    res.status(500).json({ 
      error: 'Failed to create channel',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
