import { Composer } from './Composer';
import Activity from './Activity';
import { useEffect, useRef } from 'react';
import { useSearch } from '../hooks/feeds/useSearch';
import { useSearchParams, useLocation, useParams, useNavigate } from 'react-router-dom';
import { usePopularActivities } from '../hooks/feeds/usePopularActivities';
import { useFeedActivities } from '../hooks/feeds/useFeedActivities';
import { useHashtagFeed } from '../hooks/feeds/useHashtagFeed';
import { useResponsive } from '../contexts/ResponsiveContext';
import MobileBottomNav from './MobileBottomNav';
import './Feeds.css';

interface FeedsProps {
  feedType?: 'trending' | 'following' | 'for-you' | 'hashtag';
}

const Feeds = ({ feedType }: FeedsProps) => {
  const { hashtag } = useParams<{ hashtag: string }>();
  const { activities: globalActivities, isLoading } = useSearch();
  const { popularActivities, isLoading: isLoadingPopularActivities } = usePopularActivities();
  const { activities: followingActivities, loading: isLoadingFollowingActivities } = useFeedActivities();
  const { activities: hashtagActivities, isLoading: isLoadingHashtag } = useHashtagFeed(feedType === 'hashtag' ? hashtag : undefined);
  const { isMobileView, toggleView } = useResponsive();
  const location = useLocation();
  const navigate = useNavigate();

  // Debug logging
  useEffect(() => {
    if (feedType === 'hashtag') {
      console.log('🔍 Hashtag Feed Debug:', {
        feedType,
        hashtag,
        activitiesCount: hashtagActivities.length,
        isLoading: isLoadingHashtag,
      });
    }
  }, [feedType, hashtag, hashtagActivities, isLoadingHashtag]);

  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedPostId = searchParams.get('postId');
  const postRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const getActivities = () => {
    switch (feedType) {
      case 'trending':
        return popularActivities;
      case 'following':
        return followingActivities;
      case 'for-you':
        return globalActivities;
      case 'hashtag':
        return hashtagActivities;
      default:
        return globalActivities;
    }
  };

  const activities = getActivities();

  const getLoadingState = () => {
    switch (feedType) {
      case 'trending':
        return isLoadingPopularActivities;
      case 'following':
        return isLoadingFollowingActivities;
      case 'for-you':
        return isLoading;
      case 'hashtag':
        return isLoadingHashtag;
      default:
        return isLoading;
    }
  };

  const isLoadingActivities = getLoadingState();

  useEffect(() => {
    if (highlightedPostId && postRefs.current[highlightedPostId]) {
      const postElement = postRefs.current[highlightedPostId];
      
      setTimeout(() => {
        postElement?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        
        postElement?.classList.add('post-highlighted');
        
        setTimeout(() => {
          postElement?.classList.remove('post-highlighted');
          setSearchParams({});
        }, 2000);
      }, 300);
    }
  }, [highlightedPostId, activities, setSearchParams]);

  if (isLoadingActivities) {
    return <div>Loading...</div>
  }

  const getFeedTitle = () => {
    switch (feedType) {
      case 'trending':
        return 'Trending Posts';
      case 'following':
        return 'Following';
      case 'for-you':
        return 'For You';
      case 'hashtag':
        return `#${hashtag} posts`;
      default:
        return null;
    }
  };

  const tabs = [
    { id: 'for-you', label: 'For You', path: '/feeds/for-you' },
    { id: 'following', label: 'Following', path: '/feeds/following' },
    { id: 'trending', label: 'Trending', path: '/feeds/trending' },
  ];

  const feedsContent = (
    <div className="feeds-wrapper">
        <Composer />   
      <div className="feeds-container">
        {feedType === 'hashtag' ? (
          <div className="hashtag-header">
            <div style={{ 
              fontSize: '18px', 
              fontWeight: 600, 
              color: '#111827', 
              padding: '10px 10px 10px 15px'
            }}>
              <span style={{ color: '#2563eb' }}>#{hashtag}</span> posts
            </div>
          </div>
        ) : (
          <div className="feed-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`feed-tab ${feedType === tab.id ? 'active' : ''}`}
                onClick={() => navigate(tab.path)}
              >
                <span className="feed-tab-label">{tab.label}</span>
                {feedType === tab.id && <div className="feed-tab-indicator" />}
              </button>
            ))}
          </div>
        )}
        <div>
          {activities.length === 0 ? (
            <div className="empty-feed-state">
              No posts yet
            </div>
          ) : (
            activities.map((activity) => (
              <div 
                key={`feed-${activity.id}`}
                ref={(el) => { postRefs.current[activity.id] = el; }}
              >
                <Activity activity={activity} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  if (isMobileView) {
    return (
      <div className="feeds-page-container mobile-view">
        <div className="feeds-page-content mobile-content">
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

  return (
    <div className="feeds-page-container desktop-view">
      <div className="feeds-page-content desktop-content">
        {feedsContent}
      </div>
    </div>
  );
};

export default Feeds;
