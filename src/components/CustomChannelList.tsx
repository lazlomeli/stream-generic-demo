import React, { useState, useCallback, useEffect } from 'react';
import { useChatContext } from 'stream-chat-react';
import CreateChannelModal from './CreateChannelModal';
import ChannelList from './ChannelList';
import { listMyChannels, ChannelItem } from '../hooks/listMyChannels';
import usersGroupIcon from '../icons/users-group.svg';
import userIcon from '../icons/user.svg';
import sendIcon from '../icons/send.svg';
import './CustomChannelList.css';

interface CustomChannelListProps {
  filters: any;
  sort: any;
  options: any;
  initialChannelId?: string;
}

const CustomChannelList: React.FC<CustomChannelListProps> = (props) => {
  const { filters, sort, options, initialChannelId } = props;
  const { client, setActiveChannel } = useChatContext();
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateDMModal, setShowCreateDMModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Add refresh key
  const [availableUsers, setAvailableUsers] = useState<Array<{
    id: string;
    name: string;
    image?: string;
  }>>([]);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredChannels, setFilteredChannels] = useState<ChannelItem[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Function to load channels
  const loadChannels = useCallback(async (forceRefresh = false) => {
    if (!client.userID) return;
    
    try {
      console.log(`📡 Loading channels... ${forceRefresh ? '(force refresh)' : ''}`);
      
      // Get fresh channel data
      const channelData = await listMyChannels(client, client.userID);
      
      console.log(`✅ Loaded ${channelData.length} channels`);
      setChannels(channelData);
      setFilteredChannels(channelData); // Initialize filtered channels
      
      // Handle channel selection priority: initialChannelId > current selection > first channel
      let channelToSelect = null;
      
      if (initialChannelId) {
        // Priority 1: Try to select the channel from URL parameter
        channelToSelect = channelData.find(ch => ch.id === initialChannelId);
        if (channelToSelect) {
          console.log(`✅ Found initial channel from URL: ${channelToSelect.name}`);
        } else {
          // If initial channel not found in loaded channels, try to watch it directly
          try {
            const channel = client.channel('messaging', initialChannelId);
            await channel.watch();
            setSelectedChannelId(initialChannelId);
            setActiveChannel(channel);
            console.log(`✅ Opened initial channel from URL: ${initialChannelId}`);
            
            // Add the channel to our local state optimistically
            const newChannelItem: ChannelItem = {
              id: initialChannelId,
              name: (channel.data as any)?.name || 'Direct Message',
              type: (channel.data as any)?.isDM ? 'dm' : 'group',
              image: (channel.data as any)?.image,
              lastMessage: undefined,
              lastMessageTime: undefined,
              status: 'offline',
              onlineCount: 0,
            };
            
            setChannels(prev => [newChannelItem, ...prev]);
            setFilteredChannels(prev => [newChannelItem, ...prev]);
            console.log(`⚡ Added initial channel to list: ${initialChannelId}`);
            
            // Trigger a refresh after a short delay to get the most up-to-date channel data
            setTimeout(() => {
              console.log('🔄 Refreshing channel list to get accurate data for initial channel');
              setRefreshKey(prev => prev + 1);
            }, 1000);
            
            return; // Exit early since we found and set the channel
          } catch (error) {
            console.warn(`⚠️ Could not open initial channel ${initialChannelId}:`, error);
            // Fall through to select first available channel
          }
        }
      }
      
      if (!channelToSelect && !selectedChannelId && channelData.length > 0) {
        // Priority 2: Select first available channel if no channel is currently selected
        channelToSelect = channelData[0];
      }
      
      if (channelToSelect) {
        setSelectedChannelId(channelToSelect.id);
        
        // Set the channel as active
        try {
          const channel = client.channel('messaging', channelToSelect.id);
          await channel.watch();
          setActiveChannel(channel);
          console.log(`✅ Auto-selected channel: ${channelToSelect.name}`);
        } catch (error) {
          console.error('❌ Error auto-selecting channel:', error);
        }
      }
    } catch (error) {
      console.error('❌ Error loading channels:', error);
    }
  }, [client, selectedChannelId, setActiveChannel, initialChannelId]);

  // Function to search channels and users
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setFilteredChannels(channels);
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const lowerQuery = query.toLowerCase();

    try {
      // Filter local channels
      const localFiltered = channels.filter(channel => 
        channel.name?.toLowerCase().includes(lowerQuery)
      );
      setFilteredChannels(localFiltered);

      // Search for additional channels and users from Stream
      const [channelSearchResults, userSearchResults] = await Promise.all([
        // Search channels
        client.queryChannels(
          {
            type: 'messaging',
            name: { $autocomplete: query },
            ...(client.userID && { members: { $in: [client.userID] } })
          },
          { last_message_at: -1 },
          { limit: 10 }
        ).catch(() => []),
        // Search users
        client.queryUsers(
          {
            $or: [
              { id: { $autocomplete: query } },
              { name: { $autocomplete: query } }
            ]
          },
          { id: 1 },
          { limit: 10 }
        ).catch(() => ({ users: [] }))
      ]);

      // Combine and format search results
      const combinedResults = [
        ...channelSearchResults.map(channel => ({
          type: 'channel',
          id: channel.id,
          name: (channel.data as any)?.name || channel.id,
          cid: channel.cid,
          channel
        })),
        ...userSearchResults.users
          .filter(user => user.id !== client.userID)
          .map(user => ({
            type: 'user',
            id: user.id,
            name: user.name || user.id,
            user
          }))
      ];

      setSearchResults(combinedResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, [channels, client]);

  // Function to force refresh the channel list when a new channel is created
  const refreshChannelList = useCallback(() => {
    console.log('🔄 Refreshing channel list...');
    setRefreshKey(prev => prev + 1);
    // Force reload channels with fresh data
    loadChannels(true);
  }, [loadChannels]);

  // Handle search result selection
  const handleSearchResultSelect = useCallback(async (result: any) => {
    if (result.type === 'channel') {
      // Select existing channel
      setSelectedChannelId(result.id);
      try {
        const channel = client.channel('messaging', result.id);
        await channel.watch();
        setActiveChannel(channel);
      } catch (error) {
        console.error('❌ Error selecting search result channel:', error);
      }
    } else if (result.type === 'user') {
      // Create/open DM with user
      try {
        const channel = client.channel('messaging', { 
          members: [client.userID, result.id] 
        });
        await channel.watch();
        setActiveChannel(channel);
        setSelectedChannelId(channel.id || '');
        refreshChannelList(); // Refresh to show new channel
      } catch (error) {
        console.error('❌ Error creating DM with user:', error);
      }
    }
    
    // Clear search after selection
    setSearchQuery('');
    setSearchResults([]);
    setFilteredChannels(channels);
  }, [client, setActiveChannel, channels, refreshChannelList]);

  // Effect to trigger search when query changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchQuery, performSearch]);

  // Load channels on mount and when refresh key changes
  useEffect(() => {
    loadChannels();
  }, [loadChannels, refreshKey]);

  // Effect to handle when initialChannelId changes (e.g., from URL navigation)
  useEffect(() => {
    if (initialChannelId && channels.length > 0) {
      // Check if the initial channel is not in our current list
      const channelExists = channels.some(ch => ch.id === initialChannelId);
      if (!channelExists) {
        console.log(`🔄 Initial channel ${initialChannelId} not found in list, triggering refresh`);
        // Force a refresh to ensure we have the latest channels
        setTimeout(() => {
          setRefreshKey(prev => prev + 1);
        }, 500);
      }
    }
  }, [initialChannelId, channels]);

  // Listen for real-time channel updates
  useEffect(() => {
    if (!client.userID) return;

    const handleChannelUpdated = (event: any) => {
      console.log('📡 Real-time channel update received:', event.type);
      // Refresh channel list when channels are updated
      if (event.type === 'channel.updated' || 
          event.type === 'notification.added_to_channel' ||
          event.type === 'channel.created' ||
          event.type === 'notification.removed_from_channel' ||
          event.type === 'channel.deleted') {
        console.log('🔄 Auto-refreshing channel list due to real-time update');
        refreshChannelList();
      }
    };

    // Listen for channel events that might affect our channel list
    client.on('channel.updated', handleChannelUpdated);
    client.on('notification.added_to_channel', handleChannelUpdated);
    client.on('channel.created', handleChannelUpdated);
    client.on('notification.removed_from_channel', handleChannelUpdated);
    client.on('channel.deleted', handleChannelUpdated);

    return () => {
      client.off('channel.updated', handleChannelUpdated);
      client.off('notification.added_to_channel', handleChannelUpdated);
      client.off('channel.created', handleChannelUpdated);
      client.off('notification.removed_from_channel', handleChannelUpdated);
      client.off('channel.deleted', handleChannelUpdated);
    };
  }, [client, refreshChannelList]);

  // Listen for custom mute status change events
  useEffect(() => {
    const handleMuteStatusChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { channelId, muted } = customEvent.detail;
      console.log('🔇 Mute status change received:', { channelId, muted });
      
      // Update the specific channel's muted status in local state
      setChannels(prev => prev.map(channel => 
        channel.id === channelId 
          ? { ...channel, muted }
          : channel
      ));
      
      setFilteredChannels(prev => prev.map(channel => 
        channel.id === channelId 
          ? { ...channel, muted }
          : channel
      ));
    };

    window.addEventListener('channelMuteStatusChanged', handleMuteStatusChange);
    
    return () => {
      window.removeEventListener('channelMuteStatusChanged', handleMuteStatusChange);
    };
  }, []);


  // Handle channel selection
  const handleChannelSelect = useCallback(async (channelId: string) => {
    setSelectedChannelId(channelId);
    
    try {
      // Get the channel and watch it to make it active
      const channel = client.channel('messaging', channelId);
      await channel.watch();
      
      // Set the active channel in Stream Chat context - this will show messages on the right
      setActiveChannel(channel);
      

    } catch (error) {
      console.error('❌ Error selecting channel:', error);
    }
  }, [client, setActiveChannel]);



  // Fetch users for both group and DM creation
  const fetchUsers = useCallback(async () => {
    try {
      const users = await client.queryUsers(
        {},
        { id: 1 },
        { limit: 100 }
      );

      const userList = users.users
        .filter(user => user.id !== client.userID)
        .map(user => ({
          id: user.id,
          name: user.name || user.id,
          image: user.image
        }));

      setAvailableUsers(userList);
      return userList;
    } catch (error) {
      console.error('Error fetching users:', error);
      // Fallback to demo users if we can't fetch from Stream
      const fallbackUsers = [
        {
          id: 'alice_smith',
          name: 'Alice Smith',
          image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face'
        },
        {
          id: 'bob_johnson',
          name: 'Bob Johnson',
          image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
        },
        {
          id: 'carol_williams',
          name: 'Carol Williams',
          image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face'
        },
        {
          id: 'david_brown',
          name: 'David Brown',
          image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
        },
        {
          id: 'emma_davis',
          name: 'Emma Davis',
          image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face'
        }
      ];
      setAvailableUsers(fallbackUsers);
      return fallbackUsers;
    }
  }, [client]);

  const handleCreateGroupClick = useCallback(async () => {
    await fetchUsers();
    setShowCreateGroupModal(true);
  }, [fetchUsers]);

  const handleCreateDMClick = useCallback(async () => {
    await fetchUsers();
    setShowCreateDMModal(true);
  }, [fetchUsers]);

    const handleChannelCreated = useCallback(async (channelId: string) => {
    console.log('🎉 Channel created, ID:', channelId);

    setShowCreateGroupModal(false);
    setShowCreateDMModal(false);

    try {
      // Watch the new channel to ensure the client is aware of it
      const newChannel = client.channel('messaging', channelId);
      await newChannel.watch();
      console.log('✅ New channel watched successfully');

      // Optimistic update: Add the new channel to our local state immediately
      const newChannelItem: ChannelItem = {
        id: channelId,
        name: (newChannel.data as any)?.name || 'New Channel',
        type: (newChannel.data as any)?.isDM ? 'dm' : 'group',
        image: (newChannel.data as any)?.image,
        lastMessage: undefined,
        lastMessageTime: undefined,
        status: 'offline',
        onlineCount: 0,
      };

      setChannels(prev => [newChannelItem, ...prev]);
      setFilteredChannels(prev => [newChannelItem, ...prev]);
      console.log('⚡ Optimistically added new channel to list');

      // Set the new channel as selected and active
      setSelectedChannelId(channelId);
      setActiveChannel(newChannel);

      // Add a small delay to ensure Stream has fully processed the channel
      // then refresh the channel list to get the accurate data
      setTimeout(() => {
        console.log('🔄 Refreshing channel list for accurate data');
        refreshChannelList();
      }, 500);

    } catch (error) {
      console.error('❌ Error setting up new channel:', error);
      // Fallback to refreshing with delay if watching fails
      setTimeout(() => {
        console.log('🔄 Fallback: Refreshing channel list after error');
        refreshChannelList();
      }, 500);
    }
  }, [refreshChannelList, client, setActiveChannel]);

  const handleCloseGroupModal = useCallback(() => {
    setShowCreateGroupModal(false);
  }, []);

  const handleCloseDMModal = useCallback(() => {
    setShowCreateDMModal(false);
  }, []);

  return (
    <div className="custom-channel-list">
      {/* Create Channel Buttons */}
      <div className="create-channel-section">
        <button
          className="create-channel-button group-button"
          onClick={handleCreateGroupClick}
          title="Create new group"
        >
          <span className="create-channel-icon">+</span>
          <span className="create-channel-text">New Group</span>
          <img 
            src={usersGroupIcon}
            alt="Group"
            width="16" 
            height="16"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
        </button>
         
        <button
          className="create-channel-button dm-button"
          onClick={handleCreateDMClick}
          title="Start direct message"
        >
          <span className="create-channel-icon">+</span>
          <span className="create-channel-text">New DM</span>
          <img 
            src={sendIcon}
            alt="Direct Message"
            width="16" 
            height="16"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
        </button>
      </div>

      {/* Search Bar */}
      <div className="channel-search-container">
        <input
          type="text"
          placeholder="Search channels and users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="channel-search-input"
        />
        {isSearching && (
          <div className="search-loading">🔍 Searching...</div>
        )}
      </div>

      {/* Search Results */}
      {searchQuery && searchResults.length > 0 && (
        <div className="search-results-container">
          <div className="search-results-header">Search Results</div>
          <div className="search-results-list">
            {searchResults.map((result, index) => (
              <div
                key={`${result.type}-${result.id}`}
                className="search-result-item"
                onClick={() => handleSearchResultSelect(result)}
              >
                <img 
                  src={result.type === 'channel' ? usersGroupIcon : userIcon}
                  alt={result.type === 'channel' ? 'Channel' : 'User'}
                  className="search-result-icon"
                />
                <span className="search-result-name">{result.name}</span>
                <span className="search-result-type">
                  {result.type === 'channel' ? 'Channel' : 'User'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Channel List */}
      <div className="stream-channel-list">
        <ChannelList 
          channels={filteredChannels}
          selectedChannel={selectedChannelId}
          onChannelSelect={handleChannelSelect}
        />
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
  );
};

export default CustomChannelList;
