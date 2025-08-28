import React, { useEffect, useState, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useSearchParams } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import LoadingIcon from './LoadingIcon';
import { getSanitizedUserId } from '../utils/userUtils';
import { formatRelativeTime } from '../utils/timeUtils';
import HeartIcon from '../icons/heart.svg';
import HeartFilledIcon from '../icons/heart-filled.svg';
import MessageIcon from '../icons/message-circle.svg';
import ShareIcon from '../icons/share-3.svg';
import BookmarkIcon from '../icons/bookmark.svg';
import BookmarkFilledIcon from '../icons/bookmark-filled.svg';
import TrashIcon from '../icons/trash.svg';
import CameraIcon from '../icons/camera.svg';
import VideoIcon from '../icons/video.svg';
import PollIcon from '../icons/poll.svg';
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
  
  return undefined;
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
  const [hoveredUser, setHoveredUser] = useState<string | null>(null);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [modalFadingOut, setModalFadingOut] = useState<string | null>(null);

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
        const response = await fetch('/api/stream/feed-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ 
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
              console.log('🔄 FeedsClient ready, fetching initial posts, bookmark state, and following status...');
        fetchPosts(feedsClient.userId);
        fetchBookmarkedPosts(feedsClient.userId);
        fetchFollowingUsers(feedsClient.userId);
    }
  }, [feedsClient]);

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
        console.log('📊 Fetching counts for users:', userIds);
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
        console.log('🎯 Scrolling to highlighted post:', highlightPostId, 'in', posts.length, 'posts');
        lastScrolledHighlight.current = highlightPostId; // Mark as scrolled
        
        // Use a longer delay and retry mechanism to ensure proper scrolling
        const scrollToPost = (attempt = 1) => {
          let element = highlightedPostRef.current;
          
          // Fallback: try to find the highlighted post by class if ref fails
          if (!element) {
            element = document.querySelector('.highlighted-post') as HTMLDivElement;
            console.log('📍 Using fallback querySelector for highlighted post');
          }
          
          if (element) {
            console.log('📍 Scrolling to element, attempt:', attempt);
            
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
            console.log('⏳ Retrying scroll, attempt:', attempt + 1);
            setTimeout(() => scrollToPost(attempt + 1), attempt * 300);
          } else {
            console.warn('⚠️ Could not scroll to highlighted post after 8 attempts');
          }
        };
        
        // Initial scroll attempt with delay to ensure DOM is ready
        setTimeout(() => scrollToPost(), 500);
      } else {
        console.log('⚠️ Highlighted post not found in current posts:', highlightPostId, 'Available posts:', posts.map(p => p.id));
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
            console.log('🔄 Post not visible, scrolling again...');
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

  // Refresh bookmark state when user returns to the page (e.g., from bookmarked page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && feedsClient?.userId) {
        console.log('🔄 Page became visible, refreshing bookmark state...');
        fetchBookmarkedPosts(feedsClient.userId);
      }
    };

    const handleFocus = () => {
      if (feedsClient?.userId) {
        console.log('🔄 Page focused, refreshing bookmark state...');
        fetchBookmarkedPosts(feedsClient.userId);
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
  const handleUserMouseEnter = (userId: string) => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setModalFadingOut(null); // Cancel any fade-out
    setHoveredUser(userId);
  };

  const handleUserMouseLeave = () => {
    if (hoveredUser) {
      // Start fade-out animation
      setModalFadingOut(hoveredUser);
      
      // Remove modal from DOM after animation completes
      const timeout = setTimeout(() => {
        setHoveredUser(null);
        setModalFadingOut(null);
      }, 200); // Match the animation duration
      
      setHoverTimeout(timeout);
    }
  };



  // Function to fetch bookmarked posts to sync bookmark state
  const fetchBookmarkedPosts = async (userId?: string) => {
    const userIdToUse = userId || feedsClient?.userId;
    if (!userIdToUse) return;

    try {
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
      console.log('📖 Fetch bookmarked posts response:', data);
      if (data.success && data.bookmarkedPosts) {
        // Extract post IDs and update bookmarked posts state
        const bookmarkedPostIds = new Set<string>(data.bookmarkedPosts.map((post: any) => post.id as string));
        console.log('📖 Extracted bookmark IDs:', Array.from(bookmarkedPostIds));
        setBookmarkedPosts(bookmarkedPostIds);
        console.log('📖 Synced bookmark state:', bookmarkedPostIds.size, 'bookmarked posts');
      }
    } catch (error) {
      console.error('Error fetching bookmarked posts:', error);
      // Don't show error to user as this is background sync
    }
  };

  // Function to fetch users that current user is following
  const fetchFollowingUsers = async (userId?: string) => {
    const userIdToUse = userId || feedsClient?.userId;
    if (!userIdToUse) return;

    try {
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
      console.log('👥 Fetch following users response:', data);
      if (data.success && data.following) {
        // Extract user IDs from following list
        const followingUserIds = new Set<string>(
          data.following
            .map((follow: any) => follow.target_id || follow.target?.split(':')[1])
            .filter((id: string) => id)
        );
        console.log('👥 Following user IDs:', Array.from(followingUserIds));
        setFollowingUsers(followingUserIds);
      }
    } catch (error) {
      console.error('Error fetching following users:', error);
      // Don't show error to user as this is background sync
    }
  };

  // Function to fetch follower/following counts for users visible in posts
  const fetchUserCounts = async (userIds: string[]) => {
    if (!feedsClient?.userId || userIds.length === 0) return;

    try {
      const accessToken = await getAccessTokenSilently();
      
      // Fetch counts for each user in parallel
      const countPromises = userIds.map(async (userId) => {
        try {
          const [followersRes, followingRes] = await Promise.all([
            fetch('/api/stream/feed-actions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
              },
              body: JSON.stringify({
                action: 'get_followers',
                userId: feedsClient.userId, // Current user context
                targetUserId: userId,
                limit: 1 // Just for count
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
                userId: userId, // Target user's following
                limit: 1 // Just for count
              })
            })
          ]);

          const [followersData, followingData] = await Promise.all([
            followersRes.ok ? followersRes.json() : { count: 0 },
            followingRes.ok ? followingRes.json() : { count: 0 }
          ]);

          return {
            userId,
            followers: followersData.count || 0,
            following: followingData.count || 0
          };
        } catch (error) {
          console.warn(`Failed to fetch counts for user ${userId}:`, error);
          return {
            userId,
            followers: 0,
            following: 0
          };
        }
      });

      const results = await Promise.all(countPromises);
      
      // Update state with new counts
      setUserCounts(prev => {
        const newCounts = { ...prev };
        results.forEach(({ userId, followers, following }) => {
          newCounts[userId] = { followers, following };
        });
        return newCounts;
      });

      console.log('📊 Updated user counts for:', userIds.length, 'users');
    } catch (error) {
      console.error('Error fetching user counts:', error);
    }
  };



  // Function to fetch real posts from Stream feeds (hybrid approach)
  const fetchPosts = async (userId?: string) => {
    const userIdToUse = userId || feedsClient?.userId;
    
    if (!userIdToUse) {
      console.log('❌ No userId available, skipping fetchPosts');
      return;
    }
    
    try {
      const accessToken = await getAccessTokenSilently();
      
      // Fetch from timeline feed (posts from followed users + own posts)
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
        console.log(`📰 Loaded ${timelinePosts.length} posts from timeline feed`);
      }
      
      // If timeline has few posts, supplement with global feed for discovery
      let globalPosts: any[] = [];
      if (timelinePosts.length < 10) {
        console.log('📰 Timeline has few posts, fetching from global feed for discovery...');
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
          console.log(`🌍 Loaded ${globalPosts.length} posts from global feed`);
        }
      }
      
      // Combine and deduplicate posts
      const allPosts = [...timelinePosts, ...globalPosts];
      const uniquePosts = allPosts.filter((activity, index, self) => 
        index === self.findIndex(a => a.id === activity.id)
      );
      
      // Sort by creation time (newest first)
      uniquePosts.sort((a, b) => new Date(b.time || b.created_at).getTime() - new Date(a.time || a.created_at).getTime());
      
      console.log(`📰 Combined ${uniquePosts.length} unique posts (${timelinePosts.length} timeline + ${globalPosts.length} global)`);
      
      // Transform Stream activities to our FeedPost format
      const streamPosts: FeedPost[] = uniquePosts.map((activity: any) => {
        const actorId = activity.actor;
        
        // Check if this is marked as current user's post from server
        const isOwnPost = activity.isCurrentUser || actorId === userIdToUse;
        
        // Get user display name and profile image
        const displayName = getUserDisplayName(actorId, user, activity.userInfo, activity.userProfile);
        const profileImage = getUserProfileImage(actorId, user, activity.userInfo, activity.userProfile);
        
        const userInfo = {
          name: displayName,
          image: profileImage,
          role: isOwnPost ? 'Current User' : undefined,
          company: undefined
        };
        
        return {
          id: activity.id,
          actor: actorId,
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
          isOwnPost: isOwnPost,
          userInfo: userInfo,
          userProfile: activity.userProfile // Store the full user profile
        };
      });
      
      setPosts(streamPosts);
      console.log(`✅ Final feed contains ${streamPosts.length} posts`);
      
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

  // Demo attachment functions
  const addRandomPhoto = () => {
    const photoId = Math.floor(Math.random() * 1000) + 1;
    const newPhoto = {
      type: 'image' as const,
      url: `https://picsum.photos/800/600?random=${photoId}`,
      name: `Random Photo ${photoId}`
    };
    
    setSelectedAttachments(prev => [...prev, newPhoto]);
    console.log('📸 Added random photo:', newPhoto.url);
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
    console.log('🎥 Added random video:', newVideo.url);
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
      name: `Poll: ${question}`,
      question: question,
      options: options,
      votes: demoVotes
    };
    
    setSelectedAttachments(prev => [...prev, newPoll]);
    console.log('📊 Added demo poll:', question);
  };

  const removeAttachment = (index: number) => {
    setSelectedAttachments(prev => prev.filter((_, i) => i !== index));
    console.log(`🗑️ Removed attachment at index ${index}`);
  };

  // Create a post
  const createPost = async () => {
    // Allow posts with either text or attachments (or both)
    if ((newPostText.trim() === '' && selectedAttachments.length === 0) || !feedsClient?.userId) return;

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
      
      console.log('📝 Sending user profile for post creation:', JSON.stringify(userProfile, null, 2));
      
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
      
      console.log('📎 Demo attachments prepared:', attachments.length);
      
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
      console.log(`📦 Request payload size: ${(payloadSize / 1024).toFixed(2)}KB`);

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
      
      // Refresh posts from Stream to show the new post
      await fetchPosts(feedsClient.userId);
      
      setNewPostText('');
      
      // Clear selected attachments
      setSelectedAttachments([]);
      
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
    const action = isCurrentlyBookmarked ? 'remove_bookmark' : 'bookmark_post';
    
    console.log('🔖 Bookmark action:', action, 'for post:', postId, 'currently bookmarked:', isCurrentlyBookmarked);
    
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
      console.log('🔖 Bookmark API response:', responseData);

      if (!response.ok) {
        throw new Error(`Failed to update bookmark: ${responseData.error || response.statusText}`);
      }

      // Update local state
      setBookmarkedPosts(prev => {
        const newBookmarked = new Set(prev);
        if (isCurrentlyBookmarked) {
          console.log('🔖 Removing from local state:', postId);
          newBookmarked.delete(postId);
        } else {
          console.log('🔖 Adding to local state:', postId);
          newBookmarked.add(postId);
        }
        console.log('🔖 Updated local bookmarked posts:', Array.from(newBookmarked));
        return newBookmarked;
      });
      
    } catch (err: any) {
      console.error('Error updating bookmark:', err);
      alert('Failed to update bookmark. Please try again.');
    }
  };

  const handleFollow = async (targetUserId: string) => {
    if (!feedsClient?.userId || targetUserId === feedsClient.userId) return;

    const isCurrentlyFollowing = followingUsers.has(targetUserId);
    const action = isCurrentlyFollowing ? 'unfollow_user' : 'follow_user';
    
    console.log('👥 Follow action:', action, 'for user:', targetUserId);
    
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
          targetUserId
        }),
      });

      const responseData = await response.json();
      console.log('👥 Follow API response:', responseData);

      if (!response.ok) {
        throw new Error(`Failed to ${action}: ${responseData.error || response.statusText}`);
      }

      // Update local state
      setFollowingUsers(prev => {
        const newFollowing = new Set(prev);
        if (isCurrentlyFollowing) {
          console.log('👥 Removing from following:', targetUserId);
          newFollowing.delete(targetUserId);
        } else {
          console.log('👥 Adding to following:', targetUserId);
          newFollowing.add(targetUserId);
        }
        console.log('👥 Updated following users:', Array.from(newFollowing));
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
      
    } catch (err: any) {
      console.error('Error updating follow status:', err);
      alert('Failed to update follow status. Please try again.');
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

      // If comments are currently shown, refresh them
      if (showComments === postId) {
        await fetchComments(postId);
      }

      // Refresh posts to get updated comment counts from server
      await fetchPosts(feedsClient.userId);

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
  return (
    <div className="feeds-container">
      <div className="feeds-header">
        <h1>Activity Feeds</h1>
      </div>



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
                          <span>Poll Preview</span>
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
                <span>Demo Photo</span>
              </button>
              <button 
                className="media-button" 
                title="Add random demo video" 
                onClick={addRandomVideo}
              >
                <img src={VideoIcon} alt="Video" width={20} height={20} />
                <span>Demo Video</span>
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
              {isCreatingPost ? <LoadingIcon size={16} /> : 'Post'}
            </button>
          </div>
        </div>
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
            <div 
              key={post.id} 
              className={`feed-post ${isHighlighted ? 'highlighted-post' : ''}`}
              ref={isHighlighted ? highlightedPostRef : null}
            >
              <div className="post-header">
                <div className="post-author">
                  <div 
                    className={`post-author-info ${!post.isOwnPost && post.actor && post.actor !== feedsClient?.userId ? 'user-hover-container' : ''}`}
                    onMouseEnter={!post.isOwnPost && post.actor && post.actor !== feedsClient?.userId ? () => handleUserMouseEnter(post.actor) : undefined}
                    onMouseLeave={!post.isOwnPost && post.actor && post.actor !== feedsClient?.userId ? handleUserMouseLeave : undefined}
                  >
                    <div className="author-avatar">
                      {post.userInfo?.image ? (
                        <img 
                          src={post.userInfo.image}
                          alt={post.userInfo?.name}
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
                      <div className="author-name-row">
                        <span className="author-name">
                          {post.userInfo?.name || 'Unknown User'}
                        </span>
                      </div>
                      <span className="post-time">{formatRelativeTime(post.time || post.created_at || new Date())}</span>
                    </div>

                    {/* User hover modal - now inside the hover container */}
                    {(hoveredUser === post.actor || modalFadingOut === post.actor) && !post.isOwnPost && userCounts[post.actor] && (
                      <div className={`user-hover-modal ${modalFadingOut === post.actor ? 'fading-out' : ''}`}>
                        <div className="user-modal-header">
                          <div className="user-modal-avatar">
                            {post.userInfo?.image ? (
                              <img src={post.userInfo.image} alt={post.userInfo?.name} />
                            ) : (
                              <div className="modal-initials-avatar">
                                {(post.userInfo?.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                              </div>
                            )}
                          </div>
                          <div className="user-modal-info">
                            <h4 className="user-modal-name">{post.userInfo?.name || 'Unknown User'}</h4>
                            <div className="user-modal-stats">
                              <span><strong>{userCounts[post.actor].followers}</strong> followers</span>
                              <span><strong>{userCounts[post.actor].following}</strong> following</span>
                            </div>
                            <div className="user-joined-date">
                              Joined {formatJoinedDate(post.actor)}
                            </div>
                          </div>
                        </div>
                        <button 
                          className={`modal-follow-button ${followingUsers.has(post.actor) ? 'following' : ''}`}
                          onClick={() => handleFollow(post.actor)}
                        >
                          {followingUsers.has(post.actor) ? 'Following' : 'Follow'}
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
                      onClick={() => handleFollow(post.actor)}
                      title={followingUsers.has(post.actor) ? 'Unfollow user' : 'Follow user'}
                    >
                      {followingUsers.has(post.actor) ? 'Following' : 'Follow'}
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
                {post.text && post.text.trim() && (
                  <p className="post-text">{post.text}</p>
                )}
                {post.attachments && post.attachments.length > 0 && (
                  <div className="post-attachments">
                    {post.attachments.map((attachment, index) => (
                      <div key={index} className="post-attachment">
                        {attachment.type === 'image' ? (
                          <img 
                            src={(attachment as any).url || `data:${(attachment as any).mimeType || attachment.mime_type};base64,${(attachment as any).data}`} 
                            alt={(attachment as any).name || attachment.title}
                            className="post-attachment-image"
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
                    {loadingComments === post.id ? (
                      <LoadingIcon size={16} />
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
};

export default Feeds;
