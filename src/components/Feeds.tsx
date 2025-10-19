import { Composer } from './Composer';
import Activity from './Activity';
import { useEffect, useRef } from 'react';
import { useSearch } from '../hooks/feeds/useSearch';
import { useSearchParams } from 'react-router-dom';
import { usePopularActivities } from '../hooks/feeds/usePopularActivities';
import { useFeedActivities } from '../hooks/feeds/useFeedActivities';

interface FeedsProps {
  feedType?: 'trending' | 'following' | 'for-you';
}

const Feeds = ({ feedType }: FeedsProps) => {
  const { activities: globalActivities, clearSearch, isLoading } = useSearch();
  const { popularActivities, isLoading: isLoadingPopularActivities } = usePopularActivities();
  const { activities: followingActivities, loading: isLoadingFollowingActivities } = useFeedActivities();

  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedPostId = searchParams.get('postId');
  const postRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Select activities based on feedType
  const getActivities = () => {
    switch (feedType) {
      case 'trending':
        console.log('popularActivities', popularActivities);
        return popularActivities;
      case 'following':
        console.log('feedActivities', followingActivities);
        return followingActivities;
      case 'for-you':
        console.log('globalActivities', globalActivities);
        return globalActivities;
      default:
        console.log('default', globalActivities);
        return globalActivities;
    }
  };

  const activities = getActivities();

  // Get the appropriate loading state
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

  // Scroll to and highlight the post when postId is in URL
  useEffect(() => {
    if (highlightedPostId && postRefs.current[highlightedPostId]) {
      const postElement = postRefs.current[highlightedPostId];
      
      // Smooth scroll to the post
      setTimeout(() => {
        postElement?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        
        // Add temporary highlight animation
        postElement?.classList.add('post-highlighted');
        
        // Remove highlight after animation
        setTimeout(() => {
          postElement?.classList.remove('post-highlighted');
          // Clear the postId from URL
          setSearchParams({});
        }, 2000);
      }, 300);
    }
  }, [highlightedPostId, activities, setSearchParams]);

  if (isLoadingActivities) {
    return <div>Loading...</div>
  }

  // Get the display title based on feed type
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

  console.log('feedType', feedType);

  return (
    <div style={{ marginTop: '30px' }}>
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
