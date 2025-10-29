import { generateSampleUsers } from './sample-users.js';

export async function resetChat(client) {
  try {
    const channelsResponse = await client.queryChannels({
      type: 'messaging',
    });

    for (const channel of channelsResponse) {
      try {
        if (channel.id === 'general') {
          await channel.truncate();
        } else {
          await channel.delete({ hard_delete: true });
        }
      } catch (error) {
        console.error('Error deleting channel:', error);
      }
    }

    const livestreamChannels = await client.queryChannels({
      type: 'livestream',
    });

    for (const channel of livestreamChannels) {
      try {
        await channel.delete({ hard_delete: true });
      } catch (error) {
        console.error('Error deleting livestream channel:', error);
      }
    }

    // Delete anonymous viewers (users starting with "viewer_")
    try {
      console.log('🧹 Checking for anonymous viewers to delete...');
      const usersResponse = await client.queryUsers({
        id: { $autocomplete: 'viewer_' }
      });

      const anonymousViewers = usersResponse.users.filter(user => user.id.startsWith('viewer_'));
      
      if (anonymousViewers.length > 0) {
        console.log(`🧹 Found ${anonymousViewers.length} anonymous viewers to delete:`, anonymousViewers.map(u => u.id));
        
        const deletePromises = anonymousViewers.map(user => 
          client.deleteUser(user.id, { 
            mark_messages_deleted: true,
            hard_delete: true 
          }).catch(error => {
            console.error(`❌ Error deleting anonymous viewer ${user.id}:`, error);
            return null;
          })
        );

        await Promise.all(deletePromises);
        console.log(`✅ Successfully deleted ${anonymousViewers.length} anonymous viewers`);
      } else {
        console.log('✓ No anonymous viewers found');
      }
    } catch (error) {
      console.error('⚠️ Error deleting anonymous viewers during reset:', error);
      // Don't fail the entire reset if this fails
    }

    return { success: true, message: 'Chat reset completed' };
  } catch (error) {
    console.error('Error resetting chat:', error);
    throw error;
  }
}

export async function seedChat(client, currentUserId) {
  try {
    const sampleUsers = generateSampleUsers();
    await client.upsertUsers(sampleUsers);

    const allUserIds = [...sampleUsers.map((u) => u.id), currentUserId];

    const groupChannelId = 'general';
    const groupChannel = client.channel('messaging', groupChannelId, {
      name: 'General',
      created_by_id: currentUserId,
      members: allUserIds,
      isDM: false,
      channelType: 'chat',
    });
    
    try {
      await groupChannel.query();
      await groupChannel.addMembers(allUserIds);
    } catch (error) {
      if (error.message?.includes('does not exist') || error.code === 16) {
        await groupChannel.create();
      } else {
        throw error;
      }
    }

    await groupChannel.sendMessage({
      text: 'Welcome to the General channel! 👋',
      user_id: currentUserId,
    }); 

    const dmChannels = [];
    for (const sampleUser of sampleUsers) {
      const dmChannelId = `dm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const dmChannel = client.channel('messaging', dmChannelId, {
        name: undefined,
        created_by_id: currentUserId,
        members: [currentUserId, sampleUser.id],
        isDM: true,
        channelType: 'chat',
      });
      await dmChannel.create();
      dmChannels.push(dmChannelId);

      await dmChannel.sendMessage({
        text: `Hi! I'm ${sampleUser.name}. Nice to meet you!`,
        user_id: sampleUser.id,
      });
    }

    return { success: true, message: 'Chat seeded', data: { dmChannels } };
  } catch (error) {
    console.error('Error seeding chat:', error);
    throw error;
  }
}

