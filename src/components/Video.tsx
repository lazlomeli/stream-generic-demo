import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  LivestreamLayout,
  useCallStateHooks,
  CallingState,
  CallControls,
  SpeakerLayout,
  ParticipantView,
  useCall,
} from '@stream-io/video-react-sdk'
import { StreamChat, Channel as StreamChannel } from 'stream-chat'
import {
  Chat as StreamChatUI,
  Channel as StreamChannelUI,
  MessageList,
  MessageInput,
  Thread,
  Window,
  Message,
} from 'stream-chat-react'
import LoadingSpinner from './LoadingSpinner'
import LivestreamSetup from './LivestreamSetup'
import { getSanitizedUserId } from '../utils/userUtils'
import { useUILayout } from '../App'

// Import SVG icons for UI elements
import ViewersIcon from '../icons/viewers.svg'
import MessageCircleIcon from '../icons/message-circle.svg'
import CaretIcon from '../icons/caret.svg'
// Import SVG icons for custom controls
import MicrophoneIcon from '../icons/microphone.svg'
import MicrophoneOffIcon from '../icons/microphone-off.svg'
import VideoIcon from '../icons/video.svg'
import VideoOffIcon from '../icons/video-off.svg'
import HeartIcon from '../icons/heart.svg'
import DeviceDesktopIcon from '../icons/device-desktop.svg'
import StopIcon from '../icons/stop.svg'
import videoLoop from '../assets/video-loop.mov'
import 'stream-chat-react/dist/css/v2/index.css'
import '@stream-io/video-react-sdk/dist/css/styles.css'
import './Video.css'

// Message styling is now handled in Video.css

