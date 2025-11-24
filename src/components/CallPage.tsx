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
import nameUtils from '../utils/nameUtils';
import PhoneIcon from '../icons/call.svg';
import VideoIcon from '../icons/video.svg';
import VideoOffIcon from '../icons/video-off.svg';
import MicrophoneIcon from '../icons/microphone.svg';
import MicrophoneOffIcon from '../icons/microphone-off.svg';
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

  const callType = searchParams.get('type') || 'video';
  const channelId = searchParams.get('channel');
  const mobileParam = searchParams.get('mobile') === 'true';
  
  const [videoClient, setVideoClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [ringingPlayed, setRingingPlayed] = useState(false);
  const [demoUserJoined, setDemoUserJoined] = useState(false);
  
  const demoUserClientRef = useRef<StreamVideoClient | null>(null);
  const demoUserCallRef = useRef<any>(null);
  const demoUserTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const apiKey = import.meta.env.VITE_STREAM_API_KEY as string | undefined;

  const sanitizedUserId = React.useMemo(() => {
    if (!user) return 'anonymous';
    return getSanitizedUserId(user);
  }, [user]);

  useEffect(() => {
    setHideHeader(true);
    return () => setHideHeader(false);
  }, [setHideHeader]);

  const getStreamToken = useCallback(
    async (tokenType: 'video') => {
      if (!isAuthenticated || !user) {
        throw new Error('User not authenticated');
      }
      const accessToken = await getAccessTokenSilently();
      
      const userProfile = {
        name: user.name || user.email || `User ${sanitizedUserId}`,
        image: user.picture,
        role: 'admin'
      };

      const response = await fetch('/api/auth-tokens', {
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

  const playRingingSound = useCallback(() => {
    if (ringingPlayed) return;
    
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

    const currentTime = audioContext.currentTime;
    playTone(800, 0.4, currentTime);
    playTone(800, 0.4, currentTime + 0.6);
    
    setRingingPlayed(true);
  }, [ringingPlayed]);

  const addDemoUser = useCallback(async (mainCall: any) => {
    if (!apiKey || !callId || demoUserJoined) {
      console.log('Demo user already joined or missing requirements');
      return;
    }
  
    if (demoUserClientRef.current || demoUserCallRef.current) {
      console.log('Demo user already initialized');
      return;
    }
  
    try {
      const mainCallState = mainCall.state.callingState;
      
      if (mainCallState === CallingState.LEFT || mainCallState === CallingState.IDLE) {
        return;
      }
  
      setDemoUserJoined(true);
      
      const demoUserId = 'demo_user_2025';
      const demoUserName = 'Demo User';
      const demoUserImage = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face';
      
      const accessToken = await getAccessTokenSilently();
      
      const response = await fetch('/api/auth-tokens', {
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
        throw new Error(`Failed to get demo user token: ${response.status}`);
      }
  
      const tokenData = await response.json();
      
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
      const demoCall = demoUserClient.call('default', callId);
      demoUserCallRef.current = demoCall;
  
      // Simple join without settings_override
      await demoCall.join({ create: false });
  
      // Give it a moment to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
  
      // Now disable camera and microphone
      try {
        if (demoCall.camera) {
          await demoCall.camera.disable();
          console.log('✅ Demo user camera disabled');
        }
        if (demoCall.microphone) {
          await demoCall.microphone.disable();
          console.log('✅ Demo user microphone disabled');
        }
      } catch (deviceErr) {
        console.warn('⚠️ Could not disable demo user devices:', deviceErr);
        // This is okay - they might already be disabled
      }
  
      console.log('✅ Demo user joined silently');
      showSuccess('🎉 Demo user joined the call!');
      
    } catch (err: any) {
      console.error('❌ Error adding demo user:', err);
      setDemoUserJoined(false);
    }
  }, [apiKey, callId, demoUserJoined, getAccessTokenSilently, showSuccess]);

  const initializeCall = useCallback(async () => {
    // Remove videoClient check since we're using hasInitialized ref
    if (!callId || !apiKey || !sanitizedUserId || isConnecting) {
      return;
    }
  
    setIsConnecting(true);
    setError(null);
  
    try {
      playRingingSound();
  
      const videoToken = await getStreamToken('video');
  
      const userConfig = {
        id: sanitizedUserId,
        name: user?.name || user?.email || `User_${sanitizedUserId}`,
        image: user?.picture || undefined,
      };
  
      const client = new StreamVideoClient({
        apiKey,
        user: userConfig,
        token: videoToken,
      });
  
      setVideoClient(client);
  
      const newCall = client.call('default', callId);
      setCall(newCall);
  
      const joinOptions: any = {
        create: true,
        data: {
          members: [
            {
              user_id: sanitizedUserId,
            }
          ],
        },
      };
      
      await newCall.join(joinOptions);
  
      showSuccess(`${callType === 'audio' ? 'Audio' : 'Video'} call started!`);
      
      // Schedule demo user to join after 5 seconds
      demoUserTimeoutRef.current = setTimeout(() => {
        addDemoUser(newCall);
      }, 5000);
  
    } catch (err: any) {
      console.error('Failed to start call:', err);
      setError(err.message || 'Failed to start call');
      showError(`Failed to start call: ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  }, [callId, apiKey, sanitizedUserId, isConnecting, callType, getStreamToken, user, playRingingSound, showSuccess, showError, addDemoUser]);

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (isAuthenticated && user && !isLoading && !hasInitialized.current) {
      hasInitialized.current = true;
      initializeCall();
    }

    // Cleanup on unmount only
    return () => {
      console.log('🧹 Component unmounting, cleaning up...');
      
      // Clear demo user timeout
      if (demoUserTimeoutRef.current) {
        clearTimeout(demoUserTimeoutRef.current);
      }

      // Leave demo user call
      if (demoUserCallRef.current) {
        demoUserCallRef.current.leave().catch((err: any) => {
          console.warn('⚠️ Error leaving demo call:', err.message);
        });
        demoUserCallRef.current = null;
      }
      
      // Disconnect demo user client
      if (demoUserClientRef.current) {
        demoUserClientRef.current.disconnectUser().catch((err: any) => {
          console.warn('⚠️ Error disconnecting demo client:', err.message);
        });
        demoUserClientRef.current = null;
      }

      // Leave main call
      if (call) {
        call.leave().catch((err: any) => {
          console.warn('⚠️ Error leaving main call:', err.message);
        });
      }
      
      // Disconnect main client
      if (videoClient) {
        videoClient.disconnectUser().catch((err: any) => {
          console.warn('⚠️ Error disconnecting main client:', err.message);
        });
      }
    };
  }, [isAuthenticated, user, isLoading]); // Remove videoClient, call, initializeCall from deps

  const handleEndCall = useCallback(() => {
    // Navigation will trigger the cleanup in useEffect
    navigate('/chat');
  }, [navigate]);

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

  if (!videoClient || !call) {
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
      <StreamVideo client={videoClient}>
        <StreamCall call={call}>
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

interface MobileVideoLayoutProps {
  participants: any[];
  callType: string;
  onEndCall: () => void;
}

const MobileVideoLayout: React.FC<MobileVideoLayoutProps> = ({ participants, callType, onEndCall }) => {
  const localParticipant = participants.find(p => p.isLocalParticipant);
  const remoteParticipants = participants.filter(p => !p.isLocalParticipant);

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
      {localParticipant && (
        <div className="mobile-main-video">
          <div className="call-header">
            <h2>
              {callType === 'audio' ? 'Audio Call' : 'Video Call'} 
              <span className="participant-count">({participants.length} participant{participants.length !== 1 ? 's' : ''})</span>
            </h2>
          </div>
          <ParticipantView 
            participant={localParticipant} 
            trackType="videoTrack"
            className="mobile-local-video"
          />
          
          {remoteParticipants.length > 0 && (
            <div className="mobile-pip-container">
              {remoteParticipants.slice(0, 1).map((participant) => (
                <div key={participant.sessionId} className="mobile-pip-video">
                  <ParticipantView 
                    participant={participant} 
                    trackType="videoTrack"
                    className="mobile-remote-video"
                  />
                </div>
              ))}
              
              {remoteParticipants.length > 1 && (
                <div className="mobile-additional-count">
                  +{remoteParticipants.length - 1} more
                </div>
              )}
            </div>
          )}
          
          <div className="call-controls-container mobile-call-controls">
            <CustomCallControls callType={callType} onEndCall={onEndCall} />
          </div>
        </div>
      )}
      
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
            {nameUtils.getFirstName(localParticipant.name || localParticipant.userId)}
          </h3>
          <p className="mobile-call-status">Waiting for others to join...</p>
        </div>
      )}
    </div>
  );
};

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
      {/* <div className="str-video__menu-container" /> */}
      {!(isMobileView || isMobileCall) && (
        <div className="call-header">
          <h2>
            {callType === 'audio' ? 'Audio Call' : 'Video Call'} 
            <span className="participant-count">({participants.length} participant{participants.length !== 1 ? 's' : ''})</span>
          </h2>
        </div>
      )}
      
      <div className="call-content">
        {callType === 'audio' ? (
          <div className="audio-call-layout">
            <CallParticipantsList onClose={() => {}} />
          </div>
        ) : (
          <div className="video-call-layout">
            {isMobileView || isMobileCall ? (
              <MobileVideoLayout participants={participants} callType={callType} onEndCall={onEndCall} />
            ) : participants.length <= 2 ? (
              <SpeakerLayout />
            ) : (
              <PaginatedGridLayout />
            )}
          </div>
        )}
      </div>
      
      {!(isMobileView || isMobileCall) && (
        <div className="call-controls-container">
          <CustomCallControls callType={callType} onEndCall={onEndCall} />
        </div>
      )}
    </div>
  );
};

interface CustomCallControlsProps {
  callType: string;
  onEndCall: () => void;
}

const CustomCallControls: React.FC<CustomCallControlsProps> = ({ callType, onEndCall }) => {
  const { 
    useMicrophoneState, 
    useCameraState,
  } = useCallStateHooks();
  
  // Use isMute for actual state, not optionsAwareIsMute
  const { microphone, isMute: isMicMuted } = useMicrophoneState();
  const { camera, isMute: isCameraMuted } = useCameraState();

  const handleMicrophoneToggle = useCallback(async () => {
    if (!microphone) {
      console.error('❌ Microphone not available');
      return;
    }
    try {
      console.log('🎤 Toggling microphone, current state:', isMicMuted);
      await microphone.toggle();
      console.log('✅ Microphone toggled successfully');
    } catch (error) {
      console.error('❌ Failed to toggle microphone:', error);
    }
  }, [microphone, isMicMuted]);

  const handleCameraToggle = useCallback(async () => {
    if (!camera) {
      console.error('❌ Camera not available');
      return;
    }
    try {
      console.log('📹 Toggling camera, current state:', isCameraMuted);
      await camera.toggle();
      console.log('✅ Camera toggled successfully');
    } catch (error) {
      console.error('❌ Failed to toggle camera:', error);
    }
  }, [camera, isCameraMuted]);

  return (
    <div className="custom-call-controls">
      <div className="call-controls-row">
        <button
          className={`call-control-btn microphone-btn ${isMicMuted ? 'muted' : ''}`}
          onClick={handleMicrophoneToggle}
          title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          disabled={!microphone}
        >
          <img 
            src={isMicMuted ? MicrophoneOffIcon : MicrophoneIcon} 
            alt={isMicMuted ? 'Unmute' : 'Mute'} 
            className="control-icon"
          />
        </button>
        
        {callType === 'video' && (
          <button
            className={`call-control-btn camera-btn ${isCameraMuted ? 'camera-off' : ''}`}
            onClick={handleCameraToggle}
            title={isCameraMuted ? 'Turn On Camera' : 'Turn Off Camera'}
            disabled={!camera}
          >
            <img 
              src={isCameraMuted ? VideoOffIcon : VideoIcon} 
              alt={isCameraMuted ? 'Camera Off' : 'Camera On'} 
              className="control-icon"
            />
          </button>
        )}
        
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

