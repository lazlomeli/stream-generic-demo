import React from 'react'
import { ChannelItem } from '../hooks/listMyChannels'
import FallbackAvatar from './FallbackAvatar'
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
              <div className="channel-list-loading-spinner"></div>
              <p className="channel-list-loading-text">Loading...</p>
            </div>
          ) : (
            channels.map((channelItem) => { 
              console.log('channelItem', channelItem.image);
              return (
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
                      />
                      <div className={`channel-item-status ${
                        channelItem.status === 'online' ? 'online' : 
                        channelItem.status === 'away' ? 'away' : 'offline'
                      }`}></div>
                    </div>
                  
                  <div className="channel-item-text">
                    <div className="channel-item-header">
                      <h3 className="channel-item-name">{channelItem.name}</h3>
                      <span className="channel-item-time">{channelItem.lastMessageTime}</span>
                    </div>
                    <p className="channel-item-message">{channelItem.lastMessage}</p>
                  </div>
                </div>
              </button>
            )})
          )}
        </div>
      </div>
    </div>
  )
}

export default ChannelList
