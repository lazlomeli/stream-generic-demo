import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { StreamChat, Channel as StreamChannel } from 'stream-chat'
import { useAuth0 } from '@auth0/auth0-react'
import {
  Chat as ChatComponent,
  Channel,
  ChannelHeader,
  MessageList,
  Thread,
  Window,
  useChatContext,
} from 'stream-chat-react'
import CustomMessageInput from './CustomMessageInput'
import CustomAttachment from './CustomAttachment'
import FallbackAvatar from './FallbackAvatar'
import LoadingSpinner from './LoadingSpinner'
import LoadingIcon from './LoadingIcon'
import { getSanitizedUserId } from '../utils/userUtils'
import 'stream-chat-react/dist/css/v2/index.css'

import type { ChannelItem } from "../hooks/listMyChannels"
import "./Chat.css";
import "./VoiceRecording.css";

interface ChatProps {}

// Custom Channel List component using Stream Chat SDK
const CustomChannelList: React.FC<{
  selectedChannelId: string;
  onChannelSelect: (channelId: string) => void;
}> = ({ selectedChannelId, onChannelSelect }) => {
  const { client } = useChatContext();
  const [channels, setChannels] = useState<ChannelItem[]>([]);

  const fetchChannels = useCallback(async () => {
    if (!client) return;
    
    try {
      const filters = { type: "messaging", members: { $in: [client.userID!] } };
      const channels = await client.queryChannels(filters, { last_message_at: -1 }, { watch: false, state: true });
      
      const channelItems = channels.map((c) => {
        const last = c.state.messages.at(-1);
        const isDM = (c.state.members?.size ?? 0) === 2;

        // Handle voice messages for channel list preview
        let lastMessage = last?.text;
        
        // If no text but has voice recording attachment, show voice message preview
        if (!lastMessage && last?.attachments && last.attachments.length > 0) {
          const voiceAttachment = last.attachments.find(att => att.type === 'voiceRecording');
          if (voiceAttachment) {
            // Use custom preview text if available, otherwise show default
            const customData = last as any; // Type assertion for custom data
            lastMessage = customData.custom?.previewText || '🎤 Voice Message';
          }
        }

        // Type assertion for channel data to access custom properties
        const channelData = c.data as any;
        const channelName = channelData?.name;
        const channelImage = channelData?.image;

        return {
          id: c.id!,
          name: isDM ? (channelName as string) || 'Direct Message' : (channelName as string) || "General",
          type: isDM ? "dm" as const : "group" as const,
          image: channelImage || (channelName === 'General' ? '/general-channel.svg' : undefined),
          lastMessage: lastMessage,
          lastMessageTime: last?.created_at ? new Date(last.created_at).toLocaleTimeString() : undefined,
        };
      });
      
      setChannels(channelItems);
    } catch (error) {
      console.error('Error fetching channels:', error);
    }
  }, [client]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Refresh channels when messages change
  useEffect(() => {
    if (client) {
      const handleMessageNew = () => {
        fetchChannels();
      };

      client.on('message.new', handleMessageNew);
      
      return () => {
        client.off('message.new', handleMessageNew);
      };
    }
  }, [client, fetchChannels]);

  return (
    <div className="custom-channel-list">
      <div className="channel-list-header">
        <h3>Channels</h3>
      </div>
      <div className="channel-list-items">
        {channels.map((channelItem) => (
          <button
            key={channelItem.id}
            onClick={() => onChannelSelect(channelItem.id)}
            className={`channel-item-button ${
              selectedChannelId === channelItem.id ? 'selected' : ''
            }`}
          >
            <div className="channel-item-content">
              <div className="channel-item-avatar">
                <FallbackAvatar
                  src={channelItem.image}
                  alt={channelItem.name || 'Channel'}
                  className="channel-item-avatar-image"
                  size={24}
                />
              </div>
              <div className="channel-item-text">
                <div className="channel-item-header">
                  <h4 className="channel-item-name">{channelItem.name}</h4>
                  <span className="channel-item-time">{channelItem.lastMessageTime}</span>
                </div>
                <p className="channel-item-message">{channelItem.lastMessage || 'No messages yet'}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const Chat: React.FC<ChatProps> = () => {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();

  const apiKey = import.meta.env.VITE_STREAM_API_KEY as string | undefined;

  const [clientReady, setClientReady] = useState(false);
  const [channel, setChannel] = useState<any>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("general");
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Keep a single client instance per tab
  const clientRef = useRef<StreamChat | null>(null);

  // Memoize current user id once using shared utility
  const sanitizedUserId = useMemo(() => getSanitizedUserId(user), [user]);

  // --- helpers ---
  const getStreamToken = useCallback(
    async (userId: string): Promise<string> => {
      const accessToken = await getAccessTokenSilently();
      const res = await fetch("/api/stream/chat-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`chat-token failed: ${res.status} ${text}`);
      }
      const json = await res.json();
      return json.token as string;
    },
    [getAccessTokenSilently]
  );

  const seedIfNeeded = useCallback(
    async (userId: string) => {
      const accessToken = await getAccessTokenSilently();
      const res = await fetch("/api/stream/seed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const text = await res.text();
        // Not fatal for chat connection, but log it
        console.warn("seed failed:", res.status, text);
      }
    },
    [getAccessTokenSilently]
  );

  // Handle channel switching
  const handleChannelSwitch = useCallback(async (channelId: string) => {
    if (!clientRef.current) return;
    
    try {
      console.log('Switching to channel:', channelId);
      let newChannel;
      
      if (channelId === "general") {
        newChannel = clientRef.current.channel("messaging", "general", {
          members: [sanitizedUserId],
          // @ts-ignore-next-line
          name: "General",
          // @ts-ignore-next-line
          image: "/general-channel.svg",
        });
      } else {
        newChannel = clientRef.current.channel("messaging", channelId);
      }
      
      await newChannel.watch();
      setChannel(newChannel);
      setSelectedChannelId(channelId);
      console.log('Successfully switched to channel:', channelId);
    } catch (error) {
      console.error('Error switching channel:', error);
    }
  }, [sanitizedUserId]);

  // Handle voice message events
  const handleVoiceMessage = useCallback(async (event: CustomEvent) => {
    const { audioBlob, duration, size } = event.detail;
    const client = clientRef.current;
    const currentChannel = channel;

    if (!client || !currentChannel) {
      console.error('Client or channel not ready for voice message');
      return;
    }

    try {
      console.log('Processing voice message:', { duration, size });
      
      // Create a file from the blob for Stream Chat upload
      const file = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });
      
      console.log('Uploading voice message to Stream Chat:', file.name, file.size);

      // Upload the file to Stream Chat
      const uploadResponse = await client.uploadFile(file, currentChannel);
      
      if (!uploadResponse) {
        throw new Error('File upload failed');
      }

      console.log('File uploaded successfully:', uploadResponse);

      // Send the voice message with the uploaded file URL
      const response = await currentChannel.sendMessage({
        text: '', // No text in the channel message
        attachments: [
          {
            type: 'voiceRecording',
            asset_url: uploadResponse.file, // Use the uploaded file URL
            mime_type: 'audio/webm',
            file_size: size,
            duration: duration,
            title: 'Voice Message',
            waveform_data: Array.from({ length: 50 }, () => Math.random() * 0.8 + 0.2), // Generate mock waveform data
          }
        ],
        // Add custom data for channel list preview
        custom: {
          messageType: 'voiceRecording',
          previewText: '🎤 Voice Message'
        }
      });

      console.log('Voice message sent successfully:', response);
      
      // Force channel refresh to ensure message appears
      await currentChannel.watch();
      
    } catch (error: any) {
      console.error('Error processing voice message:', error);
      
      if (error.message?.includes('max payload size')) {
        alert('Voice message too large. Please record a shorter message.');
      } else {
        alert('Failed to send voice message. Please try again.');
      }
    }
  }, [channel]);

  // Reset state when drawer closes
  useEffect(() => {
    // This effect is no longer needed as Chat is rendered directly
    // if (!isOpen) {
    //   setClientReady(false);
    //   setChannel(null);
    //   setError(null);
    //   setIsConnecting(false);
    //   setSelectedChannelId("general");
    //   // do NOT disconnect here; cleanup runs in main effect's return
    // }
  }, []);

  // Main connect effect
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    if (!apiKey) {
      setError(
        "Stream API key not configured. Set VITE_STREAM_API_KEY in your frontend env."
      );
      return;
    }

    let cancelled = false;

    const client = new StreamChat(apiKey);
    clientRef.current = client;

    const run = async () => {
      try {
        setIsConnecting(true);
        setError(null);

        // Do seed and token fetch in parallel
        const [_, token] = await Promise.all([
          seedIfNeeded(sanitizedUserId),
          getStreamToken(sanitizedUserId),
        ]);
        if (cancelled) return;

        await client.connectUser(
          {
            id: sanitizedUserId,
            name: user.name || user.email || "Anonymous User",
            image: user.picture || undefined,
          },
          token
        );
        if (cancelled) return;

        // Ensure user is added to general channel before trying to watch
        try {
          const accessToken = await getAccessTokenSilently();
          await fetch("/api/stream/add-user-to-general", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ userId: sanitizedUserId }),
          });
        } catch (error) {
          console.log('Failed to add user to general channel via API:', error);
          // Continue anyway, maybe the user already has access
        }

        // Now try to watch the general channel
        const general = client.channel("messaging", "general");
        await general.watch();
        if (cancelled) return;

        setChannel(general);
        setSelectedChannelId("general");
        setClientReady(true);
      } catch (e: any) {
        console.error("Error connecting to Stream:", e);
        if (!cancelled) setError("Failed to connect to chat. Please try again.");
      } finally {
        if (!cancelled) setIsConnecting(false);
      }
    };

    run();

    // Cleanup on unmount / auth change / apiKey change
    return () => {
      cancelled = true;
      const c = clientRef.current;
      if (c?.userID) {
        // Disconnect only if connected
        c.disconnectUser().catch((e) =>
          console.warn("Chat disconnect warning:", e)
        );
      }
      clientRef.current = null;
    };
  }, [
    isAuthenticated,
    user,
    apiKey,
    getStreamToken,
    seedIfNeeded,
    sanitizedUserId,
  ]);

  // Listen for voice message events
  useEffect(() => {
    const handleVoiceMessageEvent = (event: Event) => {
      if (event instanceof CustomEvent && event.type === 'voiceMessageReady') {
        handleVoiceMessage(event);
      }
    };

    window.addEventListener('voiceMessageReady', handleVoiceMessageEvent);
    
    return () => {
      window.removeEventListener('voiceMessageReady', handleVoiceMessageEvent);
    };
  }, [handleVoiceMessage]);

  // Fix Stream Chat modal z-index issues
  useEffect(() => {
    let observer: MutationObserver;

    const fixModalZIndex = () => {
      // Find all modal-related elements and ensure they have proper z-index
      const modalSelectors = [
        '.str-chat__modal',
        '.str-chat__modal-wrapper',
        '.str-chat__overlay',
        '.str-chat__message-actions-box',
        '.str-chat__message-reactions-selector',
        '.str-chat__dropdown',
        '.str-chat__tooltip',
        '.str-chat__reactions-list',
        '.str-chat__popover',
        '[class*="str-chat__modal"]',
        '[class*="str-chat__dropdown"]',
        '[class*="str-chat__reactions"]',
        '[class*="str-chat__message-actions"]'
      ];

      modalSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element: any) => {
          element.style.zIndex = '999999';
          element.style.position = element.style.position || 'fixed';
          
          // Ensure proper pointer events
          if (element.classList.contains('str-chat__overlay') || 
              element.classList.contains('str-chat__modal-wrapper')) {
            element.style.pointerEvents = 'none';
            
            // Enable pointer events for content inside
            const content = element.querySelector('.str-chat__modal-inner, .str-chat__modal-content');
            if (content) {
              (content as any).style.pointerEvents = 'auto';
            }
          } else {
            element.style.pointerEvents = 'auto';
          }
        });
      });
    };

    // Run initial fix
    fixModalZIndex();

    // Set up mutation observer to catch dynamically added modals
    observer = new MutationObserver((mutations) => {
      let shouldFix = false;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const element = node as Element;
            if (element.className && 
                (element.className.includes('str-chat__modal') ||
                 element.className.includes('str-chat__dropdown') ||
                 element.className.includes('str-chat__reactions') ||
                 element.className.includes('str-chat__message-actions') ||
                 element.className.includes('str-chat__tooltip'))) {
              shouldFix = true;
            }
          }
        });
      });
      if (shouldFix) {
        setTimeout(fixModalZIndex, 0);
      }
    });

    // Start observing the document for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    // Also run fix every 100ms for the first 2 seconds to catch any delayed modals
    const interval = setInterval(fixModalZIndex, 100);
    setTimeout(() => clearInterval(interval), 2000);

    return () => {
      if (observer) {
        observer.disconnect();
      }
      clearInterval(interval);
    };
  }, [clientReady]);

  // --- render states ---
  if (error) {
    return (
      <div className="chat-error">
        <div className="chat-error-content">
          <h3 className="chat-error-title">Connection Error</h3>
          <p className="chat-error-message">{error}</p>
          <button onClick={() => window.history.back()} className="chat-error-button">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="chat-loading">
        <div className="chat-loading-content">
          <LoadingSpinner />
          <p>Connecting to chat...</p>
        </div>
      </div>
    );
  }

  if (!clientReady || !clientRef.current) {
    return (
      <div className="chat-loading">
        <div className="chat-loading-content">
          <LoadingSpinner />
          <p>Initializing chat...</p>
        </div>
      </div>
    );
  }

  const client = clientRef.current;

  return (
    <div className="chat-container">
      {/* Chat Header */}
      <div className="chat-header">
        <h1 className="chat-header-title">Messages</h1>
      </div>

      {/* Stream Chat Implementation */}
      <ChatComponent
        client={client}
        theme="str-chat__theme-light"
        key={`chat-${client.userID || "disconnected"}`}
      >
        <div className="chat-layout">
          {/* Left — Channel List using Stream Chat SDK */}
          <div className="chat-sidebar">
            <CustomChannelList 
              selectedChannelId={selectedChannelId}
              onChannelSelect={handleChannelSwitch}
            />
          </div>

          {/* Right — Chat Area using Stream Chat SDK */}
          <div className="chat-main">
            <Channel channel={channel} Attachment={CustomAttachment}>
              <Window>
                <ChannelHeader />
                <MessageList />
                <CustomMessageInput />
              </Window>
              <Thread />
            </Channel>
          </div>
        </div>
      </ChatComponent>
    </div>
  );
};

export default Chat;
