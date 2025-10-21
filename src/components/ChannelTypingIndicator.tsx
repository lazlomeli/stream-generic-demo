import React, { useState, useEffect } from 'react';
import { useChatContext } from 'stream-chat-react';
import LoadingCirclesIcon from '../icons/loading-circles.svg';
import './ChannelTypingIndicator.css';

interface ChannelTypingIndicatorProps {
  channelId: string;
  lastMessage?: string;
}

const ChannelTypingIndicator: React.FC<ChannelTypingIndicatorProps> = ({ 
  channelId, 
  lastMessage 
}) => {
  const { client } = useChatContext();
  const [typingUsers, setTypingUsers] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    if (!client || !channelId) return;

    let channel: any = null;

    const setupTypingListener = async () => {
      try {
        channel = client.channel('messaging', channelId);
        
        const handleTypingStart = (event: any) => {
          const userId = event.user?.id;
          const userName = event.user?.name || event.user?.id || 'Someone';
          if (userId && userId !== client.userID) {
            setTypingUsers(prev => {
              if (!prev.find(user => user.id === userId)) {
                return [...prev, { id: userId, name: userName }];
              }
              return prev;
            });
          }
        };

        const handleTypingStop = (event: any) => {
          const userId = event.user?.id;
          if (userId) {
            setTypingUsers(prev => prev.filter(user => user.id !== userId));
          }
        };

        channel.on('typing.start', handleTypingStart);
        channel.on('typing.stop', handleTypingStop);

      } catch (error) {
        console.error('[ChannelTypingIndicator.tsx]: Error setting up typing listener for channel', channelId, error);
      }
    };

    setupTypingListener();

    return () => {
      if (channel) {
        channel.off('typing.start');
        channel.off('typing.stop');
      }
      setTypingUsers([]);
    };
  }, [client, channelId]);

  if (typingUsers.length > 0) {
    const getTypingMessage = () => {
      if (typingUsers.length === 1) {
        return `${typingUsers[0].name} is typing...`;
      } else if (typingUsers.length === 2) {
        return `${typingUsers[0].name} and ${typingUsers[1].name} are typing...`;
      } else {
        return `${typingUsers[0].name} and ${typingUsers.length - 1} others are typing...`;
      }
    };

    return (
      <div className="channel-typing-indicator">
        <img 
          src={LoadingCirclesIcon} 
          alt="Typing" 
          className="channel-typing-icon"
        />
        <span className="channel-typing-text">
          {getTypingMessage()}
        </span>
      </div>
    );
  }
  
  return (
    <span className="channel-last-message">
      {lastMessage || 'No messages yet'}
    </span>
  );
};

export default ChannelTypingIndicator;
