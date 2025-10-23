import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  LivestreamLayout,
  useCallStateHooks,
  CallingState,
  ParticipantView,
  useCall,
} from '@stream-io/video-react-sdk'
import { StreamChat, Channel as StreamChannel } from 'stream-chat'
import LoadingSpinner from './LoadingSpinner'
import LivestreamSetup from './LivestreamSetup'
import { getSanitizedUserId } from '../utils/userUtils'
import { useUILayout } from '../App'
import { useResponsive } from '../contexts/ResponsiveContext'
import { useLocation } from 'react-router-dom'
import MobileBottomNav from './MobileBottomNav'
import ViewersIcon from '../icons/viewers.svg'
import MessageCircleIcon from '../icons/message-circle.svg'
import CaretIcon from '../icons/caret.svg'
import MicrophoneIcon from '../icons/microphone.svg'
import MicrophoneOffIcon from '../icons/microphone-off.svg'
import VideoIcon from '../icons/video.svg'
import VideoOffIcon from '../icons/video-off.svg'
import HeartIcon from '../icons/heart.svg'
import DeviceDesktopIcon from '../icons/device-desktop.svg'
import StopIcon from '../icons/stop.svg'
import videoLoop from '../assets/video-loop.mov'
import '@stream-io/video-react-sdk/dist/css/styles.css'
import './Video.css'

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
      setMessages(prev => [...prev, event.message])
      setTimeout(scrollToBottom, 100)
    }

    const handleMessageUpdated = (event: any) => {
      setMessages(prev => prev.map(msg => 
        msg.id === event.message.id ? event.message : msg
      ))
    }

    const handleMessageDeleted = (event: any) => {
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
          placeholder="Send a message..."
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

// Error Boundary for Stream Chat
class ChatErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('💥 Chat Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="chat-error">
          <h3>💬 Chat Temporarily Unavailable</h3>
          <button onClick={() => window.location.reload()}>Refresh Page</button>
        </div>
      )
    }
    return this.props.children
  }
}

// Viewer Waiting Room Component
interface ViewerWaitingRoomProps {
  chatClient: StreamChat | null
  channel: StreamChannel | null
  streamTitle: string
  callId: string
  isAnonymousViewer?: boolean
  onStreamGoesLive?: () => void
}

