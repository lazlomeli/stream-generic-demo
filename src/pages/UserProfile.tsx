import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import LoadingSpinner from '../components/LoadingSpinner';
import LoadingIcon from '../components/LoadingIcon';
import { getSanitizedUserId } from '../utils/userUtils';
import { formatRelativeTime } from '../utils/timeUtils';
import { getAuth0UserId, cacheUserIdMapping, getPublicUserId } from '../utils/idUtils';
import { apiCache } from '../utils/apiCache';
import HeartIcon from '../icons/heart.svg';
import HeartFilledIcon from '../icons/heart-filled.svg';
import MessageIcon from '../icons/message-circle.svg';
import ShareIcon from '../icons/share-3.svg';
import BookmarkIcon from '../icons/bookmark.svg';
import BookmarkFilledIcon from '../icons/bookmark-filled.svg';
import CameraIcon from '../icons/camera.svg';
import VideoIcon from '../icons/video.svg';
import PollIcon from '../icons/poll.svg';
import '../components/Feeds.css';
import './UserProfile.css';

// Demo user mapping for fallback
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

interface UserProfile {
  userId: string;
  name: string;
  image?: string;
  role?: string;
  company?: string;
  joinDate?: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
}

interface FeedPost {
  id: string;
  actor: string;
  text: string;
  attachments?: Array<{
    type: string;
    asset_url: string;
    mime_type: string;
    title: string;
    url?: string;
    name?: string;
    question?: string;
    options?: string[];
    votes?: number[];
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
  userInfo?: {
    name: string;
    image: string;
    role?: string;
    company?: string;
  };
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

// Helper function to get corrected user display name (prioritize Stream Chat data)
const getCorrectedUserDisplayName = (userId: string, streamChatUserData?: any, fallbackName?: string) => {
  // First priority: Stream Chat user data (most reliable)
  if (streamChatUserData?.name && !isCorruptedName(streamChatUserData.name)) {
    return streamChatUserData.name;
  }

  // Second priority: Check if fallback name is not corrupted
  if (fallbackName && !isCorruptedName(fallbackName)) {
    return fallbackName;
  }

  // Third priority: Demo user mapping
  const demoUser = DEMO_USERS[userId as keyof typeof DEMO_USERS];
  if (demoUser) {
    return demoUser.name;
  }

  // Last resort: format the user ID to be more readable
  return formatUserId(userId);
};

// Helper function to get corrected user profile image
const getCorrectedUserProfileImage = (userId: string, streamChatUserData?: any, fallbackImage?: string) => {
  // First priority: Stream Chat user data
  if (streamChatUserData?.image) {
    return streamChatUserData.image;
  }

  // Second priority: Fallback image
  if (fallbackImage) {
    return fallbackImage;
  }

  // Third priority: Demo user mapping
  const demoUser = DEMO_USERS[userId as keyof typeof DEMO_USERS];
  if (demoUser) {
    return demoUser.image;
  }

  return undefined;
};

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

// Helper function to check if a name is corrupted
const isCorruptedName = (name: string): boolean => {
  if (!name) return true;
  
  // Check for Auth0 corrupted patterns
  const corruptedPatterns = [
    /^google-oauth2/i,
    /^auth0_[a-f0-9]+$/i,
    /^[a-f0-9]{20,}$/i, // Long hex strings
    /\|/,  // Contains pipe character (Auth0 ID format)
    /^oauth2/i
  ];

  return corruptedPatterns.some(pattern => pattern.test(name));
};

// Helper function to format user ID to be more readable
const formatUserId = (userId: string): string => {
  // Handle Auth0-style IDs
  if (userId.includes('|') || userId.includes('oauth2') || userId.includes('google')) {
    const parts = userId.split(/[|_]/);
    if (parts.length >= 2) {
      const provider = parts[0].replace(/([A-Z])/g, ' $1').trim();
      return `${provider} User`;
    }
  }
  
  return userId.replace(/[^a-zA-Z0-9@_-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()).trim() || 'Unknown User';
};

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [feedsClient, setFeedsClient] = useState<any>(null);
  const [streamChatUserData, setStreamChatUserData] = useState<any>(null);
  const [imageLoadError, setImageLoadError] = useState(false);

  // Initialize feeds client
  useEffect(() => {
    const initFeedsClient = async () => {
      if (!user || !isAuthenticated) return;

      try {
        const accessToken = await getAccessTokenSilently();
        const sanitizedUserId = getSanitizedUserId(user);
        
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

        if (response.ok) {
          const { token, apiKey } = await response.json();
          setFeedsClient({ token, apiKey, userId: sanitizedUserId });
        }
      } catch (err) {
        console.error('Error initializing feeds client:', err);
      }
    };

    initFeedsClient();
  }, [user, isAuthenticated, getAccessTokenSilently]);

  // Fetch user profile and posts
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId || !feedsClient) return;

      setIsLoading(true);
      setError(null);

      try {
        const accessToken = await getAccessTokenSilently();

        // Resolve hashed userId to Auth0 userId
        let auth0UserId: string = getAuth0UserId(userId) || userId; // Try cache first, fallback to original userId
        
        if (!getAuth0UserId(userId)) {
          // If not in cache, try to resolve via backend
          try {
            const resolveResponse = await fetch('/api/stream/user-data', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ 
                type: 'resolve',
                hashedUserId: userId 
              }),
            });

            if (resolveResponse.ok) {
              const { auth0UserId: resolvedId } = await resolveResponse.json();
              if (resolvedId) {
                auth0UserId = resolvedId;
                // Cache the mapping for future use
                cacheUserIdMapping(auth0UserId, userId);
              }
            }
            // If resolution fails, auth0UserId remains as userId (backward compatibility)
          } catch (resolveError) {
            console.warn('Could not resolve hashed user ID, assuming Auth0 ID:', resolveError);
            // auth0UserId remains as userId (backward compatibility)
          }
        }

        // Fetch user's posts
        const postsResponse = await fetch('/api/stream/user-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            type: 'posts',
            userId: feedsClient.userId,
            targetUserId: auth0UserId,
            limit: 20
          }),
        });

        if (!postsResponse.ok) {
          throw new Error('Failed to fetch user posts');
        }

        const postsData = await postsResponse.json();
        const userPosts = postsData.posts || [];

        // Fetch user counts (followers/following)
        const [followersRes, followingRes] = await Promise.all([
          fetch('/api/stream/feed-actions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              action: 'get_followers',
              userId: feedsClient.userId,
              targetUserId: auth0UserId
            })
          }),
          fetch('/api/stream/feed-actions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              action: 'get_following',
              userId: auth0UserId
            })
          })
        ]);

        const [followersData, followingData] = await Promise.all([
          followersRes.ok ? followersRes.json() : { count: 0 },
          followingRes.ok ? followingRes.json() : { count: 0 }
        ]);

        // Check if current user is following this user
        const isFollowingRes = await fetch('/api/stream/feed-actions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            action: 'get_following',
            userId: feedsClient.userId
          })
        });

        let isCurrentlyFollowing = false;
        if (isFollowingRes.ok) {
          const followingList = await isFollowingRes.json();
          isCurrentlyFollowing = followingList.following?.some((follow: any) => 
            follow.target_id === auth0UserId || follow.target?.split(':')[1] === auth0UserId
          ) || false;
        }

        // Try to get Stream Chat user data for better name/image (with caching)
        const chatUserData = await apiCache.fetchStreamChatUser(
          auth0UserId,
          async () => {
            console.log('🔍 Fetching Stream Chat user data for:', auth0UserId);
            
            const chatUserResponse = await fetch('/api/stream/user-data', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ 
                type: 'chat-user',
                userId: auth0UserId 
              }),
            });

            if (chatUserResponse.ok) {
              const chatData = await chatUserResponse.json();
              console.log('🖼️ Stream Chat API response for', auth0UserId, ':', {
                hasUser: !!chatData.user,
                hasImage: !!chatData.user?.image,
                imageDomain: chatData.user?.image ? new URL(chatData.user.image).hostname : 'none'
              });
              return chatData.user;
            } else {
              console.warn('❌ Stream Chat API failed for', auth0UserId, ':', chatUserResponse.status);
            }
            
            return null;
          }
        );

        setStreamChatUserData(chatUserData);

        // Get user info from the first post or fallback
        let userInfo = null;
        if (userPosts.length > 0) {
          userInfo = userPosts[0].userInfo || userPosts[0].userProfile;
        }

        // Create user profile with corrected data
        const correctedName = getCorrectedUserDisplayName(auth0UserId, chatUserData, userInfo?.name);
        const correctedImage = getCorrectedUserProfileImage(auth0UserId, chatUserData, userInfo?.image);
        
        console.log('🎭 User profile data for', correctedName, ':', {
          auth0UserId,
          hasChatUserData: !!chatUserData,
          chatUserImage: chatUserData?.image,
          fallbackImage: userInfo?.image,
          finalImage: correctedImage
        });

        const userProfile: UserProfile = {
          userId: auth0UserId, // Store the Auth0 ID in profile
          name: correctedName,
          image: correctedImage,
          role: userInfo?.role || chatUserData?.role,
          company: userInfo?.company || chatUserData?.company,
          joinDate: '23rd Aug 2024', // Hardcoded as requested
          postCount: userPosts.length,
          followerCount: followersData.count || 0,
          followingCount: followingData.count || 0,
        };

        setProfile(userProfile);
        setPosts(userPosts);
        setIsFollowing(isCurrentlyFollowing);
        setImageLoadError(false); // Reset image error state for new user

      } catch (err: any) {
        console.error('Error fetching user profile:', err);
        setError(err.message || 'Failed to load user profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId, feedsClient, getAccessTokenSilently]);

  const handleFollow = async () => {
    if (!feedsClient?.userId || !profile?.userId) return;

    try {
      const accessToken = await getAccessTokenSilently();
      
      const response = await fetch('/api/stream/feed-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: isFollowing ? 'unfollow_user' : 'follow_user',
          userId: feedsClient.userId,
          targetUserId: profile.userId
        }),
      });

      if (response.ok) {
        setIsFollowing(!isFollowing);
        setProfile(prev => prev ? {
          ...prev,
          followerCount: prev.followerCount + (isFollowing ? -1 : 1)
        } : null);
      }
    } catch (err) {
      console.error('Error updating follow status:', err);
    }
  };

  const goBackToFeeds = () => {
    navigate('/feeds');
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error || !profile) {
    return (
      <div className="feeds-error">
        <h2>Error Loading Profile</h2>
        <p>{error || 'User profile not found'}</p>
        <button onClick={goBackToFeeds}>Back to Feeds</button>
      </div>
    );
  }

  const isOwnProfile = feedsClient?.userId === profile?.userId;

  return (
    <div className="feeds-container">
      {/* User Profile Header */}
      <div className="user-profile-header">
        <div className="profile-left-section">
          <div className="profile-avatar">
            {profile.image && !imageLoadError ? (
              <img 
                src={profile.image} 
                alt={profile.name}
                onError={(e) => {
                  console.log(`❌ Image failed to load for ${profile.name}:`, profile.image);
                  setImageLoadError(true);
                }}
                onLoad={() => {
                  console.log(`✅ Image loaded successfully for ${profile.name}`);
                }}
              />
            ) : (
              <div className="profile-initials-avatar">
                {getUserInitials(profile.name)}
              </div>
            )}
          </div>
          {!isOwnProfile && (
            <button 
              className={`profile-follow-button ${isFollowing ? 'following' : ''}`}
              onClick={handleFollow}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
        <div className="profile-details">
          <h1 className="profile-name">{profile.name}</h1>
          <div className="profile-stats">
            <div className="stat">
              <strong>{profile.postCount}</strong>
              <span>Posts</span>
            </div>
            <div className="stat">
              <strong>{profile.followerCount}</strong>
              <span>Followers</span>
            </div>
            <div className="stat">
              <strong>{profile.followingCount}</strong>
              <span>Following</span>
            </div>
          </div>
          <p className="profile-join-date">Joined {profile.joinDate}</p>
        </div>
      </div>

      {/* User's Posts */}
      <div className="user-posts-section">
        <h2 className="posts-title">Posts by {profile.name}</h2>
        {posts.length === 0 ? (
          <div className="feeds-empty">
            <p>{isOwnProfile ? "You haven't posted anything yet." : `${profile.name} hasn't posted anything yet.`}</p>
          </div>
        ) : (
          <div className="feeds-timeline">
            {posts.map((post) => (
              <div key={post.id} className="feed-post">
                <div className="post-header">
                  <div className="post-author">
                    <div className="post-author-info">
                      <div className="author-avatar">
                        {profile.image && !imageLoadError ? (
                          <img 
                            src={profile.image} 
                            alt={profile.name}
                            onError={() => setImageLoadError(true)}
                          />
                        ) : (
                          <div className="initials-avatar">
                            {getUserInitials(profile.name)}
                          </div>
                        )}
                      </div>
                      <div className="author-info">
                        <div className="author-name-row">
                          <span className="author-name">{profile.name}</span>
                        </div>
                        <span className="post-time">{formatRelativeTime(post.time || post.created_at || new Date())}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="post-content">
                  {post.text && post.text.trim() && (
                    <p className="post-text">{post.text}</p>
                  )}
                  {post.attachments && post.attachments.length > 0 && (
                    <div className="post-attachments">
                      {post.attachments.map((attachment, index) => (
                        <div key={index} className="post-attachment">
                          {attachment.type === 'image' ? (
                            <img 
                              src={(attachment as any).url || attachment.asset_url} 
                              alt={(attachment as any).name || attachment.title}
                              className="post-attachment-image"
                            />
                          ) : attachment.type === 'video' ? (
                            <video 
                              src={(attachment as any).url || attachment.asset_url}
                              controls
                              autoPlay
                              loop
                              muted
                              className="post-attachment-video"
                            >
                              Your browser does not support the video tag.
                            </video>
                          ) : attachment.type === 'poll' ? (
                            <div className="post-attachment-poll">
                              <div className="poll-header">
                                <img src={PollIcon} alt="Poll" width={20} height={20} />
                                <span className="poll-title">Poll</span>
                              </div>
                              <div className="poll-question">{(attachment as any).question}</div>
                              <div className="poll-options">
                                {(attachment as any).options?.map((option: string, optionIndex: number) => {
                                  const votes = (attachment as any).votes?.[optionIndex] || 0;
                                  const totalVotes = (attachment as any).votes?.reduce((sum: number, v: number) => sum + v, 0) || 0;
                                  const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                                  
                                  return (
                                    <div key={optionIndex} className="poll-option">
                                      <div className="poll-option-text">{option}</div>
                                      <div className="poll-option-stats">
                                        <div className="poll-option-bar">
                                          <div 
                                            className="poll-option-fill" 
                                            style={{ width: `${percentage}%` }}
                                          ></div>
                                        </div>
                                        <span className="poll-option-percentage">{percentage}%</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="poll-footer">
                                Total votes: {(attachment as any).votes?.reduce((sum: number, v: number) => sum + v, 0) || 0}
                              </div>
                            </div>
                          ) : (
                            <img src={attachment.asset_url} alt={attachment.title} className="post-attachment-image" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="post-actions">
                  <button className="action-button like-button">
                    <img src={HeartIcon} alt="Like" className="action-icon" />
                    {post.custom?.likes || 0}
                  </button>
                  <button className="action-button comment-button">
                    <img src={MessageIcon} alt="Comment" className="action-icon" />
                    {post.custom?.comments || 0}
                  </button>
                  <button className="action-button share-button">
                    <img src={ShareIcon} alt="Share" className="action-icon" />
                    {post.custom?.shares || 0}
                  </button>
                  <button className="action-button bookmark-button">
                    <img src={BookmarkIcon} alt="Bookmark" className="action-icon" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
