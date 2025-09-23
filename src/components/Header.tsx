import React from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { useNavigate } from 'react-router-dom'
import SendIcon from '../icons/send.svg'
import HomeIcon from '../icons/home.svg'
import LogoutIcon from '../icons/logout-2.svg'
import StreamLogo from '../assets/stream-logo.png'
import CastIcon from '../icons/cast.svg'
import BookmarkIcon from '../icons/bookmark.svg'
import DeviceDesktopIcon from '../icons/device-desktop.svg'
import PhoneIcon from '../icons/phone.svg'
import { useResponsive } from '../contexts/ResponsiveContext'

interface HeaderProps {
  showNavigation?: boolean;
}

const Header: React.FC<HeaderProps> = ({ showNavigation = true }) => {
  const { isAuthenticated, user, logout } = useAuth0()
  const navigate = useNavigate()
  const { isMobileView, toggleView } = useResponsive()

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

  const handleVideoClick = () => {
    navigate('/video')
  }

  const handleBookmarkedClick = () => {
    navigate('/bookmarked')
  }

  const handleLoginClick = () => {
    navigate('/login')
  }

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          
          {/* Left side - Logo and conditionally Navigation icons */}
          <div className="header-left">
            {/* Stream Logo - always visible */}
            <button
              onClick={handleHomeClick}
              className="header-nav-button header-logo"
              title="Home"
            >
              <img src={StreamLogo} alt="Stream Logo" />
            </button>

            {/* Navigation icons - only when showNavigation is true */}
            {showNavigation && (
              <div className="header-icons">
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

                {isAuthenticated && (
                  <button
                    onClick={handleVideoClick}
                    className="header-nav-button"
                    title="Livestream"
                  >
                    <img src={CastIcon} alt="Livestream" />
                  </button>
                )}
                
                {isAuthenticated && (
                  <button
                    onClick={handleBookmarkedClick}
                    className="header-nav-button"
                    title="Bookmarked Posts"
                  >
                    <img src={BookmarkIcon} alt="Bookmarked Posts" />
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Center - Responsive Toggle Button */}
          <div className="header-center">
            <button
              onClick={toggleView}
              className="responsive-toggle-button"
              title={isMobileView ? 'Switch to Desktop View' : 'Switch to Mobile View'}
            >
              <span>{isMobileView ? 'Desktop' : 'Mobile'}</span>
            </button>
          </div>
          
          {/* Right side - User info and logout */}
          <div className="header-right">
            {isAuthenticated && (
              <div className="user-section">
                <div className="user-info">
                  <div className="user-avatar">
                    {user?.picture ? (
                      <img src={user.picture} alt={user.name || user.email || 'User'} />
                    ) : (
                      <span>
                        {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                      </span>
                    )}
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
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
