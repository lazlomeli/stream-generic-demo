import React from 'react'
import { useNavigate } from 'react-router-dom'
import SendIcon from '../icons/send.svg'
import HomeIcon from '../icons/home.svg'
import CastIcon from '../icons/stream.svg'
import BookmarkIcon from '../icons/bookmark.svg'
import BellIcon from '../icons/bell.svg'

interface MobileBottomNavProps {
  currentPath: string
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentPath }) => {
  const navigate = useNavigate()

  const handleFeedsClick = () => {
    navigate('/feeds')
  }

  const handleChatClick = () => {
    navigate('/chat')
  }

  const handleVideoClick = () => {
    navigate('/video')
  }

  const handleBookmarkedClick = () => {
    navigate('/bookmarked')
  }

  const handleNotificationsClick = () => {
    navigate('/notifications')
  }

  const navItems = [
    {
      icon: HomeIcon,
      label: 'Feeds',
      path: '/feeds',
      onClick: handleFeedsClick
    },
    {
      icon: SendIcon,
      label: 'Chat',
      path: '/chat',
      onClick: handleChatClick
    },
    {
      icon: CastIcon,
      label: 'Live',
      path: '/video',
      onClick: handleVideoClick
    },
    {
      icon: BookmarkIcon,
      label: 'Saved',
      path: '/bookmarked',
      onClick: handleBookmarkedClick
    }
  ]

  return (
    <div className="mobile-bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.path}
          onClick={item.onClick}
          className={`mobile-nav-item ${currentPath.startsWith(item.path) ? 'active' : ''}`}
          title={item.label}
        >
          <img src={item.icon} alt={item.label} />
          <span>{item.label}</span>
        </button>
      ))}
      
      <button
        onClick={handleNotificationsClick}
        className={`mobile-nav-item ${currentPath === '/notifications' ? 'active' : ''}`}
        title="Alerts"
      >
        <img src={BellIcon} alt="Alerts" />
        <span>Alerts</span>
      </button>
    </div>
  )
}

export default MobileBottomNav
