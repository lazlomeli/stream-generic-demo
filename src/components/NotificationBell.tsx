import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { getSanitizedUserId } from '../utils/userUtils';
import './NotificationBell.css';

// Simple bell icon as SVG component
const BellIcon = () => (
  <svg 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className="bell-icon"
  >
    <path 
      d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M13.73 21a2 2 0 0 1-3.46 0" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

interface NotificationBellProps {
  className?: string;
  showClickHandler?: boolean;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ className = '', showClickHandler = true }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      initializeNotifications();
      
      // Set up simple polling every 30 seconds for reliability
      const interval = setInterval(fetchUnreadCount, 30000);
      
      // Listen for notifications marked as read event
      const handleNotificationsMarkedAsRead = () => {
        console.log('🔔 Notifications marked as read, refreshing badge count...');
        fetchUnreadCount();
      };
      
      window.addEventListener('notificationsMarkedAsRead', handleNotificationsMarkedAsRead);
      
      // Return cleanup function
      return () => {
        clearInterval(interval);
        window.removeEventListener('notificationsMarkedAsRead', handleNotificationsMarkedAsRead);
      };
    }
  }, [isAuthenticated, user]);

  const initializeNotifications = async () => {
    try {
      // Fetch initial unread count
      await fetchUnreadCount();
    } catch (error) {
      console.error('❌ Failed to initialize notifications:', error);
    }
  };

  const fetchUnreadCount = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const accessToken = await getAccessTokenSilently();
      const sanitizedUserId = getSanitizedUserId(user);

      const response = await fetch('/api/stream/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'get_unread_count',
          userId: sanitizedUserId
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setUnreadCount(result.unreadCount || 0);
        }
      } else {
        console.error('Failed to fetch unread notification count');
      }
    } catch (error) {
      console.error('Error fetching unread notification count:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBellClick = () => {
    navigate('/notifications');
  };

  if (!isAuthenticated) {
    return null;
  }

  if (showClickHandler) {
    return (
      <button 
        className={`notification-bell ${className}`}
        onClick={handleBellClick}
        title="Notifications"
        disabled={isLoading}
      >
        <div className="bell-container">
          <BellIcon />
          {unreadCount > 0 && (
            <span className="notification-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        {isLoading && <div className="bell-loading"></div>}
      </button>
    );
  }

  // When used in sidebar, render just the bell content without button wrapper
  return (
    <div className={`notification-bell ${className}`}>
      <div className="bell-container">
        <BellIcon />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </div>
      {isLoading && <div className="bell-loading"></div>}
    </div>
  );
};

export default NotificationBell;
