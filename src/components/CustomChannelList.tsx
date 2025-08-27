import React, { useState, useCallback, useEffect } from 'react';
import { useChatContext } from 'stream-chat-react';
import CreateChannelModal from './CreateChannelModal';
import ChannelList from './ChannelList';
import { listMyChannels, ChannelItem } from '../hooks/listMyChannels';
import usersGroupIcon from '../icons/users-group.svg';
import sendIcon from '../icons/send.svg';
import './CustomChannelList.css';

interface CustomChannelListProps {
  filters: any;
  sort: any;
  options: any;
}

const CustomChannelList: React.FC<CustomChannelListProps> = (props) => {
  const { client, setActiveChannel } = useChatContext();
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateDMModal, setShowCreateDMModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Add refresh key
  const [availableUsers, setAvailableUsers] = useState<Array<{
    id: string;
    name: string;
    image?: string;
  }>>([]);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');

  // Function to load channels
  const loadChannels = useCallback(async () => {
    if (!client.userID) return;
    try {
      const channelData = await listMyChannels(client, client.userID);
      setChannels(channelData);
      
      // If no channel is selected and we have channels, select the first one
      if (!selectedChannelId && channelData.length > 0) {
        const firstChannel = channelData[0];
        setSelectedChannelId(firstChannel.id);
        
        // Set the first channel as active
        try {
          const channel = client.channel('messaging', firstChannel.id);
          await channel.watch();
          setActiveChannel(channel);
          console.log(`✅ Auto-selected first channel: ${firstChannel.name}`);
        } catch (error) {
          console.error('❌ Error auto-selecting first channel:', error);
        }
      }
    } catch (error) {
      console.error('Error loading channels:', error);
    }
  }, [client, selectedChannelId, setActiveChannel]);

  // Function to force refresh the channel list when a new channel is created
  const refreshChannelList = useCallback(() => {
    setRefreshKey(prev => prev + 1);
    loadChannels(); // Reload channels when refreshing
  }, [loadChannels]);

  // Load channels on mount and when refresh key changes
  useEffect(() => {
    loadChannels();
  }, [loadChannels, refreshKey]);

  // Handle channel selection
  const handleChannelSelect = useCallback(async (channelId: string) => {
    setSelectedChannelId(channelId);
    
    try {
      // Get the channel and watch it to make it active
      const channel = client.channel('messaging', channelId);
      await channel.watch();
      
      // Set the active channel in Stream Chat context - this will show messages on the right
      setActiveChannel(channel);
      
      console.log(`✅ Selected channel: ${channelId}`);
    } catch (error) {
      console.error('❌ Error selecting channel:', error);
    }
  }, [client, setActiveChannel]);



  // Fetch users for both group and DM creation
  const fetchUsers = useCallback(async () => {
    try {
      const users = await client.queryUsers(
        {},
        { id: 1 },
        { limit: 100 }
      );

      const userList = users.users
        .filter(user => user.id !== client.userID)
        .map(user => ({
          id: user.id,
          name: user.name || user.id,
          image: user.image
        }));

      setAvailableUsers(userList);
      return userList;
    } catch (error) {
      console.error('Error fetching users:', error);
      // Fallback to demo users if we can't fetch from Stream
      const fallbackUsers = [
        {
          id: 'alice_smith',
          name: 'Alice Smith',
          image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face'
        },
        {
          id: 'bob_johnson',
          name: 'Bob Johnson',
          image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
        },
        {
          id: 'carol_williams',
          name: 'Carol Williams',
          image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face'
        },
        {
          id: 'david_brown',
          name: 'David Brown',
          image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
        },
        {
          id: 'emma_davis',
          name: 'Emma Davis',
          image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face'
        }
      ];
      setAvailableUsers(fallbackUsers);
      return fallbackUsers;
    }
  }, [client]);

  const handleCreateGroupClick = useCallback(async () => {
    await fetchUsers();
    setShowCreateGroupModal(true);
  }, [fetchUsers]);

  const handleCreateDMClick = useCallback(async () => {
    await fetchUsers();
    setShowCreateDMModal(true);
  }, [fetchUsers]);

  const handleChannelCreated = useCallback(async (channelId: string) => {
    console.log('✅ Channel created:', channelId);
    setShowCreateGroupModal(false);
    setShowCreateDMModal(false);
    
    try {
      // Watch the new channel to ensure the client is aware of it
      const newChannel = client.channel('messaging', channelId);
      await newChannel.watch();
      console.log('✅ Successfully watching new channel');
      
      // Set the new channel as selected and active
      setSelectedChannelId(channelId);
      setActiveChannel(newChannel);
      
      // Refresh the channel list once to show the new channel
      refreshChannelList();
      
    } catch (error) {
      console.error('❌ Error setting up new channel:', error);
      // Fallback to just refreshing if watching fails
      refreshChannelList();
    }
  }, [refreshChannelList, client, setActiveChannel]);

  const handleCloseGroupModal = useCallback(() => {
    setShowCreateGroupModal(false);
  }, []);

  const handleCloseDMModal = useCallback(() => {
    setShowCreateDMModal(false);
  }, []);

  return (
    <div className="custom-channel-list">
      {/* Create Channel Buttons */}
      <div className="create-channel-section">
        <button
          className="create-channel-button group-button"
          onClick={handleCreateGroupClick}
          title="Create new group"
        >
          <span className="create-channel-icon">+</span>
          <span className="create-channel-text">New Group</span>
          <img 
            src={usersGroupIcon}
            alt="Group"
            width="16" 
            height="16"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
        </button>
         
        <button
          className="create-channel-button dm-button"
          onClick={handleCreateDMClick}
          title="Start direct message"
        >
          <span className="create-channel-icon">+</span>
          <span className="create-channel-text">New DM</span>
          <img 
            src={sendIcon}
            alt="Direct Message"
            width="16" 
            height="16"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
        </button>
      </div>

      {/* Our Custom ChannelList with group avatar support */}
      <div className="stream-channel-list">
        <ChannelList 
          channels={channels}
          selectedChannel={selectedChannelId}
          onChannelSelect={handleChannelSelect}
        />
      </div>

      {/* Create Group Modal */}
      <CreateChannelModal
        isOpen={showCreateGroupModal}
        onClose={handleCloseGroupModal}
        onChannelCreated={handleChannelCreated}
        availableUsers={availableUsers}
        currentUserId={client.userID}
      />

      {/* Create DM Modal */}
      <CreateChannelModal
        isOpen={showCreateDMModal}
        onClose={handleCloseDMModal}
        onChannelCreated={handleChannelCreated}
        availableUsers={availableUsers}
        currentUserId={client.userID}
        isDM={true}
      />
    </div>
  );
};

export default CustomChannelList;
