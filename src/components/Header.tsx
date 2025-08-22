import React from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { useNavigate } from 'react-router-dom'
import SendIcon from '../icons/send.svg'
import HomeIcon from '../icons/home.svg'
import LogoutIcon from '../icons/logout-2.svg'
import StreamLogo from '../assets/stream-logo.png'

interface HeaderProps {}

const Header: React.FC<HeaderProps> = () => {
  const { isAuthenticated, user, logout } = useAuth0()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } })
  }

  const handleHomeClick = () => {
    navigate('/')
  }

  const handleChatClick = () => {
    navigate('/chat')
  }

  const handleFeedsClick = () => {
    navigate('/feeds')
  }

  const handleLoginClick = () => {
    navigate('/login')
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
                {/* <img src={HomeIcon} alt="Home" /> */}
                <img src={StreamLogo} alt="Stream Logo" />
              </button>

              {/* Feeds icon - only when authenticated */}
              {isAuthenticated && (
                <button
                  onClick={handleFeedsClick}
                  className="header-nav-button"
                  title="Activity Feeds"
                >
                  <img src={HomeIcon} alt="Feeds" />
                </button>
              )}
            </div>

              {/* Chat icon - only when authenticated */}
              {isAuthenticated && (
                <button
                  onClick={handleChatClick}
                  className="header-nav-button"
                  title="Stream Chat"
                >
                  <img src={SendIcon} alt="Chat" />
                </button>
              )}
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
                  onClick={handleLoginClick}
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
