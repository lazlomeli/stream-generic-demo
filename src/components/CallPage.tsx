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


import PhoneIcon from '../icons/phone.svg';
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
  
  const [videoClientReady, setVideoClientReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callJoined, setCallJoined] = useState(false);
  const [ringingPlayed, setRingingPlayed] = useState(false);
  const [demoUserJoined, setDemoUserJoined] = useState(false);

  const videoClientRef = useRef<StreamVideoClient | null>(null);
  const callRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const demoUserClientRef = useRef<StreamVideoClient | null>(null);
  const demoUserCallRef = useRef<any>(null);

  const apiKey = import.meta.env.VITE_STREAM_API_KEY as string | undefined;

  const sanitizedUserId = React.useMemo(() => {
    if (!user) return 'anonymous';
    return getSanitizedUserId(user);
  }, [user]);

  useEffect(() => {
    setHideHeader(true);
    return () => setHideHeader(false);
  }, [setHideHeader]);

  useEffect(() => {
    if (mobileParam) {
    }
  }, [mobileParam]);

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

  const initializeCall = useCallback(async () => {
    if (!callId || !apiKey || !sanitizedUserId || videoClientRef.current || isConnecting) {
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

      const videoClient = new StreamVideoClient({
        apiKey,
        user: userConfig,
        token: videoToken,
      });

      videoClientRef.current = videoClient;
      setVideoClientReady(true);

      const call = videoClient.call('default', callId);
      callRef.current = call;

      const joinOptions: any = {
        create: true,
        data: {
          members: [
            {
              user_id: sanitizedUserId,
              role: 'call_member',
            }
          ],
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

      await call.join(joinOptions);
    
      setCallJoined(true);
      showSuccess(`${callType === 'audio' ? 'Audio' : 'Video'} call started!`);
      
      const stateMonitor = setInterval(() => {
        if (callRef.current) {
          if (callRef.current.state.callingState === CallingState.LEFT) {
            clearInterval(stateMonitor);
          }
        }
      }, 1000);
      
      setTimeout(async () => {
        clearInterval(stateMonitor);
        
        if (callRef.current && callRef.current.state.callingState === CallingState.JOINED) {
          await addDemoUser();
        } else {
          if (callRef.current) {
          }
        }
      }, 5000);

    } catch (err: any) {
      setError(err.message || 'Failed to start call');
      showError(`Failed to start call: ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  }, [callId, apiKey, sanitizedUserId, isConnecting, callType, channelId, getStreamToken, user, playRingingSound, showSuccess, showError]);

  const addDemoUser = async () => {
    if (!apiKey || !callId || demoUserJoined || !callRef.current) return;

    try {
      const mainCallState = callRef.current.state.callingState;
      
      if (mainCallState === CallingState.LEFT || mainCallState === CallingState.IDLE) {
        return;
      }
      
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
        const errorText = await response.text();
        throw new Error(`Failed to get demo user token: ${response.status} ${errorText}`);
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

      const demoJoinOptions: any = {
        create: false,
      };

      await demoCall.join(demoJoinOptions);

      const demoCallState = demoCall.state.callingState;

      if (demoCallState === CallingState.JOINED) {
        setDemoUserJoined(true);
        showSuccess('🎉 Demo user joined the call!');
      } else {
        throw new Error(`Demo user join failed, state: ${demoCallState}`);
      }

    } catch (err: any) {
      console.error('❌ Error adding demo user:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user && !isLoading) {
      initializeCall();
    }

    return () => {
      if (callRef.current && callRef.current.state.callingState !== 'left') {
        callRef.current.leave().catch((err: any) => {
          console.warn('⚠️ Error leaving main call:', err.message);
        });
      }
      
      if (videoClientRef.current) {
        videoClientRef.current.disconnectUser().catch((err: any) => {
          console.warn('⚠️ Error disconnecting main client:', err.message);
        });
      }
      
      if (demoUserCallRef.current && demoUserCallRef.current.state.callingState !== 'left') {
        demoUserCallRef.current.leave().catch((err: any) => {
          console.warn('⚠️ Error leaving demo call:', err.message);
        });
      }
      
      if (demoUserClientRef.current) {
        demoUserClientRef.current.disconnectUser().catch((err: any) => {
          console.warn('⚠️ Error disconnecting demo client:', err.message);
        });
      }
    };
  }, [isAuthenticated, user, isLoading]);

  const handleEndCall = useCallback(() => {
    if (callRef.current && callRef.current.state.callingState !== 'left') {
      callRef.current.leave().catch((err: any) => {
        console.warn('⚠️ Error in handleEndCall (main):', err.message);
      });
    }
    
    if (demoUserCallRef.current && demoUserCallRef.current.state.callingState !== 'left') {
      demoUserCallRef.current.leave().catch((err: any) => {
        console.warn('⚠️ Error in handleEndCall (demo):', err.message);
      });
    }
    
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


interface MobileVideoLayoutProps {
  participants: any[];
}

const MobileVideoLayout: React.FC<MobileVideoLayoutProps> = ({ participants }) => {
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
          <ParticipantView 
            participant={localParticipant} 
            trackType="videoTrack"
            className="mobile-local-video"
          />
        </div>
      )}

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
          
          {remoteParticipants.length > 1 && (
            <div className="mobile-additional-count">
              +{remoteParticipants.length - 1} more
            </div>
          )}
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

  const localParticipant = participants.find(p => p.isLocalParticipant);
  const actualCameraState = localParticipant?.videoStream ? true : false;
  
  const isActuallyOff = !actualCameraState;

  React.useEffect(() => {
    const checkCameraStatus = async () => {
      if (callType === 'video' && camera) {
        try {
          const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
          if (camera && isActuallyOff && callType === 'video') {
            setTimeout(async () => {
              try {
                await camera.enable();
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
      if (!microphone) {
        console.error('❌ Microphone object not available');
        return;
      }

      await microphone.toggle();
    } catch (error) {
      console.error('❌ Failed to toggle microphone:', error);
    }
  };

  const handleCameraToggle = async () => {
    try {
      if (!camera) {
        console.error('❌ Camera object not available');
        return;
      }

      const canSendVideo = ownCapabilities?.includes(OwnCapability.SEND_VIDEO);
      
      if (!canSendVideo) {
        try {
          await call?.grantPermissions(userId, [
            OwnCapability.SEND_AUDIO,
            OwnCapability.SEND_VIDEO,
          ]);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (permError) {
          console.error('❌ Failed to grant video permissions:', permError);
          throw new Error('Unable to grant video permissions. Please check call settings.');
        }
      }

      if (!hasBrowserPermission) {
        console.error('❌ Browser camera permission not granted');
        throw new Error('Please grant camera permission in your browser settings.');
      }

      if (isActuallyOff) {
        await camera.enable();
      } else {
        await camera.disable();
      }
      
    } catch (error) {
      console.error('❌ Failed to toggle camera:', error);
      console.error('❌ Error details:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
        return;
      }
      
      try {
        await camera.toggle();
      } catch (fallbackError) {
        console.error('❌ Fallback toggle also failed:', fallbackError);
      }
    }
  };

  return (
    <div className="custom-call-controls">
      <div className="call-controls-row">
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
