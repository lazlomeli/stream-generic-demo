import React from 'react';
import './RightSidebar.css';
import { useFollowSuggestions } from '../hooks/feeds/useFollowSuggestions';
import { useNavigate } from 'react-router-dom';
import { UserActions } from './UserActions';


interface RightSidebarProps {}

const RightSidebar: React.FC<RightSidebarProps> = () => {

  const navigate = useNavigate();
  const { whoToFollow, isLoading: isLoadingWhoToFollow } = useFollowSuggestions();
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handleGoToProfile = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  console.log('whoToFollow', whoToFollow);
  console.log('isLoadingWhoToFollow', isLoadingWhoToFollow);

  return (
    <aside className="right-sidebar">
      <div className="right-sidebar-content">

        {/* Suggested Users Section */}
        <div className="sidebar-section">
          <h3 className="section-title">Suggested for you</h3>
          <div className="users-list">
            {isLoadingWhoToFollow ? (
              <div className="user-item">
                <div className="user-avatar">
                  <span className="avatar-initials">Loading...</span>
                </div>
              </div>
            ) : whoToFollow.length === 0 ? (
              
                <span className="no-suggestions-text">No new suggestions!</span>
              
            ) : (
              whoToFollow.map((user, index) => (
                <div key={index} className="user-item" onClick={() => handleGoToProfile(user.id)}>
                  <div className="user-avatar">
                    <span className="avatar-initials">{getInitials(user.name as string)}</span>
                  </div>
                  <div className="user-info">
                    <div className="user-name">{user.name}</div>
                    {/* Follow button */}
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
