import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useChannelStateContext, useChatContext } from 'stream-chat-react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import FallbackAvatar from './FallbackAvatar';
import { useToast } from '../contexts/ToastContext';
import OptionsIcon from '../icons/options.svg';
import PhoneIcon from '../icons/call.svg';
import VideoIcon from '../icons/video-call.svg';
import './CustomChannelHeader.css';

const CustomChannelHeader: React.FC = () => {
  const { channel } = useChannelStateContext();
  const { client, setActiveChannel } = useChatContext();
  const { getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [muteToggleKey, setMuteToggleKey] = useState(0);
  const optionsButtonRef = useRef<HTMLButtonElement>(null);

  if (!channel) {
    return (
      <div className="str-chat__header-livestream">
        <div className="str-chat__header-livestream-left">
          <div className="str-chat__header-livestream-left-title">
            Chat
          </div>
        </div>
      </div>
    );
  }

  // @ts-ignore
  const isDM = channel.data?.isDM === true;
  const channelType = isDM ? 'dm' : 'group';
  
  const memberCount = Object.keys(channel.state?.members || {}).length;

  let channelName: string;
  let channelImage: string | undefined = undefined;
  
  if (isDM) {
    const members = channel.state?.members || {};
    const otherUser = Object.values(members).find(member => 
      member.user?.id !== client.userID
    );
    
    channelName = otherUser?.user?.name || otherUser?.user?.id || 'Direct Message';
    channelImage = otherUser?.user?.image;
  } else {
    channelName = (channel.data as any)?.name || 'Channel';
  }

  const currentUserId = client.userID;
  const members = channel.state?.members || {};
  
  const onlineUsers = Object.values(members).filter(member => 
    member.user?.online === true
  );
  const onlineCount = onlineUsers.length;
  
  const getSubtitle = () => {
    if (isDM) {
      // For DMs, show online status of the other user
      const otherUser = Object.values(members).find(member => member.user?.id !== currentUserId);
      if (otherUser?.user?.online) {
        return 'Online';
      }
      return 'Offline';
    } else {
      // For group channels, show "X members, Y online"
      // Include the current user in the online count
      const totalOnline = onlineCount;
      const otherOnlineCount = onlineUsers.filter(member => member.user?.id !== currentUserId).length;
      
      if (totalOnline === 0) {
        return `${memberCount} members, 0 online`;
      } else if (otherOnlineCount === 0 && totalOnline === 1) {
        // Only the current user is online
        return `${memberCount} members, 1 online (You)`;
      } else {
        return `${memberCount} members, ${totalOnline} online`;
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      if (optionsButtonRef.current && optionsButtonRef.current.contains(target)) {
        return;
      }
      
      if (target.closest('.options-dropdown')) {
        return;
      }
      
      if (target.closest('.leave-channel-modal')) {
        return;
      }
      
      setShowOptionsMenu(false);
    };

    if (showOptionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showOptionsMenu]);

  const handleMuteToggle = async () => {
    if (!channel || !client.userID) return;

    try {
      const isCurrentlyMuted = channel.muteStatus().muted;
      
      if (isCurrentlyMuted) {
        await channel.unmute();
        showSuccess('Channel unmuted');
      } else {
        await channel.mute();
        showSuccess('Channel muted');
      }
      
      const newMutedState = !isCurrentlyMuted;
      setMuteToggleKey(prev => prev + 1);
      
      window.dispatchEvent(new CustomEvent('channelMuteStatusChanged', {
        detail: { 
          channelId: channel.id, 
          muted: newMutedState 
        }
      }));
      
      setShowOptionsMenu(false);
    } catch (err: any) {
      console.error('❌ Error toggling mute:', err);
      showError('Failed to update mute settings. Please try again.');
    }
  };

  const handleLeaveChannel = async () => {
    if (!channel || !client.userID) return;

    setIsLeaving(true);
    try {
      const channelId = channel.id;
      const accessToken = await getAccessTokenSilently();
      
      const response = await fetch('/api/chat-operations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          type: 'leave-channel',
          channelId: channelId,
          userId: client.userID
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to leave channel');
      }

      const result = await response.json();
      console.log('✅ Successfully left/deleted channel:', result);
      
      setActiveChannel(undefined);
      
      if (result.deleted) {
        showSuccess('Channel deleted successfully');
      } else {
        showSuccess('Left channel successfully');
      }
      
      navigate('/chat');
      
    } catch (err: any) {
      console.error('❌ Error leaving channel:', err);
      showError('Failed to leave channel. Please try again.');
    } finally {
      setIsLeaving(false);
      setShowLeaveConfirm(false);
      setShowOptionsMenu(false);
    }
  };

  const isMuted = useMemo(() => {
    return channel?.muteStatus().muted || false;
  }, [channel, muteToggleKey]);

  const handleAudioCall = () => {
    navigate('/call');
  };

  const handleVideoCall = () => {
    navigate('/call');
  };


  return (
    <>
      <div className="str-chat__header-livestream">
        <div className="str-chat__header-livestream-left">
          <div className="str-chat__header-livestream-left-avatar">
            <FallbackAvatar
              src={channelImage}
              alt={channelName}
              size={40}
              channelType={channelType}
              channelName={channelName}
            />
          </div>
          <div className="str-chat__header-livestream-left-info">
            <div className="str-chat__header-livestream-left-title">
              {channelName}
            </div>
            <div className="str-chat__header-livestream-left-subtitle">
              {getSubtitle()}
            </div>
          </div>
        </div>
        
        <div className="str-chat__header-livestream-right">
          <div className="call-buttons-container">
            <button
              className="call-button audio-call-button"
              onClick={handleAudioCall}
              title="Start audio call"
            >
              <img src={PhoneIcon} alt="Audio call" width="20" height="20" />
            </button>
            <button
              className="call-button video-call-button"
              onClick={handleVideoCall}
              title="Start video call"
            >
              <img src={VideoIcon} alt="Video call" width="20" height="20" />
            </button>
          </div>
          
          <div className="options-menu-container">
            <button
              ref={optionsButtonRef}
              className="options-menu-button"
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              title="Channel options"
            >
              <img src={OptionsIcon} alt="Options" width="20" height="20" />
            </button>
            
            {showOptionsMenu && (
              <div className="options-dropdown">
                <button
                  className="options-menu-item"
                  onClick={handleMuteToggle}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {isMuted ? (
                      <>
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                      </>
                    ) : (
                      <>
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                        <line x1="23" y1="9" x2="17" y2="15"></line>
                        <line x1="17" y1="9" x2="23" y2="15"></line>
                      </>
                    )}
                  </svg>
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
                
                <button
                  className="options-menu-item leave-item"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setShowLeaveConfirm(true);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16,17 21,12 16,7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  Leave Channel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showLeaveConfirm && (
        <div className="leave-channel-modal-overlay" onClick={() => setShowLeaveConfirm(false)}>
          <div className="leave-channel-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Leave Channel</h3>
            <p>
              Are you sure you want to leave "{channelName}"? 
              {memberCount === 1 && " This will delete the channel since you're the only member."}
              {memberCount === 2 && channelType === 'dm' && " You'll be removed from this conversation."}
              {memberCount > 2 && " You'll be removed from this channel and won't receive any more messages from it."}
            </p>
            <div className="leave-channel-modal-actions">
              <button
                className="cancel-button"
                onClick={() => setShowLeaveConfirm(false)}
                disabled={isLeaving}
              >
                Cancel
              </button>
              <button
                className="leave-button"
                onClick={handleLeaveChannel}
                disabled={isLeaving}
              >
                {isLeaving ? 'Leaving...' : (memberCount === 1 ? 'Delete Channel' : 'Leave Channel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomChannelHeader;
