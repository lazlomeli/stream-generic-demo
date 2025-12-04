import React from 'react';
import { EmptyStateIndicatorProps } from 'stream-chat-react';
import './CustomEmptyStateIndicator.css';
import PaperPlaneIcon from '../assets/paper-plane.png';
import NoChatsIcon from '../assets/no-chat.avif';

export const CustomEmptyStateIndicator: React.FC<EmptyStateIndicatorProps> = ({ listType }) => {
  if (listType === 'thread') return null;

  if (listType === 'channel') {
    return (
      <div className='custom-empty-channel'>
        <img src={NoChatsIcon} alt="Empty state indicator" className='custom-empty-list-icon' />
        <h2 className='custom-empty-title'>No chats yet</h2>
        <p className='custom-empty-description'>
          Start a conversation by creating a chat!
        </p>
      </div>
    );
  } 
  
  if (listType === 'message') {
    return (
      <div className='custom-empty-channel'>
        <img src={PaperPlaneIcon} alt="Empty state indicator" className='custom-empty-chat-icon' />
        <h2 className='custom-empty-title'>No messages yet</h2>
        <p className='custom-empty-description'>
          Start a conversation by sending a message!
        </p>
      </div>
    );
  }
  
  return null;
};

export default CustomEmptyStateIndicator;