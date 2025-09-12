import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import LoadingSpinner from '../components/LoadingSpinner';
import LoadingIcon from '../components/LoadingIcon';
import { getSanitizedUserId, sanitizeUserId } from '../utils/userUtils';
import { formatRelativeTime } from '../utils/timeUtils';
import { getAuth0UserId, cacheUserIdMapping, getPublicUserId } from '../utils/idUtils';
import { apiCache } from '../utils/apiCache';
import streamFeedsManager from '../utils/streamFeedsClient';
import { useToast } from '../contexts/ToastContext';
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
  const { showSuccess, showError } = useToast();
  
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
        console.log('🔐 UserProfile: Got access token:', {
          hasToken: !!accessToken,
          tokenLength: accessToken?.length || 0,
          tokenStart: accessToken?.substring(0, 30) + '...' || 'none'
        });
        
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
          
          // Initialize Stream Feeds client for real-time state management
          await streamFeedsManager.initialize({ token, apiKey, userId: sanitizedUserId });
          console.log('✅ Stream Feeds client initialized for real-time counts in UserProfile');
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
        console.log('🔐 UserProfile fetchUserProfile: Got access token:', {
          hasToken: !!accessToken,
          tokenLength: accessToken?.length || 0,
          tokenStart: accessToken?.substring(0, 30) + '...' || 'none'
        });

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

                // Fetch user's posts - IMPORTANT: Sanitize targetUserId for Stream API consistency
        const sanitizedTargetUserId = sanitizeUserId(auth0UserId);
        console.log(`🔧 UserProfile: Sanitizing targetUserId "${auth0UserId}" → "${sanitizedTargetUserId}"`);
        
        console.log('🔐 UserProfile: About to call posts API with token:', {
          hasAccessToken: !!accessToken,
          tokenLength: accessToken?.length || 0,
          tokenStart: accessToken?.substring(0, 30) + '...' || 'none',
          payload: {
            type: 'posts',
            userId: feedsClient.userId,
            targetUserId: sanitizedTargetUserId,
            limit: 20
          }
        });
        
        const postsResponse = await fetch('/api/stream/user-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ 
            type: 'posts',
            userId: feedsClient.userId,
            targetUserId: sanitizedTargetUserId, // ✅ Now sanitized!
            limit: 20 
          }),
        });

        console.log('📡 UserProfile: Posts API response:', {
          status: postsResponse.status,
          statusText: postsResponse.statusText,
          ok: postsResponse.ok,
          headers: {
            'content-type': postsResponse.headers.get('content-type'),
            'cache-control': postsResponse.headers.get('cache-control')
          }
        });

        if (!postsResponse.ok) {
          const errorText = await postsResponse.text();
          console.error('❌ UserProfile: Posts API failed:', {
            status: postsResponse.status,
            statusText: postsResponse.statusText,
            errorText: errorText.substring(0, 500)
          });
          throw new Error('Failed to fetch user posts');
        }

        const postsData = await postsResponse.json();
        const userPosts = postsData.posts || [];

        // Get follow state from shared cache first  
        let isCurrentlyFollowing = apiCache.getFollowState(feedsClient.userId, auth0UserId);
        console.log('🎯 USERPROFILE: Cached follow state:', isCurrentlyFollowing);
        
        // If not cached, fetch from API
        if (isCurrentlyFollowing === null) {
          console.log('🌐 USERPROFILE: Follow state not cached, fetching from API...');
          
          const followingRes = await fetch('/api/stream/feed-actions', {
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

          if (followingRes.ok) {
            const followingList = await followingRes.json();
            isCurrentlyFollowing = followingList.following?.some((follow: any) => {
              const targetUserId = follow.target_id?.split(':')[1] || follow.target_id;
              console.log(`🔍 USERPROFILE: Checking follow relationship:`, {
                streamTargetId: follow.target_id,
                extractedUserId: targetUserId,
                currentUserId: auth0UserId,
                matches: targetUserId === auth0UserId
              });
              return targetUserId === auth0UserId;
            }) || false;
            
            // Cache the result and following list for consistency  
            apiCache.setFollowState(feedsClient.userId, auth0UserId, isCurrentlyFollowing || false);
            
            const followingUserIds = new Set<string>(
              (followingList.following || [])
                .map((follow: any) => {
                  const targetUserId = follow.target_id?.split(':')[1] || follow.target_id;
                  console.log(`🔍 USERPROFILE: Extracting user ID from:`, {
                    streamTargetId: follow.target_id,
                    extractedUserId: targetUserId
                  });
                  return targetUserId;
                })
                .filter((id: string) => id)
            );
            apiCache.setFollowingList(feedsClient.userId, followingUserIds);
          } else {
            isCurrentlyFollowing = false;
          }
        }

        // Get user counts using the same batch API as Feeds
        const userCounts = await apiCache.fetchUserCountsBatch(
          [auth0UserId],
          async (uncachedUserIds: string[]) => {
            if (uncachedUserIds.length === 0) return {};
            
            console.log(`📊 USERPROFILE: Batch fetching counts for user: ${auth0UserId}`);
            
            // CRITICAL: Sanitize all target user IDs for Stream API consistency
            const sanitizedTargetUserIds = uncachedUserIds.map(id => sanitizeUserId(id));
            console.log(`🔧 USERPROFILE: Sanitizing batch user IDs:`, uncachedUserIds.map((original, i) => 
              `"${original}" → "${sanitizedTargetUserIds[i]}"`));
            
            const response = await fetch('/api/stream/get-user-counts-batch', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
              },
              body: JSON.stringify({
                userId: feedsClient.userId,
                targetUserIds: sanitizedTargetUserIds  // ✅ Now sanitized!
              })
            });

            if (!response.ok) {
              console.warn('USERPROFILE: User counts request failed:', response.status);
              return {};
            }

            const data = await response.json();
            return data.userCounts || {};
          }
        );

        const counts = userCounts[auth0UserId] || { followers: 0, following: 0 };
        const followersData = { count: counts.followers };
        const followingData = { count: counts.following };

        // Try to get Stream Chat user data for better name/image (with caching)
        const chatUserData = await apiCache.fetchStreamChatUser(
          auth0UserId,
          async () => {
            console.log('🔍 Fetching Stream Chat user data for:', auth0UserId);
            // Sanitize for Stream Chat API consistency too
            const sanitizedChatUserId = sanitizeUserId(auth0UserId);
            console.log(`🔧 UserProfile: Sanitizing chat userId "${auth0UserId}" → "${sanitizedChatUserId}"`);
            
            console.log('🔐 UserProfile: Access token check:', {
              hasAccessToken: !!accessToken,
              tokenLength: accessToken?.length || 0,
              tokenStart: accessToken?.substring(0, 20) + '...' || 'none'
            });
            
            const chatUserResponse = await fetch('/api/stream/user-data', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ 
                type: 'chat-user',
                userId: sanitizedChatUserId  // ✅ Now sanitized!
              }),
            });
            
            console.log('📡 UserProfile: user-data response:', {
              status: chatUserResponse.status,
              statusText: chatUserResponse.statusText,
              ok: chatUserResponse.ok
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
        console.log('🔄 USERPROFILE: Setting initial follow state:', {
          targetUserId: auth0UserId,
          isCurrentlyFollowing,
          willSetFollowingTo: isCurrentlyFollowing || false,
          cacheKey: `follow_state_${feedsClient.userId}_${auth0UserId}`
        });
        setIsFollowing(isCurrentlyFollowing || false);
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

  // Function to refresh follow status and counts from Stream API using shared cache
  const refreshFollowData = async () => {
    if (!feedsClient?.userId || !profile?.userId) return;
    
    try {
      console.log('🔄 USERPROFILE: Refreshing follow data using shared cache...');
      
      // Use the same batch API as Feeds component for consistency
      const targetUserId = profile.userId;
      
      // Get follow state from cache first
      let isCurrentlyFollowing = apiCache.getFollowState(feedsClient.userId, targetUserId);
      
      // If not cached, fetch from API
      if (isCurrentlyFollowing === null) {
        console.log('🌐 USERPROFILE: Follow state not cached, fetching from API...');
        const accessToken = await getAccessTokenSilently();
        
        const followingRes = await fetch('/api/stream/feed-actions', {
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

        if (followingRes.ok) {
          const followingList = await followingRes.json();
          isCurrentlyFollowing = followingList.following?.some((follow: any) => 
            follow.target_id === targetUserId || follow.target?.split(':')[1] === targetUserId
          ) || false;
          
          // Cache the result
          apiCache.setFollowState(feedsClient.userId, targetUserId, isCurrentlyFollowing || false);
          
          // Also cache the full following list for Feeds component consistency
          const followingUserIds = new Set<string>(
            (followingList.following || [])
              .map((follow: any) => follow.target_id || follow.target?.split(':')[1])
              .filter((id: string) => id)
          );
          apiCache.setFollowingList(feedsClient.userId, followingUserIds);
        } else {
          isCurrentlyFollowing = false;
        }
      } else {
        console.log('🎯 USERPROFILE: Using cached follow state');
      }

      // Get user counts using real-time client-side state
      console.log(`📊 USERPROFILE: Fetching real-time counts for user: ${targetUserId}`);
      const accessToken = await getAccessTokenSilently();
      const counts = await streamFeedsManager.getUserCounts(targetUserId, accessToken);
      
      // Update state with fresh data
      console.log(`🔄 USERPROFILE: Setting follow state from cache:`, {
        isCurrentlyFollowing,
        targetUserId,
        cacheKey: `follow_state_${feedsClient.userId}_${targetUserId}`,
        willSetTo: isCurrentlyFollowing !== null ? isCurrentlyFollowing : false
      });
      setIsFollowing(isCurrentlyFollowing !== null ? isCurrentlyFollowing : false);
      setProfile(prev => prev ? {
        ...prev,
        followerCount: counts.followers,
        followingCount: counts.following
      } : null);
      
      console.log('✅ USERPROFILE: Follow data refreshed using shared cache:', {
        isFollowing: isCurrentlyFollowing,
        followerCount: counts.followers,
        followingCount: counts.following,
        usedCache: apiCache.getFollowState(feedsClient.userId, targetUserId) !== null
      });
      
    } catch (error) {
      console.error('❌ USERPROFILE: Error refreshing follow data:', error);
    }
  };

  const handleMessageUser = async () => {
    if (!feedsClient?.userId || !profile?.userId) return;

    try {
      const accessToken = await getAccessTokenSilently();
      
      // Create or get existing DM channel
      const response = await fetch('/api/stream/chat-operations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          type: 'create-channel',
          currentUserId: feedsClient.userId,
          isDM: true,
          selectedUsers: JSON.stringify([profile.userId]),
          channelName: `${profile.name}` // DM channel name
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create channel');
      }

      const result = await response.json();
      console.log('✅ DM Channel created/found:', result);
      
      showSuccess('Opening message...');
      
      // Navigate to chat with the specific channel ID
      navigate(`/chat/${result.channelId}`);
      
    } catch (err: any) {
      console.error('❌ Error creating DM channel:', err);
      showError('Failed to start conversation. Please try again.');
    }
  };

  const handleFollow = async () => {
    if (!feedsClient?.userId || !profile?.userId) return;

    const targetUserId = profile.userId;
    const currentlyFollowing = isFollowing;
    const action = currentlyFollowing ? 'unfollow_user' : 'follow_user';
    
    console.log(`🐥 USERPROFILE: Starting ${action} for user ${targetUserId}`, {
      currentUserId: feedsClient.userId,
      targetUserId,
      currentlyFollowing,
      action
    });

    // Optimistic UI update
    setIsFollowing(!currentlyFollowing);
    setProfile(prev => prev ? {
      ...prev,
      followerCount: prev.followerCount + (currentlyFollowing ? -1 : 1)
    } : null);

    try {
      const accessToken = await getAccessTokenSilently();
      
      const requestBody = {
        action,
        userId: feedsClient.userId,
        targetUserId
      };
      
      console.log(`🚀 USERPROFILE: Making ${action} API call:`, {
        url: '/api/stream/feed-actions',
        method: 'POST',
        body: requestBody,
        hasAccessToken: !!accessToken
      });
      
      const response = await fetch('/api/stream/feed-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log(`💬 USERPROFILE: API response status:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Follow API failed:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          action,
          targetUserId
        });
        throw new Error(`Failed to ${action}: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log(`✅ USERPROFILE: ${action} response data:`, responseData);
      
      // Update shared cache to notify all components
      apiCache.updateFollowState(feedsClient.userId, targetUserId, !currentlyFollowing);
      console.log(`📝 USERPROFILE: Updated shared follow state cache`);
      
      // Broadcast follow state change for other components (like Feeds)
      // This ensures the hover modal in Feeds shows the correct follow button state
      window.dispatchEvent(new CustomEvent('followStateChanged', {
        detail: {
          currentUserId: feedsClient.userId,
          targetUserId,
          isFollowing: !currentlyFollowing
        }
      }));
      console.log(`📡 USERPROFILE: Broadcasted follow state change event`);
      
      // Small delay to ensure Stream API has processed the follow relationship
      console.log(`⏱️ USERPROFILE: Waiting 500ms for Stream API to process follow relationship...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // CRITICAL: Update follower counts only (trust the optimistic follow state update)
      console.log(`🔄 USERPROFILE: Fetching updated follower counts from client-side state...`);
      console.log(`🎯 USERPROFILE DEBUG: Follow action context:`, {
        currentUser: feedsClient.userId,
        targetUser: targetUserId,
        action,
        followDirection: `${feedsClient.userId} ${!currentlyFollowing ? 'follows' : 'unfollows'} ${targetUserId}`,
        expectedChanges: {
          [`${feedsClient.userId}_following`]: !currentlyFollowing ? '+1' : '-1',
          [`${targetUserId}_followers`]: !currentlyFollowing ? '+1' : '-1',
          [`${feedsClient.userId}_followers`]: 'unchanged',
          [`${targetUserId}_following`]: 'unchanged'
        }
      });
      
      try {
        const counts = await streamFeedsManager.getUserCounts(targetUserId, accessToken);
        console.log(`📊 USERPROFILE DEBUG: Count API returned for ${targetUserId}:`, {
          followers: counts.followers,
          following: counts.following,
          note: `These are ${targetUserId}'s counts (followers of them + people they follow)`
        });
        
        setProfile(prev => prev ? {
          ...prev,
          followerCount: counts.followers,
          followingCount: counts.following
        } : null);
        console.log(`✅ USERPROFILE: Updated follower counts:`, {
          followers: counts.followers,
          following: counts.following,
          followButtonState: !currentlyFollowing // Should match optimistic update
        });
      } catch (error) {
        console.error('❌ USERPROFILE: Error fetching updated counts:', error);
      }
      
      // Show success toast
      showSuccess(currentlyFollowing ? 'User unfollowed successfully!' : 'User followed successfully!');
      
    } catch (err: any) {
      console.error('❌ USERPROFILE: Error updating follow status:', err);
      
      // Revert UI state on failure
      setIsFollowing(currentlyFollowing);
      setProfile(prev => prev ? {
        ...prev,
        followerCount: prev.followerCount + (currentlyFollowing ? 1 : -1)
      } : null);
      
      showError(`Failed to ${currentlyFollowing ? 'unfollow' : 'follow'} user. Please try again.`);
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
            <div className="profile-action-buttons">
              <button 
                className="profile-message-button"
                onClick={handleMessageUser}
                title="Send message"
              >
                <img src={MessageIcon} alt="Message" className="button-icon" />
                Message
              </button>
              <button 
                className={`profile-follow-button ${isFollowing ? 'following' : ''}`}
                onClick={handleFollow}
              >
                {(() => {
                  console.log(`🔘 USERPROFILE: Rendering follow button, isFollowing: ${isFollowing}, targetUserId: ${profile?.userId}`);
                  return isFollowing ? 'Following' : 'Follow';
                })()}
              </button>
            </div>
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
