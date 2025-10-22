import { generateSampleUsers } from './sample-users.js';

/**
 * Reset Chat - Delete all channels (keep users intact)
 * 
 * This function only deletes channels. Sample users are permanent and never deleted.
 * They will be reused/updated during seeding.
 * 
 * @param {import('stream-chat').StreamChat} client 
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function resetChat(client) {
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
      } catch (error) {
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
      } catch (error) {
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
 * Seed Chat - Create sample users and channels
 * 
 * @param {import('stream-chat').StreamChat} client 
 * @param {string} currentUserId
 * @returns {Promise<{success: boolean, message: string, data: any}>}
 */
export async function seedChat(client, currentUserId) {
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
    });
    
    try {
      // Try to query the existing channel first
      await groupChannel.query();
      console.log(`✅ Reusing existing general channel`);
      
      // Update members to include everyone
      await groupChannel.addMembers(allUserIds);
      console.log(`✅ Updated general channel members`);
    } catch (error) {
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
    const dmChannels = [];
    for (const sampleUser of sampleUsers) {
      const dmChannelId = `dm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const dmChannel = client.channel('messaging', dmChannelId, {
        name: undefined, // DMs don't have names
        created_by_id: currentUserId,
        members: [currentUserId, sampleUser.id],
        isDM: true,
        channelType: 'chat',
      });
      await dmChannel.create();
      dmChannels.push(dmChannelId);
      console.log(`✅ Created DM channel with ${sampleUser.name}: ${dmChannelId}`);

      // Send an initial message in the DM
      await dmChannel.sendMessage({
        text: `Hi! I'm ${sampleUser.name}. Nice to meet you!`,
        user_id: sampleUser.id,
      });
    }

    console.log('✅ Chat seeding completed successfully');
    return { success: true, message: 'Chat seeded', data: { dmChannels } };
  } catch (error) {
    console.error('❌ Error during Chat seeding:', error);
    throw error;
  }
}

