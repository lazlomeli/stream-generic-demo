import { connect } from 'getstream';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Define a basic type for the user profile response
interface UserProfileResponse {
  [key: string]: {
    name?: string;
    username?: string;
    image?: string;
    profile_image?: string;
    role?: string;
    company?: string;
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, feedGroup = 'flat', feedId = 'global', limit = 20 } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Get Stream API credentials
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Missing Stream API credentials' });
    }

    console.log(`🔑 Stream API Key configured: ${apiKey ? 'Yes' : 'No'}`);
    console.log(`🔑 Stream API Secret configured: ${apiSecret ? 'Yes' : 'No'}`);
    console.log(`🔑 Stream API Key length: ${apiKey?.length || 0}`);
    console.log(`🔑 Stream API Secret length: ${apiSecret?.length || 0}`);

    // Initialize Stream Feeds client
    const streamFeedsClient = connect(apiKey, apiSecret);

    // Fetch activities from the specified feed
    const feed = streamFeedsClient.feed(feedGroup, feedId);
    console.log(`Fetching from feed: ${feedGroup}:${feedId} for user: ${userId}`);
    
    const result = await feed.get({ limit, withReactionCounts: true });
    console.log(`Found ${result.results.length} activities in ${feedGroup}:${feedId}`);
    console.log(`🔍 withReactionCounts enabled: true`);
    
    // Debug: Log the first activity to see its structure
    if (result.results.length > 0) {
      const firstActivity = result.results[0] as any;
      console.log('🔍 Sample activity structure:', JSON.stringify(firstActivity, null, 2));
      console.log('🔍 Sample activity reaction_counts:', firstActivity.reaction_counts);
      console.log('🔍 Sample activity custom:', firstActivity.custom);
      
      // Test if we can get any reactions for the first activity
      try {
        const testReactions = await streamFeedsClient.reactions.filter({
          activity_id: firstActivity.id,
          limit: 1
        });
        console.log(`🔍 Test reactions for first activity:`, testReactions);
      } catch (error: any) {
        console.log(`⚠️ Could not test reactions for first activity:`, error.message);
      }
    }

    // Enrich activities with user information
    const enrichedActivities = await Promise.all(
      result.results.map(async (activity: any) => {
        try {
          // Priority 1: Use userProfile data stored directly in the activity
          if (activity.userProfile && activity.userProfile.name) {
            console.log(`✅ Using stored userProfile for ${activity.actor}:`, activity.userProfile);
            return {
              ...activity,
              userInfo: {
                name: activity.userProfile.name,
                image: activity.userProfile.image || undefined,
                role: activity.userProfile.role || undefined,
                company: activity.userProfile.company || undefined
              }
            };
          }
          
          // Priority 2: Fallback to Stream's user profile system
          if (streamFeedsClient.getUsers) {
            try {
              const userProfile = await streamFeedsClient.getUsers([activity.actor]) as UserProfileResponse;
              const userData = userProfile[activity.actor];
              
              if (userData && userData.name) {
                console.log(`✅ Using Stream user profile for ${activity.actor}:`, userData);
                return {
                  ...activity,
                  userInfo: {
                    name: userData.name || userData.username,
                    image: userData.image || userData.profile_image || undefined,
                    role: userData.role || undefined,
                    company: userData.company || undefined
                  }
                };
              }
            } catch (getUserError: any) {
              // Handle user not found gracefully
              if (getUserError?.response?.status === 404 || getUserError?.error?.status_code === 404) {
                console.log(`👤 User ${activity.actor} not found in Stream user database - using fallback`);
              } else {
                console.warn(`❌ Failed to get Stream user profile for ${activity.actor}:`, getUserError?.message);
              }
              // Fall through to Priority 3 fallback
            }
          }
          
          // Priority 3: Use actor ID as fallback
          console.warn(`⚠️ No user profile found for ${activity.actor}, using actor ID as name`);
          return {
            ...activity,
            userInfo: {
              name: activity.actor,
              image: undefined,
              role: undefined,
              company: undefined
            }
          };
        } catch (userError) {
          console.warn(`Failed to fetch user profile for ${activity.actor}:`, userError);
          // Return activity without user enrichment if user fetch fails
          return {
            ...activity,
            userInfo: {
              name: activity.actor,
              image: undefined,
              role: undefined,
              company: undefined
            }
          };
        }
      })
    );

    // Add comment counts to activities
    const activitiesWithCommentCounts = await Promise.all(
      enrichedActivities.map(async (activity: any) => {
        let commentCount = 0;
        
        // First, try to get comment count from withReactionCounts
        if (activity.reaction_counts && typeof activity.reaction_counts.comment === 'number') {
          commentCount = activity.reaction_counts.comment;
          console.log(`✅ Using reaction_counts for activity ${activity.id}: ${commentCount} comments`);
        } else {
          // Fallback: manually count comment reactions
          try {
            console.log(`🔄 Manually counting comments for activity ${activity.id}...`);
            const commentReactions = await streamFeedsClient.reactions.filter({
              activity_id: activity.id,
              kind: 'comment'
            });
            
            commentCount = commentReactions.results?.length || 0;
            console.log(`✅ Manual count for activity ${activity.id}: ${commentCount} comments`);
          } catch (error) {
            console.warn(`⚠️ Could not get comment count for activity ${activity.id}:`, error);
            commentCount = 0;
          }
        }
        
        // Ensure we have a custom object with comment count
        const customData = activity.custom || {};
        
        return {
          ...activity,
          custom: {
            ...customData,
            comments: commentCount,
            // Ensure other custom fields exist
            likes: customData.likes || 0,
            shares: customData.shares || 0,
            category: customData.category || 'general'
          }
        };
      })
    );

    return res.json({
      success: true,
      activities: activitiesWithCommentCounts,
      feedGroup,
      feedId,
      count: activitiesWithCommentCounts.length
    });

  } catch (error: any) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch posts',
      details: error.message 
    });
  }
}
