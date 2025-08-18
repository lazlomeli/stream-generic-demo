import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Chat as ChatComponent,
  Channel,
  ChannelHeader,
  MessageInput,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";
import { StreamChat } from "stream-chat";
import "stream-chat-react/dist/css/v2/index.css";

import SampleChannels from "./SampleChannels";
import ChannelListComponent from "./ChannelList";
import type { ChannelItem } from "../hooks/listMyChannels"
import "./Chat.css";

interface ChatProps {
  isOpen: boolean;
  onClose: () => void;
}

const sanitizeUserId = (userId: string) =>
  userId.replace(/[^a-zA-Z0-9@_-]/g, "_").slice(0, 64);

const Chat: React.FC<ChatProps> = ({ isOpen, onClose }) => {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();

  const apiKey = import.meta.env.VITE_STREAM_API_KEY as string | undefined;

  const [clientReady, setClientReady] = useState(false);
  const [channel, setChannel] = useState<any>(null);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [selectedChannel, setSelectedChannel] = useState("general");
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Keep a single client instance per tab
  const clientRef = useRef<StreamChat | null>(null);

  // Memoize current user id once
  const rawUserId = user?.sub || user?.email || "anonymous";
  const sanitizedUserId = useMemo(() => sanitizeUserId(rawUserId), [rawUserId]);

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

  const switchChannel = useCallback(
    async (channelId: string) => {
      const client = clientRef.current;
      if (!client) return;
      try {
        let newChannel;
        if (channelId === "general") {
          newChannel = client.channel("messaging", "general", {
            members: [sanitizedUserId],
          });
        } else {
          newChannel = client.channel("messaging", channelId);
        }
        await newChannel.watch();
        setChannel(newChannel);
        setSelectedChannel(channelId);
      } catch (e) {
        console.error("Error switching channel:", e);
      }
    },
    [sanitizedUserId]
  );

  const handleChannelsCreated = useCallback((newChannels: ChannelItem[]) => {
    setChannels(newChannels);
  }, []);

  // Reset state when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setClientReady(false);
      setChannel(null);
      setError(null);
      setIsConnecting(false);
      setSelectedChannel("general");
      setChannels([]);
      // do NOT disconnect here; cleanup runs in main effect’s return
    }
  }, [isOpen]);

  // Main connect effect
  useEffect(() => {
    if (!isOpen) return;
    if (!isAuthenticated || !user) return;

    if (!apiKey) {
      setError(
        "Stream API key not configured. Set VITE_STREAM_API_KEY in your frontend env."
      );
      return;
    }

    let cancelled = false;
    const client = clientRef.current ?? StreamChat.getInstance(apiKey);
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

        // Ensure default channel available and watched
        const general = client.channel("messaging", "general", {
          members: [sanitizedUserId],
        });
        await general.watch();
        if (cancelled) return;

        setChannel(general);
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
    isOpen,
    isAuthenticated,
    user,
    apiKey,
    getStreamToken,
    seedIfNeeded,
    sanitizedUserId,
  ]);

  // --- render states ---
  if (!isOpen) return null;

  if (error) {
    return (
      <div className="chat-error">
        <div className="chat-error-content">
          <div className="text-center">
            <div className="chat-error-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h3 className="chat-error-title">Connection Error</h3>
            <p className="chat-error-message">{error}</p>
            <button onClick={onClose} className="chat-error-button">
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!clientReady || !clientRef.current || !channel) {
    return (
      <div className="chat-loading">
        <div className="chat-loading-content">
          <div className="text-center">
            <div className="chat-loading-spinner"></div>
            <p className="chat-loading-text">
              {isConnecting ? "Reconnecting to chat..." : "Connecting to chat..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const client = clientRef.current;

  return (
    <div className="chat-container">
      {/* Chat Header with Back Button */}
      <div className="chat-header">
        <h1 className="chat-header-title">Messages</h1>
        <button onClick={onClose} className="chat-header-back-button">
          ← Back to Home
        </button>
      </div>

      {/* Layout */}
      <div className="chat-layout">
        {/* Left — Channel List */}
        <ChannelListComponent
          channels={channels}
          selectedChannel={selectedChannel}
          onChannelSelect={switchChannel}
        />

        {/* Right — Chat Area */}
        <div className="chat-area">
          <ChatComponent
            client={client}
            theme="str-chat__theme-light"
            key={`chat-${client.userID || "disconnected"}`}
          >
            <Channel channel={channel}>
              <Window>
                <ChannelHeader />
                <MessageList />
                <MessageInput />
              </Window>
              <Thread />
            </Channel>
          </ChatComponent>
        </div>
      </div>

      {/* Invisible manager: fills your channels via backend seed + query */}
      <SampleChannels
        streamClient={client}
        currentUserId={sanitizedUserId}
        onChannelsCreated={handleChannelsCreated}
      />
    </div>
  );
};

export default Chat;
