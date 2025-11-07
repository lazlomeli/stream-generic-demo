import React from 'react';
import './RightSidebar.css';
import { useFollowSuggestions } from '../hooks/feeds/useFollowSuggestions';
import { useNavigate } from 'react-router-dom';
import { UserActions } from './UserActions';
import { generateAvatarUrl } from '../utils/avatarUtils';
import { useSearch } from '../hooks/feeds/useSearch';
import { SearchInput } from './SearchInput';
import { SearchResults } from './SearchResults';
import { useTrendingHashtags } from '../hooks/feeds/useTrendingHashtags';

interface RightSidebarProps {}

const RightSidebar: React.FC<RightSidebarProps> = () => {
  const navigate = useNavigate();
  const { whoToFollow, isLoading: isLoadingWhoToFollow } = useFollowSuggestions();
  const { hashtags: trendingHashtags, isLoading: isLoadingHashtags } = useTrendingHashtags(5);
  
  // Use the existing useSearch hook
  const {
    activities,
    users,
    searchQuery,
    searchMode,
    isLoading,
    error,
    searchActivities,
    clearSearch,
  } = useSearch();

  const handleGoToProfile = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  const handleSearch = (query: string, mode?: "$q" | "$autocomplete") => {
    searchActivities(query, mode || searchMode);
  };

  const handleClearSearch = () => {
    clearSearch();
  };

  const handleSearchModeChange = (mode: "$q" | "$autocomplete") => {
    if (searchQuery.trim()) {
      searchActivities(searchQuery, mode);
    }
  };

  const isSearchActive = searchQuery.trim().length > 0;

  const handleHashtagClick = (hashtag: string) => {
    navigate(`/feeds/hashtag/${hashtag}`);
  };

  return (
    <aside className="right-sidebar">
      <div className="right-sidebar-content">

        {/* Search Section */}
        <div className="sidebar-section search-section">
          <h3 className="section-title search-title">Search</h3>
          <div className="search-container">
            <SearchInput
              placeholder="Search activities..."
              value={searchQuery}
              searchMode={searchMode}
              isLoading={isLoading}
              onSearch={handleSearch}
              onClear={handleClearSearch}
              onSearchModeChange={handleSearchModeChange}
            />

            {/* Search Results Overlay */}
            {isSearchActive && (
              <div className="search-results-overlay">
                <SearchResults
                  activities={activities}
                  users={users}
                  searchQuery={searchQuery}
                  isLoading={isLoading}
                  error={error}
                  onClose={clearSearch}
                />
              </div>
            )}
          </div>
        </div>

        {/* Trending Section - Always rendered */}
        <div className="sidebar-section">
          <h3 className="section-title">Trending</h3>
          <div className="trending-list">
            {isLoadingHashtags ? (
              <div className="trending-loading">Loading...</div>
            ) : trendingHashtags.length === 0 ? (
              <div className="trending-empty">No hashtags yet</div>
            ) : (
              trendingHashtags.slice(0, 3).map((item, index) => (
                <div 
                  key={index} 
                  className="trending-item"
                  onClick={() => handleHashtagClick(item.hashtag)}
                >
                  <span className="hashtag">#{item.hashtag}</span>
                  <span className="post-count">{item.count} {item.count === 1 ? 'post' : 'posts'}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Suggested for you Section - Always rendered */}
        <div className="sidebar-section">
          <h3 className="section-title">Suggested for you</h3>
          <div className="users-list">
            {isLoadingWhoToFollow ? (
              <div className="user-item">
                <div className="loading-text">Loading...</div>
              </div>
            ) : whoToFollow.length === 0 ? (
              <span className="no-suggestions-text">No new suggestions!</span>
            ) : (
                  whoToFollow.slice(0,4).map((user, index) => {
                    const userImage = (user as any).data?.image || (user as any).profile?.image || (user as any).image;
                    return (
                      <div key={index} className="user-item" onClick={() => handleGoToProfile(user.id)}>
                        <div className="user-avatar">
                          <img 
                            src={userImage || generateAvatarUrl(user.id)} 
                            alt={user.name as string}
                            className="avatar-image"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = generateAvatarUrl(user.id);
                            }}
                          />
                        </div>
                        <div className="user-info">
                          <div className="user-name">{user.name}</div>
                          <UserActions targetUserId={user.id} />
                        </div>
                      </div>
                    );
                  })
            )}
          </div>
        </div>

      </div>
    </aside>
  );
};

export default RightSidebar;
