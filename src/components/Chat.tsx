import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { StreamChat, Channel as StreamChannel } from 'stream-chat'
import { useAuth0 } from '@auth0/auth0-react'
import { useParams } from 'react-router-dom'
import {
  Chat as ChatComponent,
  Channel,
  MessageList,
  Thread,
  Window,
  Streami18n,
} from 'stream-chat-react'
import { CustomMessageInput, CustomSendButton } from './CustomMessageInput'
import CustomAttachment from './CustomAttachment'
import LoadingSpinner from './LoadingSpinner'
import VoiceMessageHandler from './VoiceMessageHandler'
import CustomChannelList from './CustomChannelList'
import CustomChannelHeader from './CustomChannelHeader'
import PinnedMessages from './PinnedMessages'
import MobileBottomNav from './MobileBottomNav'
import MobileChannelList from './MobileChannelList'
import MobileChatView from './MobileChatView'
import { useResponsive } from '../contexts/ResponsiveContext'
import { useLocation } from 'react-router-dom'
import 'stream-chat-react/dist/css/v2/index.css'

import "./VoiceRecording.css";
import "./ChatLayout.css";

interface ChatProps {}



const Chat: React.FC<ChatProps> = () => {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const { channelId } = useParams<{ channelId?: string }>();
  const { isMobileView, toggleView } = useResponsive();
  const location = useLocation();

  const apiKey = import.meta.env.VITE_STREAM_API_KEY as string | undefined;

  const [clientReady, setClientReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [mobileViewState, setMobileViewState] = useState<'channelList' | 'chat'>('channelList');
  const [selectedMobileChannel, setSelectedMobileChannel] = useState<StreamChannel | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const streami18n = new Streami18n();
  streami18n.setLanguage('en');
  
  const [availableUsers, setAvailableUsers] = useState<Array<{
    id: string;
    name: string;
    image?: string;
  }>>([]);

  const clientRef = useRef<StreamChat | null>(null);
  
  const sanitizeUserId = useCallback((userId: string) => {
    return userId.replace(/[^a-zA-Z0-9@_-]/g, '');
  }, []);

  const sanitizedUserId = useMemo(() => 
    user?.nickname ? sanitizeUserId(user.nickname) : '',
    [user?.nickname, sanitizeUserId]
  );

  const handleMobileChannelSelect = (channel: StreamChannel) => {
    setSelectedMobileChannel(channel);
    setMobileViewState('chat');
  };

  const handleMobileBackToList = () => {
    setMobileViewState('channelList');
    setSelectedMobileChannel(null);
  };

  useEffect(() => {
    if (!isMobileView) {
      setMobileViewState('channelList');
      setSelectedMobileChannel(null);
    } else if (channelId && clientRef.current) {
      const channel = clientRef.current.channel('messaging', channelId);
      setSelectedMobileChannel(channel);
      setMobileViewState('chat');
    }
  }, [isMobileView, channelId, clientReady]);

  const fetchUsers = useCallback(async () => {
    if (!clientRef.current) return;
    
    if (!clientRef.current.userID) {
      console.warn('📱 Mobile: Cannot fetch users - client.userID not available');
      return;
    }
    
    try {
      const users = await clientRef.current.queryUsers(
        {},
        { id: 1 },
        { limit: 100 }
      );

      const currentUserId = clientRef.current.userID;
      const userList = users.users
        .filter(user => {
          // Exclude current user
          if (user.id === currentUserId) {
            console.log('📱 Mobile: Filtering out current user:', user.id);
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
    } catch (error) {
      console.error('❌ Mobile: Error fetching users:', error);
    }
  }, []);


  const handleMobileChannelCreated = useCallback(async (channelId: string) => {
    console.log('Mobile channel created:', channelId);
  }, []);

  const filters = useMemo(() => ({ 
    type: 'messaging', 
    members: { $in: [sanitizedUserId] } 
  }), [sanitizedUserId]);
  
  const sort = useMemo(() => ({ last_message_at: -1 } as const), []);
  
  const options = useMemo(() => ({ 
    limit: 20,
    watch: true,
    state: true
  }), []);

  const getStreamToken = useCallback(
    async (userId: string): Promise<string> => {
      const accessToken = await getAccessTokenSilently();
      const res = await fetch("/api/auth-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ 
          type: 'chat',
          userId,
          userProfile: {
            name: user?.name || user?.email || 'Anonymous User',
            image: user?.picture || undefined,
            role: 'User'
          }
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`auth-tokens failed: ${res.status} ${text}`);
      }
      const json = await res.json();
      return json.token as string;
    },
    [getAccessTokenSilently, user]
  );

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

        const token = await getStreamToken(sanitizedUserId);
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

        try {
          const accessToken = await getAccessTokenSilently();
          const response = await fetch("/api/chat-operations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ 
              type: 'add-to-general',
              userId: sanitizedUserId,
            }),
          });
          if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 404) {
              console.error('❌ General channel does not exist:', errorData.message);

            } else {
              console.error('❌ Failed to add user to general channel:', errorData);
            }
          } else {

          }
        } catch (error) {
          console.error('❌ Network error adding user to general channel:', error);
        }

        setClientReady(true);
        
        fetchUsers();
      } catch (e: any) {
        console.error("Error connecting to Stream:", e);
        if (!cancelled) setError("Failed to connect to chat. Please try again.");
      } finally {
        if (!cancelled) setIsConnecting(false);
      }
    };

    run();

    return () => {
      cancelled = true;
      const c = clientRef.current;
      if (c?.userID) {  
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
    fetchUsers,
    getAccessTokenSilently,
    sanitizedUserId,
  ]);



  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h3>Connection Error</h3>
        <p>{error}</p>
        <button onClick={() => window.history.back()}>
          Go Back
        </button>
      </div>
    );
  }

  if (isConnecting) {
    return <LoadingSpinner />;
  }

  if (!clientReady || !clientRef.current) {
    return <LoadingSpinner />;
  }

  const client = clientRef.current;

  if (isMobileView) {
    return (
      <div className={`chat-container mobile-view`}>
        <div className={`chat-content mobile-content`}>
          <ChatComponent
            client={client}
            theme="str-chat__theme-light"
            i18nInstance={streami18n}
            key={`chat-${client.userID || "disconnected"}`}
          >
            {mobileViewState === 'channelList' ? (
              <MobileChannelList
                filters={filters}
                sort={sort}
                options={options}
                onChannelSelect={handleMobileChannelSelect}
                onBackToList={handleMobileBackToList}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                availableUsers={availableUsers}
                onChannelCreated={handleMobileChannelCreated}
              />
            ) : selectedMobileChannel ? (
              <MobileChatView
                channel={selectedMobileChannel}
                onBack={handleMobileBackToList}
              />
            ) : (
              <div className="mobile-no-channel">Select a chat to start messaging</div>
            )}
          </ChatComponent>
          <MobileBottomNav currentPath={location.pathname} />
        </div>
        <button 
          className="desktop-toggle-button"
          onClick={toggleView}
          title="Switch to Desktop View"
        >
          Desktop
        </button>
      </div>
    );
  }

  return (
    <div className={`chat-container desktop-view`}>
      <div className={`chat-content desktop-content`}>
        <ChatComponent
          i18nInstance={streami18n}
          client={client}
          theme="str-chat__theme-light"
          key={`chat-${client.userID || "disconnected"}`}
        >
          <CustomChannelList 
            filters={filters}
            sort={sort}
            options={options}
            initialChannelId={channelId}
          />
          <Channel Attachment={CustomAttachment} SendButton={CustomSendButton}>
            <Window>
              <CustomChannelHeader />
              <div className="message-area-container">
                <PinnedMessages />
                <MessageList 
                  disableDateSeparator={false}
                />
              </div>
              <CustomMessageInput />
            </Window>
            <Thread />
            <VoiceMessageHandler />
          </Channel>
        </ChatComponent>
      </div>
    </div>
  );
};

export default Chat;
