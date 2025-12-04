import React, { useState, useCallback, useEffect } from 'react';
import { useChatContext, ChannelList as StreamChannelList, ChannelListProps } from 'stream-chat-react';
import type { Channel } from 'stream-chat';
import CreateChannelModal from './CreateChannelModal';
import CustomChannelPreview from './CustomChannelPreview';
import usersGroupIcon from '../icons/users-group.svg';
import sendIcon from '../icons/send-msg.svg';
import searchIcon from '../icons/search.svg';
import './CustomChannelList.css';

// interface CustomChannelListProps {
//   filters: any;
//   sort: any;
//   options: any;
//   initialChannelId?: string;
// }

interface CustomChannelListProps extends ChannelListProps {
  initialChannelId?: string;
}

// const CustomChannelList: React.FC<CustomChannelListProps> = (props) => {
const CustomChannelList: React.FC<CustomChannelListProps> = (props) => {
  const { filters, sort, options, EmptyStateIndicator } = props;
  const { client, setActiveChannel } = useChatContext();

  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateDMModal, setShowCreateDMModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState<Array<{
    id: string;
    name: string;
    image?: string;
  }>>([]);

  // Client-side filter function for search
  const channelRenderFilterFn = useCallback((channels: Channel[]) => {
    if (!searchQuery.trim()) {
      return channels;
    }
    
    const query = searchQuery.trim().toLowerCase();
    
    return channels.filter((channel) => {
      // Search by channel name
      // @ts-ignore
      const channelName = channel.data?.name?.toLowerCase();
      if (channelName?.includes(query)) {
        return true;
      }
      
      // For DMs without a name, search by member names
      if (!channelName && channel.state.members) {
        const memberNames = Object.values(channel.state.members)
          .filter((member) => member.user?.id !== client.userID)
          .map((member) => member.user?.name?.toLowerCase() || member.user?.id?.toLowerCase())
          .filter(Boolean);
        
        return memberNames.some((name) => name?.includes(query));
      }
      
      return false;
    });
  }, [searchQuery, client.userID]);

  const fetchUsers = useCallback(async () => {
    if (availableUsers.length > 0) {
      return availableUsers;
    }
    
    if (!client.userID) {
      console.warn('[CustomChannelList.tsx]: Cannot fetch users - client.userID not available');
      return [];
    }
    
    try {
      const users = await client.queryUsers(
        {},
        { id: 1 },
        { limit: 50 }
      );
      const userList = users.users
        .filter(user => {
          if (user.id === client.userID) {
            return false;
          }
          
          return true;
        })
        .map(user => ({
          id: user.id,
          name: user.name || user.id,
          image: user.image
        }));
      setAvailableUsers(userList);
      return userList;
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }, [client, availableUsers]);

  const handleCreateGroupClick = useCallback(async () => {
    if (availableUsers.length === 0) {
      await fetchUsers();
    }
    setShowDropdown(false);
    setShowCreateGroupModal(true);
  }, [fetchUsers, availableUsers.length]);

  const handleCreateDMClick = useCallback(async () => {
    if (availableUsers.length === 0) {
      await fetchUsers();
    }
    setShowDropdown(false);
    setShowCreateDMModal(true);
  }, [fetchUsers, availableUsers.length]);

  const toggleDropdown = useCallback(() => {
    setShowDropdown(prev => !prev);
  }, []);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showDropdown && !target.closest('.create-dropdown-wrapper')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  return (
    <div className="custom-channel-list">
      <div className="channel-list-header">
        <div className="channel-search-wrapper">
          <input
            type="text"
            className="channel-search-input"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: "2rem",
              background: `url(${searchIcon}) no-repeat 0.5rem center`,
              backgroundSize: "1rem 1rem",
              filter: 'grayscale(1) brightness(0.9) contrast(0.7)', // also greys out the placeholder text and search icon
            }}
          />
        </div>
        
        <div className="create-dropdown-wrapper">
          <button
            className="create-channel-button"
            onClick={toggleDropdown}
            title="Create new channel"
          >
            <span className="create-channel-icon">+</span>
          </button>
          
          {showDropdown && (
            <div className="create-dropdown-menu">
              <button
                className="dropdown-menu-item"
                onClick={handleCreateDMClick}
              >
                <img 
                  src={sendIcon}
                  alt="Direct Message"
                  width="16" 
                  height="16"
                  className="dropdown-item-icon"
                />
                <span>Message</span>
              </button>
              
              <button
                className="dropdown-menu-item"
                onClick={handleCreateGroupClick}
              >
                <img 
                  src={usersGroupIcon}
                  alt="Group"
                  width="16" 
                  height="16"
                  className="dropdown-item-icon"
                />
                <span>Group Chat</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="stream-channel-list">
        <StreamChannelList 
          filters={filters}
          sort={sort}
          options={options}
          Preview={CustomChannelPreview}
          channelRenderFilterFn={channelRenderFilterFn}
          EmptyStateIndicator={EmptyStateIndicator}
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