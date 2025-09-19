import React from 'react'
import { Channel, Window, MessageList, Thread } from 'stream-chat-react'
import { Channel as StreamChannel } from 'stream-chat'
import { useNavigate } from 'react-router-dom'
import CustomAttachment from './CustomAttachment'
import CustomMessageInput from './CustomMessageInput'
import PinnedMessages from './PinnedMessages'
import VoiceMessageHandler from './VoiceMessageHandler'
import PhoneIcon from '../icons/phone.svg'
import VideoIcon from '../icons/video.svg'

interface MobileChatViewProps {
  channel: StreamChannel
  onBack: () => void
}

const MobileChatView: React.FC<MobileChatViewProps> = ({ channel, onBack }) => {
  const navigate = useNavigate()

  // Get channel name - try different properties
  const channelName = (channel.data as any)?.name || 
                     channel.data?.id ||
                     (channel.data?.member_count && channel.data.member_count > 2 
                       ? `Group Chat (${channel.data.member_count} members)`
                       : 'Chat')

  // Handle audio call
  const handleAudioCall = () => {
    if (!channel || !channel.id) return;
    
    // Generate a short, unique call ID (max 64 chars for Stream Video)
    const shortId = Math.random().toString(36).substring(2, 15);
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits
    const callId = `audio_${shortId}_${timestamp}`;
    
    // Navigate to call page with audio mode and mobile flag
    navigate(`/call/${callId}?type=audio&channel=${channel.id}&mobile=true`);
  };

  // Handle video call
  const handleVideoCall = () => {
    if (!channel || !channel.id) return;
    
    // Generate a short, unique call ID (max 64 chars for Stream Video)
    const shortId = Math.random().toString(36).substring(2, 15);
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits
    const callId = `video_${shortId}_${timestamp}`;
    
    // Navigate to call page with video mode and mobile flag
    navigate(`/call/${callId}?type=video&channel=${channel.id}&mobile=true`);
  };

  return (
    <div className="mobile-chat-view">
      {/* Mobile chat header with back button */}
      <div className="mobile-chat-header">
        <button onClick={onBack} className="mobile-back-btn" title="Back to chats">
          ←
        </button>
        <div className="mobile-chat-info">
          <h3>{channelName}</h3>
          <span className="mobile-chat-status">
            {channel.data?.member_count ? `${channel.data.member_count} members` : 'Online'}
          </span>
        </div>
        <div className="mobile-chat-actions">
          {/* Video/Audio Call Buttons */}
          <div className="mobile-call-buttons">
            <button
              className="mobile-call-button mobile-audio-call-button"
              onClick={handleAudioCall}
              title="Start audio call"
            >
              <img src={PhoneIcon} alt="Audio call" width="18" height="18" />
            </button>
            <button
              className="mobile-call-button mobile-video-call-button"
              onClick={handleVideoCall}
              title="Start video call"
            >
              <img src={VideoIcon} alt="Video call" width="18" height="18" />
            </button>
          </div>
        </div>
      </div>

      {/* Chat content */}
      <Channel channel={channel} Attachment={CustomAttachment}>
        <Window>
          <div className="mobile-message-area">
            <PinnedMessages />
            <MessageList />
          </div>
          <CustomMessageInput />
        </Window>
        <Thread />
        <VoiceMessageHandler />
      </Channel>
    </div>
  )
}

export default MobileChatView
