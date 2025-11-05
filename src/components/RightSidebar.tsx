import React, { useState } from 'react';
import './RightSidebar.css';
import { useFollowSuggestions } from '../hooks/feeds/useFollowSuggestions';
import { useNavigate } from 'react-router-dom';
import { UserActions } from './UserActions';
import { generateAvatarUrl } from '../utils/avatarUtils';


interface RightSidebarProps {}

const RightSidebar: React.FC<RightSidebarProps> = () => {

  const navigate = useNavigate();
  const { whoToFollow, isLoading: isLoadingWhoToFollow } = useFollowSuggestions();
  const [searchQuery, setSearchQuery] = useState('');

  const handleGoToProfile = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  // Fake trending hashtags data
  const trendingHashtags = [
    { hashtag: '#basketball', postCount: '1.3k' },
    { hashtag: '#technology', postCount: '2.1k' },
    { hashtag: '#travel', postCount: '987' },
    { hashtag: '#photography', postCount: '1.5k' },
    { hashtag: '#coding', postCount: '3.2k' },
  ];

  return (
    <aside className="right-sidebar">
      <div className="right-sidebar-content">

        {/* Search Section */}
        <div className="sidebar-section">
          <h3 className="section-title search-title">Search</h3>
          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Trending Section */}
        <div className="sidebar-section">
          <h3 className="section-title">Trending</h3>
          <div className="trending-list">
            {trendingHashtags.map((item, index) => (
              <div key={index} className="trending-item">
                <span className="hashtag">{item.hashtag}</span>
                <span className="post-count">{item.postCount} posts</span>
              </div>
            ))}
          </div>
        </div>

        {/* Suggested for you Section */}
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
              whoToFollow.map((user, index) => (
                <div key={index} className="user-item" onClick={() => handleGoToProfile(user.id)}>
                  <div className="user-avatar">
                    <img 
                      src={generateAvatarUrl(user.id)} 
                      alt={user.name as string}
                      className="avatar-image"
                    />
                  </div>
                  <div className="user-info">
                    <div className="user-name">{user.name}</div>
                    <UserActions targetUserId={user.id} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </aside>
  );
};

export default RightSidebar;
