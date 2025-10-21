import React, { useState, useCallback, useEffect } from 'react';
import { useChatContext } from 'stream-chat-react';
import CreateChannelModal from './CreateChannelModal';
import ChannelList from './ChannelList';
import { listMyChannels, ChannelItem } from '../hooks/listMyChannels';
import { useLastMessageListener } from '../hooks/useLastMessageListener';
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
  
  // Listen for real-time message updates to keep channel list current
  useLastMessageListener(client, setChannels);
  const [filteredChannels, setFilteredChannels] = useState<ChannelItem[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);

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
              refreshChannelList(true); // Force refresh for initial channel
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

      // Search for additional channels and users from Stream (with reduced limits to minimize API usage)
      const [channelSearchResults, userSearchResults] = await Promise.all([
        // Search channels - reduced limit and only search own channels
        client.userID ? client.queryChannels(
          {
            type: 'messaging',
            name: { $autocomplete: query },
            members: { $in: [client.userID] } // Only search channels user is a member of
          },
          { last_message_at: -1 },
          { limit: 5 } // Reduced from 10 to 5
        ).catch(() => []) : Promise.resolve([]),
        // Search users - reduced limit
        client.queryUsers(
          {
            $or: [
              { id: { $autocomplete: query } },
              { name: { $autocomplete: query } }
            ]
          },
          { id: 1 },
          { limit: 5 } // Reduced from 10 to 5
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
          // .filter(user => user.id !== client.userID)
          .filter(user => {
            console.log('🔍 User:', user);
            return user.id !== client.userID;
          })
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
  const refreshChannelList = useCallback((force = false) => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime;
    
    // Prevent refresh storms: only refresh if it's been at least 2 seconds since last refresh (unless forced)
    if (!force && timeSinceLastRefresh < 2000) {
      console.log('🚫 Skipping refresh - too soon since last refresh');
      return;
    }
    
    console.log('🔄 Refreshing channel list...');
    setLastRefreshTime(now);
    setRefreshKey(prev => prev + 1);
    // Force reload channels with fresh data
    loadChannels(true);
  }, [loadChannels, lastRefreshTime]);

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
        refreshChannelList(true); // Force refresh to show new channel
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
    }, 800); // Increased debounce to reduce API calls

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
          refreshChannelList(true); // Force refresh for missing initial channel
        }, 500);
      }
    }
  }, [initialChannelId, channels]);

  // Listen for real-time channel updates (optimized to reduce API calls)
  useEffect(() => {
    if (!client.userID) return;

    let refreshTimeout: NodeJS.Timeout | null = null;

    const handleChannelUpdated = (event: any) => {
      console.log('📡 Real-time channel update received:', event.type);
      
      // Only refresh for critical events and throttle the calls
      const criticalEvents = ['channel.created', 'channel.deleted', 'notification.added_to_channel'];
      
      if (criticalEvents.includes(event.type)) {
        console.log('🔄 Scheduling throttled refresh for critical event:', event.type);
        
        // Clear any pending refresh
        if (refreshTimeout) {
          clearTimeout(refreshTimeout);
        }
        
        // Throttle refreshes: wait 1 second before refreshing, cancel if another event comes in
        refreshTimeout = setTimeout(() => {
          console.log('🔄 Executing throttled refresh');
          refreshChannelList();
          refreshTimeout = null;
        }, 1000);
      } else {
        console.log('📡 Non-critical event, skipping refresh:', event.type);
      }
    };

    // Listen only for essential channel events
    client.on('channel.created', handleChannelUpdated);
    client.on('channel.deleted', handleChannelUpdated);
    client.on('notification.added_to_channel', handleChannelUpdated);

    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      client.off('channel.created', handleChannelUpdated);
      client.off('channel.deleted', handleChannelUpdated);
      client.off('notification.added_to_channel', handleChannelUpdated);
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



  // Fetch users for both group and DM creation (cached to avoid repeated API calls)
  const fetchUsers = useCallback(async () => {
    // If we already have users cached, don't fetch again
    if (availableUsers.length > 0) {
      console.log('📋 Using cached user list');
      return availableUsers;
    }
    
    try {
      console.log('👥 Fetching users from Stream API...');
      const users = await client.queryUsers(
        {},
        { id: 1 },
        { limit: 50 } // Reduced from 100 to 50
      );

      const userList = users.users
        .filter(user => user.id !== client.userID)
        .map(user => ({
          id: user.id,
          name: user.name || user.id,
          image: user.image
        }));

      console.log(`✅ Fetched ${userList.length} users`);
      setAvailableUsers(userList);
      return userList;
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, [client, availableUsers]);

  const handleCreateGroupClick = useCallback(async () => {
    if (availableUsers.length === 0) {
      await fetchUsers();
    }
    setShowCreateGroupModal(true);
  }, [fetchUsers, availableUsers.length]);

  const handleCreateDMClick = useCallback(async () => {
    if (availableUsers.length === 0) {
      await fetchUsers();
    }
    setShowCreateDMModal(true);
  }, [fetchUsers, availableUsers.length]);

    const handleChannelCreated = useCallback(async (channelId: string) => {
    console.log('🎉 Channel created/opened, ID:', channelId);

    setShowCreateGroupModal(false);
    setShowCreateDMModal(false);

    try {
      const newChannel = client.channel('messaging', channelId);
      await newChannel.watch();
      console.log('✅ Channel watched successfully');

      // Check if channel already exists in the list
      const channelExists = channels.some(ch => ch.id === channelId);
      
      if (!channelExists) {
        // Only add to list if it's truly a new channel
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
      } else {
        console.log('✅ Channel already exists in list, just selecting it');
      }

      // Always select and activate the channel (whether new or existing)
      setSelectedChannelId(channelId);
      setActiveChannel(newChannel);

      // Refresh to get accurate channel data
      setTimeout(() => {
        console.log('🔄 Refreshing channel list for accurate data');
        refreshChannelList(true); // Force refresh to ensure correct ordering and data
      }, 500);

    } catch (error) {
      console.error('❌ Error setting up channel:', error);
      // Fallback to refreshing with delay if watching fails
      setTimeout(() => {
        console.log('🔄 Fallback: Refreshing channel list after error');
        refreshChannelList(true); // Force refresh for error recovery
      }, 500);
    }
  }, [refreshChannelList, client, setActiveChannel, channels]);

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
