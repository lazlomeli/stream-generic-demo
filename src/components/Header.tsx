import React from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import SendIcon from '../icons/send.svg'
import HomeIcon from '../icons/home.svg'
import LogoutIcon from '../icons/logout-2.svg'

interface HeaderProps {
  onChatClick: () => void
  onHomeClick?: () => void
}

const Header: React.FC<HeaderProps> = ({ onChatClick, onHomeClick }) => {
  const { isAuthenticated, user, logout } = useAuth0()

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } })
  }

  const handleHomeClick = () => {
    if (onHomeClick) {
      onHomeClick()
    } else {
      // Fallback to regular navigation if no onHomeClick provided
      window.location.href = '/'
    }
  }

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          
          {/* Left side - Navigation icons */}
          <div className="header-left">
            <div className="header-icons">
              {/* Home icon - always visible */}
              <button
                onClick={handleHomeClick}
                className="header-nav-button"
                title="Home"
              >
                <img src={HomeIcon} alt="Home" />
              </button>
              
              {/* Chat icon - only when authenticated */}
              {isAuthenticated && (
                <button
                  onClick={onChatClick}
                  className="header-nav-button"
                  title="Stream Chat"
                >
                  <img src={SendIcon} alt="Chat" />
                </button>
              )}
            </div>
          </div>
          
          {/* Right side - User info and logout */}
          <div className="header-right">
            {isAuthenticated ? (
              <div className="user-section">
                <div className="user-info">
                  <div className="user-avatar">
                    <span>
                      {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <span className="user-name">
                    {user?.name || user?.email}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="header-logout-button"
                  title="Sign out"
                >
                  <img src={LogoutIcon} alt="Sign out" />
                </button>
              </div>
            ) : (
              <div className="auth-section">
                <button
                  onClick={() => window.location.href = '/login'}
                  className="header-auth-button"
                >
                  Get started
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
