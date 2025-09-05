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
// Note: We're using custom chat components instead of stream-chat-react UI components
// Only keeping the imports in case we need them for reference
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

interface VideoProps {}

const Video: React.FC<VideoProps> = () => {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0()
  const { setHideHeader } = useUILayout()

  const apiKey = import.meta.env.VITE_STREAM_API_KEY as string | undefined

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

  // Keep single client instances per tab
  const videoClientRef = useRef<StreamVideoClient | null>(null)
  const chatClientRef = useRef<StreamChat | null>(null)
  const callRef = useRef<any>(null)
  const channelRef = useRef<StreamChannel | null>(null)

  // Memoize current user id using shared utility
  const sanitizedUserId = useMemo(() => getSanitizedUserId(user), [user])

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
            name: user?.name || user?.email || 'Anonymous User',
            image: user?.picture || undefined,
            role: 'User'
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
    [getAccessTokenSilently, user, sanitizedUserId]
  )

  // --- Initialize Video Client ---
  const initializeVideoClient = useCallback(async () => {
    if (!apiKey || !sanitizedUserId || videoClientRef.current) {
      return
    }

    try {
      console.log('🎥 Initializing video client for user:', sanitizedUserId)
      
      const videoToken = await getStreamToken('video')
      
      const videoClient = new StreamVideoClient({
        apiKey,
        user: {
          id: sanitizedUserId,
          name: user?.name || user?.email || 'Anonymous User',
          image: user?.picture || undefined,
        },
        token: videoToken,
      })

      videoClientRef.current = videoClient
      setVideoClientReady(true)
      console.log('✅ Video client initialized successfully')

      // Create or join a livestream call with backstage mode
      const callId = 'demo-livestream' // You might want to make this dynamic
      const call = videoClient.call('livestream', callId)
      callRef.current = call

      // Create the call with backstage mode enabled if it doesn't exist, then join
      try {
        await call.getOrCreate({
          data: {
            settings_override: {
              backstage: {
                enabled: true,
                join_ahead_time_seconds: 300, // Allow joining 5 minutes before
              },
            },
          },
        })
        console.log('✅ Call created/retrieved with backstage mode successfully')
        
        await call.join()
        console.log('✅ Joined livestream call')
      } catch (joinError) {
        console.error('❌ Failed to create/join call:', joinError)
        const errorMessage = joinError instanceof Error ? joinError.message : 'Unknown error'
        throw new Error(`Failed to join livestream: ${errorMessage}`)
      }

    } catch (err) {
      console.error('❌ Failed to initialize video client:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize video')
    }
  }, [apiKey, sanitizedUserId, getStreamToken, user])

  // --- Initialize Chat Client ---
  const initializeChatClient = useCallback(async () => {
    if (!apiKey || !sanitizedUserId || chatClientRef.current) {
      return
    }

    try {
      console.log('💬 Initializing chat client for user:', sanitizedUserId)
      
      const chatToken = await getStreamToken('chat')
      
      const chatClient = StreamChat.getInstance(apiKey)
      await chatClient.connectUser(
        {
          id: sanitizedUserId,
          name: user?.name || user?.email || 'Anonymous User',
          image: user?.picture || undefined,
        },
        chatToken
      )

      chatClientRef.current = chatClient
      setChatClientReady(true)
      console.log('✅ Chat client initialized successfully')

      // Create or get the livestream chat channel
      const channelId = 'demo-livestream-chat' // You might want to make this dynamic
      const channel = chatClient.channel('livestream', channelId, {
        created_by_id: sanitizedUserId,
      })

      await channel.watch()
      channelRef.current = channel
      console.log('✅ Joined livestream chat channel')
      
      // DEBUG: Add channel event listeners to see what's happening
      channel.on('message.new', (event) => {
        console.log('🔔 NEW MESSAGE EVENT:', event)
      })
      
      channel.on('message.updated', (event) => {
        console.log('🔔 MESSAGE UPDATED EVENT:', event)
      })
      
      // Log current channel state
      console.log('📋 Channel state:', {
        id: channel.id,
        type: channel.type,
        memberCount: Object.keys(channel.state.members).length,
        messageCount: channel.state.messages.length,
        messages: channel.state.messages
      })

    } catch (err) {
      console.error('❌ Failed to initialize chat client:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize chat')
    }
  }, [apiKey, sanitizedUserId, getStreamToken, user])

  // --- Main initialization effect ---
  useEffect(() => {
    // Prevent multiple initialization attempts and wait for setup completion (join backstage)
    if (!isAuthenticated || !apiKey || !sanitizedUserId || isConnecting || initializationAttempted || !setupCompleted) {
      return
    }

    const initialize = async () => {
      setIsConnecting(true)
      setError(null)
      setInitializationAttempted(true)

      try {
        // Initialize both video and chat clients in parallel
        await Promise.all([
          initializeVideoClient(),
          initializeChatClient()
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
  }, [isAuthenticated, apiKey, sanitizedUserId, initializationAttempted, setupCompleted, initializeVideoClient, initializeChatClient])

  // --- Cleanup effect ---
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up video clients...')
      if (callRef.current) {
        callRef.current.leave().catch(console.warn)
        callRef.current = null
      }
      if (chatClientRef.current) {
        chatClientRef.current.disconnectUser().catch(console.warn)
        chatClientRef.current = null
      }
      if (videoClientRef.current) {
        videoClientRef.current = null
      }
      // Reset state for potential re-initialization
      setVideoClientReady(false)
      setChatClientReady(false)
      setInitializationAttempted(false)
      setIsConnecting(false)
      setError(null)
      setHideHeader(false) // Show header again when leaving
    }
  }, [setHideHeader])

  // --- Render helpers ---
  if (!isAuthenticated) {
    return <div className="video-error">Please log in to access the livestream.</div>
  }

  if (!apiKey) {
    return <div className="video-error">Stream API key not configured.</div>
  }

  // Show setup screen if not completed
  if (!setupCompleted) {
    return <LivestreamSetup onSetupComplete={handleSetupComplete} />
  }

  // Show backstage mode before going live
  if (backstageMode && !livestreamActive) {
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
        <StreamVideo client={videoClientRef.current}>
          <StreamCall call={callRef.current}>
            <BackstageMode 
              onGoLive={handleGoLive}
              chatClient={chatClientRef.current}
              channel={channelRef.current}
              streamTitle={streamTitle}
              onTitleChange={setStreamTitle}
            />
          </StreamCall>
        </StreamVideo>
      </div>
    )
  }

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
}