const ViewerWaitingRoom: React.FC<ViewerWaitingRoomProps> = ({
  chatClient,
  channel,
  streamTitle,
  callId,
  isAnonymousViewer = false,
  onStreamGoesLive
}) => {
  const { useParticipants } = useCallStateHooks()
  const participants = useParticipants()

  // Listen for stream going live via chat system message
  useEffect(() => {
    if (!channel) return

    const handleStreamEvent = (event: any) => {
      if (event.message?.type === 'system' && event.message?.text) {
        try {
          const data = JSON.parse(event.message.text)
          if (data.type === 'stream.went_live' && onStreamGoesLive) {
            onStreamGoesLive()
          }
        } catch (e) {
          // Not a system message
        }
      }
    }

    channel.on('message.new', handleStreamEvent)
    return () => channel.off('message.new', handleStreamEvent)
  }, [channel, onStreamGoesLive])

  return (
    <div className="viewer-waiting-room">
      <video className="waiting-room-video-background" autoPlay loop muted playsInline>
        <source src={videoLoop} type="video/mp4" />
      </video>

      <div className="waiting-room-content">
        <button className="exit-btn" onClick={() => window.location.href = '/feeds'}>
          Exit
        </button>
        
        <div className="waiting-room-header">
          <h1>🔴 Waiting for Stream to Start</h1>
          {streamTitle && <h2>{streamTitle}</h2>}
          <p>The streamer is getting ready. You'll be able to watch once they go live!</p>
        </div>

        <div className="waiting-room-participants">
          <h3>
            <img src={ViewersIcon} alt="Waiting" className="section-icon" />
            Waiting Room ({participants.length})
          </h3>
          
          <div className="participants-list">
            {participants.map((participant) => (
              <div key={participant.sessionId} className="waiting-participant">
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
                  <span className="participant-status">Waiting to watch</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Chat Components */}
      <div className="waiting-room-chat">
        <h3>
          <img src={MessageCircleIcon} alt="Chat" className="section-icon" />
          Pre-stream Chat
        </h3>
        {chatClient && channel && chatClient.userID ? (
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
              <CustomMessageList
                channel={channel}
                hostUserId=""
                currentUserId={chatClient.userID}
              />
              <CustomMessageInput
                channel={channel}
                currentUserId={chatClient.userID}
                isReadOnly={isAnonymousViewer}
              />
            </ChatErrorBoundary>
          </div>
        ) : (
          <div className="chat-loading">
            <LoadingSpinner darkMode />
          </div>
        )}
      </div>
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
}

const BackstageMode: React.FC<BackstageModeProps> = ({
  onGoLive,
  chatClient,
  channel,
  streamTitle,
  onTitleChange,
  callId,
}) => {
  const call = useCall()
  const { useParticipants } = useCallStateHooks()
  const participants = useParticipants()
  const [timeRemaining, setTimeRemaining] = useState(60)
  const [timerActive, setTimerActive] = useState(true)
  const [copySuccess, setCopySuccess] = useState(false)

  const shareableLink = `${window.location.origin}/video?live=${callId}`

  const copyLinkToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  useEffect(() => {
    if (!timerActive || timeRemaining <= 0) return
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setTimerActive(false)
          handleGoLive()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [timeRemaining, timerActive])

  const handleGoLive = async () => {
    setTimerActive(false)
    
    // Notify viewers via chat
    if (channel) {
      await channel.sendMessage({
        text: JSON.stringify({ type: 'stream.went_live', timestamp: Date.now() }),
        silent: true,
        type: 'system'
      }).catch(console.warn)
    }
    
    onGoLive()
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="backstage-container">
      <video className="backstage-video-background" autoPlay loop muted playsInline>
        <source src={videoLoop} type="video/mp4" />
      </video>
      
      {/* Camera Preview using SDK */}
      <div className="backstage-preview">
        <div className="preview-video">
          {participants.find(p => p.isLocalParticipant) ? (
            <ParticipantView 
              participant={participants.find(p => p.isLocalParticipant)!} 
              trackType="videoTrack"
            />
          ) : (
            <div className="camera-placeholder">Camera not available</div>
          )}
          <div className="preview-label">Camera preview</div>
        </div>
      </div>

      <div className="backstage-content">
        <button className="exit-btn" onClick={() => window.location.href = '/feeds'}>
          Exit
        </button>
        
        <div className="backstage-header">
          <h1>You're in the backstage!</h1>
          
          <div className="title-input-section">
            <label htmlFor="stream-title">Stream Title (Optional)</label>
            <input
              id="stream-title"
              type="text"
              className="title-input"
              placeholder="Enter your stream title..."
              value={streamTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="share-link-section">
            <label className="share-label">Share this link for viewers to join:</label>
            <div className="share-link-container">
              <input type="text" className="share-link-input" value={shareableLink} readOnly />
              <button
                className={`copy-link-btn ${copySuccess ? 'copied' : ''}`}
                onClick={copyLinkToClipboard}
              >
                {copySuccess ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
          </div>
        </div>

        <div className="backstage-controls">
          <div className="timer-section">
            <div className="timer-display">
              <span className="timer-label">Auto start in:</span>
              <span className={`timer-value ${timeRemaining <= 10 ? 'urgent' : ''}`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
            
            <div className="control-buttons">
              <button className="go-live-btn" onClick={handleGoLive}>
                Go Live Now
              </button>
              {timerActive && (
                <button className="stop-timer-btn" onClick={() => setTimerActive(false)}>
                  ⏸ Stop Timer
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="waiting-room">
          <h3>
            <img src={ViewersIcon} alt="Waiting" className="section-icon" />
            Waiting Room ({participants.filter(p => !p.isLocalParticipant).length})
          </h3>
          
          {participants.filter(p => !p.isLocalParticipant).length > 0 ? (
            <div className="waiting-participants">
              {participants.filter(p => !p.isLocalParticipant).map((participant) => (
                <div key={participant.sessionId} className="waiting-participant">
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

      {/* Custom Chat Components */}
      <div className="backstage-chat">
        <h3>
          <img src={MessageCircleIcon} alt="Chat" className="section-icon" />
          Pre-stream Chat
        </h3>
        {chatClient && channel && chatClient.userID ? (
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
              <CustomMessageList
                channel={channel}
                hostUserId={chatClient.userID}
                currentUserId={chatClient.userID}
              />
              <CustomMessageInput
                channel={channel}
                currentUserId={chatClient.userID}
              />
            </ChatErrorBoundary>
          </div>
        ) : (
          <div className="chat-loading">
            <LoadingSpinner darkMode />
          </div>
        )}
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
  const call = useCall()
  
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
    setShowReactions(!showReactions)
    console.log('❤️ Reaction sent!')
  }

  const handleStopLivestream = () => {
    setShowStopModal(true)
  }

  const confirmStopLivestream = async () => {
    try {
      setShowStopModal(false)
      console.log('🛑 Stopping livestream...')
      
      if (call) {
        await call.stopLive()
        console.log('✅ Livestream stopped successfully')
        
        await call.leave()
        console.log('✅ Left the call successfully')
      }
      
      window.location.href = '/'
    } catch (error) {
      console.error('❌ Failed to stop livestream:', error)
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

// Enhanced Livestream Layout using SDK Components
interface EnhancedLivestreamLayoutProps {
  sidebarVisible: boolean
  onSidebarToggle: () => void
  chatClient: StreamChat | null
  channel: StreamChannel | null
  streamTitle: string
  isViewer?: boolean
}

const EnhancedLivestreamLayout: React.FC<EnhancedLivestreamLayoutProps> = ({
  sidebarVisible,
  onSidebarToggle,
  chatClient,
  channel,
  streamTitle,
  isViewer = false,
}) => {
  const { useCallCallingState, useParticipants, useIsCallLive, useScreenShareState } = useCallStateHooks()
  const callingState = useCallCallingState()
  const participants = useParticipants()
  const isLive = useIsCallLive()
  const { screenShare, isMute: isScreenShareOff } = useScreenShareState()
  const isScreenSharing = !isScreenShareOff
  const [activeTab, setActiveTab] = useState<'participants' | 'chat'>('chat')

  // Debug logging for screen share state
  console.log('🖥️ Screen Share State:', {
    isLive,
    isScreenSharing,
    isScreenShareOff,
    willApplyClass: isLive && isScreenSharing
  })

  if (callingState === CallingState.JOINING) {
    return (
      <div className="video-loading">
        <LoadingSpinner darkMode />
        <p>Joining livestream...</p>
      </div>
    )
  }

  if (callingState === CallingState.LEFT || callingState === CallingState.RECONNECTING_FAILED) {
    return (
      <div className="video-loading">
        <h2>📺 Livestream Ended</h2>
        <p>{isViewer ? 'The streamer has ended this livestream.' : 'You have left the livestream.'}</p>
        <button onClick={() => window.location.href = '/feeds'} className="return-home-btn">
          Return to Homepage
        </button>
      </div>
    )
  }

  return (
    <div className={`enhanced-livestream-layout ${isLive && isScreenSharing ? 'screen-sharing-active' : ''}`}>
      {/* Use SDK's LivestreamLayout */}
      <div className="video-content">
        <LivestreamLayout />
        
        {streamTitle && (
          <div className="stream-title-overlay">
            <h1 className="stream-title">{streamTitle}</h1>
          </div>
        )}

        {/* Custom Stream Controls for streamers */}
        {!isViewer && (
          <div className="controls-overlay">
            <CustomLivestreamControls />
          </div>
        )}
      </div>

      {/* Sidebar Toggle */}
      <button 
        className={`sidebar-toggle ${sidebarVisible ? 'sidebar-open' : 'sidebar-closed'}`}
        onClick={onSidebarToggle}
      >
        <img src={CaretIcon} alt="Toggle Sidebar" className="toggle-icon" />
      </button>

      {/* Enhanced Sidebar */}
      <div className={`enhanced-sidebar ${sidebarVisible ? 'visible' : 'hidden'}`}>
        <div className="sidebar-tab-headers">
          <button 
            className={`tab-header ${activeTab === 'participants' ? 'active' : ''}`}
            onClick={() => setActiveTab('participants')}
          >
            <img src={ViewersIcon} alt="Viewers" className="tab-icon" />
            Participants ({participants.length})
          </button>
          <button 
            className={`tab-header ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <img src={MessageCircleIcon} alt="Chat" className="tab-icon" />
            Live Chat
          </button>
        </div>

        <div className="sidebar-tab-content">
          {activeTab === 'participants' && (
            <div className="participants-section">
              <div className="participants-list">
                {participants.map((participant) => (
                  <div key={participant.sessionId} className="participant-item">
                    <div className="participant-avatar">
                      {participant.image ? (
                        <img src={participant.image} alt={participant.name} />
                      ) : (
                        '👤'
                      )}
                    </div>
                    <div className="participant-info">
                      <div className="participant-name">
                        {participant.name || participant.userId}
                        {participant.isLocalParticipant && ' (You)'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {activeTab === 'chat' && (
            <div className="chat-section">
              {chatClient && channel && chatClient.userID ? (
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
                    <CustomMessageList
                      channel={channel}
                      hostUserId={isViewer ? '' : (chatClient.userID || '')}
                      currentUserId={chatClient.userID}
                    />
                    <CustomMessageInput
                      channel={channel}
                      currentUserId={chatClient.userID}
                    />
                  </ChatErrorBoundary>
                </div>
              ) : (
                <div className="chat-loading">
                  <LoadingSpinner darkMode />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Main Video Component
interface VideoProps {}

const Video: React.FC<VideoProps> = () => {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0()
  const { setHideHeader } = useUILayout()
  const { isMobileView, toggleView } = useResponsive()
  const location = useLocation()

  const apiKey = import.meta.env.VITE_STREAM_API_KEY as string | undefined
  
  const wrapInMobileView = (content: React.ReactNode) => {
    if (isMobileView) {
      return (
        <div className="video-container mobile-view">
          <div className="video-content mobile-content">
            {content}
          </div>
          {location.pathname !== '/video' && (
            <button className="desktop-toggle-button" onClick={toggleView}>
              🖥️ Desktop
            </button>
          )}
        </div>
      );
    }
    return content;
  }

  const [videoClientReady, setVideoClientReady] = useState(false)
  const [chatClientReady, setChatClientReady] = useState(false)
  const [channelReady, setChannelReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupCompleted, setSetupCompleted] = useState(false)
  const [backstageMode, setBackstageMode] = useState(false)
  const [livestreamActive, setLivestreamActive] = useState(false)
  const [streamTitle, setStreamTitle] = useState('')
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [callId, setCallId] = useState<string>('')

  const videoClientRef = useRef<StreamVideoClient | null>(null)
  const chatClientRef = useRef<StreamChat | null>(null)
  const callRef = useRef<any>(null)
  const channelRef = useRef<StreamChannel | null>(null)
  const initializationAttemptedRef = useRef(false)

  const sanitizedUserId = useMemo(() => {
    if (!user) return 'anonymous'
    return getSanitizedUserId(user)
  }, [user])

  const urlParams = new URLSearchParams(window.location.search)
  const liveStreamId = urlParams.get('live')
  const hasLiveStreamLink = !!liveStreamId
  
  const isAnonymousViewer = hasLiveStreamLink && !isAuthenticated
  const isAuthenticatedViewer = hasLiveStreamLink && isAuthenticated  
  const isStreamer = !hasLiveStreamLink && isAuthenticated
  const isViewer = hasLiveStreamLink
  
  const anonymousViewerId = useMemo(() => {
    if (isAnonymousViewer) {
      return `viewer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
    return null
  }, [isAnonymousViewer])

  const handleSetupComplete = () => {
    console.log('✅ Setup completed, transitioning to livestream mode')
    setSetupCompleted(true)
    setBackstageMode(true)
    setHideHeader(true)
  }

  // Set initial state for viewers (only once)
  useEffect(() => {
    if (isViewer && !setupCompleted) {
      console.log('👁️ Viewer detected, skipping setup screen')
      setSetupCompleted(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewer])

  useEffect(() => {
    if (isViewer) setHideHeader(true)
  }, [isViewer, setHideHeader])

  const handleGoLive = async () => {
    try {
      console.log('🚀 Going live...')
      
      // Actually transition the Stream call from backstage to live
      if (callRef.current) {
        await callRef.current.goLive()
        console.log('✅ Call.goLive() successful - backstage disabled, stream is now live')
      }
      
      // Update UI state
      setBackstageMode(false)
      setLivestreamActive(true)
      console.log('✅ UI updated to live mode')
    } catch (error) {
      console.error('❌ Failed to go live:', error)
    }
  }

  // Token helper - simplified
  const getStreamToken = useCallback(
    async (type: 'video' | 'chat', callId?: string): Promise<string> => {
      console.log(`🔑 getStreamToken called for type: ${type}, callId: ${callId}`)
      
      if (isAnonymousViewer && anonymousViewerId) {
        console.log('🔑 Fetching token for anonymous viewer:', anonymousViewerId)
        const res = await fetch('/api/auth-tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            userId: anonymousViewerId,
            callId: type === 'video' ? callId : undefined, // Only pass callId for video tokens
            userProfile: { name: 'Anonymous Viewer', role: 'admin' }
          }),
        })
        console.log(`🔑 Token response status (anonymous): ${res.status}`)
        if (!res.ok) {
          const errorText = await res.text()
          console.error('❌ Token fetch failed:', errorText)
          throw new Error(`auth-tokens failed: ${res.status}`)
        }
        const json = await res.json()
        console.log('✅ Token received (anonymous)')
        return json.token
      }
  
      console.log('🔑 Getting Auth0 access token...')
      const accessToken = await getAccessTokenSilently()
      console.log('✅ Auth0 access token received')
      
      console.log('🔑 Fetching Stream token for user:', sanitizedUserId)
      const res = await fetch('/api/auth-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          type,
          userId: sanitizedUserId,
          callId: type === 'video' ? callId : undefined, // Only pass callId for video tokens
          userProfile: {
            name: user?.name || user?.email || `User_${sanitizedUserId}`,
            image: user?.picture,
            role: 'admin',
          }
        }),
      })
      console.log(`🔑 Token response status: ${res.status}`)
      if (!res.ok) {
        const errorText = await res.text()
        console.error('❌ Token fetch failed:', errorText)
        throw new Error(`auth-tokens failed: ${res.status}`)
      }
      const json = await res.json()
      console.log('✅ Stream token received')
      return json.token
    },
    [getAccessTokenSilently, user, sanitizedUserId, isAnonymousViewer, anonymousViewerId]
  )

  // Initialize Video Client - simplified
  const initializeVideoClient = useCallback(async (sharedCallId: string) => {
    console.log('📹 initializeVideoClient called:', { sharedCallId, isAnonymousViewer, anonymousViewerId, sanitizedUserId })
    const effectiveUserId = isAnonymousViewer ? anonymousViewerId : sanitizedUserId
    console.log('👤 Effective user ID:', effectiveUserId)
    
    if (!apiKey || !effectiveUserId) {
      console.error('❌ Missing required params:', { hasApiKey: !!apiKey, effectiveUserId })
      return
    }
  
    // Reuse existing client for same user
    // @ts-ignore
    if (videoClientRef.current?.user?.id === effectiveUserId) {
      console.log('✅ Reusing existing video client')
      return
    }
  
    // Disconnect if switching users
    if (videoClientRef.current) {
      console.log('🔄 Disconnecting existing video client...')
      await videoClientRef.current.disconnectUser().catch(console.warn)
      videoClientRef.current = null
    }
  
    try {
      console.log('🔑 Fetching video token with callId...')
      const videoToken = await getStreamToken('video', sharedCallId) // Pass callId here
      console.log('✅ Video token received')
      
      console.log('🎬 Creating StreamVideoClient...')
      const videoClient = new StreamVideoClient({
        apiKey,
        user: {
          id: effectiveUserId,
          name: isAnonymousViewer ? 'Anonymous Viewer' : (user?.name || user?.email || effectiveUserId),
          image: isAnonymousViewer ? undefined : user?.picture,
        },
        token: videoToken,
      })
      console.log('✅ StreamVideoClient created')
  
      videoClientRef.current = videoClient
      setVideoClientReady(true)
      setCallId(sharedCallId)
      
      console.log('📞 Creating call object...')
      const call = videoClient.call('default', sharedCallId)
      callRef.current = call
      console.log('✅ Call object created')
  
      console.log('🔧 Getting or creating call...')
  
      if (isViewer) {
        // Viewers: Just get the existing call and join
        setBackstageMode(true)
        setLivestreamActive(false)

        console.log('👁️ Viewer: Getting existing call...')
        try {
          await call.get()
          console.log('✅ Call retrieved')
        } catch (err) {
          console.error('❌ Failed to get call:', err)
          throw new Error('This livestream does not exist or has ended')
        }
        
        console.log('🚪 Joining call as viewer...')
        await call.join({ create: false }) // Don't create, just join
        console.log('✅ Successfully joined call')
        
        // Check if the livestream is already live
        console.log('👁️ Checking if stream is already live...')
        const checkLiveStatus = () => {
          const backstageEnabled = call.state.backstage
          const startedAt = call.state.startedAt
          const participants = call.state.participants
          
          console.log('🔍 Call state check:', {
            backstageEnabled,
            startedAt: startedAt ? new Date(startedAt).toISOString() : null,
            participantCount: participants.length
          })
          
          const isCallLive = backstageEnabled === false
          
          if (isCallLive) {
            console.log('🔴 Stream is already live!')
            setBackstageMode(false)
            setLivestreamActive(true)
          } else {
            console.log('⏳ Stream in backstage mode, showing waiting room')
            setBackstageMode(true)
            setLivestreamActive(false)
          }
        }
        
        checkLiveStatus()
        setTimeout(checkLiveStatus, 1500)
        
        call.on('call.live_started', () => {
          console.log('🔴 Call went live event received!')
          setBackstageMode(false)
          setLivestreamActive(true)
        })
        
        call.on('call.ended', () => {
          console.log('🛑 Call ended event received!')
          setLivestreamActive(false)
        })
        
      } else {
        // Streamers: Create the call with backstage enabled
        console.log('🎤 Streamer: Creating call with backstage enabled...')
        
        try {
          await call.getOrCreate({
            ring: false,
            data: {
              members: [{ user_id: effectiveUserId, role: 'admin' }],
              settings_override: { 
                backstage: { 
                  enabled: true,
                },
              },
            },
          })
          console.log('✅ Call created with backstage')
          
        } catch (err) {
          console.error('❌ Failed to create/configure call:', err)
          throw err
        }
        
        console.log('🚪 Joining call as streamer...')
        await call.join()
        console.log('✅ Successfully joined call as streamer')
      }
  
    } catch (err) {
      console.error('❌ Failed to initialize video client:', err)
      console.error('Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      })
      setError(err instanceof Error ? err.message : 'Failed to initialize video')
    }
  }, [apiKey, sanitizedUserId, getStreamToken, user, anonymousViewerId, isAnonymousViewer, isViewer])

  // Initialize Chat Client - simplified
  const initializeChatClient = useCallback(async (sharedCallId: string) => {
    // Use anonymous ID for anonymous viewers, authenticated ID for everyone else
    const effectiveChatUserId = isAnonymousViewer ? anonymousViewerId : sanitizedUserId
    
    console.log('💬 initializeChatClient called:', { 
      sharedCallId, 
      sanitizedUserId, 
      anonymousViewerId,
      effectiveChatUserId,
      isAnonymousViewer,
      hasChatClient: !!chatClientRef.current 
    })
    
    if (!apiKey || !effectiveChatUserId || chatClientRef.current) {
      console.log('⏸️ Skipping chat init:', { hasApiKey: !!apiKey, effectiveChatUserId, hasChatClient: !!chatClientRef.current })
      return
    }

    try {
      console.log('🔑 Fetching chat token...')
      const chatToken = await getStreamToken('chat')
      console.log('✅ Chat token received')
      
      console.log('💬 Getting StreamChat instance...')
      const chatClient = StreamChat.getInstance(apiKey)
      
      console.log('🔌 Connecting chat user...')
      await chatClient.connectUser(
        {
          id: effectiveChatUserId,
          name: isAnonymousViewer ? 'Anonymous Viewer' : (user?.name || user?.email || `User_${effectiveChatUserId}`),
          image: isAnonymousViewer ? undefined : user?.picture,
        },
        chatToken
      )
      console.log('✅ Chat user connected')

      chatClientRef.current = chatClient
      setChatClientReady(true)

      const channelId = sharedCallId
      console.log('📺 Channel ID:', channelId)
      
      if (isStreamer || isAuthenticatedViewer) {
        console.log('🏗️ Creating/joining livestream channel via API...')
        const accessToken = await getAccessTokenSilently()
        const response = await fetch('/api/chat-operations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            type: 'create-livestream-channel',
            channelId,
            userId: effectiveChatUserId
          }),
        })
        console.log('✅ Channel creation response:', response.status)
      } else if (isAnonymousViewer) {
        console.log('👁️ Anonymous viewer joining channel via API (if needed)...')
        // Anonymous viewers can just watch the channel without backend setup
        // The backend endpoint handles anonymous users if needed
        try {
          const response = await fetch('/api/chat-operations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'create-livestream-channel',
              channelId,
              userId: effectiveChatUserId
            }),
          })
          console.log('✅ Anonymous viewer channel response:', response.status)
        } catch (err) {
          console.log('⚠️ Anonymous viewer channel setup skipped:', err)
          // Not critical for anonymous viewers
        }
      }

      console.log('👁️ Watching channel...')
      const channel = chatClient.channel('livestream', channelId)
      await channel.watch()
      console.log('✅ Channel watched successfully')
      channelRef.current = channel
      setChannelReady(true)
      console.log('✅ Channel state updated, component will re-render')

    } catch (err) {
      console.error('❌ Failed to initialize chat client:', err)
      console.error('Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      })
      setError(err instanceof Error ? err.message : 'Failed to initialize chat')
    }
  }, [apiKey, sanitizedUserId, anonymousViewerId, isAnonymousViewer, getStreamToken, user, isStreamer, isAuthenticatedViewer, getAccessTokenSilently])

  // Main initialization effect
useEffect(() => {
  console.log('🔍 Main init effect triggered:', {
    isAnonymousViewer,
    isAuthenticated,
    hasUser: !!user,
    hasApiKey: !!apiKey,
    sanitizedUserId,
    initializationAttempted: initializationAttemptedRef.current,
    setupCompleted,
    liveStreamId
  })

  if (isAnonymousViewer) {
    if (!apiKey || initializationAttemptedRef.current || !setupCompleted) {
      console.log('⏸️ Skipping init (anonymous):', { hasApiKey: !!apiKey, initAttempted: initializationAttemptedRef.current, setupCompleted })
      return
    }
  } else {
    if (!isAuthenticated || !user || !apiKey || !sanitizedUserId || initializationAttemptedRef.current || !setupCompleted) {
      console.log('⏸️ Skipping init (authenticated):', { 
        isAuthenticated, 
        hasUser: !!user, 
        hasApiKey: !!apiKey, 
        sanitizedUserId, 
        initAttempted: initializationAttemptedRef.current, 
        setupCompleted 
      })
      return
    }
  }

  const initialize = async () => {
    console.log('🚀 Starting initialization...')
    initializationAttemptedRef.current = true
    const sharedCallId = liveStreamId || `live-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    console.log('📞 Call ID:', sharedCallId)
    
    // ✅ SET VIEWER STATE IMMEDIATELY (BEFORE async operations)
    if (isViewer) {
      console.log('👁️ Setting viewer to backstage mode immediately')
      setBackstageMode(true)
      setLivestreamActive(false)
    }
    
    try {
      console.log('⏳ Initializing video and chat clients in parallel...')
      await Promise.all([
        initializeVideoClient(sharedCallId),
        initializeChatClient(sharedCallId)
      ])
      console.log('✅ Both clients initialized successfully')
    } catch (err) {
      console.error('❌ Failed to initialize clients:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize')
    }
  }

  initialize()
}, [isAuthenticated, user, apiKey, sanitizedUserId, setupCompleted, isAnonymousViewer, liveStreamId, initializeVideoClient, initializeChatClient, isViewer])

  // Cleanup
  useEffect(() => {
    return () => {
      callRef.current?.leave().catch(console.warn)
      chatClientRef.current?.disconnectUser().catch(console.warn)
      setHideHeader(false)
    }
  }, [setHideHeader])
  // Render logic
  console.log('🎨 Render logic - State check:', {
    isAuthenticated,
    isAnonymousViewer,
    hasApiKey: !!apiKey,
    setupCompleted,
    isViewer,
    backstageMode,
    livestreamActive,
    videoClientReady,
    chatClientReady,
    channelReady,
    hasVideoClient: !!videoClientRef.current,
    hasCall: !!callRef.current,
    hasChatClient: !!chatClientRef.current,
    hasChannel: !!channelRef.current,
    error
  })

  // Add this new debug log
  console.log('🎯 Render decision tree:', {
    willShowSetup: !setupCompleted && !isViewer,
    willShowBackstage: backstageMode && !livestreamActive,
    willShowLive: !backstageMode || livestreamActive,
    isInBackstageBlock: backstageMode && !livestreamActive && videoClientReady && videoClientRef.current && callRef.current,
    isInViewerBackstageBlock: backstageMode && !livestreamActive && videoClientReady && videoClientRef.current && callRef.current && isViewer
  })

  if (!isAuthenticated && !isAnonymousViewer) {
    console.log('❌ Render: Not authenticated')
    return wrapInMobileView(<div className="video-error">Please log in to access the livestream.</div>)
  }

  if (!apiKey) {
    console.log('❌ Render: No API key')
    return wrapInMobileView(<div className="video-error">Stream API key not configured.</div>)
  }

  if (!setupCompleted && !isViewer) {
    console.log('🎬 Render: Showing LivestreamSetup')
    return wrapInMobileView(<LivestreamSetup onSetupComplete={handleSetupComplete} />)
  }

  if (backstageMode && !livestreamActive) {
    console.log('🎭 Render: In backstage mode')
    if (!videoClientReady || !videoClientRef.current || !callRef.current) {
      console.log('⏳ Render: Loading (waiting for video client in backstage)', {
        videoClientReady,
        hasVideoClient: !!videoClientRef.current,
        hasCall: !!callRef.current
      })
      return wrapInMobileView(<LoadingSpinner darkMode mobile={isMobileView} />)
    }

    if (error) {
      console.log('❌ Render: Error in backstage:', error)
      return wrapInMobileView(<div className="video-error">Error: {error}</div>)
    }

    if (isViewer) {
      console.log('👁️ Render: Viewer in backstage')
      
      // Show ViewerWaitingRoom immediately, chat will load in the background
      console.log('✅ Render: ViewerWaitingRoom')
      return (
        <div className="video-container">
          <StreamVideo client={videoClientRef.current}>
            <StreamCall call={callRef.current}>
              <ViewerWaitingRoom
                chatClient={chatClientRef.current}
                channel={channelRef.current}
                streamTitle={streamTitle}
                callId={callId}
                isAnonymousViewer={isAnonymousViewer}
                onStreamGoesLive={() => {
                  setBackstageMode(false)
                  setLivestreamActive(true)
                }}
              />
            </StreamCall>
          </StreamVideo>
        </div>
      )
    } else {
      console.log('🎤 Render: Streamer in backstage')
      if (!chatClientReady || !channelReady || !chatClientRef.current || !channelRef.current) {
        console.log('⏳ Render: Loading (waiting for chat in streamer backstage)', {
          chatClientReady,
          channelReady,
          hasChatClient: !!chatClientRef.current,
          hasChannel: !!channelRef.current
        })
        return wrapInMobileView(<LoadingSpinner darkMode mobile={isMobileView} />)
      }

      console.log('✅ Render: BackstageMode')
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
              />
            </StreamCall>
          </StreamVideo>
        </div>
      )
    }
  }

  console.log('📺 Render: Live stream mode')

  // For anonymous viewers, we don't require chat to be ready
  const requiresChat = !isAnonymousViewer
  
  if (!videoClientReady || !videoClientRef.current || !callRef.current) {
    console.log('⏳ Render: Loading (waiting for video client in live mode)', {
      videoClientReady,
      hasVideoClient: !!videoClientRef.current,
      hasCall: !!callRef.current
    })
    return wrapInMobileView(<LoadingSpinner darkMode mobile={isMobileView} />)
  }
  
  if (requiresChat && (!chatClientReady || !channelReady || !chatClientRef.current || !channelRef.current)) {
    console.log('⏳ Render: Loading (waiting for chat in live mode)', {
      chatClientReady,
      channelReady,
      hasChatClient: !!chatClientRef.current,
      hasChannel: !!channelRef.current
    })
    return wrapInMobileView(<LoadingSpinner darkMode mobile={isMobileView} />)
  }
  
  if (error) {
    console.log('❌ Render: Error in live mode:', error)
    return wrapInMobileView(<div className="video-error">Error: {error}</div>)
  }

  const videoContent = (
    <div className="video-container">
      <div className="video-main">
        <StreamVideo client={videoClientRef.current}>
          <StreamCall call={callRef.current}>
            <EnhancedLivestreamLayout 
              sidebarVisible={sidebarVisible} 
              onSidebarToggle={() => setSidebarVisible(!sidebarVisible)}
              chatClient={chatClientRef.current}
              channel={channelRef.current}
              streamTitle={streamTitle}
              isViewer={isViewer}
            />
          </StreamCall>
        </StreamVideo>
      </div>
    </div>
  )

  return wrapInMobileView(
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {videoContent}
      {isMobileView && <MobileBottomNav currentPath={location.pathname} />}
    </div>
  )
}

export default Video