import React, { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { getSanitizedUserId } from '../utils/userUtils';
import { formatRelativeTime } from '../utils/timeUtils';
import HeartIcon from '../icons/heart.svg';
import HeartFilledIcon from '../icons/heart-filled.svg';
import MessageIcon from '../icons/message-circle.svg';
import ShareIcon from '../icons/share-3.svg';
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
  created_at?: string;
  time?: string;
  activity_id: string; // The original post ID to navigate back to
}

const BookmarkedPosts = () => {
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const [bookmarkedPosts, setBookmarkedPosts] = useState<BookmarkedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedsClient, setFeedsClient] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const initializeFeedsClient = async () => {
      try {
        const { FeedsClient } = await import('@stream-io/feeds-react-sdk');
        const accessToken = await getAccessTokenSilently();
        
        const response = await fetch('/api/stream/chat-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ userId: getSanitizedUserId(user) })
        });

        if (!response.ok) {
          throw new Error('Failed to get Stream token');
        }

        const { token, apiKey } = await response.json();
        const client = new FeedsClient(apiKey);
        await client.connectUser({ id: getSanitizedUserId(user) }, token);
        
        setFeedsClient(client);
      } catch (err: any) {
        console.error('Error initializing feeds client:', err);
        setError(err.message);
      }
    };

    initializeFeedsClient();
  }, [isAuthenticated, user, getAccessTokenSilently]);

  useEffect(() => {
    if (!feedsClient) return;
    fetchBookmarkedPosts();
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
        <h1>📖 Bookmarked Posts</h1>
        <p>Posts you've saved for later reading</p>
        <button 
          className="back-to-feeds-button"
          onClick={() => navigate('/feeds')}
        >
          ← Back to Feeds
        </button>
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
        <div className="posts-container">
          {bookmarkedPosts.map((post) => (
            <article 
              key={post.id} 
              className="post bookmarked-post"
              onClick={() => handlePostClick(post.activity_id)}
            >
              <div className="post-header">
                <div className="post-author">
                  <div className="author-avatar">
                    <span>{post.actor.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="author-info">
                    <span className="author-name">{post.actor}</span>
                    <span className="post-time">
                      {post.created_at ? formatRelativeTime(post.created_at) : post.time || 'Unknown time'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="post-content">
                <p>{post.text}</p>
                
                {post.attachments && post.attachments.length > 0 && (
                  <div className="post-attachments">
                    {post.attachments.map((attachment, index) => (
                      <div key={index} className="attachment">
                        {attachment.type === 'image' ? (
                          <img 
                            src={attachment.asset_url} 
                            alt={attachment.title || 'Attachment'} 
                            className="attachment-image"
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
                <div className="action-stats">
                  <span>{post.custom?.likes || 0} likes</span>
                  <span>{post.custom?.comments || 0} comments</span>
                  <span>{post.custom?.shares || 0} shares</span>
                </div>
                
                <div className="action-buttons">
                  <button className="action-button like-button">
                    <img src={HeartIcon} alt="Like" className="action-icon" />
                  </button>
                  <button className="action-button comment-button">
                    <img src={MessageIcon} alt="Comment" className="action-icon" />
                  </button>
                  <button className="action-button share-button">
                    <img src={ShareIcon} alt="Share" className="action-icon" />
                  </button>
                  <button 
                    className="action-button bookmark-button bookmarked"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent post click navigation
                      handleRemoveBookmark(post.id);
                    }}
                  >
                    <img src={BookmarkFilledIcon} alt="Remove Bookmark" className="action-icon" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookmarkedPosts;
