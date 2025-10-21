import React from 'react';
import { ChannelPreviewUIComponentProps } from 'stream-chat-react';
import FallbackAvatar from './FallbackAvatar';
import ChannelTypingIndicator from './ChannelTypingIndicator';
import VolumeOffIcon from '../icons/volume-off.svg';
import './ChannelList.css';

const CustomChannelPreview: React.FC<ChannelPreviewUIComponentProps> = (props) => {
  const { channel, setActiveChannel, watchers, displayTitle, displayImage, latestMessage, active } = props;

  if (!channel) return null;

  // Get channel data
  const channelId = channel.id || '';
  const memberCount = Object.keys(channel.state?.members || {}).length;
  
  // Check if this is a DM channel (marked as isDM in channel data)
  // @ts-ignore - isDM is a custom field we add to channel data
  const isDM = channel.data?.isDM === true;

  // Determine channel name
  const channelName = displayTitle || 'Channel';
  
  // For group channels, don't use any image (force fallback icon)
  // For DM channels, use the displayImage (other user's avatar)
  const channelImage = isDM ? displayImage : undefined;

  // Get last message time
  let lastMessageTime: string | undefined;
  if (latestMessage && typeof latestMessage === 'object' && 'created_at' in latestMessage) {
    const createdAt = latestMessage.created_at;
    if (createdAt && (typeof createdAt === 'string' || typeof createdAt === 'number' || createdAt instanceof Date)) {
      lastMessageTime = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  // Calculate online status for status indicator
  const members = channel.state?.members || {};
  const currentUserId = channel._client?.userID;
  const onlineUsers = Object.values(members).filter(member => member.user?.online === true);
  const otherUsersOnline = onlineUsers.filter(member => member.user?.id !== currentUserId);
  const otherUsersOnlineCount = otherUsersOnline.length;
  const onlineCount = onlineUsers.length;

  const getChannelStatus = () => {
    if (isDM) {
      return otherUsersOnlineCount > 0 ? 'online' : 'offline';
    } else {
      if (otherUsersOnlineCount > 0) {
        return 'online';
      } else if (onlineCount === 1) {
        return 'away';
      } else {
        return 'offline';
      }
    }
  };

  const status = getChannelStatus();

  // Check if channel is muted
  const isMuted = channel.muteStatus()?.muted || false;

  // Get last message for preview from channel state
  const lastMessage = channel.state.messages[channel.state.messages.length - 1];
  let lastMessageText = '';
  
  if (lastMessage) {
    // Get message text or fallback to attachment preview
    let messageText = lastMessage.text || '';
    
    // If no text but has attachments, show appropriate preview
    if (!messageText && lastMessage.attachments && lastMessage.attachments.length > 0) {
      const attachment = lastMessage.attachments[0];
      switch (attachment.type) {
        case 'voiceRecording':
          messageText = '🎤 Voice Message';
          break;
        case 'image':
          messageText = '📷 Photo';
          break;
        case 'video':
          messageText = '🎥 Video';
          break;
        case 'file':
          messageText = '📎 File';
          break;
        case 'giphy':
          messageText = '🎬 GIF';
          break;
        default:
          messageText = '📎 Attachment';
          break;
      }
    }

    // Add sender name prefix to the message preview
    if (messageText && lastMessage.user) {
      const senderName = lastMessage.user.name || lastMessage.user.id;
      const isOwnMessage = lastMessage.user.id === currentUserId;
      lastMessageText = isOwnMessage ? `You: ${messageText}` : `${senderName}: ${messageText}`;
    } else if (messageText) {
      lastMessageText = messageText;
    }
  }

  const handleClick = () => {
    if (setActiveChannel) {
      setActiveChannel(channel, watchers);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`channel-item-button ${active ? 'selected' : ''}`}
    >
      <div className="channel-item-content">
        <div className="channel-item-avatar">
          <FallbackAvatar
            src={channelImage}
            alt={channelName}
            className="channel-item-avatar-image"
            size={24}
            channelType={isDM ? 'dm' : 'group'}
            channelName={channelName}
          />
          <div className={`channel-item-status ${status}`}></div>
        </div>

        <div className="channel-item-text">
          <div className="channel-item-header">
            <h3 className="channel-item-name">{channelName}</h3>
            <div className="channel-item-meta">
              {isMuted && (
                <img 
                  src={VolumeOffIcon} 
                  alt="Muted" 
                  className="channel-item-mute-icon"
                  title="Channel is muted"
                />
              )}
              <span className="channel-item-time">{lastMessageTime}</span>
            </div>
          </div>
          <div className="channel-item-message">
            <ChannelTypingIndicator
              channelId={channelId}
              lastMessage={lastMessageText}
            />
          </div>
        </div>
      </div>
    </button>
  );
};

export default CustomChannelPreview;

