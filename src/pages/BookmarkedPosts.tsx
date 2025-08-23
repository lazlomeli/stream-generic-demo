import React, { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { getSanitizedUserId } from '../utils/userUtils';
import { formatRelativeTime } from '../utils/timeUtils';
import BookmarkIcon from '../icons/bookmark.svg';
import BookmarkFilledIcon from '../icons/bookmark-filled.svg';
import '../components/Feeds.css';

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
}

const BookmarkedPosts = () => {
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
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
        const response = await fetch('/api/stream/feed-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ userId: sanitizedUserId }),
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
      console.log('📖 BookmarkedPosts page focused, refreshing data...');
      if (feedsClient?.userId) {
        fetchBookmarkedPosts();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && feedsClient?.userId) {
        console.log('📖 BookmarkedPosts page became visible, refreshing data...');
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
      console.log('📖 Received bookmarked posts data:', data);
      console.log('📖 Bookmarked posts array:', data.bookmarkedPosts);
      setBookmarkedPosts(data.bookmarkedPosts || []);
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

  // Function to get user avatar or create fallback
  const getUserAvatar = (actorId: string) => {
    // If it's the current user, use Auth0 profile picture or create initial avatar
    if (actorId === feedsClient?.userId) {
      if (user?.picture) {
        return user.picture;
      } else {
        // Create fallback avatar with user's initial
        const initial = user?.name?.[0] || user?.email?.[0] || 'U';
        return `data:image/svg+xml,${encodeURIComponent(`
          <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="20" fill="#3b82f6"/>
            <text x="20" y="26" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="white">${initial.toUpperCase()}</text>
          </svg>
        `)}`;
      }
    }
    
    // For demo users, use Unsplash images
    const demoImages = {
      'alice_smith': '1580489944761-15a19d654956',
      'bob_johnson': '1507003211169-0a1dd7228f2d',
      'carol_williams': '1438761681033-6461ffad8d80',
      'david_brown': '1472099645785-5658abf4ff4e',
      'emma_davis': '1544005313-94ddf0286df2'
    };
    
    const imageId = demoImages[actorId as keyof typeof demoImages];
    return imageId ? `https://images.unsplash.com/photo-${imageId}?w=40&h=40&fit=crop&crop=face` : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face';
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
    } catch (err: any) {
      console.error('Error removing bookmark:', err);
      alert('Failed to remove bookmark. Please try again.');
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

  return (
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
                      <img 
                        src={getUserAvatar(post.actor)}
                        alt={post.actor}
                        onError={(e) => {
                          // Fallback to initials avatar if image fails to load
                          const target = e.target as HTMLImageElement;
                          const initial = post.actor.replace('_', ' ').split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
                          target.src = `data:image/svg+xml,${encodeURIComponent(`
                            <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="20" cy="20" r="20" fill="#6b7280"/>
                              <text x="20" y="26" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="white">${initial}</text>
                            </svg>
                          `)}`;
                        }}
                      />
                    </div>
                    <div className="author-info">
                      <span className="author-name">
                        {post.actor === feedsClient?.userId ? 'You' : post.actor.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
};

export default BookmarkedPosts;