// Generate consistent random color for username based on user ID
const generateUserColor = (userId: string): string => {
  // Use a simple hash function to generate consistent colors
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate HSL color with good saturation and lightness for readability
  const hue = Math.abs(hash % 360);
  const saturation = 70 + (Math.abs(hash) % 30); // 70-100%
  const lightness = 45 + (Math.abs(hash) % 20);  // 45-65%
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

// Custom Message Bubble Component
interface CustomMessageBubbleProps {
  message: any
  hostUserId: string
  isCurrentUser: boolean
}

const CustomMessageBubble: React.FC<CustomMessageBubbleProps> = ({ message, hostUserId, isCurrentUser }) => {
  if (!message || !message.text) {
    return null
  }
  
  // Filter out system messages (stream notifications)
  if (message.type === 'system') {
    return null
  }
  
  // Also filter out messages that look like system notifications
  try {
    const parsed = JSON.parse(message.text)
    if (parsed.type && parsed.type.startsWith('stream.')) {
      return null
    }
  } catch (e) {
    // Not JSON, continue with normal message display
  }
    
    // Extract user data safely
    const messageUser = message.user || {}
  const messageUserId = messageUser.id || 'unknown'
    const messageUserName = messageUser.name || messageUser.display_name || messageUserId || 'Unknown'
    
    // Check if this message is from the host
    const isMessageFromHost = messageUserId === hostUserId
    
    // Generate consistent color for this user
    const userColor = generateUserColor(messageUserId)
    
    return (
    <div className="custom-message-bubble">
        {/* LIVE badge for host messages */}
        {isMessageFromHost && (
          <span className="live-badge">LIVE</span>
        )}
        
        {/* Username with color */}
        <span 
        className="username" 
          style={{ color: userColor }}
        >
          {messageUserName}
        </span>
        
        {/* Message separator */}
      <span className="separator">: </span>
        
        {/* Message text */}
      <span className="message-text">
        {message.text}
        </span>
      </div>
    )
}

// Custom Message List Component
interface CustomMessageListProps {
  channel: StreamChannel | null
  hostUserId: string
  currentUserId: string
}

const CustomMessageList: React.FC<CustomMessageListProps> = ({ channel, hostUserId, currentUserId }) => {
  const [messages, setMessages] = useState<any[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (!channel) return

    // Get initial messages
    const loadMessages = async () => {
      try {
        const result = await channel.query({ messages: { limit: 50 } })
        setMessages(result.messages || [])
        setTimeout(scrollToBottom, 100)
  } catch (error) {
        console.error('Failed to load messages:', error)
      }
    }

    loadMessages()

    // Listen for new messages
    const handleNewMessage = (event: any) => {
      console.log('📨 New message received:', event.message)
      setMessages(prev => [...prev, event.message])
      setTimeout(scrollToBottom, 100)
    }

    const handleMessageUpdated = (event: any) => {
      console.log('📝 Message updated:', event.message)
      setMessages(prev => prev.map(msg => 
        msg.id === event.message.id ? event.message : msg
      ))
    }

    const handleMessageDeleted = (event: any) => {
      console.log('🗑️ Message deleted:', event.message)
      setMessages(prev => prev.filter(msg => msg.id !== event.message.id))
    }

    // Set up event listeners
    channel.on('message.new', handleNewMessage)
    channel.on('message.updated', handleMessageUpdated)
    channel.on('message.deleted', handleMessageDeleted)

    // Cleanup
    return () => {
      channel.off('message.new', handleNewMessage)
      channel.off('message.updated', handleMessageUpdated)
      channel.off('message.deleted', handleMessageDeleted)
    }
  }, [channel])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  if (!channel) {
    return (
      <div className="custom-message-list loading">
        <p>Loading chat...</p>
      </div>
    )
  }

  return (
    <div className="custom-message-list">
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <CustomMessageBubble
              key={message.id}
              message={message}
              hostUserId={hostUserId}
              isCurrentUser={message.user?.id === currentUserId}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

// Custom Message Input Component
interface CustomMessageInputProps {
  channel: StreamChannel | null
  currentUserId: string
  isReadOnly?: boolean
}

const CustomMessageInput: React.FC<CustomMessageInputProps> = ({ channel, currentUserId, isReadOnly = false }) => {
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const sendMessage = async () => {
    if (!channel || !message.trim() || isSending || isReadOnly) return

    setIsSending(true)
    try {
      await channel.sendMessage({
        text: message.trim(),
      })
      setMessage('')
      // Focus back on input after sending
      setTimeout(() => inputRef.current?.focus(), 100)
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage()
  }

  if (!channel) {
    return (
      <div className="custom-message-input disabled">
        <input 
          type="text" 
          placeholder="Chat unavailable..." 
          disabled 
          className="input-field disabled"
        />
      </div>
    )
  }

  if (isReadOnly) {
    return (
      <div className="custom-message-input disabled">
        <input 
          type="text" 
          placeholder="Sign in to chat..." 
          disabled 
          className="input-field disabled"
        />
      </div>
    )
  }

  return (
    <form className="custom-message-input" onSubmit={handleSubmit}>
      <div className="input-container">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Escribe tu mensaje..."
          className="input-field"
          disabled={isSending}
          maxLength={1000}
          autoComplete="off"
        />
        <button
          type="submit"
          className={`send-button ${!message.trim() || isSending ? 'disabled' : ''}`}
          disabled={!message.trim() || isSending}
          title="Send message"
        >
          {isSending ? (
            <div className="sending-spinner">⏳</div>
          ) : (
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M2 21L23 12L2 3V10L17 12L2 14V21Z" 
                fill="currentColor"
              />
            </svg>
          )}
        </button>
      </div>
    </form>
  )
}

// Viewer Waiting Room Component - shown when viewers join a backstage livestream
interface ViewerWaitingRoomProps {
  chatClient: StreamChat | null
  channel: StreamChannel | null
  streamTitle: string
  callId: string
  call: any
  isAnonymousViewer?: boolean
  isAuthenticatedViewer?: boolean
  onStreamGoesLive?: () => void
}

const ViewerWaitingRoom: React.FC<ViewerWaitingRoomProps> = ({
  chatClient,
  channel,
  streamTitle,
  callId,
  call,
  isAnonymousViewer = false,
  isAuthenticatedViewer = false,
  onStreamGoesLive
}) => {
  const { useParticipants } = useCallStateHooks()
  const participants = useParticipants()

  // Stream automatically handles participant updates through the video call

  // No need for custom participant updates - Stream handles this automatically through video call participants

  // Count waiting participants from Stream's native participant list
  // Include all participants for waiting room display
  const waitingParticipants = participants
  
  // Debug logging for waiting room
  console.log('🚪 WAITING ROOM DEBUG:', {
    totalParticipants: participants.length,
    waitingParticipants: waitingParticipants.length,
    allParticipants: participants.map(p => ({
      userId: p.userId,
      name: p.name,
      isLocal: p.isLocalParticipant,
      sessionId: p.sessionId
    })),
    isAnonymousViewer,
    isAuthenticatedViewer
  })

  // Listen for "stream went live" messages from the streamer
  useEffect(() => {
    if (!channel) return // Allow all viewers to listen, regardless of auth type

    const handleStreamEvent = (event: any) => {
      console.log('📡 Received chat event:', event.message?.type, event.message?.text)
      if (event.message?.type === 'system' && event.message?.text) {
        try {
          const data = JSON.parse(event.message.text)
          console.log('📋 Parsed system message:', data)
          if (data.type === 'stream.went_live') {
            console.log('🔴 Stream went live - transitioning viewer!')
            if (onStreamGoesLive) {
              onStreamGoesLive()
            }
          }
        } catch (e) {
          console.log('📋 Not a JSON system message:', e)
          // Not a system message, ignore
        }
      }
    }

    channel.on('message.new', handleStreamEvent)
    
    return () => {
      channel.off('message.new', handleStreamEvent)
    }
  }, [channel, onStreamGoesLive]) // Simplified dependencies


  const handleExit = () => {
    window.location.href = '/feeds'
  }

  return (
    <div className="viewer-waiting-room">
      {/* Background */}
      <video 
        className="waiting-room-video-background"
        autoPlay 
        loop 
        muted 
        playsInline
      >
        <source src={videoLoop} type="video/mp4" />
        <source src={videoLoop} type="video/quicktime" />
      </video>

      {/* Main Content */}
      <div className="waiting-room-content">
        <button className="exit-btn" onClick={handleExit}>
          Exit
        </button>
        
        <div className="waiting-room-header">
          <h1>🔴 Waiting for Stream to Start</h1>
          {streamTitle && <h2>{streamTitle}</h2>}
          <p>The streamer is getting ready. You'll be able to watch once they go live!</p>
        </div>

        {/* Stream Status */}
        <div className="waiting-room-timer">
          <div className="timer-display">
            <span className="timer-label">🎬 Stream will start soon</span>
            <span className="timer-value">
              Please wait...
            </span>
          </div>
        </div>

        {/* Waiting Room Participants */}
        <div className="waiting-room-participants">
          <h3>
            <img src={ViewersIcon} alt="Waiting" className="section-icon" />
            Waiting Room ({waitingParticipants.length}) {/* All participants including viewer */}
          </h3>
          
          <div className="participants-list">
            {/* Show current user */}
            <div className="waiting-participant current-user">
              <div className="participant-avatar">👤</div>
              <div className="participant-info">
                <span className="participant-name">You</span>
                <span className="participant-status">Waiting to watch</span>
              </div>
            </div>
            
            {/* Show other participants */}
            {waitingParticipants.filter(p => !p.isLocalParticipant).map((participant) => {
              // Determine if this participant is the streamer 
              // Streamers are authenticated users who are not anonymous viewers
              const isStreamer = participant.userId && 
                                !participant.userId.startsWith('viewer_') && 
                                !participant.userId.startsWith('anonymous_');
              
              console.log('🎭 Participant analysis:', {
                userId: participant.userId,
                name: participant.name,
                isLocal: participant.isLocalParticipant,
                isStreamer: isStreamer
              });
              
              return (
                <div key={participant.sessionId || participant.userId} className={`waiting-participant ${isStreamer ? 'streamer' : ''}`}>
                  <div className="participant-avatar">
                    {participant.image ? (
                      <img src={participant.image} alt={participant.name} />
                    ) : (
                      <div className="avatar-placeholder">
                        {(participant.name || participant.userId)?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                  <div className="participant-info">
                    <span className="participant-name">
                      {participant.name || participant.userId || 'Anonymous User'}
                      {isStreamer && <span className="live-badge">LIVE</span>}
                    </span>
                    <span className="participant-status">
                      {isStreamer ? 'Streaming live' : 'Waiting to watch'}
                    </span>
                  </div>
                </div>
              );
            })}
            
            {waitingParticipants.filter(p => !p.isLocalParticipant).length === 0 && (
              <p className="no-other-participants">You're the first viewer waiting!</p>
            )}
          </div>
        </div>
      </div>

      {/* Chat Sidebar */}
      <div className="waiting-room-chat">
        <h3>
          <img src={MessageCircleIcon} alt="Chat" className="section-icon" />
          Pre-stream Chat
        </h3>
        {chatClient && channel && chatClient.userID && chatClient.user ? (
          <div className="stream-chat-container" style={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <ChatErrorBoundary>
              <StreamChatUI client={chatClient} theme="str-chat__theme-dark">
                <StreamChannelUI channel={channel}>
                  <Window>
                    <div style={{ 
                      flex: 1, 
                      minHeight: 0,
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <CustomMessageList
                        channel={channel}
                        hostUserId=""
                        currentUserId={chatClient?.userID || ''}
                      />
                    </div>
                    <CustomMessageInput
                      channel={channel}
                      currentUserId={chatClient?.userID || ''}
                      isReadOnly={isAnonymousViewer}
                    />
                  </Window>
                  <Thread />
                </StreamChannelUI>
              </StreamChatUI>
            </ChatErrorBoundary>
          </div>
        ) : (
          <div className="chat-loading">
            <LoadingSpinner darkMode />
            <p>Connecting to chat...</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Error Boundary for Stream Chat components
class ChatErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('💥 Chat Error Boundary caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="chat-error" style={{ 
          padding: '1rem', 
          textAlign: 'center', 
          backgroundColor: '#ff000010', 
          border: '1px solid #ff0000',
          borderRadius: '4px',
          margin: '1rem 0'
        }}>
          <h3>💬 Chat Temporarily Unavailable</h3>
          <p>There was an issue loading the chat. Please refresh the page.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Refresh Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}


interface VideoProps {}

const Video: React.FC<VideoProps> = () => {
  const { user, isAuthenticated, getAccessTokenSilently, isLoading } = useAuth0()
  const { setHideHeader } = useUILayout()

  const apiKey = import.meta.env.VITE_STREAM_API_KEY as string | undefined
  
  // Early guard: if we're loading or user should be available but isn't, show loading
  if (isLoading) {
    return <LoadingSpinner />
  }

  const [videoClientReady, setVideoClientReady] = useState(false)
  const [chatClientReady, setChatClientReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [initializationAttempted, setInitializationAttempted] = useState(false)
  const [setupCompleted, setSetupCompleted] = useState(false)
  const [backstageMode, setBackstageMode] = useState(false)
  const [livestreamActive, setLivestreamActive] = useState(false)
  const [streamTitle, setStreamTitle] = useState('')
  const [streamConfig, setStreamConfig] = useState<{
    streamType: 'webrtc' | 'rtmp'
    streamKey?: string
    streamUrl?: string
  } | null>(null)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [callId, setCallId] = useState<string>('')

  // Keep single client instances per tab
  const videoClientRef = useRef<StreamVideoClient | null>(null)
  const chatClientRef = useRef<StreamChat | null>(null)
  const callRef = useRef<any>(null)
  const channelRef = useRef<StreamChannel | null>(null)
  const cleanupInProgressRef = useRef<Set<string>>(new Set())
  
  // Global cleanup tracking to prevent duplicate cleanups across component instances
  const globalCleanupTracker = useMemo(() => {
    if (typeof window !== 'undefined') {
      if (!window.__streamCleanupTracker) {
        window.__streamCleanupTracker = new Set<string>();
      }
      return window.__streamCleanupTracker;
    }
    return new Set<string>();
  }, []);

  // Memoize current user id using shared utility - with proper null checking
  const sanitizedUserId = useMemo(() => {
    if (!user) {
      console.log('⚠️ User not yet loaded, using anonymous ID')
      return 'anonymous'
    }
    return getSanitizedUserId(user)
  }, [user])

  // Check if there's a live stream ID in URL parameters
  const urlParams = new URLSearchParams(window.location.search)
  const liveStreamId = urlParams.get('live')

  // Check if user is joining via a livestream link
  const hasLiveStreamLink = !!liveStreamId
  
  // Determine user role based on authentication and URL
  const isAnonymousViewer = hasLiveStreamLink && !isAuthenticated
  const isAuthenticatedViewer = hasLiveStreamLink && isAuthenticated  
  const isStreamer = !hasLiveStreamLink && isAuthenticated
  
  // For backward compatibility, isViewer includes both anonymous and authenticated viewers
  const isViewer = hasLiveStreamLink
  
  // Generate consistent anonymous user ID only for anonymous viewers
  const anonymousViewerId = useMemo(() => {
    if (isAnonymousViewer) {
      return `viewer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
    return null
  }, [isAnonymousViewer])

  // Handle setup completion - go to backstage mode first
  const handleSetupComplete = (config: {
    streamType: 'webrtc' | 'rtmp'
    streamKey?: string
    streamUrl?: string
  }) => {
    setStreamConfig(config)
    setSetupCompleted(true)
    setBackstageMode(true)
    setHideHeader(true) // Hide header when entering backstage
  }

  // Debug logging for viewer detection
  console.log('=== VIDEO COMPONENT DEBUG ===')
  console.log('Current URL:', window.location.href)
  console.log('URL search params:', window.location.search)
  console.log('Parsed liveStreamId:', liveStreamId)
  console.log('hasLiveStreamLink:', hasLiveStreamLink)
  console.log('isAnonymousViewer:', isAnonymousViewer)
  console.log('isAuthenticatedViewer:', isAuthenticatedViewer)
  console.log('isStreamer:', isStreamer)
  console.log('Auth0 isLoading:', isLoading)
  console.log('isAuthenticated from Auth0:', isAuthenticated)
  console.log('Auth0 user object:', user)
  console.log('sanitizedUserId:', sanitizedUserId)
  console.log('=== END DEBUG ===')

  // Early return for debugging if there's an issue
  if (isAnonymousViewer) {
    console.log('🔍 ANONYMOUS VIEWER MODE: Should bypass auth requirements')
  } else if (isAuthenticatedViewer) {
    console.log('🔍 AUTHENTICATED VIEWER MODE: User is authenticated and joining via link')
  }

  
  // Additional safety check - if user is expected but not loaded, show loading
  if (!isAnonymousViewer && isAuthenticated && !user) {
    console.log('⏳ User authenticated but user object not yet loaded...')
    return <LoadingSpinner />
  }
  
  // Set initial state for viewers
  useEffect(() => {
    if (isViewer) {
      setSetupCompleted(true) // Skip setup for viewers
      // Don't automatically set backstageMode or livestreamActive
      // Let the call state determine what viewers should see
    }
  }, [isViewer])

  // Set header visibility for viewers
  useEffect(() => {
    if (isViewer) {
      setHideHeader(true) // Hide header for viewers too
    }
  }, [isViewer, setHideHeader])

  // Handle going live from backstage
  const handleGoLive = () => {
    setBackstageMode(false)
    setLivestreamActive(true)
  }

  const handleSidebarToggle = () => {
    setSidebarVisible(!sidebarVisible)
  }

  // --- Token helpers ---
  const getStreamToken = useCallback(
    async (type: 'video' | 'chat'): Promise<string> => {
      // Handle anonymous viewers
      if (isAnonymousViewer && anonymousViewerId) {
        const res = await fetch('/api/stream/auth-tokens', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type,
            userId: anonymousViewerId,
            userProfile: {
              name: 'Anonymous Viewer',
              image: undefined,
              role: 'user' // Anonymous viewers get user role
            }
          }),
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`auth-tokens failed: ${res.status} ${text}`)
        }
        const json = await res.json()
        return json.token as string
      }

      // Handle authenticated users (both viewers and streamers)
      const accessToken = await getAccessTokenSilently()
      const res = await fetch('/api/stream/auth-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          type,
          userId: sanitizedUserId,
          userProfile: {
            name: user?.name || user?.email || `User_${sanitizedUserId}`,
            image: user?.picture || undefined,
            role: isStreamer ? 'admin' : 'user' // Streamers get admin role, authenticated viewers get user role
          }
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`auth-tokens failed: ${res.status} ${text}`)
      }
      const json = await res.json()
      return json.token as string
    },
    [getAccessTokenSilently, user, sanitizedUserId, isAnonymousViewer, isStreamer, anonymousViewerId]
  )

  // --- Initialize Video Client ---
  const initializeVideoClient = useCallback(async (sharedCallId: string) => {
    // Use anonymous ID for anonymous viewers, authenticated ID for everyone else
    const effectiveUserId = isAnonymousViewer 
      ? anonymousViewerId
      : sanitizedUserId
      
    if (!apiKey || !effectiveUserId || videoClientRef.current) {
      console.log('🚫 Skipping video client initialization:', { hasApiKey: !!apiKey, hasEffectiveUserId: !!effectiveUserId, hasExistingClient: !!videoClientRef.current })
      return
    }

    try {
      console.log('🎥 Initializing video client for user:', effectiveUserId, isViewer ? '(viewer)' : '(streamer)')
      
      const videoToken = await getStreamToken('video')
      console.log('🔑 Video token obtained:', videoToken.substring(0, 50) + '...')

      const userConfig = {
        id: effectiveUserId as string, // We already checked effectiveUserId is not null above
        name: isAnonymousViewer 
          ? 'Anonymous Viewer' 
          : (user?.name || user?.email || `User_${effectiveUserId}`),
        image: isAnonymousViewer ? undefined : (user?.picture || undefined),
      }
      
      console.log('👤 Creating video client with user config:', userConfig)
      
      const videoClient = new StreamVideoClient({
        apiKey,
        user: userConfig,
        token: videoToken,
      })

      videoClientRef.current = videoClient
      setVideoClientReady(true)
      console.log('✅ Video client initialized successfully')
      console.log('🔧 setVideoClientReady(true) called - state should update now')

      // Use the shared call ID that was calculated once
      setCallId(sharedCallId)
      
      // Create or join a livestream call
      console.log('📞 Creating call with ID:', sharedCallId, 'for user role: admin')
      const call = videoClient.call('livestream', sharedCallId)
      callRef.current = call

      // Create the call with backstage explicitly disabled to avoid permission issues for viewers
      try {
        console.log('🔧 Creating/joining call with backstage disabled...')
        await call.getOrCreate({
          data: {
            settings_override: {
              backstage: {
                enabled: false, // Explicitly disable backstage
              },
            },
          },
        })
        console.log('✅ Call created/joined successfully with backstage disabled')
        
        if (isViewer) {
          // For viewers, join the call with viewer-specific options to avoid backstage permissions
          console.log('👁️ Viewer joining call to receive video streams...')
          
          try {
            // Join as viewer - should work now that backstage is disabled
            await call.join()
            console.log('✅ Viewer joined livestream call successfully')
            
            // Debug: Check participants after joining
            setTimeout(() => {
              const currentParticipants = call.state.participants
              console.log('🔍 POST-JOIN PARTICIPANT CHECK:', {
                participantCount: currentParticipants?.length || 0,
                participants: currentParticipants?.map(p => ({
                  userId: p.userId,
                  name: p.name,
                  isLocal: p.isLocalParticipant,
                  sessionId: p.sessionId
                })) || []
              })
            }, 1000)
            
            // Since we're not using Stream's backstage mode, determine state based on our UI state
            console.log('📊 Viewer joined call successfully - checking current stream state')
            
            // For viewers, start in waiting room mode by default
            // The streamer's UI state will determine when to transition to live
            console.log('⏳ Starting in waiting room - will transition when streamer goes live')
            setBackstageMode(true)
            setLivestreamActive(false)
            
            // Listen for call ended events
            call.on('call.ended', () => {
              console.log('🔴 Stream ended')
              setLivestreamActive(false)
            })
            
          } catch (joinError) {
            console.warn('⚠️ Failed to join call as viewer:', joinError)
            // Fallback to showing waiting room without video
            setBackstageMode(true)
            setLivestreamActive(false)
          }
        } else {
          // For streamers, join the call normally
          await call.join()
          console.log('✅ Streamer joined livestream call')
        }

      } catch (joinError) {
        console.error('❌ Failed to create/join call:', joinError)
        const errorMessage = joinError instanceof Error ? joinError.message : 'Unknown error'
        throw new Error(`Failed to join livestream: ${errorMessage}`)
      }

    } catch (err) {
      console.error('❌ Failed to initialize video client:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize video')
    }
  }, [apiKey, sanitizedUserId, getStreamToken, user, anonymousViewerId, isAnonymousViewer, isViewer])

  // --- Initialize Chat Client ---
  const initializeChatClient = useCallback(async (sharedCallId: string) => {
    // Initialize chat for all users (including anonymous viewers for read-only access)
    if (!apiKey || !sanitizedUserId || chatClientRef.current) {
      console.log('💬 Skipping chat client initialization:', { 
        isAnonymousViewer, 
        isAuthenticatedViewer, 
        hasApiKey: !!apiKey, 
        hasSanitizedUserId: !!sanitizedUserId, 
        hasExistingClient: !!chatClientRef.current 
      })
      return
    }

    try {
      console.log('💬 Initializing chat client for user:', sanitizedUserId)
      
      const chatToken = await getStreamToken('chat')
      
      const chatClient = StreamChat.getInstance(apiKey)
      await chatClient.connectUser(
        {
          id: sanitizedUserId,
          name: user?.name || user?.email || `User_${sanitizedUserId}`,
          image: user?.picture || undefined,
        },
        chatToken
      )

      chatClientRef.current = chatClient
      setChatClientReady(true)
      console.log('✅ Chat client initialized successfully')

      // Create or get the livestream chat channel using the shared call ID
      // CRITICAL: All participants must use the exact same channel ID
      
      // DEBUGGING: Log all ID sources
      console.log('🔍 CHAT CHANNEL DEBUG - Using shared call ID:', {
        sharedCallId,
        liveStreamId,
        isViewer,
        isStreamer,
        urlParams: window.location.search,
        urlParamsLive: new URLSearchParams(window.location.search).get('live')
      })
      
      // Use the shared call ID that was calculated consistently for all users
      const channelId = sharedCallId
      
      console.log('💬 Creating/joining chat channel with ID:', channelId)
      
      // Different logic for streamers vs viewers
      if (isStreamer) {
        // Streamers: Create the livestream channel
        console.log('🎬 Streamer creating livestream channel via API...')
        
        const accessToken = await getAccessTokenSilently()
        
        const createChannelResponse = await fetch('/api/stream/chat-operations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            type: 'create-livestream-channel',
            channelId: channelId,
            userId: sanitizedUserId
          }),
        })

        if (!createChannelResponse.ok) {
          const errorText = await createChannelResponse.text()
          throw new Error(`Failed to create livestream channel: ${createChannelResponse.status} ${errorText}`)
        }

        const createChannelResult = await createChannelResponse.json()
        console.log('✅ Livestream channel created by streamer:', createChannelResult)
        
      } else if (isAuthenticatedViewer) {
        // Authenticated viewers: Add themselves to existing channel
        console.log('👤 Authenticated viewer joining existing livestream channel via API...')
        
        const accessToken = await getAccessTokenSilently()
        
        const joinChannelResponse = await fetch('/api/stream/chat-operations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            type: 'create-livestream-channel', // This handles both create and join
            channelId: channelId,
            userId: sanitizedUserId
          }),
        })

        if (!joinChannelResponse.ok) {
          const errorText = await joinChannelResponse.text()
          throw new Error(`Failed to join livestream channel: ${joinChannelResponse.status} ${errorText}`)
        }

        const joinChannelResult = await joinChannelResponse.json()
        console.log('✅ Authenticated viewer joined livestream channel:', joinChannelResult)
        
      } else {
        // Anonymous viewers: Add themselves to existing channel for read access
        console.log('👁️ Anonymous viewer joining existing livestream channel for read access...')
        
        const joinChannelResponse = await fetch('/api/stream/chat-operations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'create-livestream-channel', // This handles both create and join
            channelId: channelId,
            userId: sanitizedUserId // Use anonymous viewer ID
          }),
        })

        if (!joinChannelResponse.ok) {
          const errorText = await joinChannelResponse.text()
          console.warn(`⚠️ Failed to join livestream channel as anonymous viewer: ${joinChannelResponse.status} ${errorText}`)
          // Continue anyway - they can still watch the video
        } else {
          const joinChannelResult = await joinChannelResponse.json()
          console.log('✅ Anonymous viewer joined livestream channel for read access:', joinChannelResult)
        }
      }

      // Create chat channel for all users (including anonymous viewers for read access)
      if (chatClient) {
        // Now connect to the existing channel (no need to create client-side)
        const channel = chatClient.channel('livestream', channelId)
        
        console.log('👀 Watching existing livestream channel...')
        await channel.watch() // Watch for real-time updates
        channelRef.current = channel
        
        // Ensure chat client is fully connected before proceeding
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        console.log('✅ Joined livestream chat channel - Stream will handle real-time updates:', {
          channelId: channel.id,
          channelType: channel.type,
          channelCid: channel.cid,
          memberCount: Object.keys(channel.state.members).length,
          currentUserId: sanitizedUserId,
          members: Object.keys(channel.state.members),
          clientConnected: !!chatClient.userID,
          clientUser: chatClient.user?.id,
          initialMessages: channel.state.messages?.length || 0,
          // channelConfig: channel.state.config, // Commented out due to TS error
          permissions: channel.state.membership?.channel_role
        })
        
        // Debug: Log any existing messages
        if (channel.state.messages && channel.state.messages.length > 0) {
          console.log('📨 Existing messages in channel:', channel.state.messages.map(m => ({
            id: m.id,
            text: m.text,
            user: m.user?.id,
            created_at: m.created_at
          })))
        }
        
        // Debug: Set up message event listener to track real-time updates
        const messageListener = (event: any) => {
          console.log('🔔 REAL-TIME MESSAGE EVENT:', {
            type: event.type,
            messageId: event.message?.id,
            text: event.message?.text,
            userId: event.message?.user?.id,
            channelId: event.channel?.id,
            totalMessages: channel.state.messages?.length || 0
          })
          
          // Force a re-render by triggering a state update
          setChatClientReady(prev => prev) // This will trigger a re-render without changing the value
        }
        
        channel.on('message.new', messageListener)
        
        // Store the listener for cleanup
        ;(channelRef.current as any)._messageListener = messageListener
        
        // Force initial query to ensure we have all messages
        try {
          console.log('🔄 Force-querying channel for existing messages...')
          await channel.query({ messages: { limit: 50 } })
          console.log('✅ Channel query completed, messages should be visible')
        } catch (queryError) {
          console.warn('⚠️ Failed to query channel messages:', queryError)
        }
      } else {
        console.log('💬 Skipping chat channel setup (anonymous viewer or no chat client)')
      }

    } catch (err) {
      console.error('❌ Failed to initialize chat client:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize chat')
    }
  }, [apiKey, sanitizedUserId, getStreamToken, user, isAnonymousViewer, isAuthenticatedViewer])

  // --- Main initialization effect ---
  useEffect(() => {
    // Different initialization logic for different user types
    if (isAnonymousViewer) {
      // For anonymous viewers: only need apiKey and setupCompleted, don't require authentication
      if (!apiKey || isConnecting || initializationAttempted || !setupCompleted) {
        return
      }
    } else {
      // For authenticated users (streamers and authenticated viewers): require authentication AND user object
      if (!isAuthenticated || !user || !apiKey || !sanitizedUserId || isConnecting || initializationAttempted || !setupCompleted) {
        console.log('⏳ Waiting for initialization requirements:', {
          isAuthenticated,
          hasUser: !!user,
          hasApiKey: !!apiKey,
          hasSanitizedUserId: !!sanitizedUserId,
          isConnecting,
          initializationAttempted,
          setupCompleted
        })
        return
      }
    }

    const initialize = async () => {
      setIsConnecting(true)
      setError(null)
      setInitializationAttempted(true)

      try {
        // Calculate the shared call ID once that both video and chat will use
        // This ensures perfect synchronization between video call and chat channel
        const sharedCallId = liveStreamId || `live-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        
        console.log('🔄 Initializing with shared call ID:', sharedCallId, {
          liveStreamId,
          isViewer,
          isStreamer,
          isAnonymousViewer
        })

        // Initialize video and chat for all users (including anonymous viewers for read-only chat)
        await Promise.all([
          initializeVideoClient(sharedCallId),
          initializeChatClient(sharedCallId)
        ])
      } catch (err) {
        console.error('❌ Failed to initialize clients:', err)
        setError(err instanceof Error ? err.message : 'Failed to initialize')
        // Don't retry automatically - user can refresh page if needed
      } finally {
        setIsConnecting(false)
      }
    }

    initialize()
  }, [isAuthenticated, user, apiKey, sanitizedUserId, setupCompleted, isAnonymousViewer, liveStreamId]) // Removed initializationAttempted to prevent cleanup loop

  // --- Cleanup livestream channel function ---
  const cleanupLivestreamChannel = useCallback(async (channelId: string) => {
    // Only cleanup if user is authenticated and is the streamer (creator)
    if (!isAuthenticated || !user || !isStreamer || !sanitizedUserId) {
      console.log('🚫 Skipping livestream cleanup - not authenticated streamer');
      return;
    }

    // Prevent duplicate cleanup attempts (both local and global)
    if (cleanupInProgressRef.current.has(channelId) || globalCleanupTracker.has(channelId)) {
      console.log(`🚫 Cleanup already in progress for channel: ${channelId}`);
      return;
    }

    cleanupInProgressRef.current.add(channelId);
    globalCleanupTracker.add(channelId);

    try {
      console.log(`🧹 Cleaning up livestream channel: ${channelId}`);
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const accessToken = await getAccessTokenSilently();
      
      const response = await fetch('/api/stream/chat-operations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          type: 'cleanup-livestream-channel',
          channelId: channelId,
          userId: sanitizedUserId
        }),
      });

      if (response.ok) {
        console.log(`✅ Successfully cleaned up livestream channel: ${channelId}`);
      } else {
        console.warn(`⚠️ Failed to cleanup livestream channel: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up livestream channel:', error);
      // Don't throw - cleanup failures shouldn't block user navigation
    } finally {
      // Always remove from in-progress sets when done
      cleanupInProgressRef.current.delete(channelId);
      globalCleanupTracker.delete(channelId);
    }
  }, [isAuthenticated, user, isStreamer, sanitizedUserId, getAccessTokenSilently]);

  // --- Cleanup effect ---
  useEffect(() => {
    return () => {
      console.log('🧹 Cleanup effect triggered! Current state:', {
        callId,
        isStreamer,
        videoClientReady,
        chatClientReady
      });
      
      // Cleanup livestream channel if this is a streamer
      if (callId && isStreamer) {
        console.log('🧹 Cleaning up livestream channel on component unmount...');
        cleanupLivestreamChannel(callId);
      }
      
      if (callRef.current) {
        callRef.current.leave().catch(console.warn)
        callRef.current = null
      }
      if (chatClientRef.current) {
        chatClientRef.current.disconnectUser().catch(console.warn)
        chatClientRef.current = null
      }
      
      // Clean up message listener
      if (channelRef.current && (channelRef.current as any)._messageListener) {
        channelRef.current.off('message.new', (channelRef.current as any)._messageListener)
        delete (channelRef.current as any)._messageListener
      }
      
      if (videoClientRef.current) {
        videoClientRef.current = null
      }
      // Reset state for potential re-initialization (but keep initializationAttempted to prevent re-runs)
      setVideoClientReady(false)
      setChatClientReady(false)
      setIsConnecting(false)
      setError(null)
      setHideHeader(false) // Show header again when leaving
    }
  }, [setHideHeader, isStreamer]) // Removed callId to prevent cleanup during initialization

  // --- Render helpers ---
  // Only require authentication for streamers, not anonymous viewers
  if (!isAuthenticated && !isAnonymousViewer) {
    return <div className="video-error">Please log in to access the livestream.</div>
  }

  if (!apiKey) {
    return <div className="video-error">Stream API key not configured.</div>
  }

  // Show setup screen if not completed and user is not a viewer
  if (!setupCompleted && !isViewer) {
    return <LivestreamSetup onSetupComplete={handleSetupComplete} />
  }


  // Debug state values
  console.log('🔍 VIDEO DEBUG STATE:', {
    setupCompleted,
    backstageMode,
    livestreamActive,
    isConnecting,
    videoClientReady,
    chatClientReady,
    hasVideoClient: !!videoClientRef.current,
    hasCallRef: !!callRef.current,
    hasChannelRef: !!channelRef.current,
    error,
    isViewer,
    isStreamer
  });

  // Show backstage mode before going live (different for streamers vs viewers)
  if (backstageMode && !livestreamActive) {
    if (isConnecting || !videoClientReady) {
      console.log('🔄 Showing loading: isConnecting:', isConnecting, 'videoClientReady:', videoClientReady);
      return <LoadingSpinner darkMode />
    }
    
    if (error) {
      return <div className="video-error">Error: {error}</div>
    }

    if (!videoClientRef.current || !callRef.current) {
      console.log('🔄 Showing loading: missing refs - videoClient:', !!videoClientRef.current, 'call:', !!callRef.current);
      return <LoadingSpinner darkMode />
    }

    if (isViewer) {
      // Show viewer waiting room (no need for chat requirements for anonymous viewers)
      const needsChat = !isAnonymousViewer
      if (needsChat && (!chatClientReady || !chatClientRef.current || !channelRef.current)) {
        return <LoadingSpinner darkMode />
      }

      return (
        <div className="video-container">
          <StreamVideo client={videoClientRef.current}>
            <StreamCall call={callRef.current}>
              <ViewerWaitingRoom
                chatClient={needsChat ? chatClientRef.current : null}
                channel={needsChat ? channelRef.current : null}
                streamTitle={streamTitle}
                callId={callId}
                call={callRef.current}
                isAnonymousViewer={isAnonymousViewer}
                isAuthenticatedViewer={isAuthenticatedViewer}
                onStreamGoesLive={() => {
                  console.log('🔴 Viewer transitioning from waiting room to live stream')
                  setBackstageMode(false)
                  setLivestreamActive(true)
                }}
              />
            </StreamCall>
          </StreamVideo>
        </div>
      )
    } else {
      // Show streamer backstage mode
      if (!chatClientReady || !chatClientRef.current || !channelRef.current) {
      return <LoadingSpinner darkMode />
    }

    return (
      <div className="video-container">
        <StreamVideo client={videoClientRef.current}>
          <StreamCall call={callRef.current}>
            <BackstageMode 
              onGoLive={handleGoLive}
              chatClient={chatClientRef.current}
              channel={channelRef.current}
              streamTitle={streamTitle}
              onTitleChange={setStreamTitle}
              callId={callId}
              isViewer={isViewer}
              isStreamer={isStreamer}
              liveStreamId={liveStreamId}
            />
          </StreamCall>
        </StreamVideo>
      </div>
    )
    }
  }

  // Loading logic for all users (now everyone has chat access)
  if (isConnecting || !videoClientReady || !chatClientReady) {
    return <LoadingSpinner darkMode />
  }
  
  if (error) {
    return <div className="video-error">Error: {error}</div>
  }
  
  if (!videoClientRef.current || !callRef.current || !chatClientRef.current || !channelRef.current) {
    return <LoadingSpinner darkMode />
  }

  return (
    <div className="video-container">
      <div className="video-main">
        <StreamVideo client={videoClientRef.current}>
          <StreamCall call={callRef.current}>
            <EnhancedLivestreamLayout 
              sidebarVisible={sidebarVisible} 
              onSidebarToggle={handleSidebarToggle}
              chatClient={chatClientRef.current}
              channel={channelRef.current}
              streamTitle={streamTitle}
              isViewer={isViewer}
              isStreamer={isStreamer}
              isAnonymousViewer={isAnonymousViewer}
              isAuthenticatedViewer={isAuthenticatedViewer}
              anonymousViewerId={anonymousViewerId}
              sanitizedUserId={sanitizedUserId}
              liveStreamId={liveStreamId}
            />
          </StreamCall>
        </StreamVideo>
      </div>
    </div>
  )
}

// Enhanced Livestream Layout using Stream SDK Components
interface EnhancedLivestreamLayoutProps {
  sidebarVisible: boolean
  onSidebarToggle: () => void
  chatClient: StreamChat | null
  channel: StreamChannel | null
  streamTitle: string
  isViewer?: boolean
  isStreamer?: boolean
  isAnonymousViewer?: boolean
  isAuthenticatedViewer?: boolean
  anonymousViewerId?: string | null
  sanitizedUserId?: string | null
  liveStreamId?: string | null
}

const EnhancedLivestreamLayout: React.FC<EnhancedLivestreamLayoutProps> = ({
  sidebarVisible,
  onSidebarToggle,
  chatClient,
  channel,
  streamTitle,
  isViewer = false,
  isStreamer = false,
  isAnonymousViewer = false,
  isAuthenticatedViewer = false,
  anonymousViewerId = null,
  sanitizedUserId = null,
  liveStreamId = null
}) => {
  const { useCallCallingState, useParticipants, useCallState } = useCallStateHooks()
  const callingState = useCallCallingState()
  const participants = useParticipants()
  const callState = useCallState()
  const [activeTab, setActiveTab] = useState<'participants' | 'chat'>('chat')
  const [streamEnded, setStreamEnded] = useState(false)

  // Determine the host user ID
  // The host is the user who is NOT a viewer (didn't join via link)
  // For viewers: hostUserId should be determined from the channel or participants
  // For host: hostUserId is their own sanitizedUserId
  const hostUserId = useMemo(() => {
    if (isStreamer && sanitizedUserId) {
      // If we are the streamer, we are the host
      return sanitizedUserId
    } else if (isViewer && participants.length > 0) {
      // If we are a viewer, find the host among participants
      // The host should be the user who is not anonymous (doesn't start with 'viewer_')
      const hostParticipant = participants.find(p => {
        const participantId = p.userId
        return participantId && !participantId.startsWith('viewer_') && participantId !== sanitizedUserId
      })
      return hostParticipant?.userId || ''
    }
    return ''
  }, [isStreamer, isViewer, sanitizedUserId, participants])

  // Function to apply Twitch-style formatting to messages
  const applyTwitchStyling = useCallback(() => {
    // Apply username colors and LIVE badges
    const messages = document.querySelectorAll('.str-chat__message-simple')
    
    messages.forEach((messageElement) => {
      const authorNameElement = messageElement.querySelector('.str-chat__message-author-name')
      
      if (authorNameElement && !authorNameElement.hasAttribute('data-twitch-styled')) {
        // Get the username text
        const username = authorNameElement.textContent || ''
        
        // Generate consistent color for this user
        const userColor = generateUserColor(username)
        
        // Apply the color using CSS custom property
        ;(authorNameElement as HTMLElement).style.setProperty('--username-color', userColor)
        
        // Check if this user is the host and add LIVE badge
        // Extract user ID from the message element or use multiple detection methods
        const messageElement = authorNameElement.closest('.str-chat__message-simple')
        const messageUserId = messageElement?.getAttribute('data-user-id') || ''
        
        const isHost = hostUserId && (
          username === hostUserId ||                                    // Direct username match
          messageUserId === hostUserId ||                              // User ID match
          username.includes(hostUserId.split('_').pop() || '') ||      // Partial ID match
          (isStreamer && messageElement?.classList.contains('str-chat__message--me')) // Current user is streamer
        )
        
        if (isHost) {
          const liveBadge = document.createElement('span')
          liveBadge.className = 'live-badge'
          liveBadge.textContent = 'LIVE'
          liveBadge.style.cssText = `
            background-color: #ff0000 !important;
            color: #ffffff !important;
            padding: 0.125rem 0.375rem !important;
            border-radius: 0.25rem !important;
            font-size: 0.625rem !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
            margin-right: 0.5rem !important;
            display: inline-block !important;
            vertical-align: middle !important;
          `
          
          authorNameElement.parentNode?.insertBefore(liveBadge, authorNameElement)
        }
        
        // Mark as styled to avoid re-processing
        authorNameElement.setAttribute('data-twitch-styled', 'true')
      }
    })
  }, [hostUserId])

  // Apply styling when messages change - DISABLED TO FIX BROKEN CHAT
  // useEffect(() => {
  //   const interval = setInterval(applyTwitchStyling, 500) // Check every 500ms for new messages
  //   return () => clearInterval(interval)
  // }, [applyTwitchStyling])

  // Debug logging for calling state
  console.log('🎭 EnhancedLivestreamLayout calling state:', {
    callingState,
    isViewer,
    isStreamer,
    hasChat: !!chatClient && !!channel,
    streamEnded,
    participantCount: participants.length
  })

  // Monitor for stream ending - detect when livestream stops
  useEffect(() => {
    // Detect if we're a viewer and the streamer has left (indicated by very few participants)
    if (isViewer && participants.length <= 1 && callingState === CallingState.JOINED) {
      // Likely that the streamer has ended the stream
      console.log('🔴 Stream detected as ended for viewer - low participant count')
      setTimeout(() => setStreamEnded(true), 2000) // Small delay to avoid false positives
    }
  }, [participants.length, isViewer, callingState])

  if (callingState === CallingState.JOINING) {
    return (
      <div className="video-loading">
        <LoadingSpinner darkMode />
        <p>Joining livestream...</p>
        <p style={{ fontSize: '0.8em', opacity: 0.7 }}>
          State: {callingState} | Viewer: {isViewer ? 'Yes' : 'No'}
        </p>
      </div>
    )
  }

  if (callingState === CallingState.LEFT) {
    // Check if this is a viewer who was kicked out vs someone who left voluntarily
    return (
      <div className="video-loading">
        <p>{isViewer ? 'The livestream has ended.' : 'You have left the livestream.'}</p>
        {isViewer && (
          <button 
            onClick={() => window.location.href = '/feeds'}
            className="return-home-btn"
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Return to Homepage
          </button>
        )}
      </div>
    )
  }

  // Handle when call is disconnected/ended by host
  if (callingState === CallingState.RECONNECTING_FAILED || streamEnded) {
    return (
      <div className="video-loading">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h2>📺 Livestream Ended</h2>
          <p>The streamer has ended this livestream.</p>
          <p>Thank you for watching!</p>
          <button 
            onClick={() => window.location.href = '/feeds'}
            className="return-home-btn"
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            Return to Homepage
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="enhanced-livestream-layout">
      {/* Main Video Area */}
      <div className="video-content">
        <LivestreamLayout />
        
        {/* Stream Title - Top Left */}
        {streamTitle && (
          <div className="stream-title-overlay">
            <h1 className="stream-title">{streamTitle}</h1>
          </div>
        )}
        

        {/* Custom Stream Controls - Bottom (Only for streamers) */}
        {isStreamer && (
          <div className="controls-overlay">
            <CustomLivestreamControls />
          </div>
        )}
      </div>

      {/* Sidebar Toggle */}
      <button 
        className={`sidebar-toggle ${sidebarVisible ? 'sidebar-open' : 'sidebar-closed'}`}
        onClick={onSidebarToggle}
        title={sidebarVisible ? 'Hide Chat' : 'Show Chat'}
      >
        <img src={CaretIcon} alt="Toggle Sidebar" className="toggle-icon" />
      </button>

      {/* Enhanced Sidebar */}
      <div className={`enhanced-sidebar ${sidebarVisible ? 'visible' : 'hidden'}`}>
        {/* Tab Headers */}
        <div className="sidebar-tab-headers">
          <button 
            className={`tab-header ${activeTab === 'participants' ? 'active' : ''}`}
            onClick={() => setActiveTab('participants')}
          >
            <img src={ViewersIcon} alt="Viewers" className="tab-icon" />
            Participants
          </button>
          <button 
            className={`tab-header ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <img src={MessageCircleIcon} alt="Chat" className="tab-icon" />
            Live Chat
          </button>
        </div>

        {/* Tab Content */}
        <div className="sidebar-tab-content">
          {activeTab === 'participants' && (
            <ParticipantsList 
              participants={participants}
              isViewer={isViewer}
              isStreamer={isStreamer}
              isAnonymousViewer={isAnonymousViewer}
              isAuthenticatedViewer={isAuthenticatedViewer}
              anonymousViewerId={anonymousViewerId}
              sanitizedUserId={sanitizedUserId}
            />
          )}
          
          {activeTab === 'chat' && (
            <div className="chat-section">
              {chatClient && channel && chatClient.userID && chatClient.user ? (
                <div className="stream-chat-container" style={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  <ChatErrorBoundary>
                    <StreamChatUI client={chatClient} theme="str-chat__theme-dark">
                      <StreamChannelUI channel={channel}>
                        <Window>
                          <div style={{ 
                            flex: 1, 
                            minHeight: 0,
                            display: 'flex',
                            flexDirection: 'column'
                          }}>
                            <CustomMessageList
                              channel={channel}
                              hostUserId={hostUserId}
                              currentUserId={isAnonymousViewer ? (anonymousViewerId || '') : (sanitizedUserId || '')}
                            />
                          </div>
                          <CustomMessageInput
                            channel={channel}
                            currentUserId={isAnonymousViewer ? (anonymousViewerId || '') : (sanitizedUserId || '')}
                            isReadOnly={isAnonymousViewer}
                          />
                        </Window>
                        <Thread />
                      </StreamChannelUI>
                    </StreamChatUI>
                  </ChatErrorBoundary>
                </div>
              ) : (
                <div className="chat-loading">
                  <LoadingSpinner darkMode />
                  <p>Connecting to chat...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Participants List Component
interface ParticipantsListProps {
  participants: any[]
  isViewer?: boolean
  isStreamer?: boolean
  isAnonymousViewer?: boolean
  isAuthenticatedViewer?: boolean
  anonymousViewerId?: string | null
  sanitizedUserId?: string | null
}

const ParticipantsList: React.FC<ParticipantsListProps> = ({ 
  participants, 
  isViewer = false, 
  isStreamer = false,
  isAnonymousViewer = false,
  isAuthenticatedViewer = false,
  anonymousViewerId = null,
  sanitizedUserId = null
}) => {
  // Helper function to format participant names
  const formatParticipantName = (participant: any) => {
    const userId = participant.userId || participant.user_id || participant.id
    const userName = participant.name || participant.user?.name || userId
    
    // Check if this is an anonymous viewer (starts with "viewer_")
    if (userId && userId.startsWith('viewer_')) {
      // Extract timestamp from viewer ID and use it to create a consistent guest number
      const timestamp = userId.split('_')[1] || '0'
      const guestNumber = (parseInt(timestamp) % 1000).toString().padStart(3, '0')
      return `Guest_${guestNumber}`
    }
    
    // For authenticated users, return their actual name
    return userName || 'Unknown User'
  }

  // Helper function to determine if participant is the streamer
  const isParticipantStreamer = (participant: any) => {
    const userId = participant.userId || participant.user_id || participant.id
    
    // Anonymous viewers (starting with "viewer_") are never streamers
    if (userId && userId.startsWith('viewer_')) {
      return false
    }
    
    // The key insight: Only the person who created the livestream should be marked as streamer
    // This is determined by who is NOT joining via a livestream link
    
    // If we're not a viewer (not joining via link), then WE are the streamer
    // In this case, only mark ourselves as streamer if we match the participant
    if (!isViewer) {
      const currentUserId = sanitizedUserId
      return userId === currentUserId
    } else {
      // If we ARE a viewer (joining via link), then the streamer is someone else
      // The streamer should be the non-anonymous user who is not us
      const currentUserId = isAnonymousViewer ? anonymousViewerId : sanitizedUserId
      
      // Don't mark ourselves as streamer if we're a viewer
      if (userId === currentUserId) {
        return false
      }
      
      // Mark the other authenticated user (not anonymous viewer) as streamer
      return !userId?.startsWith('viewer_')
    }
  }

  console.log('👥 Participants data:', participants.map(p => ({
    id: p.userId || p.user_id || p.id,
    name: p.name || p.user?.name,
    isLocal: p.isLocalParticipant,
    connectionQuality: p.connectionQuality,
    publishedTracks: p.publishedTracks,
    isStreamer: isParticipantStreamer(p),
    hasVideoTrack: !!(p.videoTrack || p.video),
    hasAudioTrack: !!(p.audioTrack || p.audio)
  })))

  if (!participants || participants.length === 0) {
    return (
      <div className="participants-section">
        <div className="participants-empty">
          <p>No participants yet</p>
          <p>Viewers will appear here when they join</p>
        </div>
      </div>
    )
  }

  return (
    <div className="participants-section">
      <div className="participants-header">
        <h3>Participants ({participants.length})</h3>
      </div>
      <div className="participants-list">
        {participants.map((participant, index) => {
          const participantName = formatParticipantName(participant)
          const isStreamer = isParticipantStreamer(participant)
          const isLocalParticipant = participant.isLocalParticipant
          const userId = participant.userId || participant.user_id || participant.id

          return (
            <div 
              key={userId || index} 
              className={`participant-item ${isLocalParticipant ? 'local-participant' : ''} ${isStreamer ? 'streamer' : 'viewer'}`}
            >
              <div className="participant-avatar">
                {isStreamer ? '🔴' : '👤'}
              </div>
              <div className="participant-info">
                <div className="participant-name">
                  {isStreamer && <span className="live-badge">LIVE</span>}
                  {participantName}
                  {isLocalParticipant && ' (You)'}
                </div>
                <div className="participant-status">
                  {isStreamer ? 'Streaming' : 'Watching'}
                </div>
              </div>
              <div className="participant-connection">
                {participant.connectionQuality && (
                  <div className={`connection-indicator ${participant.connectionQuality}`}>
                    {participant.connectionQuality === 'excellent' && '●●●'}
                    {participant.connectionQuality === 'good' && '●●○'}
                    {participant.connectionQuality === 'poor' && '●○○'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Custom Livestream Controls Component
const CustomLivestreamControls: React.FC = () => {
  const { 
    useMicrophoneState, 
    useCameraState, 
    useScreenShareState
  } = useCallStateHooks()
  
  const { microphone, isMute } = useMicrophoneState()
  const { camera, isMute: isCameraOff } = useCameraState()
  const { screenShare, isMute: isScreenShareOff } = useScreenShareState()
  const call = useCall() // Move hook call to component level
  
  const [showReactions, setShowReactions] = useState(false)
  const [showStopModal, setShowStopModal] = useState(false)

  const handleMicrophoneToggle = async () => {
    try {
      await microphone.toggle()
    } catch (error) {
      console.error('Failed to toggle microphone:', error)
    }
  }

  const handleCameraToggle = async () => {
    try {
      await camera.toggle()
    } catch (error) {
      console.error('Failed to toggle camera:', error)
    }
  }

  const handleScreenShareToggle = async () => {
    try {
      await screenShare.toggle()
    } catch (error) {
      console.error('Failed to toggle screen share:', error)
    }
  }

  const handleReactionClick = () => {
    // Toggle reaction menu or send a default reaction
    setShowReactions(!showReactions)
    // For now, just log - you can implement reaction functionality here
    console.log('❤️ Reaction sent!')
  }

  const handleStopLivestream = () => {
    setShowStopModal(true)
  }

  const confirmStopLivestream = async () => {
    try {
      setShowStopModal(false)
      console.log('🛑 Stopping livestream...')
      
      // Use the call instance from component level
      if (call) {
        // End the livestream for all participants
        await call.stopLive()
        console.log('✅ Livestream stopped successfully')
        
        // Leave the call after stopping it
        await call.leave()
        console.log('✅ Left the call successfully')
      }
      
      // Navigate back to home after proper cleanup
      window.location.href = '/'
    } catch (error) {
      console.error('❌ Failed to stop livestream:', error)
      // Still navigate home even if there's an error
      window.location.href = '/'
    }
  }

  const cancelStopLivestream = () => {
    setShowStopModal(false)
  }

  return (
    <div className="custom-livestream-controls">
      <div className="controls-container">
        
        {/* Microphone Button */}
        <button
          className={`control-btn microphone-btn ${isMute ? 'muted' : ''}`}
          onClick={handleMicrophoneToggle}
          title={isMute ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          <img 
            src={isMute ? MicrophoneOffIcon : MicrophoneIcon} 
            alt={isMute ? 'Unmute' : 'Mute'} 
            className="control-icon"
          />
        </button>

        {/* Video Camera Button */}
        <button
          className={`control-btn camera-btn ${isCameraOff ? 'camera-off' : ''}`}
          onClick={handleCameraToggle}
          title={isCameraOff ? 'Turn On Camera' : 'Turn Off Camera'}
        >
          <img 
            src={isCameraOff ? VideoOffIcon : VideoIcon} 
            alt={isCameraOff ? 'Camera Off' : 'Camera On'} 
            className="control-icon"
          />
        </button>

        {/* Reaction Button */}
        <button
          className={`control-btn reaction-btn ${showReactions ? 'active' : ''}`}
          onClick={handleReactionClick}
          title="Send Reaction"
        >
          <img 
            src={HeartIcon} 
            alt="Send Reaction" 
            className="control-icon"
          />
        </button>

        {/* Screen Share Button */}
        <button
          className={`control-btn screen-share-btn ${!isScreenShareOff ? 'sharing' : ''}`}
          onClick={handleScreenShareToggle}
          title={isScreenShareOff ? 'Start Screen Share' : 'Stop Screen Share'}
        >
          <img 
            src={DeviceDesktopIcon} 
            alt="Screen Share" 
            className="control-icon"
          />
        </button>

        {/* Stop Livestream Button */}
        <button
          className="control-btn stop-btn"
          onClick={handleStopLivestream}
          title="Stop Livestream"
        >
          <img 
            src={StopIcon} 
            alt="Stop Livestream" 
            className="control-icon"
          />
        </button>

      </div>

      {/* Reaction Menu (if shown) */}
      {showReactions && (
        <div className="reaction-menu">
          <button onClick={() => console.log('❤️')}>❤️</button>
          <button onClick={() => console.log('👍')}>👍</button>
          <button onClick={() => console.log('🎉')}>🎉</button>
          <button onClick={() => console.log('👏')}>👏</button>
          <button onClick={() => console.log('🔥')}>🔥</button>
        </div>
      )}

      {/* Stop Confirmation Modal */}
      {showStopModal && (
        <div className="stop-modal-overlay">
          <div className="stop-modal">
            <div className="stop-modal-content">
              <h3>Stop Livestream?</h3>
              <p>Are you sure you want to end this livestream? This action cannot be undone.</p>
              <div className="stop-modal-buttons">
                <button 
                  className="cancel-button"
                  onClick={cancelStopLivestream}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-stop-button"
                  onClick={confirmStopLivestream}
                >
                  Stop Stream
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// Backstage Mode Component
interface BackstageModeProps {
  onGoLive: () => void
  chatClient: StreamChat | null
  channel: StreamChannel | null
  streamTitle: string
  onTitleChange: (title: string) => void
  callId: string
  isViewer?: boolean
  isStreamer?: boolean
  liveStreamId?: string | null
}

const BackstageMode: React.FC<BackstageModeProps> = ({
  onGoLive,
  chatClient,
  channel,
  streamTitle,
  onTitleChange,
  callId,
  isViewer = false,
  isStreamer = false,
  liveStreamId = null
}) => {
  const handleExit = () => {
    window.location.href = '/feeds'
  }
  const call = useCall()
  const { useParticipants, useCallState } = useCallStateHooks()
  const participants = useParticipants()
  const callState = useCallState()
  
  const [timeRemaining, setTimeRemaining] = useState(60) // 60 seconds countdown
  const [timerActive, setTimerActive] = useState(true)
  const [copySuccess, setCopySuccess] = useState(false)
  // Use Stream's native participant management instead of custom messaging

  // Determine the host user ID for backstage chat
  // Since we're in backstage mode, the current user (if not a viewer) is likely the host
  const hostUserId = useMemo(() => {
    if (isStreamer) {
      // If we are the streamer, determine our user ID from the chat client
      return chatClient?.userID || ''
    } else if (isViewer && participants.length > 0) {
      // If we are a viewer, find the host among participants
      const hostParticipant = participants.find(p => {
        const participantId = p.userId
        return participantId && !participantId.startsWith('viewer_')
      })
      return hostParticipant?.userId || ''
    }
    return chatClient?.userID || ''
  }, [isStreamer, isViewer, participants, chatClient])

  // Function to apply Twitch-style formatting to backstage messages
  const applyBackstageTwitchStyling = useCallback(() => {
    // Apply username colors and LIVE badges for backstage chat
    const messages = document.querySelectorAll('.backstage-chat .str-chat__message-simple')
    
    messages.forEach((messageElement) => {
      const authorNameElement = messageElement.querySelector('.str-chat__message-author-name')
      
      if (authorNameElement && !authorNameElement.hasAttribute('data-twitch-styled')) {
        // Get the username text
        const username = authorNameElement.textContent || ''
        
        // Generate consistent color for this user
        const userColor = generateUserColor(username)
        
        // Apply the color using CSS custom property
        ;(authorNameElement as HTMLElement).style.setProperty('--username-color', userColor)
        
        // Check if this user is the host and add LIVE badge
        const messageElement = authorNameElement.closest('.str-chat__message-simple')
        const messageUserId = messageElement?.getAttribute('data-user-id') || ''
        
        const isHost = hostUserId && (
          username === hostUserId ||                                    // Direct username match
          messageUserId === hostUserId ||                              // User ID match
          username === chatClient?.user?.name ||                       // Current user name match
          username.includes(hostUserId.split('_').pop() || '') ||      // Partial ID match
          (isStreamer && messageElement?.classList.contains('str-chat__message--me')) // Current user is streamer
        )
        
        if (isHost) {
          const liveBadge = document.createElement('span')
          liveBadge.className = 'live-badge'
          liveBadge.textContent = 'LIVE'
          liveBadge.style.cssText = `
            background-color: #ff0000 !important;
            color: #ffffff !important;
            padding: 0.125rem 0.375rem !important;
            border-radius: 0.25rem !important;
            font-size: 0.625rem !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
            margin-right: 0.5rem !important;
            display: inline-block !important;
            vertical-align: middle !important;
          `
          
          authorNameElement.parentNode?.insertBefore(liveBadge, authorNameElement)
        }
        
        // Mark as styled to avoid re-processing
        authorNameElement.setAttribute('data-twitch-styled', 'true')
      }
    })
  }, [hostUserId, chatClient])

  // Apply styling when messages change - DISABLED TO FIX BROKEN CHAT  
  // useEffect(() => {
  //   const interval = setInterval(applyBackstageTwitchStyling, 500) // Check every 500ms for new messages
  //   return () => clearInterval(interval)
  // }, [applyBackstageTwitchStyling])

  // Generate shareable link with unique livestream ID
  // Viewers can join by visiting this URL with the 'live' parameter
  const shareableLink = `${window.location.origin}/video?live=${callId}`

  // Copy link function
  const copyLinkToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = shareableLink
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  // Countdown timer effect
  useEffect(() => {
    if (!timerActive || timeRemaining <= 0) return

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setTimerActive(false)
          // Auto go live when timer reaches 0
          handleGoLive()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeRemaining, timerActive])

  const handleGoLive = async () => {
    try {
      setTimerActive(false)
      console.log('🚀 Going live...')
      
      // Notify viewers via chat that the stream has gone live (hidden system message)
      if (channel) {
        try {
          await channel.sendMessage({
            text: JSON.stringify({
              type: 'stream.went_live',
              timestamp: Date.now()
            }),
            silent: true, // Don't show notification
            type: 'system' // Mark as system message
          })
          console.log('📢 Notified viewers that stream went live (hidden)')
        } catch (error) {
          console.warn('⚠️ Failed to notify viewers:', error)
        }
      }
      
      // Update local UI state to show the live stream
      console.log('✅ Transitioning to live mode via UI state')
      onGoLive()
    } catch (error) {
      console.error('❌ Failed to go live:', error)
    }
  }

  const handleStopTimer = () => {
    setTimerActive(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Count waiting participants (exclude the host/streamer, use Stream's native participants)
  const waitingParticipants = participants.filter(p => p.isLocalParticipant === false)
  
  // Debug logging for backstage waiting room
  console.log('🎬 BACKSTAGE WAITING ROOM DEBUG:', {
    totalParticipants: participants.length,
    waitingParticipants: waitingParticipants.length,
    allParticipants: participants.map(p => ({
      userId: p.userId,
      name: p.name,
      isLocal: p.isLocalParticipant,
      sessionId: p.sessionId
    })),
    isViewer,
    isStreamer
  })

  return (
    <div className="backstage-container">
      {/* Video background */}
      <video 
        className="backstage-video-background"
        autoPlay 
        loop 
        muted 
        playsInline
      >
        <source src={videoLoop} type="video/mp4" />
        <source src={videoLoop} type="video/quicktime" />
      </video>
      
      {/* Camera Preview - Top Left (Only for streamers) */}
      {isStreamer && (
        <div className="backstage-preview">
          <div className="preview-video">
            {participants.find(p => p.isLocalParticipant) ? (
              <ParticipantView 
                participant={participants.find(p => p.isLocalParticipant)!} 
                trackType="videoTrack"
              />
            ) : (
              <div className="camera-placeholder">
                <p>Camera not available</p>
              </div>
            )}
            <div className="preview-label">Camera preview</div>
          </div>
        </div>
      )}

              {/* Main Content Area */}
        <div className="backstage-content">
          <button className="exit-btn" onClick={handleExit}>
            Exit
          </button>
          
          <div className="backstage-header">
            {isViewer ? (
              <>
                <h1>Waiting for stream to start</h1>
                <p>The streamer is getting ready. You'll be able to watch once they go live!</p>
              </>
            ) : (
              <>
                <h1>You're in the backstage!</h1>
                <p>Get ready to go live. Preview your camera and check who's waiting to join.</p>
                
                {/* Stream Title Input (Only for streamers) */}
                <div className="title-input-section">
                  <label htmlFor="stream-title" className="title-label">
                    Stream Title (Optional)
                  </label>
                  <input
                    id="stream-title"
                    type="text"
                    className="title-input"
                    placeholder="Enter your stream title..."
                    value={streamTitle}
                    onChange={(e) => onTitleChange(e.target.value)}
                    maxLength={100}
                  />
                  {streamTitle && (
                    <div className="title-preview">
                      <span className="preview-label">Preview:</span>
                      <span className="preview-title">{streamTitle}</span>
                    </div>
                  )}
                </div>

                {/* Share Link Section (Only for streamers) */}
                <div className="share-link-section">
                  <label className="share-label">
                    Share this link for viewers to join:
                  </label>
                  <div className="share-link-container">
                    <input
                      type="text"
                      className="share-link-input"
                      value={shareableLink}
                      readOnly
                    />
                    <button
                      className={`copy-link-btn ${copySuccess ? 'copied' : ''}`}
                      onClick={copyLinkToClipboard}
                      title="Copy link to clipboard"
                    >
                      {copySuccess ? '✓ Copied!' : '📋 Copy'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

        {/* Timer and Go Live Controls (Only for streamers) */}
        {isStreamer && (
          <div className="backstage-controls">
            <div className="timer-section">
              <div className="timer-display">
                <span className="timer-label">Auto start in:</span>
                <span className={`timer-value ${timeRemaining <= 10 ? 'urgent' : ''}`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
              
              <div className="control-buttons">
                <button 
                  className="go-live-btn"
                  onClick={handleGoLive}
                  disabled={!timerActive && timeRemaining === 0}
                >
                  Go Live Now 
                </button>
                
                {timerActive && (
                  <button 
                    className="stop-timer-btn"
                    onClick={handleStopTimer}
                  >
                    ⏸ Stop Timer
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Viewer Timer Display (show countdown but no controls) */}
        {isViewer && (
          <div className="backstage-controls">
            <div className="timer-section">
              <div className="timer-display">
                <span className="timer-label">Stream starts in:</span>
                <span className={`timer-value ${timeRemaining <= 10 ? 'urgent' : ''}`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Waiting Room Participants */}
        <div className="waiting-room">
          <h3>
            <img src={ViewersIcon} alt="Waiting" className="section-icon" />
            Waiting Room ({waitingParticipants.length})
          </h3>
          
          {waitingParticipants.length > 0 ? (
            <div className="waiting-participants">
              {waitingParticipants.map((participant) => (
                <div key={participant.sessionId || participant.userId} className="waiting-participant">
                  <div className="participant-avatar">
                    {participant.image ? (
                      <img src={participant.image} alt={participant.name} />
                    ) : (
                      <div className="avatar-placeholder">
                        {(participant.name || participant.userId)?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                  <div className="participant-info">
                    <span className="participant-name">
                      {participant.name || participant.userId || 'Anonymous User'}
                    </span>
                    <span className="participant-status">
                      {participant.userId?.startsWith('viewer_') || participant.userId?.startsWith('anonymous_') 
                        ? 'Waiting to watch' 
                        : 'Waiting to join'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-participants">
              <p>No one is waiting yet. Share your stream link to invite viewers!</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Sidebar */}
      <div className="backstage-chat">
        <h3>
          <img src={MessageCircleIcon} alt="Chat" className="section-icon" />
          Pre-stream Chat
        </h3>
        {chatClient && channel && chatClient.userID && chatClient.user ? (
          <div className="stream-chat-container" style={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <ChatErrorBoundary>
              <StreamChatUI client={chatClient} theme="str-chat__theme-dark">
                <StreamChannelUI channel={channel}>
                  <Window>
                    <div style={{ 
                      flex: 1, 
                      minHeight: 0,
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <CustomMessageList
                        channel={channel}
                        hostUserId={hostUserId}
                        currentUserId={chatClient?.userID || ''}
                      />
                    </div>
                    <CustomMessageInput
                      channel={channel}
                      currentUserId={chatClient?.userID || ''}
                      isReadOnly={false}
                    />
                  </Window>
                  <Thread />
                </StreamChannelUI>
              </StreamChatUI>
            </ChatErrorBoundary>
          </div>
        ) : (
          <div className="chat-loading">
            <LoadingSpinner darkMode />
            <p>Connecting to chat...</p>
          </div>
        )}
      </div>
    </div>
  )
}






export default Video
