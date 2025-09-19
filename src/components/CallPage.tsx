import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  CallControls,
  SpeakerLayout,
  useCallStateHooks,
  CallingState,
  PaginatedGridLayout,
  CallParticipantsList,
  useCall,
  OwnCapability,
  ParticipantView,
} from '@stream-io/video-react-sdk';
import LoadingSpinner from './LoadingSpinner';
import { getSanitizedUserId } from '../utils/userUtils';
import { useToast } from '../contexts/ToastContext';
import { useUILayout } from '../App';
import { useResponsive } from '../contexts/ResponsiveContext';
import { getFirstName } from '../utils/nameUtils';

// Import icons
import PhoneIcon from '../icons/phone.svg';
import VideoIcon from '../icons/video.svg';
import VideoOffIcon from '../icons/video-off.svg';
import MicrophoneIcon from '../icons/microphone.svg';
import MicrophoneOffIcon from '../icons/microphone-off.svg';
import iPhoneOverlay from '../assets/iphone-overlay.png';

// Import Stream Video CSS
import '@stream-io/video-react-sdk/dist/css/styles.css';
import './CallPage.css';
import './CallPage-mobile.css';

interface CallPageProps {}

const CallPage: React.FC<CallPageProps> = () => {
  const { callId } = useParams<{ callId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, getAccessTokenSilently, isLoading } = useAuth0();
  const { showSuccess, showError } = useToast();
  const { setHideHeader } = useUILayout();
  const { isMobileView } = useResponsive();

  const callType = searchParams.get('type') || 'video'; // 'audio' or 'video'
  const channelId = searchParams.get('channel');
  const mobileParam = searchParams.get('mobile') === 'true';
  
  const [videoClientReady, setVideoClientReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callJoined, setCallJoined] = useState(false);
  const [ringingPlayed, setRingingPlayed] = useState(false);
  const [demoUserJoined, setDemoUserJoined] = useState(false);

  // Refs for client and call
  const videoClientRef = useRef<StreamVideoClient | null>(null);
  const callRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const demoUserClientRef = useRef<StreamVideoClient | null>(null);
  const demoUserCallRef = useRef<any>(null);

  const apiKey = import.meta.env.VITE_STREAM_API_KEY as string | undefined;

  // Memoize user ID
  const sanitizedUserId = React.useMemo(() => {
    if (!user) return 'anonymous';
    return getSanitizedUserId(user);
  }, [user]);

  // Hide header for call page
  useEffect(() => {
    setHideHeader(true);
    return () => setHideHeader(false);
  }, [setHideHeader]);

  // Force mobile view if the mobile parameter is passed
  useEffect(() => {
    if (mobileParam) {
      console.log('📱 Mobile call detected, enabling mobile view')
      // The mobile parameter indicates this call was initiated from mobile view
    }
  }, [mobileParam]);

  // Get Stream token function
  const getStreamToken = useCallback(
    async (tokenType: 'video') => {
      if (!isAuthenticated || !user) {
        throw new Error('User not authenticated');
      }

      const accessToken = await getAccessTokenSilently();
      
      const userProfile = {
        name: user.name || user.email || `User ${sanitizedUserId}`,
        image: user.picture,
        role: 'admin' // Give admin role for call permissions
      };

      const response = await fetch('/api/stream/auth-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          type: tokenType,
          userId: sanitizedUserId,
          userProfile: userProfile,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to get ${tokenType} token`);
      }

      const data = await response.json();
      return data.token;
    },
    [isAuthenticated, user, sanitizedUserId, getAccessTokenSilently]
  );

  // Play ringing sound
  const playRingingSound = useCallback(() => {
    if (ringingPlayed) return;
    
    // Create a simple ringing tone using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playTone = (frequency: number, duration: number, startTime: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(0.1, startTime + duration - 0.1);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    // Play ring tone pattern (two beeps)
    const currentTime = audioContext.currentTime;
    playTone(800, 0.4, currentTime);
    playTone(800, 0.4, currentTime + 0.6);
    
    setRingingPlayed(true);
  }, [ringingPlayed]);

  // Initialize video client and join call
  const initializeCall = useCallback(async () => {
    if (!callId || !apiKey || !sanitizedUserId || videoClientRef.current || isConnecting) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      console.log('🎥 Initializing call:', { callId, callType, channelId });

      // Play ringing sound
      playRingingSound();

      // Get video token
      const videoToken = await getStreamToken('video');
      console.log('🔑 Video token obtained for call');

      // Create video client
      const userConfig = {
        id: sanitizedUserId,
        name: user?.name || user?.email || `User_${sanitizedUserId}`,
        image: user?.picture || undefined,
      };

      const videoClient = new StreamVideoClient({
        apiKey,
        user: userConfig,
        token: videoToken,
      });

      videoClientRef.current = videoClient;
      setVideoClientReady(true);

      // Create the call
      console.log('🎯 Creating call with ID:', callId);
      const call = videoClient.call('default', callId);
      callRef.current = call;

      // Monitor call state changes
      console.log('📊 Initial call state:', call.state.callingState);

      // Simplified join options to avoid potential conflicts
      console.log('🔧 Preparing join options for call type:', callType);
      
      const joinOptions: any = {
        create: true,
        data: {
          members: [
            {
              user_id: sanitizedUserId,
              role: 'call_member', // Use call_member role for proper video permissions
            }
          ],
          // Ensure proper call permissions
          settings: {
            video: {
              enabled: true,
              access_request_enabled: false,
            },
            audio: {
              enabled: true,
              access_request_enabled: false,
            },
          },
        },
      };

      // Set required settings with minimum valid values
      if (callType === 'audio') {
        joinOptions.data.settings_override = {
          video: { 
            camera_default_on: false,
            target_resolution: {
              width: 640,
              height: 480
            }
          },
          audio: { 
            mic_default_on: true,
            default_device: 'speaker'
          },
        };
      } else {
        joinOptions.data.settings_override = {
          video: { 
            camera_default_on: true,
            target_resolution: {
              width: 640,
              height: 480
            }
          },
          audio: { 
            mic_default_on: true,
            default_device: 'speaker'
          },
        };
      }

      // Remove custom permissions to avoid conflicts with token capabilities
      // The Stream Video SDK should use token-level capabilities instead

      console.log('🚀 Joining call with options:', JSON.stringify(joinOptions, null, 2));
      
      await call.join(joinOptions);
      
      console.log('✅ Successfully joined call:', callId);
      console.log('📊 Call state after join:', call.state.callingState);
      console.log('👥 Initial participants:', call.state.participants.length);

      setCallJoined(true);
      showSuccess(`${callType === 'audio' ? 'Audio' : 'Video'} call started!`);
      
      // Monitor call state every second for debugging
      const stateMonitor = setInterval(() => {
        if (callRef.current) {
          console.log('🔍 Call state check:', callRef.current.state.callingState);
          console.log('🔍 Participants count:', callRef.current.state.participants.length);
          
          if (callRef.current.state.callingState === CallingState.LEFT) {
            console.log('⚠️ Call was left unexpectedly!');
            clearInterval(stateMonitor);
          }
        }
      }, 1000);
      
      // Add demo user after a delay, but only if call is still active
      setTimeout(async () => {
        clearInterval(stateMonitor); // Stop monitoring after demo user attempt
        
        // Double-check that the call is still active before adding demo user
        if (callRef.current && callRef.current.state.callingState === CallingState.JOINED) {
          console.log('🎯 Main call still active after 5 seconds, adding demo user...');
          await addDemoUser();
        } else {
          console.log('⚠️ Main call no longer active after 5 seconds, skipping demo user');
          if (callRef.current) {
            console.log('⚠️ Current state:', callRef.current.state.callingState);
          }
        }
      }, 5000); // Increased to 5 seconds to see if timing is the issue

    } catch (err: any) {
      console.error('❌ Error initializing call:', err);
      console.error('❌ Full error object:', err);
      console.error('❌ Error stack:', err.stack);
      
      setError(err.message || 'Failed to start call');
      showError(`Failed to start call: ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  }, [callId, apiKey, sanitizedUserId, isConnecting, callType, channelId, getStreamToken, user, playRingingSound, showSuccess, showError]);

  // Add demo user that actually joins the call
  const addDemoUser = async () => {
    if (!apiKey || !callId || demoUserJoined || !callRef.current) return;

    try {
      console.log('👥 Adding demo user to call...');
      
      // Check if main call is still active before adding demo user
      const mainCallState = callRef.current.state.callingState;
      console.log('📞 Main call state before demo user:', mainCallState);
      
      if (mainCallState === CallingState.LEFT || mainCallState === CallingState.IDLE) {
        console.log('⚠️ Main call not active, skipping demo user');
        return;
      }
      
      // Reuse existing sample user instead of creating random ones
      const demoUserId = 'bob_johnson';
      const demoUserName = 'Bob Johnson';
      const demoUserImage = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face';
      
      // Get token for demo user
      const accessToken = await getAccessTokenSilently();
      const response = await fetch('/api/stream/auth-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          type: 'video',
          userId: demoUserId,
          userProfile: {
            name: demoUserName,
            role: 'user'
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get demo user token');
      }

      const tokenData = await response.json();
      
      // Create demo user video client
      const demoUserClient = new StreamVideoClient({
        apiKey,
        user: {
          id: demoUserId,
          name: demoUserName,
          image: demoUserImage
        },
        token: tokenData.token,
      });

      demoUserClientRef.current = demoUserClient;

      // Create call instance for demo user
      const demoCall = demoUserClient.call('default', callId);
      demoUserCallRef.current = demoCall;

      // Simplified join options for demo user
      const demoJoinOptions: any = {
        create: false, // Don't create, join existing call
      };

      // Don't override settings, use defaults to avoid conflicts
      await demoCall.join(demoJoinOptions);
      
      // Check if demo user actually joined successfully
      const demoCallState = demoCall.state.callingState;
      console.log('📞 Demo call state after join:', demoCallState);
      
      if (demoCallState === CallingState.JOINED) {
        console.log('✅ Demo user joined call successfully');
        setDemoUserJoined(true);
        showSuccess('🎉 Demo user joined the call!');
      } else {
        throw new Error(`Demo user join failed, state: ${demoCallState}`);
      }

    } catch (err: any) {
      console.error('❌ Error adding demo user:', err);
      console.log('🔍 Demo user join failed, but main call should continue');
      // Don't show error to user since this is just demo functionality
      // The main call should continue working even if demo user fails
    }
  };

  // Initialize call when component mounts
  useEffect(() => {
    if (isAuthenticated && user && !isLoading) {
      initializeCall();
    }

    // Only cleanup when component actually unmounts, not on re-renders
    return () => {
      console.log('🧹 Cleanup effect running...');
      
      // Add safety checks to prevent double cleanup
      if (callRef.current && callRef.current.state.callingState !== 'left') {
        console.log('🧹 Leaving main call...');
        callRef.current.leave().catch((err: any) => {
          console.warn('⚠️ Error leaving main call:', err.message);
        });
      }
      
      if (videoClientRef.current) {
        console.log('🧹 Disconnecting main client...');
        videoClientRef.current.disconnectUser().catch((err: any) => {
          console.warn('⚠️ Error disconnecting main client:', err.message);
        });
      }
      
      if (demoUserCallRef.current && demoUserCallRef.current.state.callingState !== 'left') {
        console.log('🧹 Leaving demo call...');
        demoUserCallRef.current.leave().catch((err: any) => {
          console.warn('⚠️ Error leaving demo call:', err.message);
        });
      }
      
      if (demoUserClientRef.current) {
        console.log('🧹 Disconnecting demo client...');
        demoUserClientRef.current.disconnectUser().catch((err: any) => {
          console.warn('⚠️ Error disconnecting demo client:', err.message);
        });
      }
    };
  }, [isAuthenticated, user, isLoading]); // Removed initializeCall from dependency array

  // Handle call end
  const handleEndCall = useCallback(() => {
    console.log('📞 User ended call manually');
    
    // Leave both calls with safety checks
    if (callRef.current && callRef.current.state.callingState !== 'left') {
      console.log('📞 Leaving main call...');
      callRef.current.leave().catch((err: any) => {
        console.warn('⚠️ Error in handleEndCall (main):', err.message);
      });
    }
    
    if (demoUserCallRef.current && demoUserCallRef.current.state.callingState !== 'left') {
      console.log('📞 Leaving demo call...');
      demoUserCallRef.current.leave().catch((err: any) => {
        console.warn('⚠️ Error in handleEndCall (demo):', err.message);
      });
    }
    
    // Navigate back to the channel or chat
    if (channelId) {
      navigate(`/chat/${channelId}`);
    } else {
      navigate('/chat');
    }
  }, [navigate, channelId]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <div>Please log in to join the call.</div>;
  }

  if (error) {
    return (
      <div className="call-error">
        <h2>Call Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/chat')} className="back-button">
          Back to Chat
        </button>
      </div>
    );
  }

  if (!videoClientReady || !callRef.current) {
    return (
      <div className="call-loading">
        <LoadingSpinner />
        <div className="call-loading-text">
          <h2>
            {callType === 'audio' ? (
              <>
                <img src={PhoneIcon} alt="Audio call" width="24" height="24" />
                Starting audio call...
              </>
            ) : (
              <>
                <img src={VideoIcon} alt="Video call" width="24" height="24" />
                Starting video call...
              </>
            )}
          </h2>
          <p>Connecting to call {callId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`call-page ${isMobileView || mobileParam ? 'mobile-call' : ''}`}>
      {(isMobileView || mobileParam) && (
        <div className="iphone-overlay" />
      )}
      <StreamVideo client={videoClientRef.current!}>
        <StreamCall call={callRef.current}>
          <CallInterface 
            callType={callType} 
            onEndCall={handleEndCall} 
            userId={sanitizedUserId}
            isMobileCall={mobileParam || isMobileView}
          />
        </StreamCall>
      </StreamVideo>
    </div>
  );
};


// Custom mobile video layout component for WhatsApp/FaceTime style
interface MobileVideoLayoutProps {
  participants: any[];
}

const MobileVideoLayout: React.FC<MobileVideoLayoutProps> = ({ participants }) => {
  // Find local and remote participants
  const localParticipant = participants.find(p => p.isLocalParticipant);
  const remoteParticipants = participants.filter(p => !p.isLocalParticipant);

  console.log('📱 Mobile Video Layout:', {
    totalParticipants: participants.length,
    hasLocal: !!localParticipant,
    remoteCount: remoteParticipants.length
  });


  if (participants.length === 0) {
    return (
      <div className="mobile-video-waiting">
        <div className="waiting-message">
          <h3>Waiting for participants to join...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-video-container">
      {/* Main full-screen video (local participant's video) */}
      {localParticipant && (
        <div className="mobile-main-video">
          <ParticipantView 
            participant={localParticipant} 
            trackType="videoTrack"
            className="mobile-local-video"
          />
        </div>
      )}

      {/* Picture-in-Picture overlay for remote participant(s) */}
      {remoteParticipants.length > 0 && (
        <div className="mobile-pip-container">
          {remoteParticipants.slice(0, 1).map((participant, index) => (
            <div key={participant.sessionId} className="mobile-pip-video">
              <ParticipantView 
                participant={participant} 
                trackType="videoTrack"
                className="mobile-remote-video"
              />
            </div>
          ))}
          
          {/* Show additional participants count if more than 1 remote */}
          {remoteParticipants.length > 1 && (
            <div className="mobile-additional-count">
              +{remoteParticipants.length - 1} more
            </div>
          )}
        </div>
      )}

      {/* Audio-only fallback for participants without video */}
      {remoteParticipants.length === 0 && localParticipant && (
        <div className="mobile-audio-only">
          <div className="mobile-avatar-large">
            <img 
              src={localParticipant.image || `https://getstream.io/random_png/?id=${localParticipant.userId}&name=${localParticipant.name || localParticipant.userId}`}
              alt={localParticipant.name || localParticipant.userId}
              className="avatar-image"
            />
          </div>
          <h3 className="mobile-participant-name">
            {getFirstName(localParticipant.name || localParticipant.userId)}
          </h3>
          <p className="mobile-call-status">Waiting for others to join...</p>
        </div>
      )}
    </div>
  );
};

// Call interface component
interface CallInterfaceProps {
  callType: string;
  onEndCall: () => void;
  userId: string;
  isMobileCall?: boolean;
}

const CallInterface: React.FC<CallInterfaceProps> = ({ callType, onEndCall, userId, isMobileCall = false }) => {
  const { useCallCallingState, useParticipants } = useCallStateHooks();
  const callingState = useCallCallingState();
  const participants = useParticipants();
  const { isMobileView } = useResponsive();

  console.log('🔍 Call Interface - State:', callingState, 'Participants:', participants.length);
  
  // Log detailed participant info
  participants.forEach((participant, index) => {
    console.log(`👤 Participant ${index + 1}:`, {
      id: participant.userId,
      name: participant.name,
      isLocalParticipant: participant.isLocalParticipant
    });
  });

  if (callingState === CallingState.LEFT) {
    return (
      <div className="call-ended">
        <h2>Call Ended</h2>
        <p>You have left the call.</p>
        <button onClick={onEndCall} className="back-button">
          Back to Chat
        </button>
      </div>
    );
  }

  return (
    <div className={`call-interface ${isMobileView || isMobileCall ? 'mobile-call-interface' : ''}`}>
      <div className="call-header">
        <h2>
          {callType === 'audio' ? 'Audio Call' : 'Video Call'} 
          <span className="participant-count">({participants.length} participant{participants.length !== 1 ? 's' : ''})</span>
        </h2>
      </div>

      <div className="call-content">
        {callType === 'audio' ? (
          <div className="audio-call-layout">
            <CallParticipantsList onClose={() => {}} />
          </div>
        ) : (
          <div className="video-call-layout">
            {isMobileView || isMobileCall ? (
              <MobileVideoLayout participants={participants} />
            ) : participants.length <= 2 ? (
              <SpeakerLayout />
            ) : (
              <PaginatedGridLayout />
            )}
          </div>
        )}
      </div>

      <div className={`call-controls-container ${isMobileView || isMobileCall ? 'mobile-call-controls' : ''}`}>
        <CustomCallControls callType={callType} onEndCall={onEndCall} userId={userId} />
      </div>
    </div>
  );
};

// Custom Call Controls Component
interface CustomCallControlsProps {
  callType: string;
  onEndCall: () => void;
  userId: string;
}

const CustomCallControls: React.FC<CustomCallControlsProps> = ({ callType, onEndCall, userId }) => {
  const { 
    useMicrophoneState, 
    useCameraState,
    useParticipants,
    useOwnCapabilities,
  } = useCallStateHooks();
  
  const { microphone, isMute } = useMicrophoneState();
  const { camera, isMute: isCameraOff, hasBrowserPermission, isPromptingPermission } = useCameraState();
  const call = useCall();
  const participants = useParticipants();
  const ownCapabilities = useOwnCapabilities();

  // Get the local participant (you) to check actual video state
  const localParticipant = participants.find(p => p.isLocalParticipant);
  const actualCameraState = localParticipant?.videoStream ? true : false;
  
  // Use actual camera state instead of the potentially incorrect isCameraOff
  const isActuallyOff = !actualCameraState;

  // Log current states and capabilities for debugging
  console.log('🔍 Control states:', {
    microphone: { isMute, hasDevice: !!microphone },
    camera: { 
      isCameraOff, 
      actualCameraState,
      isActuallyOff,
      hasDevice: !!camera, 
      status: camera?.state?.status,
      localParticipant: !!localParticipant,
      publishedTracks: localParticipant?.publishedTracks,
      hasBrowserPermission,
      isPromptingPermission
    },
    capabilities: {
      hasCapabilities: !!ownCapabilities,
      canSendVideo: ownCapabilities?.includes(OwnCapability.SEND_VIDEO),
      canSendAudio: ownCapabilities?.includes(OwnCapability.SEND_AUDIO),
      allCapabilities: ownCapabilities
    }
  });

  // Check for camera permission issues
  React.useEffect(() => {
    const checkCameraStatus = async () => {
      if (callType === 'video' && camera) {
        console.log('🔍 Checking camera permissions and status...');
        
        try {
          // Check browser camera permissions
          const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
          console.log('📹 Camera permission:', permissions.state);
          
          // Only auto-enable if camera is actually off (not just the state says so)
          if (camera && isActuallyOff && callType === 'video') {
            console.log('📹 Camera is actually OFF but this is a video call - attempting to enable...');
            setTimeout(async () => {
              try {
                await camera.enable();
                console.log('📹 Camera enabled successfully');
              } catch (err) {
                console.error('❌ Failed to enable camera:', err);
              }
            }, 1000);
          }
        } catch (err) {
          console.error('❌ Error checking camera permissions:', err);
        }
      }
    };
    
    checkCameraStatus();
  }, [camera, isCameraOff, callType]);

  const handleMicrophoneToggle = async () => {
    try {
      console.log('🎤 Toggling microphone...');
      console.log('🎤 Current state - isMute:', isMute);
      console.log('🎤 Microphone object:', microphone);
      
      if (!microphone) {
        console.error('❌ Microphone object not available');
        return;
      }

      await microphone.toggle();
      console.log('🎤 Microphone toggled successfully');
    } catch (error) {
      console.error('❌ Failed to toggle microphone:', error);
    }
  };

  const handleCameraToggle = async () => {
    try {
      console.log('📹 Toggling camera...');
      console.log('📹 Current state - isCameraOff:', isCameraOff);
      console.log('📹 Camera object:', camera);
      
      if (!camera) {
        console.error('❌ Camera object not available');
        return;
      }

      // Check if user has video permissions
      const canSendVideo = ownCapabilities?.includes(OwnCapability.SEND_VIDEO);
      console.log('📹 User can send video:', canSendVideo);
      
      if (!canSendVideo) {
        console.log('🔐 User lacks send-video capability, attempting to grant permission...');
        try {
          await call?.grantPermissions(userId, [
            OwnCapability.SEND_AUDIO,
            OwnCapability.SEND_VIDEO,
          ]);
          console.log('✅ Video permissions granted successfully');
          
          // Wait a bit for permissions to take effect
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (permError) {
          console.error('❌ Failed to grant video permissions:', permError);
          throw new Error('Unable to grant video permissions. Please check call settings.');
        }
      }

      // Check browser permissions
      if (!hasBrowserPermission) {
        console.error('❌ Browser camera permission not granted');
        throw new Error('Please grant camera permission in your browser settings.');
      }

      // Check camera status
      console.log('📹 Camera status:', {
        state: camera.state.status,
        isCameraOff,
        isActuallyOff,
        actualCameraState,
        hasBrowserPermission
      });

      // Use actual camera state for toggling
      if (isActuallyOff) {
        console.log('📹 Camera is actually OFF, trying to enable...');
        await camera.enable();
      } else {
        console.log('📹 Camera is actually ON, trying to disable...');
        await camera.disable();
      }
      
      console.log('📹 Camera state changed successfully');
      
      // Log new state after toggle
      setTimeout(() => {
        console.log('📹 New camera state after change:', {
          isCameraOff,
          state: camera.state.status
        });
      }, 200);
      
    } catch (error) {
      console.error('❌ Failed to toggle camera:', error);
      console.error('❌ Error details:', error);
      
      // Don't try fallback if it's a permission issue
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
        console.log('❌ Permission error detected, not trying fallback');
        return;
      }
      
      // Fallback: try the toggle method
      try {
        console.log('📹 Trying fallback toggle method...');
        await camera.toggle();
        console.log('📹 Fallback toggle succeeded');
      } catch (fallbackError) {
        console.error('❌ Fallback toggle also failed:', fallbackError);
      }
    }
  };

  return (
    <div className="custom-call-controls">
      <div className="call-controls-row">
        {/* Microphone Toggle */}
        <button
          className={`call-control-btn microphone-btn ${isMute ? 'muted' : ''}`}
          onClick={handleMicrophoneToggle}
          title={isMute ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          <img 
            src={isMute ? MicrophoneOffIcon : MicrophoneIcon} 
            alt={isMute ? 'Unmute' : 'Mute'} 
            className="control-icon"
          />
        </button>

        {/* Camera Toggle (only show for video calls) */}
        {callType === 'video' && (
          <button
            className={`call-control-btn camera-btn ${isActuallyOff ? 'camera-off' : ''}`}
            onClick={handleCameraToggle}
            title={isActuallyOff ? 'Turn On Camera' : 'Turn Off Camera'}
            disabled={!camera}
          >
            <img 
              src={isActuallyOff ? VideoOffIcon : VideoIcon} 
              alt={isActuallyOff ? 'Camera Off' : 'Camera On'} 
              className="control-icon"
            />
          </button>
        )}

        {/* End Call Button */}
        <button
          className="call-control-btn end-call-btn"
          onClick={onEndCall}
          title="End Call"
        >
          <img 
            src={PhoneIcon} 
            alt="End Call" 
            className="control-icon end-call-icon"
          />
        </button>
      </div>
    </div>
  );
};


export default CallPage;
