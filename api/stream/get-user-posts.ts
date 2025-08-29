import { VercelRequest, VercelResponse } from '@vercel/node';
import { connect } from 'getstream';
import { requireAuth } from '../_utils/auth0';
import { json, serverError, unauthorized, bad } from '../_utils/responses';

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
    return new Response(JSON.stringify({ error: 'Method not allowed', allowedMethods: ['POST'] }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Verify authentication
    const auth = await requireAuth(req as any);
    const userId = auth.sub;
    if (!userId) {
      return unauthorized();
    }

    const { targetUserId, limit = 20 } = req.body;

    if (!targetUserId) {
      return bad('Target user ID is required');
    }

    // Initialize Stream Feeds client (matches working endpoints)
    const streamFeedsClient = connect(
      process.env.STREAM_API_KEY!,
      process.env.STREAM_API_SECRET!
    );

    console.log(`🔍 Fetching posts for user: ${targetUserId}`);

    // Get posts from global feed filtered by target user
    const globalFeed = streamFeedsClient.feed('flat', 'global');
    const result = await globalFeed.get({
      limit: 100, // Get more to filter
      withOwnReactions: true,
      withReactionCounts: true,
      withRecentReactions: true,
    });

    // Filter posts by the target user
    const userPosts = result.results.filter((activity: any) => activity.actor === targetUserId);
    
    // Limit to requested amount
    const limitedPosts = userPosts.slice(0, parseInt(limit as string));

    console.log(`📝 Found ${limitedPosts.length} posts for user ${targetUserId} (out of ${result.results.length} total posts)`);

    if (!limitedPosts || limitedPosts.length === 0) {
      return json({ 
        posts: [],
        message: 'No posts found for this user'
      });
    }

    // Enrich activities with user information
    const enrichedActivities = await Promise.all(
      limitedPosts.map(async (activity: any) => {
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

    return json({ 
      posts: enrichedActivities,
      count: enrichedActivities.length
    });

  } catch (error: any) {
    console.error('❌ Error fetching user posts:', error);
    return serverError(`Failed to fetch user posts: ${error.message}`);
  }
}
