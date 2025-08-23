import React, { useEffect, useState, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useSearchParams } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { getSanitizedUserId } from '../utils/userUtils';
import { formatRelativeTime } from '../utils/timeUtils';
import HeartIcon from '../icons/heart.svg';
import HeartFilledIcon from '../icons/heart-filled.svg';
import MessageIcon from '../icons/message-circle.svg';
import ShareIcon from '../icons/share-3.svg';
import BookmarkIcon from '../icons/bookmark.svg';
import BookmarkFilledIcon from '../icons/bookmark-filled.svg';
import TrashIcon from '../icons/trash.svg';
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
  time?: string;
  isOwnPost?: boolean;
}

const Feeds = () => {
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const [searchParams, setSearchParams] = useSearchParams();
  const [feedsClient, setFeedsClient] = useState<any>(null);
  const [clientReady, setClientReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string>('');
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<string>>(new Set());
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [showComments, setShowComments] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<{ [postId: string]: any[] }>({});
  const [loadingComments, setLoadingComments] = useState<string | null>(null);

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

  // Fetch posts when feedsClient is ready
  useEffect(() => {
    if (feedsClient?.userId) {
      console.log('🔄 FeedsClient ready, fetching initial posts...');
      fetchPosts(feedsClient.userId);
    }
  }, [feedsClient]);

  // Function to fetch real posts from Stream feeds
  const fetchPosts = async (userId?: string) => {
    const userIdToUse = userId || feedsClient?.userId;
    
    if (!userIdToUse) {
      console.log('❌ No userId available, skipping fetchPosts');
      return;
    }
    
    try {
      const accessToken = await getAccessTokenSilently();
      
      const response = await fetch('/api/stream/get-posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userId: userIdToUse,
          feedGroup: 'flat',
          feedId: 'global',
          limit: 20
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch posts: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Transform Stream activities to our FeedPost format
      const streamPosts: FeedPost[] = result.activities.map((activity: any) => ({
        id: activity.id,
        actor: activity.actor,
        text: activity.text || activity.object,
        attachments: activity.attachments || [],
        custom: activity.custom || {
          likes: 0,
          shares: 0,
          comments: 0,
          category: 'general'
        },
        time: activity.time,
        created_at: activity.time,
        isOwnPost: activity.actor === userIdToUse
      }));
      
      setPosts(streamPosts);
      console.log(`✅ Loaded ${streamPosts.length} posts from Stream feeds`);
      
    } catch (err: any) {
      console.error('❌ Error fetching posts:', err);
      // Fallback to empty posts array if fetching fails
      setPosts([]);
    }
  };

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
      
      // After seeding, fetch the real posts from Stream
      await fetchPosts(userId);
      
      // Fallback: Try again after a short delay if no posts were loaded
      setTimeout(async () => {
        if (posts.length === 0) {
          await fetchPosts(userId);
        }
      }, 1000);
      
    } catch (err: any) {
      console.error('❌ Error seeding feeds:', err);
      setSeedStatus(`❌ Error: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
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

  const createPost = async () => {
    if (!newPostText.trim() || !feedsClient?.userId) return;

    setIsCreatingPost(true);
    try {
      const accessToken = await getAccessTokenSilently();
      
      const response = await fetch('/api/stream/feed-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'create_post',
          userId: feedsClient.userId,
          postData: {
            text: newPostText.trim(),
            category: 'general'
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create post: ${response.status}`);
      }

      const result = await response.json();
      
      // Refresh posts from Stream to show the new post
      await fetchPosts(feedsClient.userId);
      
      setNewPostText('');
      setShowCreatePost(false);
      
      console.log('✅ Post created successfully');
      
    } catch (err: any) {
      console.error('❌ Error creating post:', err);
      alert('Failed to create post. Please try again.');
    } finally {
      setIsCreatingPost(false);
    }
  };

  const deletePost = async (postId: string) => {
    if (!feedsClient?.userId) return;

    setIsDeletingPost(true);
    try {
      const accessToken = await getAccessTokenSilently();
      
      const response = await fetch('/api/stream/feed-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'delete_post',
          userId: feedsClient.userId,
          postId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete post');
      }

      // Refresh posts from Stream to reflect the deletion
      await fetchPosts(feedsClient.userId);
      
      // Close the delete modal
      setShowDeleteModal(null);
      
      console.log('✅ Post deleted successfully');
      
    } catch (err: any) {
      console.error('Error deleting post:', err);
      alert('Failed to delete post. Please try again.');
    } finally {
      setIsDeletingPost(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!feedsClient?.userId) return;

    const isCurrentlyLiked = likedPosts.has(postId);
    
    try {
      const accessToken = await getAccessTokenSilently();
      
      const response = await fetch('/api/stream/feed-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: isCurrentlyLiked ? 'unlike_post' : 'like_post',
          userId: feedsClient.userId,
          postId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update like');
      }

      // Update local state
      setLikedPosts(prev => {
        const newLiked = new Set(prev);
        if (isCurrentlyLiked) {
          newLiked.delete(postId);
        } else {
          newLiked.add(postId);
        }
        return newLiked;
      });

      // Update post like count
      setPosts(prevPosts => 
        prevPosts.map(post => {
          if (post.id === postId && post.custom) {
            return {
              ...post,
              custom: {
                ...post.custom,
                likes: isCurrentlyLiked ? post.custom.likes - 1 : post.custom.likes + 1
              }
            };
          }
          return post;
        })
      );
      
    } catch (err: any) {
      console.error('Error updating like:', err);
      alert('Failed to update like. Please try again.');
    }
  };

  const handleBookmark = async (postId: string) => {
    if (!feedsClient?.userId) return;

    const isCurrentlyBookmarked = bookmarkedPosts.has(postId);
    
    try {
      const accessToken = await getAccessTokenSilently();
      
      const response = await fetch('/api/stream/feed-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: isCurrentlyBookmarked ? 'remove_bookmark' : 'bookmark_post',
          userId: feedsClient.userId,
          postId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update bookmark');
      }

      // Update local state
      setBookmarkedPosts(prev => {
        const newBookmarked = new Set(prev);
        if (isCurrentlyBookmarked) {
          newBookmarked.delete(postId);
        } else {
          newBookmarked.add(postId);
        }
        return newBookmarked;
      });
      
    } catch (err: any) {
      console.error('Error updating bookmark:', err);
      alert('Failed to update bookmark. Please try again.');
    }
  };

  const fetchComments = async (postId: string) => {
    if (!feedsClient?.userId) return;

    setLoadingComments(postId);
    try {
      const accessToken = await getAccessTokenSilently();
      
      const response = await fetch('/api/stream/feed-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'get_comments',
          userId: feedsClient.userId,
          postId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      const result = await response.json();
      
      // Update comments state
      setPostComments(prev => ({
        ...prev,
        [postId]: result.comments || []
      }));
      
    } catch (err: any) {
      console.error('Error fetching comments:', err);
      alert('Failed to load comments. Please try again.');
    } finally {
      setLoadingComments(null);
    }
  };

  const addComment = async (postId: string) => {
    if (!commentText.trim() || !feedsClient?.userId) return;

    setIsAddingComment(true);
    try {
      const accessToken = await getAccessTokenSilently();
      
      const response = await fetch('/api/stream/feed-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'add_comment',
          userId: feedsClient.userId,
          postId,
          postData: {
            text: commentText.trim()
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      // Update post comment count
      setPosts(prevPosts => 
        prevPosts.map(post => {
          if (post.id === postId && post.custom) {
            return {
              ...post,
              custom: {
                ...post.custom,
                comments: post.custom.comments + 1
              }
            };
          }
          return post;
        })
      );

      // If comments are currently shown, refresh them
      if (showComments === postId) {
        await fetchComments(postId);
      }

      setCommentText('');
      setShowCommentInput(null);
      
      console.log('✅ Comment added successfully');
      
    } catch (err: any) {
      console.error('Error adding comment:', err);
      alert('Failed to add comment. Please try again.');
    } finally {
      setIsAddingComment(false);
    }
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
          <p>No posts available. Create your first post to get started!</p>
        </div>
      ) : (
        <div className="feeds-timeline">
          {posts.map((post) => {
            const highlightPostId = searchParams.get('highlight');
            const isHighlighted = highlightPostId === post.id;
            
            return (
            <div key={post.id} className={`feed-post ${isHighlighted ? 'highlighted-post' : ''}`}>
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
                    <span className="post-time">{formatRelativeTime(post.time || post.created_at || new Date())}</span>
                  </div>
                </div>                
                {/* Delete button for own posts */}
                {post.isOwnPost && (
                  <button 
                    className="delete-post-button"
                    onClick={() => setShowDeleteModal(post.id)}
                    title="Delete post"
                  >
                    <img src={TrashIcon} alt="Delete" className="delete-icon" />
                  </button>
                )}
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
                  onClick={() => setShowCommentInput(showCommentInput === post.id ? null : post.id)}
                >
                  <img src={MessageIcon} alt="Comment" className="action-icon" />
                  {post.custom?.comments || 0}
                </button>
                <button 
                  className="action-button share-button"
                  onClick={() => handleShare(post.id)}
                >
                  <img 
                    src={ShareIcon}
                    alt="Share"
                    className="action-icon"
                  />
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

              {/* Comment Input */}
              {showCommentInput === post.id && (
                <div className="comment-input-section">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment..."
                    className="comment-textarea"
                    rows={2}
                  />
                  <div className="comment-actions">
                    <button 
                      className="submit-comment-button"
                      onClick={() => addComment(post.id)}
                      disabled={!commentText.trim() || isAddingComment}
                    >
                      {isAddingComment ? 'Adding...' : 'Comment'}
                    </button>
                    <button 
                      className="cancel-comment-button"
                      onClick={() => {
                        setShowCommentInput(null);
                        setCommentText('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* View Comments Button */}
              {(post.custom?.comments || 0) > 0 && (
                <div className="view-comments-section">
                  <button 
                    className="view-comments-button"
                    onClick={() => {
                      if (showComments === post.id) {
                        setShowComments(null);
                      } else {
                        setShowComments(post.id);
                        if (!postComments[post.id]) {
                          fetchComments(post.id);
                        }
                      }
                    }}
                    disabled={loadingComments === post.id}
                  >
                    {loadingComments === post.id ? 'Loading...' : 
                     showComments === post.id ? 'Hide Comments' : 
                     `View Comments (${post.custom?.comments || 0})`}
                  </button>
                </div>
              )}

              {/* Comments Display */}
              {showComments === post.id && postComments[post.id] && (
                <div className="comments-section">
                  <div className="comments-list">
                    {postComments[post.id].map((comment: any, index: number) => (
                      <div key={comment.id || index} className="comment-item">
                        <div className="comment-author">
                          <strong>
                            {comment.user_id === feedsClient?.userId ? 'You' : 
                             comment.user_id.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </strong>
                        </div>
                        <div className="comment-text">{comment.data?.text || comment.text}</div>
                        <div className="comment-time">
                          {formatRelativeTime(comment.created_at || new Date())}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Button for Create Post */}
      <button 
        className="fab-create-post"
        onClick={() => setShowCreatePost(!showCreatePost)}
        title="Create new post"
      >
        <span className="fab-plus">+</span>
      </button>

      {/* Create Post Modal */}
      {showCreatePost && (
        <div className="create-post-modal-overlay" onClick={() => setShowCreatePost(false)}>
          <div className="create-post-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Post</h3>
              <button 
                className="modal-close-button"
                onClick={() => setShowCreatePost(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <textarea
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                placeholder="What's on your mind?"
                className="post-textarea"
                rows={4}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button 
                className="modal-cancel-button"
                onClick={() => setShowCreatePost(false)}
              >
                Cancel
              </button>
              <button 
                className="modal-submit-button"
                onClick={createPost}
                disabled={!newPostText.trim() || isCreatingPost}
              >
                {isCreatingPost ? 'Creating...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="delete-modal-overlay" onClick={() => setShowDeleteModal(null)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Post</h3>
              <button 
                className="modal-close-button"
                onClick={() => setShowDeleteModal(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <p className="delete-warning">
                Are you sure you want to delete this post? This action cannot be undone.
              </p>
            </div>
            <div className="modal-actions">
              <button 
                className="modal-cancel-button"
                onClick={() => setShowDeleteModal(null)}
              >
                Cancel
              </button>
              <button 
                className="modal-delete-button"
                onClick={() => deletePost(showDeleteModal)}
                disabled={isDeletingPost}
              >
                {isDeletingPost ? 'Deleting...' : 'Delete Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feeds;
