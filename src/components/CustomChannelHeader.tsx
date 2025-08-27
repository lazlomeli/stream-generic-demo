import React from 'react';
import { useChannelStateContext, useChatContext } from 'stream-chat-react';
import FallbackAvatar from './FallbackAvatar';
import './CustomChannelHeader.css';

const CustomChannelHeader: React.FC = () => {
  const { channel } = useChannelStateContext();
  const { client } = useChatContext();

  if (!channel) {
    return (
      <div className="str-chat__header-livestream">
        <div className="str-chat__header-livestream-left">
          <div className="str-chat__header-livestream-left-title">
            Chat
          </div>
        </div>
      </div>
    );
  }

  // Determine if it's a group channel based on member count
  // Use Object.keys to count members (same logic as in listMyChannels)
  const memberCount = Object.keys(channel.state?.members || {}).length;
  const isGroupChannel = memberCount > 2;
  const channelType = isGroupChannel ? 'group' : 'dm';

  // Get channel name - use type assertion for custom properties
  const channelName = (channel.data as any)?.name || 'Channel';
  
  // Get channel image - for DM channels, use the other user's image
  let channelImage = (channel.data as any)?.image;
  if (channelType === 'dm') {
    // Find the other user (not the current user)
    const members = channel.state?.members || {};
    const otherUser = Object.values(members).find(member => 
      member.user?.id !== client.userID
    );
    if (otherUser?.user?.image) {
      channelImage = otherUser.user.image;
    }
  }

  // Calculate online users
  const currentUserId = client.userID;
  const members = channel.state?.members || {};
  
  const onlineUsers = Object.values(members).filter(member => 
    member.user?.online === true
  );
  const onlineCount = onlineUsers.length;
  
  // Generate subtitle based on online presence
  const getSubtitle = () => {
    if (onlineCount === 0) {
      return isGroupChannel 
        ? `${memberCount} members` 
        : memberCount === 2 ? 'Direct Message' : `${memberCount} member${memberCount !== 1 ? 's' : ''}`;
    } else if (onlineCount === 1) {
      // Check if the only online user is the current user
      const isOnlyUserOnline = onlineUsers.some(member => member.user?.id === currentUserId) && onlineCount === 1;
      if (isOnlyUserOnline) {
        return '1 online (You)';
      } else {
        return '1 online';
      }
    } else {
      return `${onlineCount} online`;
    }
  };

  return (
    <div className="str-chat__header-livestream">
      <div className="str-chat__header-livestream-left">
        <div className="str-chat__header-livestream-left-avatar">
          <FallbackAvatar
            src={channelImage}
            alt={channelName}
            size={40}
            channelType={channelType}
            channelName={channelName}
          />
        </div>
        <div className="str-chat__header-livestream-left-info">
          <div className="str-chat__header-livestream-left-title">
            {channelName}
          </div>
          <div className="str-chat__header-livestream-left-subtitle">
            {getSubtitle()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomChannelHeader;