const EnhancedLivestreamLayout: React.FC<EnhancedLivestreamLayoutProps> = ({
  sidebarVisible,
  onSidebarToggle,
  chatClient,
  channel,
  streamTitle
}) => {
  const { useCallCallingState } = useCallStateHooks()
  const callingState = useCallCallingState()
  const [activeTab, setActiveTab] = useState<'participants' | 'chat'>('chat')

  if (callingState === CallingState.JOINING) {
    return (
      <div className="video-loading">
        <LoadingSpinner darkMode />
        <p>Joining livestream...</p>
      </div>
    )
  }

  if (callingState === CallingState.LEFT) {
    return (
      <div className="video-loading">
        <p>You have left the livestream.</p>
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
        

        {/* Custom Stream Controls - Bottom */}
        <div className="controls-overlay">
          <CustomLivestreamControls />
        </div>
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
            <div className="participants-section">
              <div className="participants-placeholder">
                <p>Viewers will appear here when they join</p>
              </div>
            </div>
          )}
          
          {activeTab === 'chat' && (
            <div className="chat-section">
              {chatClient && channel ? (
                <div className="custom-chat-container">
                  <CustomLivestreamMessageList channel={channel} />
                  <CustomLivestreamMessageInput channel={channel} />
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
      // Get the call from the current context and leave
      window.location.href = '/' // Navigate back to home
    } catch (error) {
      console.error('Failed to stop livestream:', error)
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
}

const BackstageMode: React.FC<BackstageModeProps> = ({
  onGoLive,
  chatClient,
  channel,
  streamTitle,
  onTitleChange
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
      
      // Use Stream's built-in goLive method
      if (call) {
        await call.goLive({
          start_hls: true, // Start HLS broadcast
          start_recording: true, // Start recording
        })
        console.log('✅ Successfully went live!')
      }
      
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

  // Count waiting participants (exclude the host)
  const waitingParticipants = participants.filter(p => p.isLocalParticipant === false)

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
      
      {/* Camera Preview - Top Left */}
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

              {/* Main Content Area */}
        <div className="backstage-content">
          <button className="exit-btn" onClick={handleExit}>
            Exit
          </button>
          
          <div className="backstage-header">
            <h1>You're in the backstage!</h1>
            <p>Get ready to go live. Preview your camera and check who's waiting to join.</p>
            
            {/* Stream Title Input */}
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
          </div>

        {/* Timer and Go Live Controls */}
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

        {/* Waiting Room Participants */}
        <div className="waiting-room">
          <h3>
            <img src={ViewersIcon} alt="Waiting" className="section-icon" />
            Waiting Room ({waitingParticipants.length})
          </h3>
          
          {waitingParticipants.length > 0 ? (
            <div className="waiting-participants">
              {waitingParticipants.map((participant) => (
                <div key={participant.sessionId} className="waiting-participant">
                  <div className="participant-avatar">
                    {participant.image ? (
                      <img src={participant.image} alt={participant.name} />
                    ) : (
                      <div className="avatar-placeholder">
                        {participant.name?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                  <div className="participant-info">
                    <span className="participant-name">
                      {participant.name || 'Anonymous User'}
                    </span>
                    <span className="participant-status">Waiting to join</span>
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
        {chatClient && channel ? (
          <div className="custom-chat-container">
            <CustomLivestreamMessageList channel={channel} />
            <CustomLivestreamMessageInput channel={channel} />
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


// Custom Message Input Component for Livestream Chat
const CustomLivestreamMessageInput: React.FC<{ channel: StreamChannel }> = ({ channel }) => {
  console.log('🚀 CustomLivestreamMessageInput mounted with channel:', channel?.id)
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!message.trim() || isSending) return

    try {
      setIsSending(true)
      console.log('📤 Sending message:', message.trim(), 'to channel:', channel?.id)
      const result = await channel.sendMessage({
        text: message.trim(),
      })
      console.log('✅ Message sent successfully:', result)
      setMessage('')
    } catch (error) {
      console.error('❌ Failed to send message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="custom-message-input">
      <form onSubmit={handleSubmit} className="message-input-form">
        <input
          type="text"
          className="message-input-field"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isSending}
          maxLength={500}
        />
        <button
          type="submit"
          className={`send-button ${!message.trim() || isSending ? 'disabled' : ''}`}
          disabled={!message.trim() || isSending}
        >
          {isSending ? '...' : 'Send'}
        </button>
      </form>
    </div>
  )
}

// Custom Message List Component for Livestream Chat
const CustomLivestreamMessageList: React.FC<{ channel: StreamChannel }> = ({ channel }) => {
  console.log('🚀 CustomLivestreamMessageList mounted with channel:', channel?.id)
  const { user } = useAuth0() // Get current logged-in user
  const [messages, setMessages] = useState<any[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Memoize current user id using shared utility
  const sanitizedCurrentUserId = useMemo(() => getSanitizedUserId(user), [user])

  // Array of vibrant colors for usernames
  const usernameColors = [
    '#ff4757', '#9c88ff', '#5dade2', '#2ed573', '#ffa502', '#ff6b81'
  ]

  const getUsernameColor = (userId: string) => {
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    }
    return usernameColors[Math.abs(hash) % usernameColors.length]
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (!channel) return

    // Load existing messages
    const loadMessages = async () => {
      try {
        const result = await channel.query({
          messages: { limit: 50 }
        })
        console.log('📨 Loaded existing messages:', result.messages)
        setMessages(result.messages || [])
        setTimeout(scrollToBottom, 100)
      } catch (error) {
        console.error('❌ Error loading messages:', error)
      }
    }

    loadMessages()

    // Listen for new messages
    const handleNewMessage = (event: any) => {
      console.log('🔔 NEW MESSAGE in custom list:', event)
      if (event.message) {
        setMessages(prev => [...prev, event.message])
        setTimeout(scrollToBottom, 100)
      }
    }

    // Listen for message updates
    const handleMessageUpdate = (event: any) => {
      console.log('📝 MESSAGE UPDATED in custom list:', event)
      if (event.message) {
        setMessages(prev => 
          prev.map(msg => msg.id === event.message.id ? event.message : msg)
        )
      }
    }

    // Listen for message deletions
    const handleMessageDelete = (event: any) => {
      console.log('🗑️ MESSAGE DELETED in custom list:', event)
      if (event.message) {
        setMessages(prev => prev.filter(msg => msg.id !== event.message.id))
      }
    }

    channel.on('message.new', handleNewMessage)
    channel.on('message.updated', handleMessageUpdate)
    channel.on('message.deleted', handleMessageDelete)

    return () => {
      channel.off('message.new', handleNewMessage)
      channel.off('message.updated', handleMessageUpdate)
      channel.off('message.deleted', handleMessageDelete)
    }
  }, [channel])

  const renderMessage = (message: any) => {
    const userId = message.user?.id || ''
    const userName = message.user?.name || message.user?.id || 'Anonymous'
    const messageText = message.text || ''
    const usernameColor = getUsernameColor(userId)
    
    // Check if this message is from the current logged-in user (the streamer)
    const isStreamer = userId === sanitizedCurrentUserId

    if (!messageText.trim()) return null

    return (
      <div key={message.id || Math.random()} className="livestream-message-wrapper">
        <div className="livestream-message">
          <div className="username-container">
            {isStreamer && (
              <span className="live-badge">LIVE</span>
            )}
            <span 
              className="livestream-username" 
              style={{ color: usernameColor, fontWeight: 'bold' }}
            >
              {userName}:
            </span>
          </div>
          <span className="livestream-message-text">
            {messageText}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="custom-message-list">
      <div className="message-list-container">
        {messages.length === 0 ? (
          <div className="no-messages">
            <span>Welcome to the livestream chat! Send the first message.</span>
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

// Custom Livestream Message Component
const CustomLivestreamMessage: React.FC<any> = (props) => {
  console.log('CustomLivestreamMessage props:', props) // Debug log
  
  // Array of vibrant colors for usernames
  const usernameColors = [
    '#ff4757', // Red
    '#9c88ff', // Purple  
    '#5dade2', // Blue
    '#2ed573', // Green
    '#ffa502', // Orange
    '#ff6b81', // Pink
  ]

  // Generate consistent color based on user ID
  const getUsernameColor = (userId: string) => {
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    }
    return usernameColors[Math.abs(hash) % usernameColors.length]
  }

  // Extract message data - Stream Chat passes different prop structures
  const message = props.message || props
  
  if (!message) {
    console.log('No message data in CustomLivestreamMessage')
    return (
      <div className="livestream-message-debug">
        <span style={{ color: '#ff0000' }}>No message data</span>
      </div>
    )
  }

  // Handle different message text locations and structures
  const messageText = message.text || message.html || message.content || ''
  const userId = message.user?.id || message.user_id || message.userId || ''
  const userName = message.user?.name || message.user?.display_name || message.user?.id || userId || 'Anonymous'
  const timestamp = message.created_at || message.timestamp || new Date().toLocaleTimeString()

  // Show debug info if no text
  if (!messageText || messageText.trim() === '') {
    console.log('No message text found, full message object:', message)
    return (
      <div className="livestream-message-debug">
        <span style={{ color: '#ffaa00' }}>
          Debug: {userName} sent empty message at {typeof timestamp === 'string' ? timestamp : timestamp.toLocaleTimeString()}
        </span>
      </div>
    )
  }

  const usernameColor = getUsernameColor(userId)

  return (
    <div className="livestream-message-wrapper">
      <div className="livestream-message">
        <span 
          className="livestream-username" 
          style={{ color: usernameColor, fontWeight: 'bold' }}
        >
          {userName}:
        </span>
        <span className="livestream-message-text">
          {messageText}
        </span>
      </div>
    </div>
  )
}

export default Video
