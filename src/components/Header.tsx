import React, { useState, useEffect } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { useNavigate } from 'react-router-dom'
import SendIcon from '../icons/send.svg'
import HomeIcon from '../icons/home.svg'
import LogoutIcon from '../icons/logout-2.svg'
import StreamLogo from '../assets/stream-logo.png'
import CastIcon from '../icons/stream.svg'
import BookmarkIcon from '../icons/bookmark.svg'
import ResetIcon from '../icons/restore.svg'  
import { useResponsive } from '../contexts/ResponsiveContext'
import { useToast } from '../contexts/ToastContext'

interface HeaderProps {
  showNavigation?: boolean;
}

const Header: React.FC<HeaderProps> = ({ showNavigation = true }) => {
  const { isAuthenticated, user, logout, getAccessTokenSilently } = useAuth0()
  const navigate = useNavigate()
  const { isMobileView, toggleView } = useResponsive()
  const { showSuccess, showError } = useToast()
  const [isResetting, setIsResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showFinalConfirm, setShowFinalConfirm] = useState(false)

  // Cleanup body overflow on component unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFinalConfirm) {
          // Close both modals when escaping from final confirmation
          setShowFinalConfirm(false)
          setShowResetConfirm(false)
          document.body.style.overflow = 'unset'
        } else if (showResetConfirm) {
          setShowResetConfirm(false)
          document.body.style.overflow = 'unset'
        }
      }
    }
    
    if (showResetConfirm || showFinalConfirm) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [showResetConfirm, showFinalConfirm])


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

  const handleProfileClick = () => {
    if (user?.nickname) {
      navigate(`/profile/${user.nickname}`)
    }
  }

  const handleResetClick = () => {
    setShowResetConfirm(true)
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'
  }

  const handleFirstConfirm = () => {
    // Move from first confirmation to final confirmation
    setShowResetConfirm(false)
    setShowFinalConfirm(true)
  }

  const handleFinalConfirm = async () => {
    try {
      setIsResetting(true)
      setShowFinalConfirm(false)
      // Re-enable body scroll since modal is closing
      document.body.style.overflow = 'unset'

      const token = await getAccessTokenSilently()
      
      // Get user ID from Auth0 for the reset endpoint
      const userId = user?.nickname
      if (!userId) {
        throw new Error('User not authenticated')
      }
      
      // Reset both Chat and Feeds with unified endpoint
      const response = await fetch('/api/stream/reset', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Reset failed')
      }

      showSuccess('App reset and seeded successfully! Fresh sample data has been created.')
      // Refresh the page to show the new sample data
      window.location.reload()
    } catch (error) {
      console.error('Reset error:', error)
      showError(
        error instanceof Error ? error.message : 'Failed to reset app. Please try again.'
      )
    } finally {
      setIsResetting(false)
    }
  }

  const handleFinalCancel = () => {
    setShowFinalConfirm(false)
    setShowResetConfirm(false)
    // Re-enable body scroll since we're closing all modals
    document.body.style.overflow = 'unset'
  }

  const handleResetCancel = () => {
    setShowResetConfirm(false)
    // Re-enable body scroll
    document.body.style.overflow = 'unset'
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
              className="header-logo"
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
          
          {/* Center - Responsive Toggle Button and Reset */}
          <div className="header-center">
            <button
              onClick={toggleView}
              className="responsive-toggle-button"
              title={isMobileView ? 'Switch to Desktop View' : 'Switch to Mobile View'}
            >
              <span>{isMobileView ? 'Desktop' : 'Mobile'}</span>
            </button>
            
            {/* Reset Button */}
            {isAuthenticated && (
              <button
                onClick={handleResetClick}
                className="header-nav-button reset-button"
                title="Reset App (Clear all data and create fresh sample data)"
                disabled={isResetting}
              >
                <img src={ResetIcon} alt="Reset App" />
              </button>
            )}
          </div>
          
          {/* Right side - User info and logout */}
          <div className="header-right">
            {isAuthenticated && (
              <div className="user-section">
                <div 
                  className="user-info" 
                  onClick={handleProfileClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleProfileClick()
                    }
                  }}
                  title="View your profile"
                >
                  <div className="user-avatar">
                    <img 
                      src={user?.picture || `https://api.dicebear.com/7.x/${(() => {
                        const styles = ["avataaars", "bottts", "lorelei", "adventurer", "big-smile", "fun-emoji", "pixel-art", "thumbs"];
                        const seed = user?.nickname || user?.email || 'default';
                        const charCode = seed.charCodeAt(0);
                        const styleIndex = charCode % styles.length;
                        return styles[styleIndex];
                      })()}/svg?seed=${encodeURIComponent(user?.nickname || user?.email || 'default')}`}
                      alt={user?.name || user?.email || 'User'} 
                    />
                  </div>
                  <span className="user-name">
                    {user?.name || user?.email}
                  </span>
                </div>
                {/* Notification Bell - in header right */}
                {/* <NotificationBell className="header-nav-button" /> */}
                
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
      
      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div 
          className="reset-confirmation-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleResetCancel()
            }
          }}
        >
          <div className="reset-confirmation-dialog">
              <h3>Reset App</h3>
              <p>
                This will permanently delete all existing data and create fresh sample data:
                <br />
                • Clear all chat channels and messages
                <br />
                • Clear all activity feed posts
                <br />
                • Clear all user data and follows
                <br />
                • Create sample users, channels, and posts
                <br />
                <br />
                <strong>This action cannot be undone.</strong>
              </p>
            <div className="reset-confirmation-buttons">
              <button
                onClick={handleResetCancel}
                className="reset-cancel-button"
              >
                Cancel
              </button>
              <button
                onClick={handleFirstConfirm}
                className="reset-confirm-button"
                disabled={isResetting}
              >
                Yes, Reset & Seed App
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Final Confirmation Dialog */}
      {showFinalConfirm && (
        <div 
          className="reset-confirmation-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleFinalCancel()
            }
          }}
        >
          <div className="reset-confirmation-dialog">
            <h3>Are you sure?</h3>
            <p>
              This action will permanently delete all your data and cannot be undone.
              <br />
              <br />
              <strong>Do you really want to proceed with the reset?</strong>
            </p>
            <div className="reset-confirmation-buttons">
              <button
                onClick={handleFinalCancel}
                className="reset-cancel-button"
              >
                No
              </button>
              <button
                onClick={handleFinalConfirm}
                className="reset-confirm-button"
                disabled={isResetting}
              >
                {isResetting ? 'Resetting...' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Loading Overlay */}
      {isResetting && (
        <div className="reset-loading-overlay">
          <div className="reset-loading-dialog">
            <div className="reset-loading-spinner">
              <div className="spinner"></div>
            </div>
            <h3>Resetting & seeding app...</h3>
            <p>Please wait while we clear all data and create fresh sample content.</p>
            <div className="reset-loading-progress">
              <div className="progress-bar">
                <div className="progress-bar-fill"></div>
              </div>
            </div>
          </div>
        </div>
      )}

    </header>
  )
}

export default Header
