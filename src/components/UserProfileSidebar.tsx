import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../hooks/feeds/useUser';
import { useProfileStats } from '../hooks/feeds/useProfileStats';
import { generateAvatarUrl } from '../utils/avatarUtils';
import './UserProfileSidebar.css';

const UserProfileSidebar: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [imageError, setImageError] = useState(false);
  
  const userId = user?.nickname || '';
  const { followers, following } = useProfileStats(userId);

  const handleProfileClick = () => {
    if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  if (!user) {
    return null;
  }

  // Use user's actual picture if available, otherwise use fallback
  const avatarSrc = (user.picture && !imageError) ? user.picture : generateAvatarUrl(userId);

  return (
    <aside className="user-profile-sidebar">
      <div className="user-profile-header">
        <h2 className="user-profile-title">Profile</h2>
      </div>
      <div className="user-profile-content">
        <div className="user-profile-avatar">
          <img 
            src={avatarSrc}
            alt={user.name || user.email || 'User'}
            className="profile-avatar-image"
            onError={handleImageError}
          />
        </div>
        <button 
          onClick={handleProfileClick}
          className="user-profile-name"
          title="View your profile"
        >
          {user.name || user.email}
        </button>
        <div className="user-profile-stats">
          <div className="profile-stat">
            <span className="stat-value">{followers.length}</span>
            <span className="stat-label">Followers</span>
          </div>
          <div className="profile-stat-divider"></div>
          <div className="profile-stat">
            <span className="stat-value">{following.length}</span>
            <span className="stat-label">Following</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default UserProfileSidebar;

