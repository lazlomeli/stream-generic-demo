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
    
    // Generate a valid call ID (only a-z, 0-9, _, - allowed)
    const sanitizedChannelId = channel.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const callId = `audio_${sanitizedChannelId}_${Date.now()}`;
    
    // Navigate to call page with audio mode
    navigate(`/call/${callId}?type=audio&channel=${channel.id}`);
  };

  // Handle video call
  const handleVideoCall = () => {
    if (!channel || !channel.id) return;
    
    // Generate a valid call ID (only a-z, 0-9, _, - allowed)
    const sanitizedChannelId = channel.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const callId = `video_${sanitizedChannelId}_${Date.now()}`;
    
    // Navigate to call page with video mode
    navigate(`/call/${callId}?type=video&channel=${channel.id}`);
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
          <button className="mobile-chat-options" title="Options">
            ⋮
          </button>
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
