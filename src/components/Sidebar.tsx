import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import HomeIcon from '../icons/home.svg';
import SendIcon from '../icons/send.svg';
import CastIcon from '../icons/cast.svg';
import BookmarkIcon from '../icons/bookmark.svg';
import NotificationIcon from '../icons/bell.svg';
import { useNotifications } from '../hooks/feeds/useNotifications';
import './Sidebar.css';
import '../pages/Notifications.css';

interface SidebarProps {}

const Sidebar: React.FC<SidebarProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useNotifications();

  const handleFeedsClick = () => {
    navigate('/feeds');
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
          className={`sidebar-button ${isActive('/feeds') ? 'active' : ''}`}
          title="Activity Feeds"
        >
          <img src={HomeIcon} alt="Feed" className="sidebar-icon" />
          <span className="sidebar-label">Feed</span>
        </button>

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
