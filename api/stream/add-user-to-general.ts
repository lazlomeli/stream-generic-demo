import { StreamChat } from 'stream-chat';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Get Stream API key and secret from environment variables
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('Missing Stream API credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Initialize Stream Chat client with server credentials
    const streamClient = new StreamChat(apiKey, apiSecret);

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
      
      res.status(200).json({
        success: true,
        message: 'User added to general channel'
      });
    } catch (error: any) {
      console.error('❌ Error with general channel operation:', error);
      
      // Check if the channel doesn't exist (common Stream error codes)
      if (error.code === 4 || error.code === 17 || error.message?.includes('does not exist') || error.message?.includes('not found')) {
        console.error(`❌ General channel does not exist. Run /api/stream/seed to create it.`);
        return res.status(404).json({
          error: 'General channel does not exist',
          message: 'The general channel needs to be created. Please run the seed endpoint first.',
          suggestion: 'POST to /api/stream/seed to initialize channels and users'
        });
      }
      
      // For any other error (including add member failures), return the actual error
      console.error(`❌ Unexpected error with general channel:`, error);
      res.status(500).json({
        error: 'Failed to process general channel operation',
        details: error.message,
        code: error.code || 'unknown'
      });
    }

  } catch (error) {
    console.error('Error in add-user-to-general:', error);
    res.status(500).json({ error: 'Failed to add user to general channel' });
  }
}
