import React, { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate, useLocation } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import MobileBottomNav from '../components/MobileBottomNav';
import { getSanitizedUserId } from '../utils/userUtils';
import { formatRelativeTime } from '../utils/timeUtils';
import { useToast } from '../contexts/ToastContext';
import { useResponsive } from '../contexts/ResponsiveContext';
import BookmarkIcon from '../icons/bookmark.svg';
import BookmarkFilledIcon from '../icons/bookmark-filled.svg';
import '../components/Feeds.css';

// User mapping for demo users (same as Feeds component)
const DEMO_USERS = {
  'alice_smith': {
    name: 'Alice Smith',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face',
    role: 'Frontend Developer',
    company: 'Stream'
  },
  'bob_johnson': {
    name: 'Bob Johnson',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    role: 'Backend Engineer',
    company: 'TechCorp'
  },
  'carol_williams': {
    name: 'Carol Williams',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    role: 'Product Designer',
    company: 'Design Studio'
  },
  'david_brown': {
    name: 'David Brown',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    role: 'DevRel Engineer',
    company: 'Stream'
  },
  'emma_davis': {
    name: 'Emma Davis',
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
    role: 'Full-stack Developer',
    company: 'StartupCo'
  }
};

// Helper function to get user display name (same as Feeds component)
const getUserDisplayName = (actorId: string, currentUser: any, userInfo?: any, userProfile?: any) => {
  // If this is the current user, use their Auth0 profile
  if (actorId === currentUser?.sub || actorId === getSanitizedUserId(currentUser)) {
    return currentUser?.name || currentUser?.email || 'You';
  }
  
  // First priority: Use stored userProfile data from the post (most accurate)
  if (userProfile?.name && userProfile.name !== actorId) {
    return userProfile.name;
  }
  
  // Second priority: Use userInfo from backend enrichment
  if (userInfo?.name && userInfo.name !== actorId) {
    return userInfo.name;
  }
  
  // Fallback to demo users mapping
  const demoUser = DEMO_USERS[actorId as keyof typeof DEMO_USERS];
  if (demoUser) {
    return demoUser.name;
  }
  
  // Last resort: format the actor ID to be more readable
  // Handle Auth0-style IDs like "Google-Oauth2 113714394737973100008"
  if (actorId.includes('|') || actorId.includes('oauth2') || actorId.includes('google')) {
    // Extract provider and ID parts
    const parts = actorId.split(/[|_]/);
    if (parts.length >= 2) {
      const provider = parts[0].replace(/([A-Z])/g, ' $1').trim(); // "Google Oauth2"
      return `${provider} User`;
    }
  }
  
  return actorId.replace(/[^a-zA-Z0-9@_-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()).trim() || 'Unknown User';
};

// Helper function to get user profile image (same as Feeds component)
const getUserProfileImage = (actorId: string, currentUser: any, userInfo?: any, userProfile?: any) => {
  // If this is the current user, use their Auth0 profile picture
  if (actorId === currentUser?.sub || actorId === getSanitizedUserId(currentUser)) {
    return currentUser?.picture || undefined;
  }
  
  // First priority: Use stored userProfile data from the post (most accurate)
  if (userProfile?.image) {
    return userProfile.image;
  }
  
  // Second priority: Use userInfo from backend enrichment
  if (userInfo?.image) {
    return userInfo.image;
  }
  
  // Fallback to demo users mapping
  const demoUser = DEMO_USERS[actorId as keyof typeof DEMO_USERS];
  if (demoUser) {
    return demoUser.image;
  }
  
  return undefined;
};

interface BookmarkedPost {
  id: string;
  actor: string;
  text: string;
  attachments?: Array<{
    type: string;
    asset_url: string;
    mime_type: string;
    title: string;
  }>;
  custom?: {
    likes: number;
    shares: number;
    comments: number;
    category: string;
  };
  reaction_counts?: {
    like?: number;
    comment?: number;
    share?: number;
  };
  own_reactions?: {
    like?: any[];
    comment?: any[];
    share?: any[];
  };
  created_at?: string;
  time?: string;
  activity_id: string; // The original post ID to navigate back to
  reaction_id?: string; // The bookmark reaction ID for removal
  bookmarked_at?: string; // When user bookmarked this post
  // Add user info fields
  userInfo?: {
    name: string;
    image: string;
    role?: string;
    company?: string;
  };
  isCurrentUser?: boolean; // Added for frontend display
  isOwnPost?: boolean; // Added for frontend display
  // Add userProfile field for stored Auth0 profile data
  userProfile?: {
    name: string;
    image?: string;
    role?: string;
    company?: string;
    given_name?: string;
    family_name?: string;
    nickname?: string;
    email?: string;
    sub?: string;
  };
}

const BookmarkedPosts = () => {
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useToast();
  const { isMobileView, toggleView } = useResponsive();
  const [bookmarkedPosts, setBookmarkedPosts] = useState<BookmarkedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedsClient, setFeedsClient] = useState<any>(null);

  useEffect(() => {
    const initFeedsClient = async () => {
      if (!user || !isAuthenticated) return;

      try {
        setError(null);
        
        // Get Auth0 access token for backend authentication
        const accessToken = await getAccessTokenSilently();
        
        // Use shared utility to get sanitized userId
        const sanitizedUserId = getSanitizedUserId(user);
        
        // Call your local server endpoint to get the feed token
        const response = await fetch('/api/stream/auth-tokens', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ 
            type: 'feed',
            userId: sanitizedUserId,
            userProfile: {
              name: user?.name || user?.email || 'Anonymous User',
              image: user?.picture || undefined,
              role: 'User'
            }
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get feed token: ${response.status} ${errorText}`);
        }

        const { token, apiKey } = await response.json();

        // Store the token and API key (same pattern as Feeds component)
        setFeedsClient({ token, apiKey, userId: sanitizedUserId });
      } catch (err: any) {
        console.error('Error initializing feeds client:', err);
        setError(err.message);
      }
    };

    initFeedsClient();
  }, [isAuthenticated, user, getAccessTokenSilently]);

  useEffect(() => {
    if (!feedsClient) return;
    fetchBookmarkedPosts();
  }, [feedsClient]);

  // Refresh bookmarked posts when user returns to the page
  useEffect(() => {
    const handleFocus = () => {

      if (feedsClient?.userId) {
        fetchBookmarkedPosts();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && feedsClient?.userId) {

        fetchBookmarkedPosts();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [feedsClient]);

  const fetchBookmarkedPosts = async () => {
    if (!feedsClient?.userId) return;

    try {
      setLoading(true);
      const accessToken = await getAccessTokenSilently();
      
      // Fetch user's bookmark reactions
      const response = await fetch('/api/stream/feed-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          action: 'get_bookmarked_posts',
          userId: feedsClient.userId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bookmarked posts');
      }

      const data = await response.json();


      
      // Transform posts to include user info
      const transformedPosts = (data.bookmarkedPosts || []).map((post: any) => {
        const actorId = post.actor;
        
        // Check if this is marked as current user's post from server
        const isOwnPost = post.isCurrentUser || actorId === feedsClient.userId;
        
        // Get user display name and profile image using helper functions
        const displayName = getUserDisplayName(actorId, user, post.userInfo, post.userProfile);
        const profileImage = getUserProfileImage(actorId, user, post.userInfo, post.userProfile);
        
        const userInfo = {
          name: displayName,
          image: profileImage,
          role: isOwnPost ? 'Current User' : undefined,
          company: undefined
        };
        
        return {
          ...post,
          userInfo: userInfo,
          isOwnPost: isOwnPost
        };
      });
      
      setBookmarkedPosts(transformedPosts);
    } catch (err: any) {
      console.error('Error fetching bookmarked posts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePostClick = (activityId: string) => {
    // Navigate to the feeds page with the specific post highlighted
    navigate(`/feeds?highlight=${activityId}`);
  };

  const handleRemoveBookmark = async (postId: string) => {
    if (!feedsClient?.userId) return;

    try {
      const accessToken = await getAccessTokenSilently();
      
      const response = await fetch('/api/stream/feed-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          action: 'remove_bookmark',
          userId: feedsClient.userId,
          postId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove bookmark');
      }

      // Remove from local state
      setBookmarkedPosts(prev => prev.filter(post => post.id !== postId));
      
      // Show success toast
      showSuccess('Bookmark removed successfully!');
    } catch (err: any) {
      console.error('Error removing bookmark:', err);
      showError('Failed to remove bookmark. Please try again.');
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <div>Please log in to view your bookmarked posts.</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  const bookmarkedContent = (
    <div className="feeds-container">
      <div className="feeds-header">
        <h1 style={{ marginBottom: '12px'}}>Bookmarked Posts</h1>
        <p>Posts you've saved for later reading</p>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : bookmarkedPosts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-content">
            <img src={BookmarkIcon} alt="No bookmarks" className="empty-state-icon" />
            <h3>No bookmarked posts yet</h3>
            <p>Start bookmarking posts you want to read later!</p>
            <button 
              className="cta-button"
              onClick={() => navigate('/feeds')}
            >
              Browse Posts
            </button>
          </div>
        </div>
      ) : (
        <div className="feeds-timeline">
          {bookmarkedPosts.map((post) => (
            <div 
              key={post.id} 
              className="feed-post"
              onClick={() => handlePostClick(post.id)}
              style={{ cursor: 'pointer' }}
            >
              <div className="post-header">
                <div className="post-author">
                  <div className="post-author-info">
                    <div className="author-avatar">
                      {post.userInfo?.image ? (
                        <img 
                          src={post.userInfo.image}
                          alt={post.userInfo.name}
                          onError={(e) => {
                            // Fallback to initials avatar if image fails to load
                            const target = e.target as HTMLImageElement;
                            const displayName = post.userInfo?.name || 'U';
                            const initial = displayName.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
                            target.src = `data:image/svg+xml,${encodeURIComponent(`
                              <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="20" cy="20" r="20" fill="#6b7280"/>
                                <text x="20" y="26" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="white">${initial}</text>
                              </svg>
                            `)}`;
                          }}
                        />
                      ) : (
                        // Show initials avatar if no profile picture
                        <div 
                          className="initials-avatar"
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: '#6b7280',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '16px',
                            fontWeight: 'bold'
                          }}
                        >
                          {(post.userInfo?.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                        </div>
                      )}
                    </div>
                    <div className="author-info">
                      <span className="author-name">
                        {post.isOwnPost ? 'You' : (post.userInfo?.name || 'Unknown User')}
                      </span>
                      <span className="post-time">
                        {formatRelativeTime(post.time || post.created_at || new Date())}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="post-content">
                <p className="post-text">{post.text}</p>
                
                {post.attachments && post.attachments.length > 0 && (
                  <div className="post-attachments">
                    {post.attachments.map((attachment, index) => (
                      <div key={index} className="post-image">
                        {attachment.type === 'image' ? (
                          <img 
                            src={attachment.asset_url} 
                            alt={attachment.title || 'Attachment'} 
                          />
                        ) : (
                          <div className="attachment-file">
                            <span>{attachment.title || 'File attachment'}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="post-actions">
                <button 
                  className="action-button bookmark-button bookmarked"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent post click navigation
                    handleRemoveBookmark(post.id);
                  }}
                  title="Remove from bookmarks"
                >
                  <img src={BookmarkFilledIcon} alt="Remove Bookmark" className="action-icon" />
                </button>
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
      <div className="feeds-container mobile-view">
        <div className="iphone-overlay"></div>
        <div className="feeds-content mobile-content">
          {bookmarkedContent}
          <MobileBottomNav currentPath={location.pathname} />
        </div>
        <button 
          className="desktop-toggle-button"
          onClick={toggleView}
          title="Switch to Desktop View"
        >
          🖥️ Desktop
        </button>
      </div>
    );
  }

  // Desktop view
  return bookmarkedContent;
};

export default BookmarkedPosts;
