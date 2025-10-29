import { Composer } from './Composer';
import Activity from './Activity';
import { useEffect, useRef } from 'react';
import { useSearch } from '../hooks/feeds/useSearch';
import { useSearchParams } from 'react-router-dom';
import { usePopularActivities } from '../hooks/feeds/usePopularActivities';
import { useFeedActivities } from '../hooks/feeds/useFeedActivities';
import './Feeds.css';

interface FeedsProps {
  feedType?: 'trending' | 'following' | 'for-you';
}

const Feeds = ({ feedType }: FeedsProps) => {
  const { activities: globalActivities, isLoading } = useSearch();
  const { popularActivities, isLoading: isLoadingPopularActivities } = usePopularActivities();
  const { activities: followingActivities, loading: isLoadingFollowingActivities } = useFeedActivities();

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
      default:
        return null;
    }
  };

  const feedTitle = getFeedTitle();

  return (
    <div className="feeds-container">
      {feedTitle && (
        <div style={{ 
          fontSize: '1.5rem', 
          fontWeight: 700, 
          color: '#111827', 
          marginBottom: '1.5rem',
          padding: '0 1rem'
        }}>
          {feedTitle}
        </div>
      )}
      <Composer />
      <div>
        {activities.map((activity) => (
          <div 
            key={`feed-${activity.id}`}
            ref={(el) => { postRefs.current[activity.id] = el; }}
          >
            <Activity activity={activity} />
          </div>
        ))}
      </div>
    </div>
  )
};

export default Feeds;
