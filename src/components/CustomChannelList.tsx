import React, { useState, useCallback } from 'react';
import { ChannelList as StreamChannelList, useChatContext } from 'stream-chat-react';
import CreateChannelModal from './CreateChannelModal';
import './CustomChannelList.css';

interface CustomChannelListProps {
  filters: any;
  sort: any;
  options: any;
}

const CustomChannelList: React.FC<CustomChannelListProps> = (props) => {
  const { client } = useChatContext();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<Array<{
    id: string;
    name: string;
    image?: string;
  }>>([]);

  const handleCreateChannelClick = useCallback(async () => {
    try {
      // Get all users that the current user can interact with
      // This includes users from existing channels and all users in the app
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
      setShowCreateModal(true);
    } catch (error) {
      console.error('Error fetching users:', error);
      // Fallback to demo users if we can't fetch from Stream
      setAvailableUsers([
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
      ]);
      setShowCreateModal(true);
    }
  }, [client]);

  const handleChannelCreated = useCallback((channelId: string) => {
    // The channel will be automatically added to the list
    // since Stream Chat handles this automatically
    console.log('Channel created:', channelId);
    setShowCreateModal(false);
    
    // Optionally, you can programmatically switch to the new channel
    // This would require additional props and logic
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  return (
    <div className="custom-channel-list">
      {/* Create Channel Button */}
      <div className="create-channel-section">
        <button
          className="create-channel-button"
          onClick={handleCreateChannelClick}
          title="Create new channel"
        >
          <span className="create-channel-icon">+</span>
          <span className="create-channel-text">Create Channel</span>
        </button>
      </div>

      {/* Stream Chat's built-in ChannelList */}
      <div className="stream-channel-list">
        <StreamChannelList {...props} />
      </div>

      {/* Create Channel Modal */}
      <CreateChannelModal
        isOpen={showCreateModal}
        onClose={handleCloseModal}
        onChannelCreated={handleChannelCreated}
        availableUsers={availableUsers}
        currentUserId={client.userID}
      />
    </div>
  );
};

export default CustomChannelList;
