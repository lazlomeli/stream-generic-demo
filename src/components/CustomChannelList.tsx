import React, { useState, useCallback, useEffect } from 'react';
import { useChatContext, ChannelList as StreamChannelList } from 'stream-chat-react';
import CreateChannelModal from './CreateChannelModal';
import CustomChannelPreview from './CustomChannelPreview';
import usersGroupIcon from '../icons/users-group.svg';
import userIcon from '../icons/user.svg';
import sendIcon from '../icons/send.svg';
import './CustomChannelList.css';

interface CustomChannelListProps {
  filters: any;
  sort: any;
  options: any;
  initialChannelId?: string;
}

const CustomChannelList: React.FC<CustomChannelListProps> = (props) => {
  const { filters, sort, options } = props;
  const { client, setActiveChannel } = useChatContext();
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateDMModal, setShowCreateDMModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<Array<{
    id: string;
    name: string;
    image?: string;
  }>>([]);

  // Fetch users for both group and DM creation (cached to avoid repeated API calls)
  const fetchUsers = useCallback(async () => {
    // If we already have users cached, don't fetch again
    if (availableUsers.length > 0) {
      console.log('📋 Using cached user list');
      return availableUsers;
    }
    
    try {
      console.log('👥 Fetching users from Stream API...');
      const users = await client.queryUsers(
        {},
        { id: 1 },
        { limit: 50 }
      );

      const userList = users.users
        .filter(user => user.id !== client.userID)
        .map(user => ({
          id: user.id,
          name: user.name || user.id,
          image: user.image
        }));

      console.log(`✅ Fetched ${userList.length} users`);
      setAvailableUsers(userList);
      return userList;
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, [client, availableUsers]);

  const handleCreateGroupClick = useCallback(async () => {
    if (availableUsers.length === 0) {
      await fetchUsers();
    }
    setShowCreateGroupModal(true);
  }, [fetchUsers, availableUsers.length]);

  const handleCreateDMClick = useCallback(async () => {
    if (availableUsers.length === 0) {
      await fetchUsers();
    }
    setShowCreateDMModal(true);
  }, [fetchUsers, availableUsers.length]);

  const handleChannelCreated = useCallback(async (channelId: string) => {
    console.log('🎉 Channel created/opened, ID:', channelId);

    setShowCreateGroupModal(false);
    setShowCreateDMModal(false);

    // Watch the channel and set it as active to open it immediately
    try {
      const newChannel = client.channel('messaging', channelId);
      await newChannel.watch();
      
      // Set as active channel to open it immediately
      setActiveChannel(newChannel);
      
      console.log('✅ Channel watched and opened successfully');
    } catch (error) {
      console.error('❌ Error setting up channel:', error);
    }
  }, [client, setActiveChannel]);

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

      {/* Stream's Built-in Channel List with Custom Preview */}
      <div className="stream-channel-list">
        <StreamChannelList 
          filters={filters}
          sort={sort}
          options={options}
          Preview={CustomChannelPreview}
          showChannelSearch
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
