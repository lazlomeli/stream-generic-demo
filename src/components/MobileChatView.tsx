import React from 'react'
import { Channel, Window, MessageList, Thread } from 'stream-chat-react'
import { Channel as StreamChannel } from 'stream-chat'
import CustomAttachment from './CustomAttachment'
import CustomMessageInput from './CustomMessageInput'
import PinnedMessages from './PinnedMessages'
import VoiceMessageHandler from './VoiceMessageHandler'

interface MobileChatViewProps {
  channel: StreamChannel
  onBack: () => void
}

const MobileChatView: React.FC<MobileChatViewProps> = ({ channel, onBack }) => {
  // Get channel name - try different properties
  const channelName = (channel.data as any)?.name || 
                     channel.data?.id ||
                     (channel.data?.member_count && channel.data.member_count > 2 
                       ? `Group Chat (${channel.data.member_count} members)`
                       : 'Chat')

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
