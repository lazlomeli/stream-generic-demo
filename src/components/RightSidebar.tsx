import React from 'react';
import './RightSidebar.css';

interface RightSidebarProps {}

const RightSidebar: React.FC<RightSidebarProps> = () => {
  const trendingHashtags = [
    { tag: '#StreamChat', posts: '1.8k posts' },
    { tag: '#StreamFeeds', posts: '743 posts' },
    { tag: '#StreamVideo', posts: '987 posts' }
  ];

  const suggestedUsers = [
    { name: 'Sarah Chen' },
    { name: 'Mike Yip' },
    { name: 'Alex Wang' }
  ];

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <aside className="right-sidebar">
      <div className="right-sidebar-content">
        {/* Trending Hashtags Section */}
        <div className="sidebar-section">
          <h3 className="section-title">Trending</h3>
          <div className="trending-list">
            {trendingHashtags.map((item, index) => (
              <div key={index} className="trending-item">
                <span className="hashtag">{item.tag}</span>
                <span className="post-count">{item.posts}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Suggested Users Section */}
        <div className="sidebar-section">
          <h3 className="section-title">Suggested for you</h3>
          <div className="users-list">
            {suggestedUsers.map((user, index) => (
              <div key={index} className="user-item">
                <div className="user-avatar">
                  <span className="avatar-initials">{getInitials(user.name)}</span>
                </div>
                <div className="user-info">
                  <div className="user-name">{user.name}</div>
                </div>
                <button className="follow-suggestion-btn">Follow</button>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats Section */}
        <div className="sidebar-section">
          <h3 className="section-title">Today's Stats</h3>
          <div className="stats-list">
            <div className="stat-item">
              <span className="stat-label">New Posts</span>
              <span className="stat-value">247</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Active Users</span>
              <span className="stat-value">1.2M</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Interactions</span>
              <span className="stat-value">5.8k</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default RightSidebar;
