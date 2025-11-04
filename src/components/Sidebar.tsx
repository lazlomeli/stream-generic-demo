import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import HomeIcon from '../icons/home.svg';
import SendIcon from '../icons/send.svg';
import CastIcon from '../icons/stream.svg';
import BookmarkIcon from '../icons/bookmark.svg';
import NotificationIcon from '../icons/bell.svg';
import TrendingIcon from '../icons/trending-up.svg';
// import ExploreIcon from '../icons/search.svg';
import ForyouIcon from '../icons/foryou.svg';
import FollowingIcon from '../icons/user-heart.svg';
import { useNotifications } from '../hooks/feeds/useNotifications';
import './Sidebar.css';
import '../pages/Notifications.css';

interface SidebarProps {}

const Sidebar: React.FC<SidebarProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useNotifications();
  const [isFeedExpanded, setIsFeedExpanded] = useState(false);

  const isFeedPath = location.pathname.startsWith('/feeds');

  useEffect(() => {
    if (isFeedPath) {
      setIsFeedExpanded(true);
    } else {
      setIsFeedExpanded(false);
    }
  }, [isFeedPath]);

  const handleFeedsClick = () => {
    if (isFeedPath) {
      setIsFeedExpanded(!isFeedExpanded);
    } else {
      setIsFeedExpanded(true);
      navigate('/feeds');
    }
  };

  const handleChatClick = () => {
    navigate('/chat');
  };

  const handleVideoClick = () => {
    navigate('/video');
  };

  const handleBookmarkedClick = () => {
    navigate('/bookmarked');
  };

  const handleNotificationsClick = () => {
    navigate('/notifications');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Menu</h2>
      </div>
      <nav className="sidebar-nav">
        <button
          onClick={handleFeedsClick}
          className={`sidebar-button ${isFeedPath ? 'active' : ''}`}
          title="Activity Feeds"
        >
          <img src={HomeIcon} alt="Feed" className="sidebar-icon" />
          <span className="sidebar-label">Feed</span>
        </button>

        <div className={`sidebar-submenu ${isFeedExpanded ? 'expanded' : 'collapsed'}`}>
          <button
            onClick={() => navigate('/feeds/trending')}
            className={`sidebar-button sidebar-submenu-button ${isActive('/feeds/trending') ? 'active' : ''}`}
            title="Trending"
          >
            <img src={TrendingIcon} alt="Trending" className="sidebar-icon" />
            <span className="sidebar-label">Trending</span>
          </button>
          <button
            onClick={() => navigate('/feeds/following')}
            className={`sidebar-button sidebar-submenu-button ${isActive('/feeds/following') ? 'active' : ''}`}
            title="Following"
          >
            <img src={FollowingIcon} alt="Following" className="sidebar-icon" />
            <span className="sidebar-label">Following</span>
          </button>
          <button
            onClick={() => navigate('/feeds/for-you')}
            className={`sidebar-button sidebar-submenu-button ${isActive('/feeds/for-you') ? 'active' : ''}`}
            title="For You"
          >
            <img src={ForyouIcon} alt="For You" className="sidebar-icon" />
            <span className="sidebar-label">For You</span>
          </button>
        </div>

        <button
          onClick={handleChatClick}
          className={`sidebar-button ${isActive('/chat') ? 'active' : ''}`}
          title="Stream Chat"
        >
          <img src={SendIcon} alt="Chat" className="sidebar-icon" />
          <span className="sidebar-label">Chat</span>
        </button>

        <button
          onClick={handleVideoClick}
          className={`sidebar-button ${isActive('/video') ? 'active' : ''}`}
          title="Livestream"
        >
          <img src={CastIcon} alt="Livestream" className="sidebar-icon" />
          <span className="sidebar-label">Livestream</span>
        </button>

        <button
          onClick={handleBookmarkedClick}
          className={`sidebar-button ${isActive('/bookmarked') ? 'active' : ''}`}
          title="Bookmarked Posts"
        >
          <img src={BookmarkIcon} alt="Bookmarked" className="sidebar-icon" />
          <span className="sidebar-label">Bookmarked</span>
        </button>

        <button
          onClick={handleNotificationsClick}
          className={`sidebar-button ${isActive('/notifications') ? 'active' : ''}`}
          title="Notifications"
        >
          <div className="notification-icon-wrapper">
            <img src={NotificationIcon} alt="Notifications" className="sidebar-icon" />
            {unreadCount > 0 && (
              <div className="notification-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </div>
            )}
          </div>
          <span className="sidebar-label">Notifications</span>
        </button>
      </nav>
    </aside>
  );
};

export default Sidebar;
