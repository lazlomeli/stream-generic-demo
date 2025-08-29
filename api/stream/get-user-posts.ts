import { VercelRequest, VercelResponse } from '@vercel/node';
import { connect } from 'getstream';
import { verifyAuth0Token } from '../_utils/auth0';
import { standardResponse } from '../_utils/responses';

interface UserProfileResponse {
  [userId: string]: {
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
    return standardResponse(res, 405, 'Method not allowed', { allowedMethods: ['POST'] });
  }

  try {
    // Verify authentication
    const userId = await verifyAuth0Token(req);
    if (!userId) {
      return standardResponse(res, 401, 'Unauthorized');
    }

    const { targetUserId, limit = 20 } = req.body;

    if (!targetUserId) {
      return standardResponse(res, 400, 'Target user ID is required');
    }

    // Initialize Stream Feeds client
    const streamFeedsClient = connect(
      process.env.STREAM_API_KEY!,
      process.env.STREAM_API_SECRET!,
      process.env.STREAM_APP_ID!
    );

    console.log(`🔍 Fetching posts for user: ${targetUserId}`);

    // Get the user's feed (their posts)
    const userFeed = streamFeedsClient.feed('user', targetUserId);
    const result = await userFeed.get({
      limit: parseInt(limit as string),
      withOwnReactions: true,
      withReactionCounts: true,
      withRecentReactions: true,
    });

    console.log(`📝 Found ${result.results.length} posts for user ${targetUserId}`);

    if (!result.results || result.results.length === 0) {
      return standardResponse(res, 200, 'Success', { 
        posts: [],
        message: 'No posts found for this user'
      });
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

    console.log(`✅ Successfully enriched ${enrichedActivities.length} posts for user ${targetUserId}`);

    return standardResponse(res, 200, 'Success', { 
      posts: enrichedActivities,
      count: enrichedActivities.length
    });

  } catch (error: any) {
    console.error('❌ Error fetching user posts:', error);
    return standardResponse(res, 500, 'Failed to fetch user posts', {
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
