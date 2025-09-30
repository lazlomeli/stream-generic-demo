import React, { useEffect, useState, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import LoadingIcon from './LoadingIcon';
import MobileBottomNav from './MobileBottomNav';
import { getSanitizedUserId, sanitizeUserId } from '../utils/userUtils';
import { formatRelativeTime } from '../utils/timeUtils';
import { getPublicUserId, cacheUserIdMapping, cacheMultipleUserIdMappings } from '../utils/idUtils';
import { apiCache } from '../utils/apiCache';
import { apiMonitor } from '../utils/apiMonitor';
import streamFeedsManager from '../utils/streamFeedsClient';
import { useToast } from '../contexts/ToastContext';
import { useResponsive } from '../contexts/ResponsiveContext';
import HeartIcon from '../icons/heart.svg';
import HeartFilledIcon from '../icons/heart-filled.svg';
import MessageIcon from '../icons/message-circle.svg';
import ShareIcon from '../icons/share-3.svg';
import BookmarkIcon from '../icons/bookmark.svg';
import BookmarkFilledIcon from '../icons/bookmark-filled.svg';
import SmartImage from './SmartImage';
import TrashIcon from '../icons/trash.svg';
import CameraIcon from '../icons/camera.svg';
import VideoIcon from '../icons/video.svg';
import PollIcon from '../icons/poll.svg';
import StreamLogo from '../assets/stream-logo.png';
import './Feeds.css';

// User mapping for demo users
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

// Helper function to get user display name
const getUserDisplayName = (actorId: string, currentUser: any, userInfo?: any, userProfile?: any) => {

  // If this is the current user, use their Auth0 profile
  if (actorId === currentUser?.sub || actorId === getSanitizedUserId(currentUser)) {
    return currentUser?.name || currentUser?.email || 'You';
  }
  
  // First priority: Use stored userProfile data from the post (most accurate)
  if (userProfile?.name) {
    return userProfile.name;
  }
  
  // Second priority: Use userInfo from backend enrichment
  if (userInfo?.name) {
    return userInfo.name;
  }
  
  // Fallback to demo users mapping
  const demoUser = DEMO_USERS[actorId as keyof typeof DEMO_USERS];
  if (demoUser) {
    return demoUser.name;
  }
  
  // Handle timestamped user IDs (e.g., alice_smith_1234567890 -> alice_smith)
  if (actorId.includes('_') && /\d{13}$/.test(actorId)) {
    const baseUserId = actorId.replace(/_\d{13}$/, '');
    const baseDemoUser = DEMO_USERS[baseUserId as keyof typeof DEMO_USERS];
    if (baseDemoUser) {
      return baseDemoUser.name;
    }
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

// Helper function to get user profile image
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
  
  // Handle timestamped user IDs (e.g., alice_smith_1234567890 -> alice_smith)
  if (actorId.includes('_') && /\d{13}$/.test(actorId)) {
    const baseUserId = actorId.replace(/_\d{13}$/, '');
    const baseDemoUser = DEMO_USERS[baseUserId as keyof typeof DEMO_USERS];
    if (baseDemoUser) {
      return baseDemoUser.image;
    }
  }
  
  return undefined;
};

// Helper function to generate user initials (same as UserProfile)
const getUserInitials = (name: string): string => {
  if (!name) return 'U';
  
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';
};

// Helper function to format joined date
const formatJoinedDate = (actorId: string) => {
  // Simple hardcoded demo date
  return '23rd Aug 2024';
};

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
  // Add user info fields
  userInfo?: {
    name: string;
    image: string;
    role?: string;
    company?: string;
  };
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

const Feeds = () => {
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useToast();
  const { isMobileView, toggleView } = useResponsive();
  const [feedsClient, setFeedsClient] = useState<any>(null);
  const [clientReady, setClientReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string>('');
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<string>>(new Set());
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());
  const [userCounts, setUserCounts] = useState<{ [userId: string]: { followers: number; following: number } }>({});
  const [hoveredPost, setHoveredPost] = useState<string | null>(null);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [modalFadingOut, setModalFadingOut] = useState<string | null>(null);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set());

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
  
  // Demo attachment state
  const [selectedAttachments, setSelectedAttachments] = useState<Array<{
    type: 'image' | 'video' | 'poll';
    url: string;
    name: string;
    question?: string;
    options?: string[];
    votes?: number[];
  }>>([]);
  const highlightedPostRef = useRef<HTMLDivElement>(null);
  const lastScrolledHighlight = useRef<string | null>(null);

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
        apiMonitor.logCall('/api/stream/auth-tokens', 'POST', 'Feeds-initFeedsClient');
        
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

        // Store the token and API key
        setFeedsClient({ token, apiKey, userId: sanitizedUserId });
        
        // Initialize Stream Feeds client for real-time state management
        await streamFeedsManager.initialize({ token, apiKey, userId: sanitizedUserId });
        console.log('✅ Stream Feeds client initialized for real-time counts');
        
        setClientReady(true);
        
        // Note: Demo seeding removed - only seed via reset button or explicit action
        // This prevents automatic user creation on every page load
        
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
        console.log(`🚀 FEEDS INIT: FeedsClient ready, initializing feeds for user ${feedsClient.userId}`);
        console.log(`🚀 FEEDS INIT: Starting parallel fetch of posts, bookmarks, and following users...`);
        
        fetchPosts(feedsClient.userId);
        fetchLikedPosts(feedsClient.userId);
        fetchBookmarkedPosts(feedsClient.userId);
        fetchFollowingUsers(feedsClient.userId);
    } else {
        console.log(`🚀 FEEDS INIT: FeedsClient not ready yet, waiting...`);
    }
  }, [feedsClient]);

  // Listen for follow state changes from other components (like UserProfile)
  useEffect(() => {
    const handleFollowStateChange = async (event: CustomEvent) => {
      const { currentUserId, targetUserId, isFollowing } = event.detail;
      
      if (currentUserId === feedsClient?.userId) {
        console.log('📡 FEEDS: Received follow state change event:', event.detail);
        
        // Update local state to reflect the change
        setFollowingUsers(prev => {
          const newSet = new Set(prev);
          if (isFollowing) {
            newSet.add(targetUserId);
          } else {
            newSet.delete(targetUserId);
          }
          return newSet;
        });
        
        // Force refresh user counts to get updated follower/following numbers
        setUserCounts(prev => {
          const updatedCounts = { ...prev };
          // Apply optimistic update based on the follow action
          if (updatedCounts[targetUserId]) {
            updatedCounts[targetUserId] = {
              ...updatedCounts[targetUserId],
              followers: isFollowing 
                ? updatedCounts[targetUserId].followers + 1 
                : updatedCounts[targetUserId].followers - 1
            };
          }
          return updatedCounts;
        });
        
        // Update follower counts efficiently using cached batch API
        console.log(`🔄 FEEDS EVENT: Updating follower counts from cached state...`);
        try {
          // Use cached data first, only fetch if not available
          const cachedCounts = apiCache.getUserCounts(targetUserId);
          if (cachedCounts) {
            setUserCounts(prev => ({
              ...prev,
              [targetUserId]: cachedCounts
            }));
            console.log(`✅ FEEDS EVENT: Updated from cache:`, cachedCounts);
          } else {
            // If not cached, trigger efficient batch fetch for this single user
            await fetchUserCounts([targetUserId]);
          }
        } catch (error) {
          console.error('❌ FEEDS EVENT: Error updating counts:', error);
        }
        
        console.log('✅ FEEDS: Updated local state from follow change event');
      }
    };

    const eventListener = (event: Event) => {
      handleFollowStateChange(event as CustomEvent);
    };

    window.addEventListener('followStateChanged', eventListener);
    
    return () => {
      window.removeEventListener('followStateChanged', eventListener);
    };
  }, [feedsClient?.userId]);

  // Fetch user counts when posts are loaded
  useEffect(() => {
    if (posts.length > 0) {
      // Get unique user IDs from posts (excluding current user)
      const userIds = [...new Set(
        posts
          .map(post => post.actor)
          .filter(actorId => actorId && actorId !== feedsClient?.userId)
      )];
      
      if (userIds.length > 0) {
        // Cache user ID mappings for all users in batch
        const userMappings = userIds.map(userId => ({ auth0UserId: userId }));
        cacheMultipleUserIdMappings(userMappings);
        
        fetchUserCounts(userIds);
      }
    }
  }, [posts, feedsClient?.userId]);

  // Auto-scroll to highlighted post when highlight parameter changes (not on post updates)
  useEffect(() => {
    const highlightPostId = searchParams.get('highlight');
    
    // Only scroll if we have a highlight ID and haven't already scrolled to it
    if (highlightPostId && highlightPostId !== lastScrolledHighlight.current && posts.length > 0) {
      // Check if the highlighted post exists in the current posts
      const highlightedPost = posts.find(post => post.id === highlightPostId);
      
      if (highlightedPost) {

        lastScrolledHighlight.current = highlightPostId; // Mark as scrolled
        
        // Use a longer delay and retry mechanism to ensure proper scrolling
        const scrollToPost = (attempt = 1) => {
          let element = highlightedPostRef.current;
          
          // Fallback: try to find the highlighted post by class if ref fails
          if (!element) {
            element = document.querySelector('.highlighted-post') as HTMLDivElement;

          }
          
          if (element) {

            
            // Ensure the element is fully rendered before scrolling
            requestAnimationFrame(() => {
              element?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
              });
            });
          } else if (attempt < 8) {
            // Retry up to 8 times with increasing delay

            setTimeout(() => scrollToPost(attempt + 1), attempt * 300);
          } else {
            console.warn('⚠️ Could not scroll to highlighted post after 8 attempts');
          }
        };
        
        // Initial scroll attempt with delay to ensure DOM is ready
        setTimeout(() => scrollToPost(), 500);
      } else {

      }
    }
    
    // Clear the scroll tracking when highlight parameter is removed
    if (!highlightPostId) {
      lastScrolledHighlight.current = null;
    }
  }, [searchParams, posts]);

  // Additional scroll trigger when posts are loaded and there's a highlight parameter
  useEffect(() => {
    const highlightPostId = searchParams.get('highlight');
    if (highlightPostId && posts.length > 0 && highlightPostId === lastScrolledHighlight.current) {
      // Only run this secondary check if we've already attempted to scroll to this highlight
      setTimeout(() => {
        const element = document.querySelector('.highlighted-post') as HTMLDivElement;
        if (element) {
          const rect = element.getBoundingClientRect();
          const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
          
          if (!isVisible) {

            element.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest'
            });
          }
        }
      }, 1000); // Check after 1 second
    }
  }, [posts.length, searchParams]);

  // Remove highlight after 3 seconds
  useEffect(() => {
    const highlightPostId = searchParams.get('highlight');
    
    if (highlightPostId) {
      const timer = setTimeout(() => {
        // Remove the highlight parameter from URL
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('highlight');
        setSearchParams(newSearchParams, { replace: true });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams]);

  // OPTIMIZED: Reduce bookmark refresh frequency
  useEffect(() => {
    let lastRefresh = 0;
    const REFRESH_COOLDOWN = 30000; // Only refresh every 30 seconds
    
    const handleVisibilityChange = () => {
      const now = Date.now();
      if (!document.hidden && feedsClient?.userId && (now - lastRefresh) > REFRESH_COOLDOWN) {
        console.log(`⚡ OPTIMIZED: Refreshing bookmarks (cooldown respected)`);
        fetchBookmarkedPosts(feedsClient.userId);
        lastRefresh = now;
      } else if (!document.hidden) {
        console.log(`⚡ OPTIMIZED: Skipping bookmark refresh (cooldown active)`);
      }
    };

    const handleFocus = () => {
      const now = Date.now();
      if (feedsClient?.userId && (now - lastRefresh) > REFRESH_COOLDOWN) {
        console.log(`⚡ OPTIMIZED: Refreshing bookmarks on focus (cooldown respected)`);
        fetchBookmarkedPosts(feedsClient.userId);
        lastRefresh = now;
      } else {
        console.log(`⚡ OPTIMIZED: Skipping bookmark refresh on focus (cooldown active)`);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [feedsClient]);

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

  // Hover handlers for user modal
  const handleUserMouseEnter = (postId: string) => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setModalFadingOut(null); // Cancel any fade-out
    setHoveredPost(postId);
  };

  const handleUserMouseLeave = () => {
    if (hoveredPost) {
      // Start fade-out animation
      setModalFadingOut(hoveredPost);
      
      // Remove modal from DOM after animation completes
      const timeout = setTimeout(() => {
        setHoveredPost(null);
        setModalFadingOut(null);
      }, 200); // Match the animation duration
      
      setHoverTimeout(timeout);
    }
  };



  // Function to fetch liked posts to sync like state
  const fetchLikedPosts = async (userId?: string) => {
    const userIdToUse = userId || feedsClient?.userId;
    if (!userIdToUse) {
      console.log('❤️ FETCH_LIKES: No userId available, skipping fetch');
      return;
    }

    try {
      console.log(`❤️ FETCH_LIKES: Starting fetch for user ${userIdToUse}`);
      const accessToken = await getAccessTokenSilently();
      
      const response = await fetch('/api/stream/feed-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          action: 'get_liked_posts',
          userId: userIdToUse
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch liked posts');
      }

      const data = await response.json();
      console.log(`❤️ FETCH_LIKES: API response:`, data);

      if (data.success && data.likedPostIds) {
        // Update liked posts state
        const likedPostIds = new Set<string>(data.likedPostIds as string[]);
        console.log(`❤️ FETCH_LIKES: Found ${likedPostIds.size} liked posts:`, Array.from(likedPostIds));

        setLikedPosts(likedPostIds);
        console.log(`❤️ FETCH_LIKES: Updated liked state with ${likedPostIds.size} posts`);
      } else {
        console.log(`❤️ FETCH_LIKES: No liked posts found or unsuccessful response`);
        setLikedPosts(new Set<string>());
      }
    } catch (error) {
      console.error('❤️ FETCH_LIKES: Error fetching liked posts:', error);
      // Don't show error to user as this is background sync
      // But ensure we have a clean state
      setLikedPosts(new Set<string>());
    }
  };

  // Function to fetch bookmarked posts to sync bookmark state
  const fetchBookmarkedPosts = async (userId?: string) => {
    const userIdToUse = userId || feedsClient?.userId;
    if (!userIdToUse) {
      console.log('🔖 FETCH_BOOKMARKS: No userId available, skipping fetch');
      return;
    }

    try {
      console.log(`🔖 FETCH_BOOKMARKS: Starting fetch for user ${userIdToUse}`);
      const accessToken = await getAccessTokenSilently();
      
      const response = await fetch('/api/stream/feed-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          action: 'get_bookmarked_posts',
          userId: userIdToUse
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bookmarked posts');
      }

      const data = await response.json();
      console.log(`🔖 FETCH_BOOKMARKS: API response:`, data);

      if (data.success && data.bookmarkedPosts) {
        // Extract post IDs and update bookmarked posts state
        const bookmarkedPostIds = new Set<string>(data.bookmarkedPosts.map((post: any) => post.id as string));
        console.log(`🔖 FETCH_BOOKMARKS: Found ${bookmarkedPostIds.size} bookmarked posts:`, Array.from(bookmarkedPostIds));

        setBookmarkedPosts(bookmarkedPostIds);
        console.log(`🔖 FETCH_BOOKMARKS: Updated bookmark state with ${bookmarkedPostIds.size} posts`);
      } else {
        console.log(`🔖 FETCH_BOOKMARKS: No bookmarked posts found or unsuccessful response`);
        setBookmarkedPosts(new Set<string>());
      }
    } catch (error) {
      console.error('🔖 FETCH_BOOKMARKS: Error fetching bookmarked posts:', error);
      // Don't show error to user as this is background sync
      // But ensure we have a clean state
      setBookmarkedPosts(new Set<string>());
    }
  };

  // Function to fetch users that current user is following using shared cache
  const fetchFollowingUsers = async (userId?: string) => {
    const userIdToUse = userId || feedsClient?.userId;
    if (!userIdToUse) return;

    try {
      console.log('🔄 FEEDS: Fetching following users using shared cache...');
      
      // Check cache first
      let followingUserIds = apiCache.getFollowingList(userIdToUse);
      
      if (!followingUserIds) {
        console.log('🌐 FEEDS: Following list not cached, fetching from API...');
        const accessToken = await getAccessTokenSilently();
        
        const response = await fetch('/api/stream/feed-actions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            action: 'get_following',
            userId: userIdToUse
          })
        });

        if (!response.ok) {
          throw new Error('Failed to fetch following users');
        }

        const data = await response.json();

        if (data.success && data.following) {
          // Extract user IDs from following list
          followingUserIds = new Set<string>(
            data.following
              .map((follow: any) => {
                const targetUserId = follow.target_id?.split(':')[1] || follow.target_id;
                console.log(`🔍 FEEDS: Extracting user ID from:`, {
                  streamTargetId: follow.target_id,
                  extractedUserId: targetUserId
                });
                return targetUserId;
              })
              .filter((id: string) => id)
          );

          // Cache the result for other components to use
          apiCache.setFollowingList(userIdToUse, followingUserIds);
          console.log(`💾 FEEDS: Cached following list for ${userIdToUse}`);
        } else {
          followingUserIds = new Set<string>();
        }
      } else {
        console.log('🎯 FEEDS: Using cached following list');
      }

      console.log('🔄 FEEDS: Setting initial following users state:', {
        userId: userIdToUse,
        followingCount: followingUserIds.size,
        followingUserIds: Array.from(followingUserIds),
        fromCache: !!apiCache.getFollowingList(userIdToUse)
      });
      setFollowingUsers(followingUserIds);
    } catch (error) {
      console.error('Error fetching following users:', error);
      // Don't show error to user as this is background sync
    }
  };

  // Real-time function to fetch follower/following counts using client-side state
  const fetchUserCounts = async (userIds: string[]) => {
    if (!feedsClient?.userId || userIds.length === 0) {
      return;
    }

    try {
      console.log(`📊 Batch fetching user counts for ${userIds.length} users with caching`);
      
      // Get access token for authenticated API calls
      const accessToken = await getAccessTokenSilently();
      
      // Use the efficient batch API with caching
      const newCounts = await apiCache.fetchUserCountsBatch(userIds, async (uncachedUserIds) => {
        console.log(`🚀 Making SINGLE batch API call for ${uncachedUserIds.length} uncached users`);
        
        const requestPayload = {
          userId: feedsClient.userId,
          targetUserIds: uncachedUserIds
        };
        
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }
        
        const response = await fetch('/api/stream/get-user-counts-batch', {
          method: 'POST',
          headers,
          body: JSON.stringify(requestPayload)
        });

        if (!response.ok) {
          throw new Error(`Batch user counts failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.userCounts || {};
      });

      console.log(`✅ Efficient batch counts fetched (${Object.keys(newCounts).length} users):`, newCounts);

      // Update state with the batch-fetched counts
      setUserCounts(prev => ({
        ...prev,
        ...newCounts
      }));

    } catch (error) {
      console.error('❌ Error in efficient batch user counts:', error);
    }
  };



  // Function to fetch real posts from Stream feeds (hybrid approach)
  const fetchPosts = async (userId?: string) => {
    const userIdToUse = userId || feedsClient?.userId;
    
    if (!userIdToUse) {

      return;
    }
    
    try {
      const accessToken = await getAccessTokenSilently();
      
      // Fetch from timeline feed (posts from followed users + own posts)
      apiMonitor.logCall('/api/stream/get-posts', 'POST', 'Feeds-fetchPosts-timeline');
      
      const timelineResponse = await fetch('/api/stream/get-posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userId: userIdToUse,
          feedGroup: 'timeline',
          feedId: userIdToUse,
          limit: 15
        }),
      });
      
      let timelinePosts: any[] = [];
      if (timelineResponse.ok) {
        const timelineResult = await timelineResponse.json();
        timelinePosts = timelineResult.activities || [];

      }
      
      // If timeline has few posts, supplement with global feed for discovery
      let globalPosts: any[] = [];
      if (timelinePosts.length < 10) {

        const globalResponse = await fetch('/api/stream/get-posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            userId: userIdToUse,
            feedGroup: 'flat',
            feedId: 'global',
            limit: 10
          }),
        });
        
        if (globalResponse.ok) {
          const globalResult = await globalResponse.json();
          globalPosts = globalResult.activities || [];

        }
      }
      
      // Combine and deduplicate posts
      const allPosts = [...timelinePosts, ...globalPosts];
      const uniquePosts = allPosts.filter((activity, index, self) => 
        index === self.findIndex(a => a.id === activity.id)
      );
      
      // Sort by creation time (newest first)
      uniquePosts.sort((a, b) => new Date(b.time || b.created_at).getTime() - new Date(a.time || a.created_at).getTime());
      

      
      // Transform Stream activities to our FeedPost format
      const streamPosts: FeedPost[] = uniquePosts.map((activity: any) => {
        const actorId = activity.actor;
        
        // Check if this is marked as current user's post from server
        const isOwnPost = activity.isCurrentUser || actorId === userIdToUse;
        
        // Get user display name and profile image
        const displayName = getUserDisplayName(actorId, user, activity.userInfo, activity.userProfile);
        const profileImage = getUserProfileImage(actorId, user, activity.userInfo, activity.userProfile);
        
        // Debug: log when Stream Chat provides image data
        if (activity.userInfo?.image && actorId !== userIdToUse) {
          console.log(`📰 Feed post has image for ${actorId}: ${activity.userInfo.image.slice(0, 50)}...`);
        } else if (actorId !== userIdToUse) {
          console.log(`📰 Feed post has NO image for ${actorId}`);
        }
        
        const userInfo = {
          name: displayName,
          image: profileImage,
          role: isOwnPost ? 'Current User' : undefined,
          company: undefined
        };
        
        return {
          id: activity.id,
          actor: actorId,
          text: activity.text && activity.text.trim() && activity.text !== 'media' ? activity.text : '',
          attachments: activity.attachments || [],
          custom: activity.custom || {
            likes: 0,
            shares: 0,
            comments: 0,
            category: 'general'
          },
          time: activity.time,
          created_at: activity.time,
          isOwnPost: isOwnPost,
          userInfo: userInfo,
          userProfile: activity.userProfile // Store the full user profile
        };
      });
      
      setPosts(streamPosts);

      
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

  };

  // Demo attachment functions
  const addRandomPhoto = () => {
    const photoId = Math.floor(Math.random() * 1000) + 1;
    const newPhoto = {
      type: 'image' as const,
      url: `https://picsum.photos/800/600?random=${photoId}`,
      name: `Random Photo ${photoId}`
    };
    
    setSelectedAttachments(prev => [...prev, newPhoto]);

  };

  const addRandomVideo = () => {
    // Using sample videos from a CDN or placeholder service
    const videos = [
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4'
    ];
    
    const randomVideo = videos[Math.floor(Math.random() * videos.length)];
    const videoName = randomVideo.split('/').pop()?.replace('.mp4', '') || 'Sample Video';
    
    const newVideo = {
      type: 'video' as const,
      url: randomVideo,
      name: videoName
    };
    
    setSelectedAttachments(prev => [...prev, newVideo]);

  };

  const addDemoPoll = () => {
    // Demo poll questions
    const pollQuestions = [
      'What\'s your favorite programming language?',
      'Best time for team meetings?',
      'Preferred development environment?',
      'Most useful development tool?',
      'Favorite project management methodology?'
    ];
    
    const pollOptions = [
      ['JavaScript', 'Python', 'TypeScript', 'Go'],
      ['Morning (9-11 AM)', 'Afternoon (1-3 PM)', 'Late afternoon (3-5 PM)', 'Flexible'],
      ['VS Code', 'IntelliJ', 'Vim/Neovim', 'Sublime Text'],
      ['Git', 'Docker', 'Postman', 'Chrome DevTools'],
      ['Agile', 'Scrum', 'Kanban', 'Waterfall']
    ];
    
    const randomIndex = Math.floor(Math.random() * pollQuestions.length);
    const question = pollQuestions[randomIndex];
    const options = pollOptions[randomIndex];
    
    // Generate some random demo votes to show the voting interface
    const demoVotes = options.map(() => Math.floor(Math.random() * 25) + 5); // 5-29 votes per option
    
    const newPoll = {
      type: 'poll' as const,
      url: '', // Polls don't need URLs
      name: `Poll`,
      question: question,
      options: options,
      votes: demoVotes
    };
    
    setSelectedAttachments(prev => [...prev, newPoll]);

  };

  const removeAttachment = (index: number) => {
    setSelectedAttachments(prev => prev.filter((_, i) => i !== index));

  };

  // Create a post
  const createPost = async () => {
    // Allow posts with either text or attachments (or both)
    if ((newPostText.trim() === '' && selectedAttachments.length === 0) || !feedsClient?.userId) return;

    // Prevent double submission
    if (isCreatingPost) {
      console.log('⚠️ Post creation already in progress, ignoring duplicate request');
      return;
    }

    setIsCreatingPost(true);
    try {
      const accessToken = await getAccessTokenSilently();
      
      // Send complete user profile information for better post display
      const userProfile = {
        name: user?.name || user?.email || 'Anonymous User',
        image: user?.picture || undefined,
        role: 'User',
        company: undefined,
        // Include all Auth0 profile fields
        given_name: user?.given_name || undefined,
        family_name: user?.family_name || undefined,
        nickname: user?.nickname || undefined,
        email: user?.email || undefined,
        sub: user?.sub || undefined
      };
      

      
      // Convert demo attachments to the format expected by the API
      const attachments = selectedAttachments.map(attachment => {
        const baseAttachment = {
          type: attachment.type,
          name: attachment.name,
          url: attachment.url,
          asset_url: attachment.url, // For backward compatibility
          mime_type: attachment.type === 'image' ? 'image/jpeg' : attachment.type === 'video' ? 'video/mp4' : 'application/json',
          title: attachment.name
        };

        // Include poll-specific data for poll attachments
        if (attachment.type === 'poll') {
          return {
            ...baseAttachment,
            question: attachment.question,
            options: attachment.options,
            votes: attachment.votes
          };
        }

        return baseAttachment;
      });
      

      
      const payload = {
        action: 'create_post',
        userId: feedsClient.userId,
        postData: {
          text: newPostText.trim(),
          category: 'general',
          attachments: attachments
        },
        userProfile: userProfile
      };

      // Log payload size for debugging
      const payloadSize = new Blob([JSON.stringify(payload)]).size;


      const response = await fetch('/api/stream/feed-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server response:', errorText);
        throw new Error(`Failed to create post: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      // OPTIMIZED: Add new post to state instead of refetching entire feed
      console.log(`⚡ OPTIMIZED: Adding new post to state instead of full refetch`);
      
      if (response.ok && result.activity) {
        console.log('✅ Post created successfully:', result);
        
        // Transform the new activity to FeedPost format (similar to fetchPosts logic)
        const activity = result.activity;
        const actorId = activity.actor;
        const isOwnPost = actorId === feedsClient.userId;
        
        // Use the userProfile data we sent with the post
        const displayName = userProfile.name || userProfile.email || actorId || 'Anonymous User';
        const profileImage = userProfile.image;
        
        const newPost: FeedPost = {
          id: activity.id,
          actor: actorId,
          text: activity.text && activity.text.trim() && activity.text !== 'media' ? activity.text : '',
          attachments: activity.attachments || [],
          custom: activity.custom || {
            likes: 0,
            shares: 0,
            comments: 0,
            category: 'general'
          },
          time: activity.time || activity.created_at,
          created_at: activity.time || activity.created_at,
          isOwnPost: isOwnPost,
          userInfo: {
            name: displayName,
            image: profileImage || '',
            role: isOwnPost ? 'Current User' : undefined,
            company: userProfile.company || undefined
          },
          userProfile: activity.userProfile || userProfile
        };
        
        // Add the new post to the beginning of posts array
        setPosts(prevPosts => [newPost, ...prevPosts]);
        console.log('✅ New post added to feed immediately');
        
        // Show success toast
        showSuccess('Post created successfully!');
      }
      
      setNewPostText('');
      
      // Clear selected attachments
      setSelectedAttachments([]);
      

      
    } catch (err: any) {
      console.error('❌ Error creating post:', err);
      showError('Failed to create post. Please try again.');
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

      // OPTIMIZED: Remove post from state instead of refetching entire feed
      console.log(`⚡ OPTIMIZED: Removing deleted post from state instead of full refetch`);
      
      setPosts(prev => prev.filter(post => post.id !== postId));
      
      // Optional: Refresh feed after delay to ensure accuracy (uncomment if needed)
      // setTimeout(() => fetchPosts(feedsClient.userId), 10000);
      
      // Close the delete modal
      setShowDeleteModal(null);
      
      // Show success toast
      showSuccess('Post deleted successfully!');
      
    } catch (err: any) {
      console.error('Error deleting post:', err);
      showError('Failed to delete post. Please try again.');
    } finally {
      setIsDeletingPost(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!feedsClient?.userId) return;

    const isCurrentlyLiked = likedPosts.has(postId);
    const action = isCurrentlyLiked ? 'unlike_post' : 'like_post';

    console.log(`❤️ HANDLE_LIKE: Starting ${action} for post ${postId}`);
    console.log(`❤️ HANDLE_LIKE: Current like state before action:`, {
      isCurrentlyLiked,
      totalLikedPosts: likedPosts.size,
      allLikedPostIds: Array.from(likedPosts)
    });
    
    try {
      const accessToken = await getAccessTokenSilently();
      
      const response = await fetch('/api/stream/feed-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action,
          userId: feedsClient.userId,
          postId
        }),
      });

      const responseData = await response.json();
      console.log(`❤️ HANDLE_LIKE: API response for ${action}:`, responseData);

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to update like');
      }

      // CRITICAL FIX: Refresh like state from backend after successful operation
      console.log(`❤️ HANDLE_LIKE: ${action} successful, refreshing like state from backend...`);

      // Store previous state for comparison
      const previousLikeState = new Set(likedPosts);
      console.log(`❤️ HANDLE_LIKE: Previous like state:`, Array.from(previousLikeState));

      await fetchLikedPosts(feedsClient.userId);

      // Log state after refresh
      setTimeout(() => {
        console.log(`❤️ HANDLE_LIKE: Like state after refresh:`, {
          currentLikedPosts: likedPosts.size,
          allLikedPostIds: Array.from(likedPosts),
          wasPostLiked: likedPosts.has(postId),
          expectedState: !isCurrentlyLiked
        });
      }, 100); // Small delay to ensure state has updated

      // Update post like count in local state  
      setPosts(prevPosts => 
        prevPosts.map(post => {
          if (post.id === postId && post.custom) {
            return {
              ...post,
              custom: {
                likes: isCurrentlyLiked ? Math.max(0, post.custom.likes - 1) : post.custom.likes + 1,
                shares: post.custom.shares,
                comments: post.custom.comments,
                category: post.custom.category
              }
            };
          }
          return post;
        })
      );

      // Show success toast
      showSuccess(isCurrentlyLiked ? 'Like removed!' : 'Post liked!');

    } catch (err: any) {
      console.error('❤️ HANDLE_LIKE: Error updating like:', err);
      showError('Failed to update like. Please try again.');
    }
  };

  const handleBookmark = async (postId: string) => {
    if (!feedsClient?.userId) return;

    const isCurrentlyBookmarked = bookmarkedPosts.has(postId);
    const action = isCurrentlyBookmarked ? 'remove_bookmark' : 'bookmark_post';
    
    console.log(`🔖 HANDLE_BOOKMARK: Starting ${action} for post ${postId}`);
    console.log(`🔖 HANDLE_BOOKMARK: Current bookmark state before action:`, {
      isCurrentlyBookmarked,
      totalBookmarkedPosts: bookmarkedPosts.size,
      allBookmarkedPostIds: Array.from(bookmarkedPosts)
    });
    
    try {
      const accessToken = await getAccessTokenSilently();
      
      const response = await fetch('/api/stream/feed-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action,
          userId: feedsClient.userId,
          postId
        }),
      });

      const responseData = await response.json();
      console.log(`🔖 HANDLE_BOOKMARK: API response for ${action}:`, responseData);

      if (!response.ok) {
        throw new Error(`Failed to update bookmark: ${responseData.error || response.statusText}`);
      }

      // CRITICAL FIX: Refresh bookmark state from backend after successful operation
      console.log(`🔖 HANDLE_BOOKMARK: ${action} successful, refreshing bookmark state from backend...`);
      
      // Store previous state for comparison
      const previousBookmarkState = new Set(bookmarkedPosts);
      console.log(`🔖 HANDLE_BOOKMARK: Previous bookmark state:`, Array.from(previousBookmarkState));
      
      await fetchBookmarkedPosts(feedsClient.userId);
      
      // Log state after refresh
      setTimeout(() => {
        console.log(`🔖 HANDLE_BOOKMARK: Bookmark state after refresh:`, {
          currentBookmarkedPosts: bookmarkedPosts.size,
          allBookmarkedPostIds: Array.from(bookmarkedPosts),
          wasPostBookmarked: bookmarkedPosts.has(postId),
          expectedState: !isCurrentlyBookmarked
        });
      }, 100); // Small delay to ensure state has updated
      
      // Show success toast
      showSuccess(isCurrentlyBookmarked ? 'Bookmark removed!' : 'Post bookmarked!');
      
    } catch (err: any) {
      console.error('🔖 HANDLE_BOOKMARK: Error updating bookmark:', err);
      showError('Failed to update bookmark. Please try again.');
    }
  };

  const handleUserNameClick = (auth0UserId: string) => {
    // Cache the mapping and navigate with public (hashed) ID
    const publicUserId = getPublicUserId(auth0UserId);
    cacheUserIdMapping(auth0UserId, publicUserId);
    navigate(`/profile/${publicUserId}`);
  };

  const handleImageError = (actorId: string) => {
    console.log(`❌ Feed image failed to load for actor: ${actorId}`);
    setImageLoadErrors(prev => new Set(prev).add(actorId));
  };

  const handleImageLoad = (actorId: string) => {
    console.log(`✅ Feed image loaded successfully for actor: ${actorId}`);
    // Remove from error set if it was there
    setImageLoadErrors(prev => {
      const newSet = new Set(prev);
      newSet.delete(actorId);
      return newSet;
    });
  };

  const handleFollow = async (targetUserId: string) => {
    if (!feedsClient?.userId || targetUserId === feedsClient.userId) return;

    const isCurrentlyFollowing = followingUsers.has(targetUserId);
    const action = isCurrentlyFollowing ? 'unfollow_user' : 'follow_user';
    
    console.log(`👥 FRONTEND: Starting ${action} for user ${targetUserId}`, {
      currentUserId: feedsClient.userId,
      targetUserId,
      isCurrentlyFollowing,
      action
    });
    

    
    try {
      const accessToken = await getAccessTokenSilently();
      
      const requestBody = {
        action,
        userId: feedsClient.userId,
        targetUserId
      };
      
      console.log(`🚀 FRONTEND: Making ${action} API call:`, {
        url: '/api/stream/feed-actions',
        method: 'POST',
        body: requestBody,
        hasAccessToken: !!accessToken
      });
      
      apiMonitor.logCall('/api/stream/feed-actions', 'POST', `Feeds-handleFollow-${action}`);
      
      const response = await fetch('/api/stream/feed-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log(`💬 FRONTEND: API response status:`, {
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
      console.log(`✅ FRONTEND: ${action} response data:`, responseData);

      // Update local state (optimistic update)
      setFollowingUsers(prev => {
        const newFollowing = new Set(prev);
        if (isCurrentlyFollowing) {
          console.log(`🔄 FEEDS: Removing ${targetUserId} from following list (unfollow)`);
          newFollowing.delete(targetUserId);
        } else {
          console.log(`🔄 FEEDS: Adding ${targetUserId} to following list (follow)`);
          newFollowing.add(targetUserId);
        }
        console.log(`✅ FEEDS: Updated following state - now following ${newFollowing.size} users`);
        return newFollowing;
      });

      // Update follower count for the target user
      setUserCounts(prev => {
        const newCounts = { ...prev };
        if (newCounts[targetUserId]) {
          const currentFollowers = newCounts[targetUserId].followers;
          newCounts[targetUserId] = {
            ...newCounts[targetUserId],
            followers: isCurrentlyFollowing ? currentFollowers - 1 : currentFollowers + 1
          };
        }
        return newCounts;
      });
      
      // Update shared cache to sync with other components
      apiCache.updateFollowState(feedsClient.userId, targetUserId, !isCurrentlyFollowing);
      console.log(`📝 FEEDS: Updated shared follow state cache`);
      
      // Broadcast follow state change for other components (like UserProfile)
      window.dispatchEvent(new CustomEvent('followStateChanged', {
        detail: {
          currentUserId: feedsClient.userId,
          targetUserId,
          isFollowing: !isCurrentlyFollowing
        }
      }));
      console.log(`📡 FEEDS: Broadcasted follow state change event`);
      
      // CRITICAL: Update follower counts efficiently (trust the optimistic follow state update)
      console.log(`🔄 FEEDS: Refreshing follower counts efficiently...`);
      try {
        // Clear cache for this user to force fresh data, then use efficient batch fetch
        apiCache.clearUserCounts([targetUserId]);
        await fetchUserCounts([targetUserId]);
        
        console.log(`✅ FEEDS: Follower counts refreshed efficiently after follow action`);
      } catch (error) {
        console.error('❌ FEEDS: Error fetching updated counts:', error);
      }
      
    } catch (err: any) {
      console.error('❌ Error updating follow status:', err);
      
      // Revert UI state on failure
      setFollowingUsers(prev => {
        const newFollowing = new Set(prev);
        if (isCurrentlyFollowing) {
          // Was trying to unfollow, revert back to following
          newFollowing.add(targetUserId);
        } else {
          // Was trying to follow, revert back to not following
          newFollowing.delete(targetUserId);
        }
        return newFollowing;
      });
      
      // Revert follower count
      setUserCounts(prev => {
        const newCounts = { ...prev };
        if (newCounts[targetUserId]) {
          const currentFollowers = newCounts[targetUserId].followers;
          newCounts[targetUserId] = {
            ...newCounts[targetUserId],
            followers: isCurrentlyFollowing ? currentFollowers + 1 : currentFollowers - 1
          };
        }
        return newCounts;
      });
      
      alert(`Failed to ${isCurrentlyFollowing ? 'unfollow' : 'follow'} user. Please try again.`);
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

    console.log(`💬 ADD_COMMENT_FRONTEND: Starting comment process for post ${postId}`);
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

      const responseData = await response.json();
      console.log(`💬 ADD_COMMENT_FRONTEND: API response:`, responseData);

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to add comment');
      }

      // ✅ IMMEDIATE COMMENT DISPLAY: Add the new comment to local state
      if (responseData.success && responseData.comment) {
        console.log(`💬 ADD_COMMENT_FRONTEND: Adding comment to local state immediately`);
        
        // Create a properly formatted comment object for display
        const newComment = {
          id: responseData.comment.id,
          activity_id: postId,
          data: {
            text: commentText.trim()
          },
          user_id: feedsClient.userId,
          created_at: responseData.comment.created_at || new Date().toISOString(),
          kind: 'comment'
        };

        // Add to local comment state immediately
        setPostComments(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), newComment]
        }));

        // Update the comment count in the posts array 
        setPosts(prevPosts => 
          prevPosts.map(post => {
            if (post.id === postId) {
              const currentCount = post.custom?.comments || 0;
              return {
                ...post,
                custom: {
                  likes: post.custom?.likes || 0,
                  shares: post.custom?.shares || 0,
                  comments: currentCount + 1,
                  category: post.custom?.category || 'general'
                }
              };
            }
            return post;
          })
        );

        console.log(`💬 ADD_COMMENT_FRONTEND: Comment added to local state and count updated`);
      }

      // If comments are currently shown, also refresh from backend to ensure accuracy
      if (showComments === postId) {
        console.log(`💬 ADD_COMMENT_FRONTEND: Refreshing comments from backend for accuracy`);
        setTimeout(() => fetchComments(postId), 1000); // Small delay to ensure backend is consistent
      }

      setCommentText('');
      setShowCommentInput(null);
      
      // Show success toast
      showSuccess('Comment added successfully!');
      
    } catch (err: any) {
      console.error('💬 ADD_COMMENT_FRONTEND: Error adding comment:', err);
      showError('Failed to add comment. Please try again.');
    } finally {
      setIsAddingComment(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return <LoadingSpinner />;
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
    return <LoadingSpinner />;
  }

  // Render feeds when client is ready and posts are loaded
  const feedsContent = (
    <div className="feeds-container">
      {/* Mobile Stream Logo */}
      {isMobileView && (
        <div className="mobile-stream-logo">
          <img src={StreamLogo} alt="Stream" className="stream-logo-icon" />
        </div>
      )}
      {/* Inline Post Creation */}
      <div className="create-post-inline">
        <div className="create-post-author">
          <div className="author-avatar">
            {user?.picture ? (
              <img src={user.picture} alt={user.name || 'You'} />
            ) : (
              <div className="avatar-fallback">
                {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
        <div className="create-post-content">
          <textarea
            value={newPostText}
            onChange={(e) => setNewPostText(e.target.value)}
            placeholder="What's on your mind?"
            className="create-post-textarea"
            rows={3}
          />
          
          {/* Demo attachment preview section */}
          {selectedAttachments.length > 0 && (
            <div className="file-preview-container">
              {selectedAttachments.map((attachment, index) => (
                <div key={index} className="file-preview-item">
                  <div className="file-preview-content">
                    {attachment.type === 'image' ? (
                      <img 
                        src={attachment.url} 
                        alt={attachment.name}
                        className="file-preview-image"
                      />
                    ) : attachment.type === 'video' ? (
                      <div className="file-preview-video">
                        <video 
                          src={attachment.url}
                          className="file-preview-video-element"
                          controls
                          autoPlay
                          loop
                          muted
                        />
                      </div>
                    ) : attachment.type === 'poll' ? (
                      <div className="file-preview-poll">
                        <div className="poll-preview-header">
                          <img src={PollIcon} alt="Poll" width={20} height={20} />
                          <span>Poll</span>
                        </div>
                        <div className="poll-question">{attachment.question}</div>
                        <div className="poll-options">
                          {attachment.options?.map((option, optionIndex) => (
                            <div key={optionIndex} className="poll-option-preview">
                              {option}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="file-preview-info">
                    <span className="file-name">{attachment.name}</span>
                    <span className="file-size">Demo {attachment.type}</span>
                  </div>
                  <button 
                    className="file-remove-button"
                    onClick={() => removeAttachment(index)}
                    title="Remove attachment"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          

          
          <div className="create-post-actions">
            <div className="create-post-media">
              <button 
                className="media-button" 
                title="Add random demo photo" 
                onClick={addRandomPhoto}
              >
                <img src={CameraIcon} alt="Camera" width={20} height={20} />
                <span>Photo</span>
              </button>
              <button 
                className="media-button" 
                title="Add random demo video" 
                onClick={addRandomVideo}
              >
                <img src={VideoIcon} alt="Video" width={20} height={20} />
                <span>Video</span>
              </button>
              <button 
                className="media-button" 
                title="Add demo poll" 
                onClick={addDemoPoll}
              >
                <img src={PollIcon} alt="Poll" width={20} height={20} />
                <span>Poll</span>
              </button>
            </div>
            <button 
              className="create-post-submit"
              onClick={createPost}
              disabled={(newPostText.trim() === '' && selectedAttachments.length === 0) || isCreatingPost}
            >
              {isCreatingPost ? <LoadingIcon size={48} /> : 'Post'}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Feed Tabs */}
      {isMobileView && (
        <div className="mobile-feed-tabs">
          <div className="feed-tab active">For You</div>
          <div className="feed-tab">Following</div>
        </div>
      )}

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
            <div 
              key={post.id} 
              className={`feed-post ${isHighlighted ? 'highlighted-post' : ''}`}
              ref={isHighlighted ? highlightedPostRef : null}
            >
              <div className="post-header">
                <div className="post-author">
                  <div 
                    className={`post-author-info ${!post.isOwnPost && post.actor && post.actor !== feedsClient?.userId ? 'user-hover-container' : ''}`}
                    onMouseEnter={!post.isOwnPost && post.actor && post.actor !== feedsClient?.userId ? () => handleUserMouseEnter(post.id) : undefined}
                    onMouseLeave={!post.isOwnPost && post.actor && post.actor !== feedsClient?.userId ? handleUserMouseLeave : undefined}
                  >
                    <div className="author-avatar">
                      {post.userInfo?.image && !imageLoadErrors.has(post.actor) ? (
                        <img 
                          src={post.userInfo.image}
                          alt={post.userInfo?.name}
                          onError={() => handleImageError(post.actor)}
                          onLoad={() => handleImageLoad(post.actor)}
                        />
                        ) : (
                        // Show initials avatar if no profile picture or image failed to load
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
                          {getUserInitials(post.userInfo?.name || 'Unknown User')}
                        </div>
                      )}
                    </div>
                    <div className="author-info">
                      <div className="author-name-row">
                        <span 
                          className="author-name clickable-name"
                          onClick={() => handleUserNameClick(post.actor)}
                          style={{ cursor: 'pointer' }}
                        >
                          {post.userInfo?.name || 'Unknown User'}
                        </span>
                      </div>
                      <span className="post-time">{formatRelativeTime(post.time || post.created_at || new Date())}</span>
                    </div>

                    {/* User hover modal - now inside the hover container */}
                    {(hoveredPost === post.id || modalFadingOut === post.id) && !post.isOwnPost && (
                      <div 
                        className={`user-hover-modal ${modalFadingOut === post.id ? 'fading-out' : ''}`}
                        onClick={() => handleUserNameClick(post.actor)}
                        onMouseEnter={() => handleUserMouseEnter(post.id)}
                        onMouseLeave={handleUserMouseLeave}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="user-modal-header">
                          <div className="user-modal-avatar">
                            {post.userInfo?.image && !imageLoadErrors.has(post.actor) ? (
                              <img 
                                src={post.userInfo.image} 
                                alt={post.userInfo?.name}
                                onError={() => handleImageError(post.actor)}
                                onLoad={() => handleImageLoad(post.actor)}
                              />
                            ) : (
                              <div className="modal-initials-avatar">
                                {getUserInitials(post.userInfo?.name || 'Unknown User')}
                              </div>
                            )}
                          </div>
                          <div className="user-modal-info">
                            <h4 className="user-modal-name">{post.userInfo?.name || 'Unknown User'}</h4>
                            <div className="user-modal-stats">
                              {userCounts[post.actor] ? (
                                <>
                                  <span><strong>{userCounts[post.actor].followers}</strong> followers</span>
                                  <span><strong>{userCounts[post.actor].following}</strong> following</span>
                                </>
                              ) : (
                                <>
                                  <span><strong>-</strong> followers</span>
                                  <span><strong>-</strong> following</span>
                                </>
                              )}
                            </div>
                            <div className="user-joined-date">
                              Joined {formatJoinedDate(post.actor)}
                            </div>
                          </div>
                        </div>
                        <button 
                          className={`modal-follow-button ${followingUsers.has(post.actor) ? 'following' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent modal click
                            console.log(`🔘 FEEDS MODAL: Follow button clicked for ${post.actor}, currently following: ${followingUsers.has(post.actor)}`);
                            handleFollow(post.actor);
                          }}
                        >
                      {(() => {
                        const isFollowing = followingUsers.has(post.actor);
                        return isFollowing ? 'Following' : 'Follow';
                      })()}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Top right buttons */}
                <div className="post-header-actions">
                  {/* Follow button for other users' posts */}
                  {!post.isOwnPost && post.actor && post.actor !== feedsClient?.userId && (
                    <button 
                      className={`follow-button ${followingUsers.has(post.actor) ? 'following' : ''}`}
                      onClick={() => {
                        console.log(`🔘 FEEDS HEADER: Follow button clicked for ${post.actor}, currently following: ${followingUsers.has(post.actor)}`);
                        handleFollow(post.actor);
                      }}
                      title={followingUsers.has(post.actor) ? 'Unfollow user' : 'Follow user'}
                    >
                      {(() => {
                        const isFollowing = followingUsers.has(post.actor);
                        return isFollowing ? 'Following' : 'Follow';
                      })()}
                    </button>
                  )}
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
                {post.text && post.text.trim() && post.text !== 'media' && post.text !== 'post' && (
                  <p className="post-text">{post.text}</p>
                )}
                {post.attachments && post.attachments.length > 0 && (
                  <div className="post-attachments">
                    {post.attachments.map((attachment, index) => (
                      <div key={index} className="post-attachment">
                        {attachment.type === 'image' ? (
                          <SmartImage 
                            src={attachment.asset_url || (attachment as any).url || `data:${(attachment as any).mimeType || attachment.mime_type};base64,${(attachment as any).data}`} 
                            alt={(attachment as any).name || attachment.title || 'Post image'}
                            className="post-attachment-image"
                            title={attachment.title || 'Post image'}
                          />
                        ) : attachment.type === 'video' ? (
                          <video 
                            src={(attachment as any).url || `data:${(attachment as any).mimeType || attachment.mime_type};base64,${(attachment as any).data}`}
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
                          // Fallback for legacy attachments
                          <img src={attachment.asset_url} alt={attachment.title} className="post-attachment-image" />
                        )}
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
                  onClick={() => {
                    console.log(`🔖 BOOKMARK_CLICK: Post ${post.id}, currently bookmarked: ${bookmarkedPosts.has(post.id)}`);
                    console.log(`🔖 BOOKMARK_CLICK: Current bookmark state:`, Array.from(bookmarkedPosts));
                    handleBookmark(post.id);
                  }}
                  title={bookmarkedPosts.has(post.id) ? 'Remove bookmark' : 'Add bookmark'}
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
                    {loadingComments === post.id ? (
                      <LoadingIcon size={48} />
                    ) : showComments === post.id ? 'Hide Comments' : 
                     `View Comments (${post.custom?.comments || 0})`}
                  </button>
                </div>
              )}

              {/* Debug comment count */}
              {process.env.NODE_ENV === 'development' && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  Debug: comments = {post.custom?.comments || 0} 
                  {(post.custom?.comments || 0) === 0 && ' (button hidden)'}
                  {(post.custom?.comments || 0) > 0 && ' (button visible)'}
                  , custom = {JSON.stringify(post.custom)}
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

  // Mobile view wrapper
  if (isMobileView) {
    return (
      <div className="feeds-container mobile-view">
        <div className="feeds-content mobile-content">
          {feedsContent}
          <MobileBottomNav currentPath={location.pathname} />
        </div>
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
  return feedsContent;
};

export default Feeds;
