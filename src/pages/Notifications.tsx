import React, { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate, useLocation } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import MobileBottomNav from '../components/MobileBottomNav';
import { getSanitizedUserId } from '../utils/userUtils';
import { formatRelativeTime } from '../utils/timeUtils';
import { useToast } from '../contexts/ToastContext';
import { useResponsive } from '../contexts/ResponsiveContext';
import HeartFilledIcon from '../icons/heart-filled.svg';
import MessageIcon from '../icons/message-circle.svg';
import UserIcon from '../icons/user.svg';
import './Notifications.css';

interface NotificationActivity {
  id: string;
  actor: string;
  verb: string;
  object: string;
  target?: string;
  text?: string;
  created_at: string;
  time: string;
  custom?: {
    notification_type: 'like' | 'comment' | 'follow';
    target_user: string;
    post_id?: string;
    comment_text?: string;
    aggregated_count?: number;
    actor_names?: string[];
    actor_name?: string;
    actor_image?: string;
  };
  userInfo?: {
    name: string;
    image?: string;
    role?: string;
  };
}

// Helper function to generate user initials
const getUserInitials = (name: string): string => {
  if (!name) return 'U';
  
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';
};

const Notifications = () => {
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useToast();
  const { isMobileView, toggleView } = useResponsive();
  const [notifications, setNotifications] = useState<NotificationActivity[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchNotifications();
      const cleanup = setupRealTimeNotifications();
      
      return cleanup; // Return the cleanup function from setupRealTimeNotifications
    }
  }, [isAuthenticated, user]);

  const markNotificationsAsRead = async (notificationIds: string[]) => {
    if (!user || notificationIds.length === 0) return;

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
          action: 'mark_read',
          userId: sanitizedUserId,
          notificationIds
        }),
      });

      if (response.ok) {
        console.log(`✅ Marked ${notificationIds.length} notifications as read`);
        
        // Trigger a custom event to refresh the notification bell count
        window.dispatchEvent(new CustomEvent('notificationsMarkedAsRead'));
      } else {
        console.error('Failed to mark notifications as read');
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const setupRealTimeNotifications = () => {
    // Set up periodic refresh for the notifications page
    const interval = setInterval(() => {
      console.log('🔔 Refreshing notifications...');
      fetchNotifications();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  };

  const fetchNotifications = async () => {
    if (!user) return;

    setIsLoadingNotifications(true);
    setError(null);

    try {
      const accessToken = await getAccessTokenSilently();
      const sanitizedUserId = getSanitizedUserId(user);

      console.log('🔔 Fetching notifications for user:', sanitizedUserId);

      const response = await fetch('/api/stream/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'get_notifications',
          userId: sanitizedUserId
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch notifications: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Fetched ${result.notifications.length} notifications`);
        const fetchedNotifications = result.notifications || [];
        setNotifications(fetchedNotifications);
        
        // Mark all notifications as read when user views the notifications page
        if (fetchedNotifications.length > 0) {
          const notificationIds = fetchedNotifications.map((n: any) => n.id);
          await markNotificationsAsRead(notificationIds);
        }
      } else {
        throw new Error(result.error || 'Failed to fetch notifications');
      }
    } catch (err: any) {
      console.error('❌ Error fetching notifications:', err);
      setError(err.message || 'Failed to fetch notifications');
      showError('Failed to load notifications. Please try again.');
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  const handleNotificationClick = (notification: NotificationActivity) => {
    // Navigate to the post if it's a like or comment notification
    if (notification.custom?.post_id && (notification.custom?.notification_type === 'like' || notification.custom?.notification_type === 'comment')) {
      navigate(`/?highlight=${notification.custom.post_id}`);
    } else if (notification.custom?.notification_type === 'follow') {
      // Navigate to the user's profile who followed
      navigate(`/profile/${notification.actor}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <img src={HeartFilledIcon} alt="Like" className="notification-icon like" />;
      case 'comment':
        return <img src={MessageIcon} alt="Comment" className="notification-icon comment" />;
      case 'follow':
        return <img src={UserIcon} alt="Follow" className="notification-icon follow" />;
      default:
        return <img src={UserIcon} alt="Notification" className="notification-icon default" />;
    }
  };

  const getNotificationText = (notification: NotificationActivity) => {
    const actorName = notification.custom?.actor_name || notification.userInfo?.name || notification.actor;
    const type = notification.custom?.notification_type;
    
    switch (type) {
      case 'like':
        return `${actorName} liked your post`;
      case 'comment':
        return `${actorName} commented on your post`;
      case 'follow':
        return `${actorName} followed you`;
      default:
        return notification.text || `${actorName} interacted with your content`;
    }
  };

  // Show loading state
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Show error state
  if (error) {
    return (
      <div className="notifications-error">
        <h2>Error Loading Notifications</h2>
        <p>{error}</p>
        <button onClick={fetchNotifications}>Retry</button>
      </div>
    );
  }

  const notificationsContent = (
    <div className="notifications-container">
      <div className="notifications-header">
        <h1>Notifications</h1>
        <p className="notifications-subtitle">Stay updated on your social activity</p>
      </div>

      {isLoadingNotifications ? (
        <div className="notifications-loading">
          <LoadingSpinner />
          <p>Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="notifications-empty">
          <div className="empty-state">
            <img src={UserIcon} alt="No notifications" className="empty-icon" />
            <h3>No notifications yet</h3>
            <p>When someone likes, comments, or follows you, you'll see it here.</p>
          </div>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => (
            <div 
              key={notification.id} 
              className="notification-item"
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="notification-avatar">
                {notification.custom?.actor_image || notification.userInfo?.image ? (
                  <img 
                    src={notification.custom?.actor_image || notification.userInfo?.image}
                    alt={notification.custom?.actor_name || notification.userInfo?.name || notification.actor}
                    className="avatar-image"
                  />
                ) : (
                  <div className="avatar-fallback">
                    {getUserInitials(notification.custom?.actor_name || notification.userInfo?.name || notification.actor)}
                  </div>
                )}
                <div className="notification-type-badge">
                  {getNotificationIcon(notification.custom?.notification_type || 'default')}
                </div>
              </div>
              
              <div className="notification-content">
                <div className="notification-text">
                  {getNotificationText(notification)}
                </div>
                
                {notification.custom?.comment_text && (
                  <div className="notification-preview">
                    "{notification.custom.comment_text}"
                  </div>
                )}
                
                <div className="notification-time">
                  {formatRelativeTime(notification.created_at || notification.time)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Mobile view wrapper
  if (isMobileView) {
    return (
      <div className="notifications-page mobile-view">
        <div className="notifications-content mobile-content">
          {notificationsContent}
          <MobileBottomNav currentPath={location.pathname} />
        </div>
        <div className="iphone-overlay" />
        <button 
          className="desktop-toggle-button"
          onClick={toggleView}
          title="Switch to Desktop View"
        >
          Desktop
        </button>
      </div>
    );
  }

  // Desktop view
  return <div className="notifications-page">{notificationsContent}</div>;
};

export default Notifications;
