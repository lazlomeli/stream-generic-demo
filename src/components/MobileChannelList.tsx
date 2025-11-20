import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useChatContext } from 'stream-chat-react'
import { Channel as StreamChannel } from 'stream-chat'
import { useAuth0 } from '@auth0/auth0-react'
import CreateChannelModal from './CreateChannelModal'
import { listMyChannels, ChannelItem } from '../hooks/listMyChannels'
import { useLastMessageListener } from '../hooks/useLastMessageListener'
import FallbackAvatar from './FallbackAvatar'
import LoadingIcon from './LoadingIcon'
import ChannelTypingIndicator from './ChannelTypingIndicator'
import { useToast } from '../contexts/ToastContext'
import UsersGroupIcon from '../icons/users-group.svg'
import SendIcon from '../icons/send.svg'
import TrashIcon from '../icons/trash.svg'
import OptionsIcon from '../icons/options.svg'

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
  
  useLastMessageListener(client, setChannels)
  const [showOptionsMenu, setShowOptionsMenu] = useState<string | null>(null)
  const { getAccessTokenSilently } = useAuth0()
  const { showSuccess, showError } = useToast()
  const optionsButtonRef = useRef<HTMLButtonElement>(null)

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

  const loadChannels = useCallback(async () => {
    if (!client.userID) return;
    
    try {
      setIsLoading(true)
      
      const channelData = await listMyChannels(client, client.userID)
      
      setChannels(channelData)
      setFilteredChannels(channelData)
    } catch (error) {
      console.error('[MobileChannelList.tsx]: Error loading mobile channels:', error)
    } finally {
      setIsLoading(false)
    }
  }, [client])

  useEffect(() => {
    if (client.userID) {
      loadChannels()
    }
  }, [client.userID, loadChannels])

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
    
    await loadChannels()
    
    const newChannel = client.channel('messaging', channelId)
    await newChannel.watch()
    setActiveChannel(newChannel)
    onChannelSelect(newChannel)
    onChannelCreated(channelId)
  }

  const handleOptionsClick = (e: React.MouseEvent, channelId: string) => {
    e.stopPropagation()
    setShowOptionsMenu(showOptionsMenu === channelId ? null : channelId)
  }

  const handleDeleteChannel = async (channelId: string) => {
    if (!client.userID) {
      return
    }
    
    try {
      const accessToken = await getAccessTokenSilently()
      
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
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to delete channel: ${errorText}`)
      }

      const result = await response.json()

      showSuccess('Channel deleted successfully')
      setShowOptionsMenu(null)
      await loadChannels()
      
    } catch (error) {
      console.error('[MobileChannelList.tsx]: Error deleting channel:', error)
      showError(`Failed to delete channel: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleMuteChannel = async (channelId: string) => {
    try {
      const channel = client.channel('messaging', channelId)
      await channel.watch()
      
      const isMuted = channel.muteStatus().muted
      
      if (isMuted) {
        await channel.unmute()
        showSuccess('Channel unmuted')
      } else {
        await channel.mute()
        showSuccess('Channel muted')
      }
      
      setShowOptionsMenu(null)
      await loadChannels()
      
    } catch (error) {
      console.error('[MobileChannelList.tsx]: Error toggling mute:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showError(`Failed to update mute settings: ${errorMessage}`)
    }
  }

  const handleOverlayClick = () => {
    setShowOptionsMenu(null)
  }

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (optionsButtonRef.current && !optionsButtonRef.current.contains(event.target as Node)) {
        setShowOptionsMenu(null)
      }
    }

    if (showOptionsMenu) {
      document.addEventListener('mousedown', handleDocumentClick)
    }

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
    }
  }, [showOptionsMenu])

  return (
    <div className="mobile-channel-list">
      <div className="mobile-channel-header">
        <h2>Chats</h2>
        <div className="mobile-channel-actions">
          {/* <button onClick={handleCreateGroupClick} className="create-channel-btn" title="New Group Chat">
            <img src={UsersGroupIcon} alt="Group" />
          </button>
          <button onClick={handleCreateDMClick} className="create-channel-btn create-dm-btn" title="New Direct Message">
            <img src={SendIcon} alt="DM" />
          </button> */}
        </div>
      </div>

      <div className="mobile-search-container">
        <input
          type="text"
          placeholder="Search chats..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mobile-search-input"
        />

          <button onClick={handleCreateGroupClick} className="create-channel-btn create-group-btn" title="New Group Chat">
            <img src={UsersGroupIcon} alt="Group" />
          </button>
          <button onClick={handleCreateDMClick} className="create-channel-btn create-dm-btn" title="New Direct Message">
            <img src={SendIcon} alt="DM" />
          </button>
      </div>

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
          <div className="mobile-channel-items" onClick={handleOverlayClick}>
            {filteredChannels.map((channelItem) => {
              const isChannelMuted = client.channel('messaging', channelItem.id).muteStatus().muted
              const isOptionsOpen = showOptionsMenu === channelItem.id
              
              return (
                <div key={channelItem.id} className="mobile-channel-item">
                  <div
                    onClick={() => handleChannelItemClick(channelItem.id)}
                    className="mobile-channel-item-content"
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
                        <div className="mobile-channel-time-options">
                          <span className="mobile-channel-time">{channelItem.lastMessageTime}</span>
                          <div className="mobile-channel-options-container">
                            <button
                              ref={isOptionsOpen ? optionsButtonRef : null}
                              className="mobile-channel-options-btn"
                              onClick={(e) => handleOptionsClick(e, channelItem.id)}
                              title="Channel options"
                            >
                              <img src={OptionsIcon} alt="Options" width="16" height="16" />
                            </button>
                            
                            {isOptionsOpen && (
                              <div className="mobile-channel-options-menu">
                                <button
                                  className="mobile-channel-option-item mute-option"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleMuteChannel(channelItem.id)
                                  }}
                                >
                                  <span className="option-icon">{isChannelMuted ? '🔊' : '🔇'}</span>
                                  <span className="option-text">{isChannelMuted ? 'Unmute' : 'Mute'}</span>
                                </button>
                                <button
                                  className="mobile-channel-option-item delete-option"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteChannel(channelItem.id)
                                  }}
                                >
                                  <span className="option-icon">
                                    <img src={TrashIcon} alt="Delete" width="14" height="14" />
                                  </span>
                                  <span className="option-text">Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mobile-channel-message">
                        <ChannelTypingIndicator
                          channelId={channelItem.id}
                          lastMessage={channelItem.lastMessage}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <CreateChannelModal
        isOpen={showCreateGroupModal}
        onClose={handleCloseGroupModal}
        onChannelCreated={handleChannelCreated}
        availableUsers={availableUsers}
        currentUserId={client.userID}
      />

      <CreateChannelModal
        isOpen={showCreateDMModal}
        onClose={handleCloseDMModal}
        onChannelCreated={handleChannelCreated}
        availableUsers={availableUsers}
        currentUserId={client.userID}
        isDM={true}
      />
    </div>
  );    
}

export default MobileChannelList;
