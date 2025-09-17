import React, { useState, useEffect, useCallback } from 'react'
import { useChatContext } from 'stream-chat-react'
import { ChannelList, ChannelPreviewMessenger } from 'stream-chat-react'
import { Channel as StreamChannel } from 'stream-chat'
import CreateChannelModal from './CreateChannelModal'
import { listMyChannels, ChannelItem } from '../hooks/listMyChannels'
import FallbackAvatar from './FallbackAvatar'
import LoadingIcon from './LoadingIcon'

interface MobileChannelListProps {
  filters: any
  sort: any
  options: any
  onChannelSelect: (channel: StreamChannel) => void
  onBackToList: () => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  availableUsers: Array<{
    id: string;
    name: string;
    image?: string;
  }>
  onChannelCreated: (channelId: string) => void
}

const MobileChannelList: React.FC<MobileChannelListProps> = ({
  filters,
  sort,
  options,
  onChannelSelect,
  searchQuery,
  setSearchQuery,
  availableUsers,
  onChannelCreated
}) => {
  const { client, setActiveChannel } = useChatContext()
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [showCreateDMModal, setShowCreateDMModal] = useState(false)
  const [channels, setChannels] = useState<ChannelItem[]>([])
  const [filteredChannels, setFilteredChannels] = useState<ChannelItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const handleCreateGroupClick = () => {
    setShowCreateGroupModal(true)
  }

  const handleCreateDMClick = () => {
    setShowCreateDMModal(true)
  }

  const handleCloseGroupModal = () => {
    setShowCreateGroupModal(false)
  }

  const handleCloseDMModal = () => {
    setShowCreateDMModal(false)
  }

  // Load channels using the same method as desktop
  const loadChannels = useCallback(async () => {
    if (!client.userID) return;
    
    try {
      setIsLoading(true)
      console.log('📱 Loading mobile channels...')
      
      const channelData = await listMyChannels(client, client.userID)
      console.log(`✅ Mobile loaded ${channelData.length} channels`)
      
      setChannels(channelData)
      setFilteredChannels(channelData)
    } catch (error) {
      console.error('❌ Error loading mobile channels:', error)
    } finally {
      setIsLoading(false)
    }
  }, [client])

  // Load channels on mount and when client changes
  useEffect(() => {
    if (client.userID) {
      loadChannels()
    }
  }, [client.userID, loadChannels])

  // Filter channels based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredChannels(channels)
    } else {
      const filtered = channels.filter(channel =>
        channel.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredChannels(filtered)
    }
  }, [searchQuery, channels])

  const handleChannelItemClick = async (channelId: string) => {
    try {
      const channel = client.channel('messaging', channelId)
      await channel.watch()
      setActiveChannel(channel)
      onChannelSelect(channel)
    } catch (error) {
      console.error('Error selecting mobile channel:', error)
    }
  }

  const handleChannelCreated = async (channelId: string) => {
    setShowCreateGroupModal(false)
    setShowCreateDMModal(false)
    
    // Refresh channel list
    await loadChannels()
    
    // Get the new channel and select it
    const newChannel = client.channel('messaging', channelId)
    await newChannel.watch()
    setActiveChannel(newChannel)
    onChannelSelect(newChannel)
    onChannelCreated(channelId)
  }

  return (
    <div className="mobile-channel-list">
      {/* Header with search and actions */}
      <div className="mobile-channel-header">
        <h2>Chats</h2>
        <div className="mobile-channel-actions">
          <button onClick={handleCreateGroupClick} className="create-channel-btn" title="New Group Chat">
            +
          </button>
          <button onClick={handleCreateDMClick} className="create-dm-btn" title="New Direct Message">
            DM
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="mobile-search-container">
        <input
          type="text"
          placeholder="Search chats..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mobile-search-input"
        />
      </div>

      {/* Channel list */}
      <div className="mobile-channel-list-container">
        {isLoading ? (
          <div className="mobile-channel-loading">
            <LoadingIcon size={20} />
            <span>Loading chats...</span>
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="mobile-no-channels">
            {searchQuery ? 'No chats found' : 'No chats yet. Create your first chat!'}
          </div>
        ) : (
          <div className="mobile-channel-items">
            {filteredChannels.map((channelItem) => (
              <button
                key={channelItem.id}
                onClick={() => handleChannelItemClick(channelItem.id)}
                className="mobile-channel-item"
              >
                <div className="mobile-channel-avatar">
                  <FallbackAvatar
                    src={channelItem.image}
                    alt={channelItem.name || 'Channel'}
                    className="mobile-channel-avatar-image"
                    size={48}
                    channelType={channelItem.type}
                    channelName={channelItem.name}
                  />
                  <div className={`mobile-channel-status ${channelItem.status}`}></div>
                </div>
                
                <div className="mobile-channel-content">
                  <div className="mobile-channel-row">
                    <h3 className="mobile-channel-name">{channelItem.name}</h3>
                    <span className="mobile-channel-time">{channelItem.lastMessageTime}</span>
                  </div>
                  <div className="mobile-channel-message">
                    {channelItem.lastMessage || 'No messages yet'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      <CreateChannelModal
        isOpen={showCreateGroupModal}
        onClose={handleCloseGroupModal}
        onChannelCreated={handleChannelCreated}
        availableUsers={availableUsers}
        currentUserId={client.userID}
      />

      {/* Create DM Modal */}
      <CreateChannelModal
        isOpen={showCreateDMModal}
        onClose={handleCloseDMModal}
        onChannelCreated={handleChannelCreated}
        availableUsers={availableUsers}
        currentUserId={client.userID}
        isDM={true}
      />
    </div>
  )
}

export default MobileChannelList
