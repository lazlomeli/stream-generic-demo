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

interface StreamChatProps {
  isOpen: boolean
  onClose: () => void
}

const Chat: React.FC<StreamChatProps> = ({ isOpen, onClose }) => {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0()
  const [client, setClient] = useState<StreamChat | null>(null)
  const [channel, setChannel] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Function to get Stream token from your backend
  const getStreamToken = async (userId: string): Promise<string> => {
    try {
      const accessToken = await getAccessTokenSilently()
      const response = await fetch('/api/stream/chat-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ userId })
      })

      if (!response.ok) {
        throw new Error('Failed to get chat token from backend')
      }

      const data = await response.json()
      return data.token
    } catch (error) {
      console.error('Error getting Stream token:', error)
      throw new Error('Failed to authenticate with chat service')
    }
  }

  useEffect(() => {
    if (!isOpen || !isAuthenticated || !user) return // TODO: add a loading state
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
        
        const userId = user.sub || user.email || 'anonymous'
    
        const streamToken = await getStreamToken(userId)

        await streamClient.connectUser(
          {
            id: userId,
            name: user.name || user.email || 'Anonymous User',
            image: user.picture || undefined,
          },
          streamToken
        )

        const channel = streamClient.channel('messaging', 'general', {
          // @ts-ignore - Stream types are sometimes strict about channel data
          name: 'General Chat',
          members: [userId],
        })

        await channel.watch()
        setChannel(channel)
        setClient(streamClient)
      } catch (error) {
        console.error('Error connecting to Stream:', error)
        setError('Failed to connect to chat. Please try again.')
      }
    }

    connectUser()

    // Cleanup on unmount
    return () => {
      if (streamClient) {
        streamClient.disconnectUser()
      }
    }
  }, [isOpen, isAuthenticated, user, getAccessTokenSilently])

  if (!isOpen) return null

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L3.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Connection Error</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={onClose}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!client || !channel) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Connecting to chat...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[80vh] mx-4 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full p-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Stream Chat Interface */}
        <div className="h-full">
          <ChatComponent client={client} theme="str-chat__theme-light">
            <ChannelList />
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
    </div>
  )
}

export default Chat
