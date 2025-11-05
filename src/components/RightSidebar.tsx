import React from 'react';
import './RightSidebar.css';
import { useFollowSuggestions } from '../hooks/feeds/useFollowSuggestions';
import { useNavigate } from 'react-router-dom';
import { UserActions } from './UserActions';
import { generateAvatarUrl } from '../utils/avatarUtils';


interface RightSidebarProps {}

const RightSidebar: React.FC<RightSidebarProps> = () => {

  const navigate = useNavigate();
  const { whoToFollow, isLoading: isLoadingWhoToFollow } = useFollowSuggestions();

  const handleGoToProfile = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  return (
    <aside className="right-sidebar">
      <div className="right-sidebar-content">

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
