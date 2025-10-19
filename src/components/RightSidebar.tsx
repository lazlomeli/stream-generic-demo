import React from 'react';
import './RightSidebar.css';

interface RightSidebarProps {}

const RightSidebar: React.FC<RightSidebarProps> = () => {

  const suggestedUsers = [
    { name: 'Sarah Chen' },
    { name: 'Mike Yip' },
    { name: 'Alex Wang' },
    { name: 'Emma Rodriguez' },
    { name: 'James Kim' },
    { name: 'Lisa Park' }
  ];

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <aside className="right-sidebar">
      <div className="right-sidebar-content">

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
        
      </div>
    </aside>
  );
};

export default RightSidebar;
