import React, { useState, useCallback, useEffect } from 'react';
import { useChatContext, ChannelList as StreamChannelList } from 'stream-chat-react';
import CreateChannelModal from './CreateChannelModal';
import CustomChannelPreview from './CustomChannelPreview';
import usersGroupIcon from '../icons/users-group.svg';
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

  const fetchUsers = useCallback(async () => {
    if (availableUsers.length > 0) {
      return availableUsers;
    }
    
    if (!client.userID) {
      console.warn('[CustomChannelList.tsx]: Cannot fetch users - client.userID not available');
      return [];
    }
    
    try {
      console.log('[CustomChannelList.tsx]: Fetching users, current user:', client.userID);
      
      const users = await client.queryUsers(
        {},
        { id: 1 },
        { limit: 50 }
      );

      const userList = users.users
        .filter(user => {
          const shouldInclude = user.id !== client.userID;
          if (!shouldInclude) {
            console.log('[CustomChannelList.tsx]: Filtering out current user:', user.id);
          }
          return shouldInclude;
        })
        .map(user => ({
          id: user.id,
          name: user.name || user.id,
          image: user.image
        }));

      console.log(`[CustomChannelList.tsx]: Fetched ${userList.length} users (excluding self)`);
      setAvailableUsers(userList);
      return userList;
    } catch (error) {
      console.error('[CustomChannelList.tsx]: Error fetching users:', error);
      return [];
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
    setShowCreateGroupModal(false);
    setShowCreateDMModal(false);

    try {
      const newChannel = client.channel('messaging', channelId);
      await newChannel.watch();
      
      setActiveChannel(newChannel);
      
    } catch (error) {
      console.error('[CustomChannelList.tsx]: Error setting up channel:', error);
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

      <div className="stream-channel-list">
        <StreamChannelList 
          filters={filters}
          sort={sort}
          options={options}
          Preview={CustomChannelPreview}
          showChannelSearch
        />
      </div>

      <CreateChannelModal
        isOpen={showCreateGroupModal}
        onClose={handleCloseGroupModal}
        onChannelCreated={handleChannelCreated}
        availableUsers={availableUsers}
        currentUserId={client.userID}
      />

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
