import React, { useState, useEffect } from 'react';
import { useChannelStateContext, useChatContext } from 'stream-chat-react';
import PinIcon from '../icons/pin.svg';
import AttachmentIcon from '../icons/attachment.svg';
import './PinnedMessages.css';

const PinnedMessages: React.FC = () => {
  const { channel } = useChannelStateContext();
  const { client } = useChatContext();
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!channel) return;

    const markPinnedMessages = () => {
      const messageElements = document.querySelectorAll('.str-chat__message');
      
      messageElements.forEach((messageEl) => {
        const messageId = messageEl.getAttribute('data-message-id') || 
                         messageEl.id || 
                         messageEl.querySelector('[data-message-id]')?.getAttribute('data-message-id');
        
        if (messageId) {
          const isPinned = pinnedMessages.some(pinnedMsg => pinnedMsg.id === messageId);
          
          if (isPinned) {
            (messageEl as HTMLElement).setAttribute('data-pinned', 'true');
            (messageEl as HTMLElement).classList.add('str-chat__message--pinned');
          } else {
            (messageEl as HTMLElement).removeAttribute('data-pinned');
            (messageEl as HTMLElement).classList.remove('str-chat__message--pinned');
          }
        }
      });
    };

    markPinnedMessages();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          setTimeout(markPinnedMessages, 100);
        }
      });
    });

    const messageList = document.querySelector('.str-chat__message-list');
    if (messageList) {
      observer.observe(messageList, { childList: true, subtree: true });
    }

    return () => {
      observer.disconnect();
    };
  }, [pinnedMessages]);

  useEffect(() => {
    if (!channel) return;

    const fetchPinnedMessages = async () => {
      try {
        const response = await channel.query({
          messages: {
            limit: 100
          }
        });
        
        const pinned = response.messages?.filter(msg => msg.pinned === true) || [];
        
        pinned.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        setPinnedMessages(pinned.slice(0, 10));
      } catch (error) {
        console.error('Error fetching pinned messages:', error);
      }
    };

    fetchPinnedMessages();

    const handleMessageUpdated = (event: any) => {
      if (event.message) {
        fetchPinnedMessages();
      }
    };

    const handleNewMessage = (event: any) => {
      if (event.message?.pinned) {
        fetchPinnedMessages();
      }
    };

    const handleMessageDeleted = (event: any) => {
      const deletedMessageId = event.message?.id;
      
      if (deletedMessageId) {
        const wasPinned = pinnedMessages.some(pinnedMsg => pinnedMsg.id === deletedMessageId);
        
        if (wasPinned) {
          console.log('📌 Unpinning deleted message:', deletedMessageId);
          setPinnedMessages(prev => prev.filter(msg => msg.id !== deletedMessageId));
          
          fetchPinnedMessages();
        }
      }
    };

    channel.on('message.updated', handleMessageUpdated);
    channel.on('message.new', handleNewMessage);
    channel.on('message.deleted', handleMessageDeleted);

    return () => {
      channel.off('message.updated', handleMessageUpdated);
      channel.off('message.new', handleNewMessage);
      channel.off('message.deleted', handleMessageDeleted);
    };
  }, [channel]);

  if (pinnedMessages.length === 0) {
    return null;
  }

  const formatTime = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const truncateMessage = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const scrollToMessage = async (messageId: string) => {
    try {
      const selectors = [
        `[data-testid="message-${messageId}"]`,
        `[data-message-id="${messageId}"]`,
        `#message-${messageId}`,
        `.str-chat__message[data-message-id="${messageId}"]`,
        `.str-chat__message--${messageId}`,
        `[id*="${messageId}"]`
      ];
      
      let messageElement: HTMLElement | null = null;
      
      for (const selector of selectors) {
        messageElement = document.querySelector(selector) as HTMLElement;
        if (messageElement) break;
      }
      
      if (messageElement) {     
        messageElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center'
        });

        messageElement.classList.add('highlighted-message');
        
        const messageBubble = messageElement.querySelector('.str-chat__message-bubble') as HTMLElement;
        if (messageBubble) {
          const isOwnMessage = messageElement.classList.contains('str-chat__message--me') ||
                               messageElement.querySelector('.str-chat__message--me') !== null;
          
          if (isOwnMessage) {
            messageBubble.classList.add('dimmed-message-bubble-own');
          } else {
            messageBubble.classList.add('dimmed-message-bubble-others');
          }
          
          setTimeout(() => {
            messageBubble?.classList.remove('dimmed-message-bubble-own', 'dimmed-message-bubble-others');
          }, 2000);
        }
        
        setTimeout(() => {
          messageElement?.classList.remove('highlighted-message');
        }, 3000);
      } else {
        const messageListContainer = document.querySelector('.str-chat__message-list') || 
                                   document.querySelector('.str-chat__virtual-list') ||
                                   document.querySelector('[data-testid="message-list"]');
        
        if (messageListContainer) {
          const allMessages = messageListContainer.querySelectorAll('.str-chat__message');
          let found = false;
          
          Array.from(allMessages).forEach((msg) => {
            if (!found && (msg.id?.includes(messageId) || msg.getAttribute('data-message-id') === messageId)) {
              msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
              (msg as HTMLElement).classList.add('highlighted-message');
              
              const messageBubble = msg.querySelector('.str-chat__message-bubble') as HTMLElement;
              if (messageBubble) {
                const isOwnMessage = (msg as HTMLElement).classList.contains('str-chat__message--me') ||
                                     msg.querySelector('.str-chat__message--me') !== null;
                
                if (isOwnMessage) {
                  messageBubble.classList.add('dimmed-message-bubble-own');
                } else {
                  messageBubble.classList.add('dimmed-message-bubble-others');
                }
                
                setTimeout(() => {
                  messageBubble?.classList.remove('dimmed-message-bubble-own', 'dimmed-message-bubble-others');
                }, 2000);
              }
              
              setTimeout(() => {
                (msg as HTMLElement).classList.remove('highlighted-message');
              }, 3000);
              found = true;
            }
          });
          
          if (!found) {
            console.log('Message not found in current view. ID:', messageId);
            alert('This message is not currently visible in the chat. You may need to scroll up to find older messages.');
          }
        } else {
          console.log('Message list container not found');
        }
      }
    } catch (error) {
      console.error('Error scrolling to message:', error);
    }
  };

  return (
    <div className="pinned-messages-container">
      <div className="pinned-messages-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="pinned-messages-title">
          <img 
            src={PinIcon} 
            alt="Pin" 
            className="pinned-icon"
          />
          <span className="pinned-text">
            {pinnedMessages.length === 1 
              ? '1 Pinned Message' 
              : `${pinnedMessages.length} Pinned Messages`
            }
          </span>
        </div>
        <button className="pinned-toggle">
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <div className="pinned-messages-list">
          {pinnedMessages.map((message) => (
            <div 
              key={message.id} 
              className="pinned-message-item"
              onClick={() => scrollToMessage(message.id)}
            >
              <div className="pinned-message-text">
                {message.text ? (
                  message.text
                ) : message.attachments?.length ? (
                  <>
                    <img 
                      src={AttachmentIcon} 
                      alt="Attachment" 
                      className="pinned-icon"
                      style={{ 
                        marginRight: '8px', 
                        verticalAlign: 'middle', 
                        filter: 'brightness(0) saturate(0%) grayscale(1) opacity(0.63)' 
                      }} 
                    />
                    {`${message.attachments.length} attachment${message.attachments.length > 1 ? 's' : ''}`}
                  </>
                ) : (
                  'No text content'
                )}
              </div>
              <span className="pinned-message-time">
                {formatTime(message.created_at || new Date())}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PinnedMessages;
