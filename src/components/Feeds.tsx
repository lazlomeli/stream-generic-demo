import React, { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import LoadingSpinner from './LoadingSpinner';
import { getSanitizedUserId } from '../utils/userUtils';
import HeartIcon from '../icons/heart.svg';
import HeartFilledIcon from '../icons/heart-filled.svg';
import MessageIcon from '../icons/message-circle.svg';
import ShareIcon from '../icons/share-3.svg';
import BookmarkIcon from '../icons/bookmark.svg';
import BookmarkFilledIcon from '../icons/bookmark-filled.svg';
import './Feeds.css';

interface FeedPost {
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
}

const Feeds = () => {
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const [feedsClient, setFeedsClient] = useState<any>(null);
  const [clientReady, setClientReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string>('');
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<string>>(new Set());

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
          body: JSON.stringify({ userId: sanitizedUserId }), // Use sanitized userId
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get feed token: ${response.status} ${errorText}`);
        }

        const { token, apiKey } = await response.json();

        // Store the token and API key
        setFeedsClient({ token, apiKey, userId: sanitizedUserId });
        setClientReady(true);
        
        console.log('✅ Feed token received successfully');
        
        // Automatically seed demo feeds after getting the token
        await seedDemoFeeds(sanitizedUserId, accessToken);
        
      } catch (err: any) {
        console.error('Error getting feed token:', err);
        setError(err.message || 'Failed to get feed token');
      }
    };

    initFeedsClient();
  }, [user, isAuthenticated, getAccessTokenSilently]);

  const seedDemoFeeds = async (userId: string, accessToken: string) => {
    setIsSeeding(true);
    setSeedStatus('Loading demo feeds...');

    try {
      // Use the unified seed endpoint that handles both chat and feeds
      const response = await fetch('/api/stream/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to seed feeds: ${response.status}`);
      }

      const result = await response.json();
      setSeedStatus(`✅ ${result.message}`);
      
      // For now, create some mock posts to show the interface
      // In production, these would come from the actual Stream Feeds API
      const mockPosts: FeedPost[] = [
        {
          id: '1',
          actor: 'david_brown',
          text: 'Just released version 2.0 of our API! 🎉 Major performance improvements and new endpoints. Check out the docs: https://example.com/docs',
          custom: {
            likes: 31,
            shares: 28,
            comments: 15,
            category: 'technology'
          }
        },
        {
          id: '2',
          actor: 'bob_johnson',
          text: 'Coffee and code - the perfect combination ☕️ Working on some new features for our app. What\'s everyone building today?',
          custom: {
            likes: 18,
            shares: 2,
            comments: 12,
            category: 'lifestyle'
          }
        },
        {
          id: '3',
          actor: 'carol_williams',
          text: 'Beautiful sunset from my balcony tonight! 🌅 Sometimes you just need to pause and appreciate the little moments.',
          attachments: [
            {
              type: 'image',
              asset_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
              mime_type: 'image/jpeg',
              title: 'Sunset View'
            }
          ],
          custom: {
            likes: 42,
            shares: 15,
            comments: 6,
            category: 'photography'
          }
        },
        {
          id: '4',
          actor: 'emma_davis',
          text: 'Weekend hiking trip was amazing! 🏔️ Fresh air, great views, and good company. Nature is the best therapy.',
          attachments: [
            {
              type: 'image',
              asset_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
              mime_type: 'image/jpeg',
              title: 'Mountain Hiking'
            }
          ],
          custom: {
            likes: 56,
            shares: 22,
            comments: 9,
            category: 'outdoors'
          }
        }
      ];

      setPosts(mockPosts);
      
    } catch (err: any) {
      console.error('Error seeding feeds:', err);
      setSeedStatus(`❌ Error: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleLike = (postId: string) => {
    setLikedPosts(prev => {
      const newLiked = new Set(prev);
      if (newLiked.has(postId)) {
        newLiked.delete(postId);
      } else {
        newLiked.add(postId);
      }
      return newLiked;
    });
    
    // Update the post's like count
    setPosts(prevPosts => 
      prevPosts.map(post => {
        if (post.id === postId && post.custom) {
          const isLiked = likedPosts.has(postId);
          return {
            ...post,
            custom: {
              ...post.custom,
              likes: isLiked ? post.custom.likes - 1 : post.custom.likes + 1
            }
          };
        }
        return post;
      })
    );
  };

  const handleBookmark = (postId: string) => {
    setBookmarkedPosts(prev => {
      const newBookmarked = new Set(prev);
      if (newBookmarked.has(postId)) {
        newBookmarked.delete(postId);
      } else {
        newBookmarked.add(postId);
      }
      return newBookmarked;
    });
  };

  const handleShare = (postId: string) => {
    // Update the post's share count
    setPosts(prevPosts => 
      prevPosts.map(post => {
        if (post.id === postId && post.custom) {
          return {
            ...post,
            custom: {
              ...post.custom,
              shares: post.custom.shares + 1
            }
          };
        }
        return post;
      })
    );
    
    // In a real app, this would open a share dialog
    console.log(`Sharing post ${postId}`);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="feeds-loading">
        <LoadingSpinner />
        <p>Loading...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="feeds-error">
        <h2>Error Loading Feeds</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  // Show loading state while client initializes or seeding
  if (!clientReady || !feedsClient || isSeeding) {
    return (
      <div className="feeds-loading">
        <LoadingSpinner />
        <p>{isSeeding ? seedStatus : 'Initializing feeds...'}</p>
      </div>
    );
  }

  // Render feeds when client is ready and posts are loaded
  return (
    <div className="feeds-container">
      <div className="feeds-header">
        <h1>Activity Feeds</h1>
      </div>

      {posts.length === 0 ? (
        <div className="feeds-empty">
          <p>No posts available. Please check back later!</p>
        </div>
      ) : (
        <div className="feeds-timeline">
          {posts.map((post) => (
            <div key={post.id} className="feed-post">
              <div className="post-header">
                <div className="post-author">
                  <div className="author-avatar">
                    <img 
                      src={`https://images.unsplash.com/photo-${post.actor === 'alice_smith' ? '1494790108755-2616b612b786' : 
                                 post.actor === 'bob_johnson' ? '1507003211169-0a1dd7228f2d' : 
                                 post.actor === 'carol_williams' ? '1438761681033-6461ffad8d80' :
                                 post.actor === 'david_brown' ? '1472099645785-5658abf4ff4e' :
                                 post.actor === 'emma_davis' ? '1544005313-94ddf0286df2' :
                                 '1507003211169-0a1dd7228f2d'}?w=40&h=40&fit=crop&crop=face`} 
                      alt={post.actor}
                    />
                  </div>
                  <div className="author-info">
                    <span className="author-name">{post.actor.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                    <span className="post-time">2h ago</span>
                  </div>
                </div>
              </div>
              
              <div className="post-content">
                <p className="post-text">{post.text}</p>
                {post.attachments && post.attachments.length > 0 && (
                  <div className="post-attachments">
                    {post.attachments.map((attachment, index) => (
                      <div key={index} className="post-image">
                        <img src={attachment.asset_url} alt={attachment.title} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="post-actions">
                <button 
                  className={`action-button like-button ${likedPosts.has(post.id) ? 'liked' : ''}`}
                  onClick={() => handleLike(post.id)}
                >
                  <img 
                    src={likedPosts.has(post.id) ? HeartFilledIcon : HeartIcon} 
                    alt="Like" 
                    className="action-icon"
                  />
                  {post.custom?.likes || 0}
                </button>
                <button 
                  className="action-button comment-button"
                  onClick={() => console.log(`Comment on post ${post.id}`)}
                >
                  <img src={MessageIcon} alt="Comment" className="action-icon" />
                  {post.custom?.comments || 0}
                </button>
                <button 
                  className="action-button share-button"
                  onClick={() => handleShare(post.id)}
                >
                  <img src={ShareIcon} alt="Share" className="action-icon" />
                  {post.custom?.shares || 0}
                </button>
                <button 
                  className={`action-button bookmark-button ${bookmarkedPosts.has(post.id) ? 'bookmarked' : ''}`}
                  onClick={() => handleBookmark(post.id)}
                >
                  <img 
                    src={bookmarkedPosts.has(post.id) ? BookmarkFilledIcon : BookmarkIcon} 
                    alt="Bookmark" 
                    className="action-icon"
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Feeds;
