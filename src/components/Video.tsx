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
import MessageCircleIcon from '../icons/message-circle.svg';
import CaretIcon from '../icons/caret.svg'
import MicrophoneIcon from '../icons/microphone.svg'
import MicrophoneOffIcon from '../icons/microphone-off.svg'
import VideoIcon from '../icons/video.svg'
import VideoOffIcon from '../icons/video-off.svg'
import HeartIcon from '../icons/heart.svg'
import CopyIcon from '../icons/file-copy-line.svg'
import DeviceDesktopIcon from '../icons/device-desktop.svg'
import ExitIcon from '../icons/logout-2.svg'
import StopIcon from '../icons/stop.svg'
import videoLoop from '../assets/video-loop.mov'
import '@stream-io/video-react-sdk/dist/css/styles.css'
import './Video.css'

const generateUserColor = (userId: string): string => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash % 360);
  const saturation = 70 + (Math.abs(hash) % 30);
  const lightness = 45 + (Math.abs(hash) % 20);
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

interface CustomMessageBubbleProps {
  message: any
  hostUserId: string
  isCurrentUser: boolean
}

const CustomMessageBubble: React.FC<CustomMessageBubbleProps> = ({ message, hostUserId, isCurrentUser }) => {
  if (!message || !message.text) {
    return null
  }
  
  if (message.type === 'system') {
    return null
  }
  
  try {
    const parsed = JSON.parse(message.text)
    if (parsed.type && parsed.type.startsWith('stream.')) {
      return null
    }
  } catch (e) {
  }
    
  const messageUser = message.user || {}
  const messageUserId = messageUser.id || 'unknown'
  const messageUserName = messageUser.name || messageUser.display_name || messageUserId || 'Unknown'
  
  const isMessageFromHost = messageUserId === hostUserId
  
  const userColor = generateUserColor(messageUserId)
  
  return (
    <div className="custom-message-bubble">
      {isMessageFromHost && (
        <span className="live-badge">LIVE</span>
      )}
      
      <span 
        className="username" 
        style={{ color: userColor }}
      >
        {messageUserName}
      </span>
      
      <span className="separator">: </span>
      
      <span className="message-text">
        {message.text}
      </span>
    </div>
  )
}

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

    const loadMessages = async () => {
      try {
        const result = await channel.query({ messages: { limit: 50 } })
        setMessages(result.messages || [])
        setTimeout(scrollToBottom, 100)
      } catch (error) {
      }
    }

    loadMessages()

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

    channel.on('message.new', handleNewMessage)
    channel.on('message.updated', handleMessageUpdated)
    channel.on('message.deleted', handleMessageDeleted)

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
      setTimeout(() => inputRef.current?.focus(), 100)
    } catch (error) {
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
          <img src={ExitIcon} width={18} height={18} />
        </button>
        
        <div className="waiting-room-header">
          <h1>🔴 Waiting for Stream to Start</h1>
          {streamTitle && <h2>{streamTitle}</h2>}
          <p>The streamer is getting ready. You'll be able to watch once they go live!</p>
        </div>

        <div className="waiting-room-participants">
          <h3 className="waiting-room-participants-header">
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
    
    if (channel) {
      await channel.sendMessage({
        text: JSON.stringify({ type: 'stream.went_live', timestamp: Date.now() }),
        silent: true,
        type: 'system'
      }).catch(() => {})
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
        </div>
      </div>

      <div className="backstage-content">
        <button className="exit-btn" onClick={() => window.location.href = '/feeds'}>
          <img src={ExitIcon} width={18} height={18} style={{ filter: 'invert(1)', opacity: 0.5 }} />
        </button>
        
        <div className="backstage-header">
          <h1>BACKSTAGE MODE</h1>
          
          <div className="title-input-section">
            <label htmlFor="stream-title" className="stream-title-label">Stream Title (Optional)</label>
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
                <img src={CopyIcon} alt="Copy" className="copy-icon" />
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
              <p>No one is waiting yet</p>
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
    }
  }

  const handleCameraToggle = async () => {
    try {
      await camera.toggle()
    } catch (error) {
    }
  }

  const handleScreenShareToggle = async () => {
    try {
      await screenShare.toggle()
    } catch (error) {
    }
  }

  const handleReactionClick = () => {
    setShowReactions(!showReactions)
  }

  const handleStopLivestream = () => {
    setShowStopModal(true)
  }

  const confirmStopLivestream = async () => {
    try {
      setShowStopModal(false)
      
      if (call) {
        // Collect anonymous viewer IDs before stopping the livestream
        const participants = call.state.participants || [];
        const anonymousViewerIds = participants
          .map(p => p.userId)
          .filter((userId): userId is string => {
            return typeof userId === 'string' && userId.startsWith('viewer_');
          });

        console.log(`🧹 Found ${anonymousViewerIds.length} anonymous viewers to delete:`, anonymousViewerIds);

        // Stop the livestream
        await call.stopLive()
        await call.leave()

        // Delete anonymous viewer users after stopping the livestream
        if (anonymousViewerIds.length > 0) {
          try {
            const response = await fetch('/api/chat-operations', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                type: 'delete-anonymous-viewers',
                userIds: anonymousViewerIds
              }),
            });

            if (response.ok) {
              const result = await response.json();
              console.log(`✅ Deleted ${result.deletedCount} anonymous viewers`);
            } else {
              console.error('⚠️ Failed to delete anonymous viewers:', await response.text());
            }
          } catch (deleteError) {
            console.error('❌ Error deleting anonymous viewers:', deleteError);
            // Don't block navigation even if cleanup fails
          }
        }
      }
      
      window.location.href = '/'
    } catch (error) {
      console.error('❌ Error stopping livestream:', error);
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
          <button onClick={() => {}}>❤️</button>
          <button onClick={() => {}}>👍</button>
          <button onClick={() => {}}>🎉</button>
          <button onClick={() => {}}>👏</button>
          <button onClick={() => {}}>🔥</button>
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
            <div className="mobile-view-toggle" title="Switch to Desktop View">
              <span className="toggle-label active">Mobile</span>
              <button
                onClick={toggleView}
                className="toggle-track mobile-active"
                role="switch"
                aria-checked={true}
              >
                <span className="toggle-thumb" />
              </button>
              <span className="toggle-label">Desktop</span>
            </div>
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
    setSetupCompleted(true)
    setBackstageMode(true)
    setHideHeader(true)
  }

  useEffect(() => {
    if (isViewer && !setupCompleted) {
      setSetupCompleted(true)
    }
  }, [isViewer])

  useEffect(() => {
    if (isViewer) setHideHeader(true)
  }, [isViewer, setHideHeader])

  const handleGoLive = async () => {
    try {
      if (callRef.current) {
        await callRef.current.goLive()
      }
      
      setBackstageMode(false)
      setLivestreamActive(true)
    } catch (error) {
    }
  }

  const getStreamToken = useCallback(
    async (type: 'video' | 'chat', callId?: string): Promise<string> => {
      if (isAnonymousViewer && anonymousViewerId) {
        const res = await fetch('/api/auth-tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            userId: anonymousViewerId,
            callId: type === 'video' ? callId : undefined,
            userProfile: { name: 'Anonymous Viewer', role: 'admin' }
          }),
        })
        if (!res.ok) {
          const errorText = await res.text()
          throw new Error(`auth-tokens failed: ${res.status}`)
        }
        const json = await res.json()
        return json.token
      }
  
      const accessToken = await getAccessTokenSilently()
      
      const res = await fetch('/api/auth-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          type,
          userId: sanitizedUserId,
          callId: type === 'video' ? callId : undefined,
          userProfile: {
            name: user?.name || user?.email || `User_${sanitizedUserId}`,
            image: user?.picture,
            role: 'admin',
          }
        }),
      })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`auth-tokens failed: ${res.status}`)
      }
      const json = await res.json()
      return json.token
    },
    [getAccessTokenSilently, user, sanitizedUserId, isAnonymousViewer, anonymousViewerId]
  )

  const initializeVideoClient = useCallback(async (sharedCallId: string) => {
    const effectiveUserId = isAnonymousViewer ? anonymousViewerId : sanitizedUserId
    
    if (!apiKey || !effectiveUserId) {
      return
    }
  
    // @ts-ignore
    if (videoClientRef.current?.user?.id === effectiveUserId) {
      return
    }
  
    if (videoClientRef.current) {
      await videoClientRef.current.disconnectUser().catch(() => {})
      videoClientRef.current = null
    }
  
    try {
      const videoToken = await getStreamToken('video', sharedCallId)
      
      const videoClient = new StreamVideoClient({
        apiKey,
        user: {
          id: effectiveUserId,
          name: isAnonymousViewer ? 'Anonymous Viewer' : (user?.name || user?.email || effectiveUserId),
          image: isAnonymousViewer ? undefined : user?.picture,
        },
        token: videoToken,
      })
  
      videoClientRef.current = videoClient
      setVideoClientReady(true)
      setCallId(sharedCallId)
      
      const call = videoClient.call('default', sharedCallId)
      callRef.current = call
  
      if (isViewer) {
        setBackstageMode(true)
        setLivestreamActive(false)

        try {
          await call.get()
        } catch (err) {
          throw new Error('This livestream does not exist or has ended')
        }
        
        await call.join({ create: false })
        
        const checkLiveStatus = () => {
          const backstageEnabled = call.state.backstage
          const isCallLive = backstageEnabled === false
          
          if (isCallLive) {
            setBackstageMode(false)
            setLivestreamActive(true)
          } else {
            setBackstageMode(true)
            setLivestreamActive(false)
          }
        }
        
        checkLiveStatus()
        setTimeout(checkLiveStatus, 1500)
        
        call.on('call.live_started', () => {
          setBackstageMode(false)
          setLivestreamActive(true)
        })
        
        call.on('call.ended', () => {
          setLivestreamActive(false)
        })
        
      } else {
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
          
        } catch (err) {
          throw err
        }
        
        await call.join()
      }
  
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize video')
    }
  }, [apiKey, sanitizedUserId, getStreamToken, user, anonymousViewerId, isAnonymousViewer, isViewer])

  const initializeChatClient = useCallback(async (sharedCallId: string) => {
    const effectiveChatUserId = isAnonymousViewer ? anonymousViewerId : sanitizedUserId
    
    if (!apiKey || !effectiveChatUserId || chatClientRef.current) {
      return
    }

    try {
      const chatToken = await getStreamToken('chat')
      
      const chatClient = StreamChat.getInstance(apiKey)
      
      await chatClient.connectUser(
        {
          id: effectiveChatUserId,
          name: isAnonymousViewer ? 'Anonymous Viewer' : (user?.name || user?.email || `User_${effectiveChatUserId}`),
          image: isAnonymousViewer ? undefined : user?.picture,
        },
        chatToken
      )

      chatClientRef.current = chatClient
      setChatClientReady(true)

      const channelId = sharedCallId
      
      if (isStreamer || isAuthenticatedViewer) {
        const accessToken = await getAccessTokenSilently()
        await fetch('/api/chat-operations', {
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
      } else if (isAnonymousViewer) {
        try {
          await fetch('/api/chat-operations', {
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
        } catch (err) {
        }
      }

      const channel = chatClient.channel('livestream', channelId)
      await channel.watch()
      channelRef.current = channel
      setChannelReady(true)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize chat')
    }
  }, [apiKey, sanitizedUserId, anonymousViewerId, isAnonymousViewer, getStreamToken, user, isStreamer, isAuthenticatedViewer, getAccessTokenSilently])

useEffect(() => {
  if (isAnonymousViewer) {
    if (!apiKey || initializationAttemptedRef.current || !setupCompleted) {
      return
    }
  } else {
    if (!isAuthenticated || !user || !apiKey || !sanitizedUserId || initializationAttemptedRef.current || !setupCompleted) {
      return
    }
  }

  const initialize = async () => {
    initializationAttemptedRef.current = true
    const sharedCallId = liveStreamId || `live-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    if (isViewer) {
      setBackstageMode(true)
      setLivestreamActive(false)
    }
    
    try {
      await Promise.all([
        initializeVideoClient(sharedCallId),
        initializeChatClient(sharedCallId)
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize')
    }
  }

  initialize()
}, [isAuthenticated, user, apiKey, sanitizedUserId, setupCompleted, isAnonymousViewer, liveStreamId, initializeVideoClient, initializeChatClient, isViewer])

  useEffect(() => {
    return () => {
      callRef.current?.leave().catch(() => {})
      chatClientRef.current?.disconnectUser().catch(() => {})
      setHideHeader(false)
    }
  }, [setHideHeader])

  if (!isAuthenticated && !isAnonymousViewer) {
    return wrapInMobileView(<div className="video-error">Please log in to access the livestream.</div>)
  }

  if (!apiKey) {
    return wrapInMobileView(<div className="video-error">Stream API key not configured.</div>)
  }

  if (!setupCompleted && !isViewer) {
    return wrapInMobileView(<LivestreamSetup onSetupComplete={handleSetupComplete} />)
  }

  if (backstageMode && !livestreamActive) {
    if (!videoClientReady || !videoClientRef.current || !callRef.current) {
      return wrapInMobileView(<LoadingSpinner darkMode mobile={isMobileView} />)
    }

    if (error) {
      return wrapInMobileView(<div className="video-error">Error: {error}</div>)
    }

    if (isViewer) {
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
      if (!chatClientReady || !channelReady || !chatClientRef.current || !channelRef.current) {
        return wrapInMobileView(<LoadingSpinner darkMode mobile={isMobileView} />)
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
              />
            </StreamCall>
          </StreamVideo>
        </div>
      )
    }
  }

  const requiresChat = !isAnonymousViewer
  
  if (!videoClientReady || !videoClientRef.current || !callRef.current) {
    return wrapInMobileView(<LoadingSpinner darkMode mobile={isMobileView} />)
  }
  
  if (requiresChat && (!chatClientReady || !channelReady || !chatClientRef.current || !channelRef.current)) {
    return wrapInMobileView(<LoadingSpinner darkMode mobile={isMobileView} />)
  }
  
  if (error) {
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