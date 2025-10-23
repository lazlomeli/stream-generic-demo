import React from 'react';
import { ChannelPreviewUIComponentProps } from 'stream-chat-react';
import FallbackAvatar from './FallbackAvatar';
import ChannelTypingIndicator from './ChannelTypingIndicator';
import VolumeOffIcon from '../icons/volume-off.svg';
import { getMessagePreview, formatMessageWithSender } from '../utils/messageUtils';
import './ChannelList.css';

const CustomChannelPreview: React.FC<ChannelPreviewUIComponentProps> = (props) => {
  const { channel, setActiveChannel, watchers, displayTitle, displayImage, latestMessage, active } = props;

  if (!channel) return null;

  const channelId = channel.id || '';

  // @ts-ignore
  const isDM = channel.data?.isDM === true;

  const channelName = displayTitle || 'Channel';
  
  const channelImage = isDM ? displayImage : undefined;

  let lastMessageTime: string | undefined;
  if (latestMessage && typeof latestMessage === 'object' && 'created_at' in latestMessage) {
    const createdAt = latestMessage.created_at;
    if (createdAt && (typeof createdAt === 'string' || typeof createdAt === 'number' || createdAt instanceof Date)) {
      lastMessageTime = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

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

  const isMuted = channel.muteStatus()?.muted || false;

  const lastMessage = channel.state.messages[channel.state.messages.length - 1];
  let lastMessageText = '';
  
  if (lastMessage) {
    let messageText = getMessagePreview(lastMessage);

    if (messageText && lastMessage.user) {
      lastMessageText = formatMessageWithSender(
        messageText,
        lastMessage.user.id,
        lastMessage.user.name,
        currentUserId || ''
      );
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

