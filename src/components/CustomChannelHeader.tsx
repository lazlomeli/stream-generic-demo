import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useChannelStateContext, useChatContext } from 'stream-chat-react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import FallbackAvatar from './FallbackAvatar';
import { useToast } from '../contexts/ToastContext';
import OptionsIcon from '../icons/options.svg';
import PhoneIcon from '../icons/phone.svg';
import VideoIcon from '../icons/video.svg';
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
  const [muteToggleKey, setMuteToggleKey] = useState(0); // Force re-render for mute status
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

  // Determine if it's a DM channel based on isDM flag in channel data
  // @ts-ignore - isDM is a custom field we add to channel data
  const isDM = channel.data?.isDM === true;
  const channelType = isDM ? 'dm' : 'group';
  
  // Use Object.keys to count members
  const memberCount = Object.keys(channel.state?.members || {}).length;

  // Get channel name - use type assertion for custom properties
  const channelName = (channel.data as any)?.name || 'Channel';
  
  // Get channel image - for DM channels only, use the other user's image
  // For group channels, don't set an image (force fallback icon)
  let channelImage: string | undefined = undefined;
  if (isDM) {
    // Find the other user (not the current user)
    const members = channel.state?.members || {};
    const otherUser = Object.values(members).find(member => 
      member.user?.id !== client.userID
    );
    if (otherUser?.user?.image) {
      channelImage = otherUser.user.image;
    }
  }

  // Calculate online users
  const currentUserId = client.userID;
  const members = channel.state?.members || {};
  
  const onlineUsers = Object.values(members).filter(member => 
    member.user?.online === true
  );
  const onlineCount = onlineUsers.length;
  
  // Generate subtitle based on online presence
  const getSubtitle = () => {
    if (onlineCount === 0) {
      return isDM 
        ? 'Direct Message' 
        : `${memberCount} member${memberCount !== 1 ? 's' : ''}`;
    } else if (onlineCount === 1) {
      // Check if the only online user is the current user
      const isOnlyUserOnline = onlineUsers.some(member => member.user?.id === currentUserId) && onlineCount === 1;
      if (isOnlyUserOnline) {
        return '1 online (You)';
      } else {
        return '1 online';
      }
    } else {
      return `${onlineCount} online`;
    }
  };

  // Close options menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      // Don't close if clicking on the options button or dropdown
      if (optionsButtonRef.current && optionsButtonRef.current.contains(target)) {
        return;
      }
      
      // Don't close if clicking on dropdown menu
      if (target.closest('.options-dropdown')) {
        return;
      }
      
      // Don't close if clicking on modal
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

  // Handle muting/unmuting the channel
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
      
      // Force a re-render to update the mute button text/icon
      const newMutedState = !isCurrentlyMuted;
      setMuteToggleKey(prev => prev + 1);
      
      // Broadcast mute status change to update channel list immediately
      console.log('📡 Broadcasting channelMuteStatusChanged event:', { channelId: channel.id, muted: newMutedState });
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

  // Handle leaving the channel (server-side proper leave/delete)
  const handleLeaveChannel = async () => {
    if (!channel || !client.userID) return;

    setIsLeaving(true);
    try {
      const channelId = channel.id;
      const accessToken = await getAccessTokenSilently();
      
      // Call the server-side leave channel API
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
      
      // Clear the active channel in Stream Chat context immediately
      setActiveChannel(undefined);
      
      // Show appropriate success message
      if (result.deleted) {
        showSuccess('Channel deleted successfully');
      } else {
        showSuccess('Left channel successfully');
      }
      
      // Navigate back to general chat
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

  // Get mute status (includes muteToggleKey to force re-render)
  const isMuted = useMemo(() => {
    return channel?.muteStatus().muted || false;
  }, [channel, muteToggleKey]);

  // Handle audio call
  const handleAudioCall = () => {
    if (!channel || !channel.id) return;
    
    // Generate a valid call ID (only a-z, 0-9, _, - allowed) with length limit
    const sanitizedChannelId = channel.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20); // Limit channel ID part
    const timestamp = Date.now().toString().slice(-8); // Use last 8 digits of timestamp
    const callId = `audio_${sanitizedChannelId}_${timestamp}`.slice(0, 60); // Ensure under 64 chars
    
    console.log('🎵 Generated call ID:', callId, 'Length:', callId.length);
    
    // Navigate to call page with audio mode
    navigate(`/call/${callId}?type=audio&channel=${channel.id}`);
  };

  // Handle video call
  const handleVideoCall = () => {
    if (!channel || !channel.id) return;
    
    // Generate a valid call ID (only a-z, 0-9, _, - allowed) with length limit
    const sanitizedChannelId = channel.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20); // Limit channel ID part
    const timestamp = Date.now().toString().slice(-8); // Use last 8 digits of timestamp
    const callId = `video_${sanitizedChannelId}_${timestamp}`.slice(0, 60); // Ensure under 64 chars
    
    console.log('🎥 Generated call ID:', callId, 'Length:', callId.length);
    
    // Navigate to call page with video mode
    navigate(`/call/${callId}?type=video&channel=${channel.id}`);
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
        
        {/* Call buttons and Options Menu */}
        <div className="str-chat__header-livestream-right">
          {/* Call Buttons */}
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
                      // Unmute icon
                      <>
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                      </>
                    ) : (
                      // Mute icon
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

      {/* Leave Channel Confirmation Modal */}
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
