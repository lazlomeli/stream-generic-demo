import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import HomeIcon from '../icons/home.svg';
import SendIcon from '../icons/send.svg';
import VideoIcon from '../icons/video.svg';
import BookmarkIcon from '../icons/bookmark.svg';
import './Sidebar.css';

interface SidebarProps {}

const Sidebar: React.FC<SidebarProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleFeedsClick = () => {
    navigate('/feeds');
  };

  const handleChatClick = () => {
    navigate('/chat');
  };

  const handleVideoClick = () => {
    // Navigate to video page when implemented
  };

  const handleBookmarkedClick = () => {
    navigate('/bookmarked');
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
          className="sidebar-button"
          title="Stream Video (Coming Soon)"
        >
          <img src={VideoIcon} alt="Video" className="sidebar-icon" />
          <span className="sidebar-label">Video</span>
        </button>

        <button
          onClick={handleBookmarkedClick}
          className={`sidebar-button ${isActive('/bookmarked') ? 'active' : ''}`}
          title="Bookmarked Posts"
        >
          <img src={BookmarkIcon} alt="Bookmarked" className="sidebar-icon" />
          <span className="sidebar-label">Bookmarked</span>
        </button>
      </nav>
    </aside>
  );
};

export default Sidebar;
