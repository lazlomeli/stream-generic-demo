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
  useChatContext,
  useChannelStateContext,
} from 'stream-chat-react'
import CustomMessageInput from './CustomMessageInput'
import CustomAttachment from './CustomAttachment'
import LoadingSpinner from './LoadingSpinner'
import VoiceMessageHandler from './VoiceMessageHandler'
import CustomChannelList from './CustomChannelList'
import CustomChannelHeader from './CustomChannelHeader'
import PinnedMessages from './PinnedMessages'
import { getSanitizedUserId } from '../utils/userUtils'
import 'stream-chat-react/dist/css/v2/index.css'

import "./VoiceRecording.css";
import "./ChatLayout.css";

interface ChatProps {}



const Chat: React.FC<ChatProps> = () => {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const { channelId } = useParams<{ channelId?: string }>();

  const apiKey = import.meta.env.VITE_STREAM_API_KEY as string | undefined;

  const [clientReady, setClientReady] = useState(false);
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
      const res = await fetch("/api/stream/auth-tokens", {
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
          const response = await fetch("/api/stream/chat-operations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ 
              type: 'add-to-general',
              userId: sanitizedUserId 
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 404) {
              console.error('❌ General channel does not exist:', errorData.message);

              // You might want to show this error to the user or trigger seeding
            } else {
              console.error('❌ Failed to add user to general channel:', errorData);
            }
          } else {

          }
        } catch (error) {
          console.error('❌ Network error adding user to general channel:', error);
          // Continue anyway - the user can still use chat without the general channel
        }

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



  // --- render states ---
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

  // ChannelList configuration
  const filters = { 
    type: 'messaging', 
    members: { $in: [sanitizedUserId] } 
  };
  const sort = { last_message_at: -1 } as const;
  const options = { 
    limit: 20,
    watch: true,
    state: true
  };

  return (
    <div style={{
      height: 'calc(100vh - 4rem)', // Fixed height minus header
      maxHeight: '800px', // Max height for desktop
      minHeight: '600px', // Min height for usability
      backgroundColor: 'white',
      display: 'flex'
    }}>
      <ChatComponent
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
        <Channel Attachment={CustomAttachment}>
          <Window>
            <CustomChannelHeader />
            <div className="message-area-container">
              <PinnedMessages />
              <MessageList />
            </div>
            <CustomMessageInput />
          </Window>
          <Thread />
          <VoiceMessageHandler />
        </Channel>
      </ChatComponent>
    </div>
  );
};

export default Chat;
