import React from 'react'
import { ChannelItem } from '../hooks/listMyChannels'
import FallbackAvatar from './FallbackAvatar'
import LoadingIcon from './LoadingIcon'
import ChannelTypingIndicator from './ChannelTypingIndicator'
import VolumeOffIcon from '../icons/volume-off.svg'
import './ChannelList.css'

interface ChannelListProps {
  channels: ChannelItem[]
  selectedChannel: string
  onChannelSelect: (channelId: string) => void
}

const ChannelList: React.FC<ChannelListProps> = ({ 
  channels, 
  selectedChannel, 
  onChannelSelect 
}) => {

  return (
    <div className="channel-list">
      <div className="channel-list-content">
        
        {/* Debug info */}
        <div className="channel-list-debug">
          Channels loaded: {channels.length}
        </div>
        
        {/* Channel List */}
        <div className="channel-list-items">
          {channels.length === 0 ? (
            <div className="channel-list-loading">
              <LoadingIcon size={20} />
            </div>
          ) : (
            channels.map((channelItem) => (
              <button
                key={channelItem.id}
                onClick={() => onChannelSelect(channelItem.id)}
                className={`channel-item-button ${
                  selectedChannel === channelItem.id ? 'selected' : ''
                }`}
              >
                <div className="channel-item-content">
                    <div className="channel-item-avatar">
                      <FallbackAvatar
                        src={channelItem.image}
                        alt={channelItem.name || 'Channel'}
                        className="channel-item-avatar-image"
                        size={24}
                        channelType={channelItem.type}
                        channelName={channelItem.name}
                      />
                      <div className={`channel-item-status ${
                        channelItem.status === 'online' ? 'online' : 
                        channelItem.status === 'away' ? 'away' : 'offline'
                      }`}></div>
                    </div>
                  
                  <div className="channel-item-text">
                    <div className="channel-item-header">
                      <h3 className="channel-item-name">{channelItem.name}</h3>
                      <div className="channel-item-meta">
                        {channelItem.muted && (
                          <img 
                            src={VolumeOffIcon} 
                            alt="Muted" 
                            className="channel-item-mute-icon"
                            title="Channel is muted"
                          />
                        )}
                        <span className="channel-item-time">{channelItem.lastMessageTime}</span>
                      </div>
                    </div>
                    <div className="channel-item-message">
                      <ChannelTypingIndicator
                        channelId={channelItem.id}
                        lastMessage={channelItem.lastMessage}
                      />
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default ChannelList
