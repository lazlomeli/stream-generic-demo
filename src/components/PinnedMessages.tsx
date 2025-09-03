import React, { useState, useEffect } from 'react';
import { useChannelStateContext, useChatContext } from 'stream-chat-react';
import PinIcon from '../icons/pin.svg';
import './PinnedMessages.css';

const PinnedMessages: React.FC = () => {
  const { channel } = useChannelStateContext();
  const { client } = useChatContext();
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Effect to mark pinned messages in the DOM
  useEffect(() => {
    if (!channel) return;

    const markPinnedMessages = () => {
      // Find all message elements in the chat
      const messageElements = document.querySelectorAll('.str-chat__message');
      
      messageElements.forEach((messageEl) => {
        const messageId = messageEl.getAttribute('data-message-id') || 
                         messageEl.id || 
                         messageEl.querySelector('[data-message-id]')?.getAttribute('data-message-id');
        
        if (messageId) {
          // Check if this message is in our pinned messages list
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

    // Mark pinned messages when the list changes
    markPinnedMessages();

    // Also mark when new messages are added to the DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Small delay to ensure message is fully rendered
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
        // Query messages to find pinned ones
        const response = await channel.query({
          messages: {
            limit: 100 // Get more messages to find pinned ones
          }
        });
        
        // Filter messages that are pinned
        const pinned = response.messages?.filter(msg => msg.pinned === true) || [];
        
        // Sort by creation date (newest first) and limit to 10
        pinned.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        setPinnedMessages(pinned.slice(0, 10));
      } catch (error) {
        console.error('Error fetching pinned messages:', error);
      }
    };

    // Fetch pinned messages on mount
    fetchPinnedMessages();

    // Listen for message updates (which include pin/unpin changes)
    const handleMessageUpdated = (event: any) => {
      // Only refetch if the updated message's pinned status might have changed
      if (event.message) {
        fetchPinnedMessages();
      }
    };

    const handleNewMessage = (event: any) => {
      // Check if new message is pinned
      if (event.message?.pinned) {
        fetchPinnedMessages();
      }
    };

    const handleMessageDeleted = (event: any) => {
      // Remove from pinned messages if a pinned message was deleted
      if (event.message?.pinned) {
        fetchPinnedMessages();
      }
    };

    // Add event listeners
    channel.on('message.updated', handleMessageUpdated);
    channel.on('message.new', handleNewMessage);
    channel.on('message.deleted', handleMessageDeleted);

    // Cleanup
    return () => {
      channel.off('message.updated', handleMessageUpdated);
      channel.off('message.new', handleNewMessage);
      channel.off('message.deleted', handleMessageDeleted);
    };
  }, [channel]);

  // Don't render if no pinned messages
  if (pinnedMessages.length === 0) {
    return null;
  }

  // Format the message timestamp
  const formatTime = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Truncate long messages
  const truncateMessage = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Scroll to the pinned message in the chat
  const scrollToMessage = async (messageId: string) => {
    try {
      // Try multiple selectors that Stream Chat might use
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
        // Scroll to the message
        messageElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center'
        });
        
        // Add highlight class for CSS animation
        messageElement.classList.add('highlighted-message');
        
        // Also dim the message bubble with appropriate color
        const messageBubble = messageElement.querySelector('.str-chat__message-bubble') as HTMLElement;
        if (messageBubble) {
          // Check if it's the current user's message
          const isOwnMessage = messageElement.classList.contains('str-chat__message--me') ||
                               messageElement.querySelector('.str-chat__message--me') !== null;
          
          // Apply appropriate dimming class
          if (isOwnMessage) {
            messageBubble.classList.add('dimmed-message-bubble-own');
          } else {
            messageBubble.classList.add('dimmed-message-bubble-others');
          }
          
          // Remove dimming after 2 seconds to match animation
          setTimeout(() => {
            messageBubble?.classList.remove('dimmed-message-bubble-own', 'dimmed-message-bubble-others');
          }, 2000);
        }
        
        // Remove highlight class after animation
        setTimeout(() => {
          messageElement?.classList.remove('highlighted-message');
        }, 3000);
      } else {
        // Fallback: scroll through the message list to find the message
        const messageListContainer = document.querySelector('.str-chat__message-list') || 
                                   document.querySelector('.str-chat__virtual-list') ||
                                   document.querySelector('[data-testid="message-list"]');
        
        if (messageListContainer) {
          // Try to find the message in the full list
          const allMessages = messageListContainer.querySelectorAll('.str-chat__message');
          let found = false;
          
          // Convert NodeList to Array for proper iteration
          Array.from(allMessages).forEach((msg) => {
            if (!found && (msg.id?.includes(messageId) || msg.getAttribute('data-message-id') === messageId)) {
              msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
              (msg as HTMLElement).classList.add('highlighted-message');
              
              // Also dim the message bubble with appropriate color
              const messageBubble = msg.querySelector('.str-chat__message-bubble') as HTMLElement;
              if (messageBubble) {
                // Check if it's the current user's message
                const isOwnMessage = (msg as HTMLElement).classList.contains('str-chat__message--me') ||
                                     msg.querySelector('.str-chat__message--me') !== null;
                
                // Apply appropriate dimming class
                if (isOwnMessage) {
                  messageBubble.classList.add('dimmed-message-bubble-own');
                } else {
                  messageBubble.classList.add('dimmed-message-bubble-others');
                }
                
                // Remove dimming after 2 seconds to match animation
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
                {message.text ? message.text : 
                 message.attachments?.length ? 
                 `📎 ${message.attachments.length} attachment${message.attachments.length > 1 ? 's' : ''}` :
                 'No text content'}
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
