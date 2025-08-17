import React, { useEffect, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import {
  Chat as ChatComponent,
  Channel,
  ChannelHeader,
  ChannelList,
  MessageInput,
  MessageList,
  Thread,
  Window,
} from 'stream-chat-react'
import { StreamChat } from 'stream-chat'
import 'stream-chat-react/dist/css/v2/index.css'

interface ChatProps {
  isOpen: boolean
  onClose: () => void
}

const Chat: React.FC<ChatProps> = ({ isOpen, onClose }) => {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0()
  const [client, setClient] = useState<StreamChat | null>(null)
  const [channel, setChannel] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  // Function to sanitize user ID for Stream (remove invalid characters)
  const sanitizeUserId = (userId: string): string => {
    // Replace invalid characters with valid ones
    return userId
      .replace(/[^a-zA-Z0-9@_-]/g, '_') // Replace invalid chars with underscore
      .substring(0, 64); // Stream has a 64 character limit
  }

  // Function to get Stream token from your backend
  const getStreamToken = async (userId: string): Promise<string> => {
    try {
      const sanitizedUserId = sanitizeUserId(userId);
      console.log('Getting Stream token for userId:', userId);
      console.log('Sanitized userId for Stream:', sanitizedUserId);
      
      const accessToken = await getAccessTokenSilently();
      console.log('Auth0 access token obtained');
      
      const response = await fetch('/api/stream/chat-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ userId: sanitizedUserId })
      });

      console.log('API Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error('Failed to get chat token from backend');
      }

      const data = await response.json();
      console.log('Stream token received:', data);
      return data.token;
    } catch (error) {
      console.error('Error getting Stream token:', error);
      throw new Error('Failed to authenticate with chat service');
    }
  }

  // Cleanup effect when chat closes
  useEffect(() => {
    if (!isOpen) {
      // Reset state when chat closes
      setClient(null)
      setChannel(null)
      setError(null)
      setIsConnecting(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !isAuthenticated || !user) {
      return
    }

    const apiKey = import.meta.env.VITE_STREAM_API_KEY
    if (!apiKey) {
      setError('Stream API key not configured. Please add VITE_STREAM_API_KEY to your environment variables.')
      return
    }

    // Initialize Stream Chat client
    const streamClient = new StreamChat(apiKey)

    // Connect user to Stream
    const connectUser = async () => {
      try {
        setError(null)
        setIsConnecting(true)
        
        const userId = user.sub || user.email || 'anonymous'
        const sanitizedUserId = sanitizeUserId(userId)
        
        // Stream will automatically create the user when we connect
        // No need for separate user creation endpoint
        
        // Get Stream token from your backend
        const streamToken = await getStreamToken(userId)

        await streamClient.connectUser(
          {
            id: sanitizedUserId,
            name: user.name || user.email || 'Anonymous User',
            image: user.picture || undefined,
          },
          streamToken
        )

        const channel = streamClient.channel('messaging', 'general', {
          // @ts-ignore - Stream types are sometimes strict about channel data
          name: 'General Chat',
          members: [sanitizedUserId],
        })

        await channel.watch()
        setChannel(channel)
        setClient(streamClient)
        setIsConnecting(false)
      } catch (error) {
        console.error('Error connecting to Stream:', error)
        setError('Failed to connect to chat. Please try again.')
        setIsConnecting(false)
        // Clean up failed client
        try {
          streamClient.disconnectUser()
        } catch (cleanupError) {
          console.warn('Error during failed client cleanup:', cleanupError)
        }
      }
    }

    connectUser()

    // Cleanup on unmount or when chat closes
    return () => {
      try {
        streamClient.disconnectUser()
      } catch (error) {
        console.warn('Error during cleanup:', error)
      }
    }
  }, [isOpen, isAuthenticated, user, getAccessTokenSilently])

  if (!isOpen) return null

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-lg">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Connection Error</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={onClose}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!client || !channel) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">
              {isConnecting ? 'Reconnecting to chat...' : 'Connecting to chat...'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-white">
      {/* Chat Header with Back Button */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Stream Chat</h1>
        <button
          onClick={onClose}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          ← Back to Home
        </button>
      </div>

      {/* Stream Chat Interface */}
      <div className="h-[calc(100vh-8rem)]">
        <ChatComponent 
          client={client} 
          theme="str-chat__theme-light"
          key={`chat-${client?.userID || 'disconnected'}`}
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
  )
}

export default Chat
