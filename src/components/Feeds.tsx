import { useAuth0 } from '@auth0/auth0-react';
import { useUser } from '../hooks/feeds/useUser';
import { useFeedManager } from '../hooks/feeds/useFeedManager';
import { useFeedActions } from '../hooks/feeds/useFeedActions';
import { Composer } from './Composer';
import Activity from './Activity';

const Feeds = () => {
  // const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const { user, client, loading, error, showUserModal, retryConnection } = useUser();
  const { activities, feedType, loading: loadingFeeds, switchFeedType } = useFeedManager();
  const {
    posting,
    deleting,
    refetching, 
    handlePost, 
    handleDeleteActivity, 
    handleRefetchFeeds, 
    createPostMutation, 
    deletePostMutation, 
    refetchFeedsMutation 
  } = useFeedActions();

  if (loading) {
    return <div>Loading...</div>
  }

  console.log('activities', activities);

  return (
    <div>
      <Composer />
      <div>
        {activities.map((activity) => (
          <Activity key={`feed-${activity.id}`} activity={activity} />
        ))}
      </div>
    </div>
  )
};

export default Feeds;
