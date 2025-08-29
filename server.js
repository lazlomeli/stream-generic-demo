import express from 'express';
import cors from 'cors';
import { StreamChat } from 'stream-chat';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

// Load environment variables from both .env and .env.local
dotenv.config(); // Loads .env

// --- Sample Users (same as in Vercel seed.ts) ---
const SAMPLE_USERS = [
  {
    id: "bot_bob_johnson",
    name: "Bob Johnson",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    status: "online"
  },
  {
    id: "bot_carol_williams",
    name: "Carol Williams",
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
    status: "away"
  },
  {
    id: "bot_david_brown",
    name: "David Brown",
    image:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
    status: "offline"
  },
  {
    id: "bot_emma_davis",
    name: "Emma Davis",
    image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face",
    status: "online"
  },
];


const app = express();
const PORT = process.env.PORT || 5000;

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 image uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for handling file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory for now
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Initialize Stream Chat
const streamClient = new StreamChat(
  process.env.STREAM_API_KEY,
  process.env.STREAM_API_SECRET
);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: 'local-development'
  });
});

// Stream Chat Token endpoint
app.post('/api/stream/chat-token', async (req, res) => {
  try {
    const { userId } = req.body;
    
    console.log('🔐 Generating Stream Chat token for userId:', userId);
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check if we have Stream credentials
    if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
      console.error('❌ Missing Stream API credentials');
      return res.status(500).json({ 
        error: 'Stream API credentials not configured. Check your .env file.' 
      });
    }

    // Generate Stream user token
    const streamToken = streamClient.createToken(userId);
    
    console.log('✅ Stream Chat token generated successfully');
    
    res.json({
      token: streamToken,
      apiKey: process.env.STREAM_API_KEY,
      userId: userId
    });
    
  } catch (error) {
    console.error('💥 Error generating chat token:', error);
    res.status(500).json({ error: 'Failed to generate chat token' });
  }
});

// Stream Feeds Token endpoint
app.post('/api/stream/feed-token', async (req, res) => {
  try {
    const { userId } = req.body;
    
    console.log('🔐 Generating Stream Feeds token for userId:', userId);
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check if we have Stream credentials
    if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
      console.error('❌ Missing Stream API credentials');
      return res.status(500).json({ 
        error: 'Stream API credentials not configured. Check your .env file.' 
      });
    }

    // Generate a Feeds V3-compatible JWT token
    const token = jwt.sign(
      {
        user_id: userId,
      },
      process.env.STREAM_API_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '24h', // or shorter if needed
      }
    );
    
    console.log('✅ Stream Feeds token generated successfully');
    
    res.json({
      token: token,
      apiKey: process.env.STREAM_API_KEY,
      userId: userId
    });
    
  } catch (error) {
    console.error('💥 Error generating feeds token:', error);
    res.status(500).json({ error: 'Failed to generate feeds token' });
  }
});


// Stream Feeds Get Posts endpoint
app.post('/api/stream/get-posts', async (req, res) => {
  try {
    const { userId, feedGroup = 'flat', feedId = 'global', limit = 20 } = req.body;
    
    console.log('📊 Fetching posts from feed:', `${feedGroup}:${feedId}`, 'for userId:', userId);
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Import getstream for local development (matches production)
    const { connect } = await import('getstream');
    const serverClient = connect(process.env.STREAM_API_KEY, process.env.STREAM_API_SECRET);

    // Fetch activities from the specified feed with reaction counts
    const feed = serverClient.feed(feedGroup, feedId);
    const result = await feed.get({ limit, withReactionCounts: true });

    console.log(`✅ Found ${result.results.length} activities in ${feedGroup}:${feedId}`);
    console.log(`🔍 withReactionCounts enabled: true`);
    
    // Debug: Log the first activity to see its structure
    if (result.results.length > 0) {
      console.log('🔍 Sample activity reaction_counts:', result.results[0].reaction_counts);
      console.log('🔍 Sample activity custom:', result.results[0].custom);
      
      // Test if we can get any reactions for the first activity
      try {
        const testReactions = await serverClient.reactions.filter({
          activity_id: result.results[0].id,
          limit: 1
        });
      } catch (error) {
        console.error(`⚠️ Could not test reactions for first activity:`, error.message);
      }
    }

    // Enrich activities with user information
    const enrichedActivities = result.results.map((activity) => {
      // If this is the current user's post, mark it for frontend handling
      if (activity.actor === userId) {
        return {
          ...activity,
          isCurrentUser: true
        };
      }
      
      // For other users, check if we have user info in the activity
      if (activity.userInfo) {
        return activity;
      }
      
      // Return activity as-is, frontend will handle fallback
      return activity;
    });

    // Check if we need to manually count comments (if withReactionCounts doesn't provide them)
    const activitiesWithCommentCounts = await Promise.all(enrichedActivities.map(async (activity) => {
      let commentCount = 0;
      
      // First, try to get comment count from withReactionCounts
      if (activity.reaction_counts && typeof activity.reaction_counts.comment === 'number') {
        commentCount = activity.reaction_counts.comment;
        console.log(`✅ Using reaction_counts for activity ${activity.id}: ${commentCount} comments`);
      } else {
        // Fallback: manually count comment reactions
        try {
          console.log(`🔄 Manually counting comments for activity ${activity.id}...`);
          const commentReactions = await serverClient.reactions.filter({
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
      
      // Ensure we have a custom object
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
    }));

    res.json({
      success: true,
      activities: activitiesWithCommentCounts,
      feedGroup,
      feedId,
      count: activitiesWithCommentCounts.length
    });
    
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch posts',
      details: error.message 
    });
  }
});

// Stream Get User Posts endpoint
app.post('/api/stream/get-user-posts', async (req, res) => {
  try {
    const { targetUserId, limit = 20 } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    console.log(`🔍 Fetching posts for user: ${targetUserId}`);

    // Initialize Stream Feeds client (dynamic import for consistency)
    const { connect } = await import('getstream');
    const streamFeedsClient = connect(
      process.env.STREAM_API_KEY,
      process.env.STREAM_API_SECRET
    );

    // Get posts from global feed filtered by target user
    const globalFeed = streamFeedsClient.feed('flat', 'global');
    const result = await globalFeed.get({
      limit: 100, // Get more to filter
      withOwnReactions: true,
      withReactionCounts: true,
      withRecentReactions: true,
    });

    // Filter posts by the target user
    const userPosts = result.results.filter(activity => activity.actor === targetUserId);
    
    // Limit to requested amount
    const limitedPosts = userPosts.slice(0, parseInt(limit));

    console.log(`📝 Found ${limitedPosts.length} posts for user ${targetUserId} (out of ${result.results.length} total posts)`);

    if (!limitedPosts || limitedPosts.length === 0) {
      return res.json({ 
        posts: [],
        message: 'No posts found for this user'
      });
    }

    // Enrich activities with user information
    const enrichedActivities = await Promise.all(
      limitedPosts.map(async (activity) => {
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
            const userProfile = await streamFeedsClient.getUsers([activity.actor]);
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

    res.json({ 
      posts: enrichedActivities,
      count: enrichedActivities.length
    });

  } catch (error) {
    console.error('❌ Error fetching user posts:', error);
    res.status(500).json({ error: 'Failed to fetch user posts' });
  }
});

// Stream Get Chat User endpoint
app.post('/api/stream/get-chat-user', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log(`🔍 Fetching Stream Chat user data for: ${userId}`);

    // Initialize Stream Chat client
    const serverClient = StreamChat.getInstance(
      process.env.STREAM_API_KEY,
      process.env.STREAM_API_SECRET
    );

    try {
      // Query the user from Stream Chat
      const response = await serverClient.queryUsers(
        { id: userId },
        { id: 1 },
        { limit: 1 }
      );

      if (response.users && response.users.length > 0) {
        const user = response.users[0];
        console.log(`✅ Found Stream Chat user data for ${userId}:`, {
          name: user.name,
          image: user.image,
          role: user.role
        });

        res.json({ 
          user: {
            id: user.id,
            name: user.name,
            image: user.image,
            role: user.role,
            online: user.online,
            last_active: user.last_active,
            created_at: user.created_at,
            updated_at: user.updated_at
          }
        });
      } else {
        console.log(`⚠️ No Stream Chat user found for ${userId}`);
        res.status(404).json({ 
          user: null,
          message: 'User not found in Stream Chat'
        });
      }
    } catch (chatError) {
      console.warn(`Failed to fetch Stream Chat user ${userId}:`, chatError.message);
      res.status(404).json({ 
        user: null,
        error: chatError.message
      });
    }

  } catch (error) {
    console.error('❌ Error fetching Stream Chat user:', error);
    res.status(500).json({ error: 'Failed to fetch user from Stream Chat' });
  }
});

// Stream Resolve User ID endpoint
app.post('/api/stream/resolve-user-id', async (req, res) => {
  try {
    const { hashedUserId } = req.body;

    if (!hashedUserId) {
      return res.status(400).json({ error: 'hashedUserId is required' });
    }

    console.log(`🔍 Resolving hashed user ID: ${hashedUserId}`);

    // Synchronous hash function (matches the one in frontend idUtils.ts)
    function createPublicUserIdSync(auth0UserId) {
      let hash = 0;
      for (let i = 0; i < auth0UserId.length; i++) {
        const char = auth0UserId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      // Convert to positive hex string with consistent length
      const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
      return hashHex + auth0UserId.length.toString(16).padStart(2, '0'); // Add length for extra uniqueness
    }

    // Initialize Stream Chat client
    const { StreamChat } = await import('stream-chat');
    const serverClient = StreamChat.getInstance(
      process.env.STREAM_API_KEY,
      process.env.STREAM_API_SECRET
    );

    try {
      // Query all users from Stream Chat (this might need pagination for large user bases)
      const { users } = await serverClient.queryUsers({}, { limit: 1000 });

      // Find the user whose hashed ID matches the requested one
      for (const streamUser of users) {
        const userHash = createPublicUserIdSync(streamUser.id);
        if (userHash === hashedUserId) {
          console.log(`✅ Found matching user: ${streamUser.id} -> ${userHash}`);
          return res.status(200).json({ 
            auth0UserId: streamUser.id,
            userName: streamUser.name || streamUser.id 
          });
        }
      }

      // If no match found, return error
      console.log(`❌ No user found with hashed ID: ${hashedUserId}`);
      return res.status(404).json({ 
        error: 'User not found',
        message: `No user found with hashed ID: ${hashedUserId}` 
      });

    } catch (streamError) {
      console.error('🚨 Stream Chat query error:', streamError);
      return res.status(500).json({ 
        error: 'Failed to query Stream Chat users',
        details: streamError.message || 'Unknown error'
      });
    }

  } catch (error) {
    console.error('🚨 Error resolving user ID:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message || 'Unknown error'
    });
  }
});

// Stream Batch User Counts endpoint
app.post('/api/stream/get-user-counts-batch', async (req, res) => {
  try {
    const { userId, targetUserIds } = req.body;

    if (!userId || !targetUserIds || !Array.isArray(targetUserIds)) {
      return res.status(400).json({ error: 'userId and targetUserIds array are required' });
    }

    if (targetUserIds.length === 0) {
      return res.status(200).json({ userCounts: {} });
    }

    if (targetUserIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 user IDs allowed per batch' });
    }

    console.log(`📊 Batch fetching user counts for ${targetUserIds.length} users`);

    // Initialize Stream client
    const { connect } = await import('getstream');
    const client = connect(
      process.env.STREAM_API_KEY,
      process.env.STREAM_API_SECRET,
      process.env.STREAM_APP_ID,
      { location: 'us-east' }
    );

    const results = {};

    // Batch fetch counts for all users
    const countPromises = targetUserIds.map(async (targetUserId) => {
      try {
        // Get followers count
        const followersPromise = client.feed('timeline', targetUserId).followers({ limit: 1000 });
        
        // Get following count  
        const followingPromise = client.feed('user', targetUserId).following({ limit: 1000 });

        const [followersResponse, followingResponse] = await Promise.all([
          followersPromise.catch(() => ({ results: [] })),
          followingPromise.catch(() => ({ results: [] }))
        ]);

        const followers = followersResponse.results?.length || 0;
        const following = followingResponse.results?.length || 0;

        return {
          userId: targetUserId,
          followers,
          following
        };
      } catch (error) {
        console.warn(`Failed to fetch counts for user ${targetUserId}:`, error);
        return {
          userId: targetUserId,
          followers: 0,
          following: 0
        };
      }
    });

    // Execute all requests in parallel
    const countResults = await Promise.all(countPromises);

    // Format results
    countResults.forEach(({ userId, followers, following }) => {
      results[userId] = { followers, following };
    });

    console.log(`✅ Successfully fetched counts for ${Object.keys(results).length} users`);

    return res.status(200).json({
      userCounts: results,
      totalUsers: Object.keys(results).length
    });

  } catch (error) {
    console.error('🚨 Error in batch user counts fetch:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user counts',
      details: error.message || 'Unknown error'
    });
  }
});

// Stream Feeds Actions endpoint
app.post('/api/stream/feed-actions', async (req, res) => {
  try {
    const { action, userId, postData, postId } = req.body;
    
    console.log('🎯 Processing feed action:', action, 'for userId:', userId);
    
    if (!userId || !action) {
      return res.status(400).json({ error: 'userId and action are required' });
    }

    // Check if we have Stream credentials
    if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
      console.error('❌ Missing Stream API credentials');
      return res.status(500).json({ 
        error: 'Stream API credentials not configured. Check your .env file.' 
      });
    }

    // Import getstream for local development (matches production)
    const { connect } = await import('getstream');
    const serverClient = connect(process.env.STREAM_API_KEY, process.env.STREAM_API_SECRET);
    
    console.log(`🔑 Stream API Key configured: ${process.env.STREAM_API_KEY ? 'Yes' : 'No'}`);
    console.log(`🔑 Stream API Secret configured: ${process.env.STREAM_API_SECRET ? 'Yes' : 'No'}`);
    console.log(`🔑 Stream API Key length: ${process.env.STREAM_API_KEY?.length || 0}`);
    console.log(`🔑 Stream API Secret length: ${process.env.STREAM_API_SECRET?.length || 0}`);
    
    // Create user token and user client for proper attribution
    const userToken = serverClient.createUserToken(userId);
    const userClient = connect(process.env.STREAM_API_KEY, userToken);

    switch (action) {
      case 'create_post':
        // Allow posts with either text or attachments (or both)
        if (!postData?.text && (!postData?.attachments || postData.attachments.length === 0)) {
          return res.status(400).json({ error: 'Post must have either text or attachments' });
        }

        // Extract user profile information from request
        const userProfile = req.body.userProfile || {};
        
        console.log('📝 Creating post:', postData.text ? postData.text.substring(0, 50) + '...' : '[Media only post]');
        console.log('👤 User profile data:', JSON.stringify(userProfile, null, 2));
        
        const newActivity = await serverClient.feed('flat', 'global').addActivity({
          actor: userId,
          verb: 'post',
          object: postData.text && postData.text.trim() ? 'post' : 'media', // Use 'media' for media-only posts
          text: postData.text || '', // Allow empty text for media-only posts
          attachments: postData.attachments || [],
          custom: {
            likes: 0,
            shares: 0,
            comments: 0,
            category: postData.category || 'general'
          },
          // Store complete user profile information in the post
          userProfile: {
            name: userProfile.name || userId,
            image: userProfile.image || undefined,
            role: userProfile.role || 'User',
            company: userProfile.company || undefined,
            // Store additional Auth0 profile data
            given_name: userProfile.given_name || undefined,
            family_name: userProfile.family_name || undefined,
            nickname: userProfile.nickname || undefined,
            email: userProfile.email || undefined,
            sub: userProfile.sub || userId
          }
        });

        console.log('✅ Post created with ID:', newActivity.id);
        return res.json({
          success: true,
          message: 'Post created successfully',
          activity: newActivity
        });

      case 'delete_post':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        console.log('🗑️ Deleting post:', postId);
        await serverClient.feed('flat', 'global').removeActivity(postId);
        
        console.log('✅ Post deleted');
        return res.json({
          success: true,
          message: 'Post deleted successfully'
        });

      case 'like_post':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        console.log('❤️ Liking post:', postId);
        // Add reaction using user client for proper attribution
        await userClient.reactions.add('like', postId);

        return res.json({
          success: true,
          message: 'Post liked successfully'
        });

      case 'unlike_post':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        console.log('💔 Unliking post:', postId, 'for user:', userId);
        
        try {
          // Get user's like reactions for this activity using the correct API approach
          const userReactions = await serverClient.reactions.filter({
            kind: 'like',
            user_id: userId
          });

          console.log('💔 Found total like reactions for user:', userReactions.results?.length || 0);

          // Filter to find reactions for this specific activity
          const activityReaction = userReactions.results?.find(reaction => reaction.activity_id === postId);

          if (activityReaction) {
            console.log('💔 Deleting like reaction:', activityReaction.id);
            await userClient.reactions.delete(activityReaction.id);
            console.log('💔 Like reaction deleted successfully');
          } else {
            console.log('💔 No like reaction found for this activity');
          }

          return res.json({
            success: true,
            message: 'Post unliked successfully'
          });
        } catch (error) {
          console.error('💔 Error unliking post:', error);
          return res.status(500).json({ 
            error: 'Failed to unlike post',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }

      case 'add_comment':
        if (!postId || !postData?.text) {
          return res.status(400).json({ error: 'postId and comment text are required' });
        }

        console.log('💬 Adding comment to post:', postId);
        // Add comment using user client for proper attribution
        const comment = await userClient.reactions.add('comment', postId, {
          text: postData.text
        });

        return res.json({
          success: true,
          message: 'Comment added successfully',
          comment
        });

      case 'get_comments':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        console.log('📄 Getting comments for post:', postId);
        // Get all comments for the post using server client
        const comments = await serverClient.reactions.filter({
          activity_id: postId,
          kind: 'comment'
        });

        return res.json({
          success: true,
          comments: comments.results || []
        });

      case 'bookmark_post':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        console.log('🔖 Bookmarking post:', postId);
        // Add bookmark reaction using user client
        await userClient.reactions.add('bookmark', postId);

        return res.json({
          success: true,
          message: 'Post bookmarked successfully'
        });

      case 'remove_bookmark':
        if (!postId) {
          return res.status(400).json({ error: 'postId is required' });
        }

        console.log('🔖 Removing bookmark for post:', postId, 'for user:', userId);
        
        try {
          // Get user's bookmark reactions using the correct API approach
          const userBookmarkReactions = await serverClient.reactions.filter({
            kind: 'bookmark',
            user_id: userId
          });

          console.log('🔖 Found total bookmark reactions for user:', userBookmarkReactions.results?.length || 0);

          // Filter to find reactions for this specific activity
          const activityReaction = userBookmarkReactions.results?.find(reaction => reaction.activity_id === postId);

          if (activityReaction) {
            console.log('🔖 Deleting bookmark reaction:', activityReaction.id);
            await userClient.reactions.delete(activityReaction.id);
            console.log('🔖 Bookmark reaction deleted successfully');
          } else {
            console.log('🔖 No bookmark reaction found for this activity');
          }

          return res.json({
            success: true,
            message: 'Bookmark removed successfully'
          });
        } catch (error) {
          console.error('🔖 Error removing bookmark:', error);
          return res.status(500).json({ 
            error: 'Failed to remove bookmark',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }

      case 'get_bookmarked_posts':
        console.log('📖 Getting bookmarked posts for user:', userId);
        
        // Get all bookmark reactions for the user with activity data
        const bookmarkReactions = await serverClient.reactions.filter({
          kind: 'bookmark',
          user_id: userId,
          with_activity_data: true
        });

        console.log('📖 Bookmark reactions found:', bookmarkReactions.results?.length || 0);
        
        if (!bookmarkReactions.results || bookmarkReactions.results.length === 0) {
          return res.json({
            success: true,
            bookmarkedPosts: []
          });
        }

        // Get activity IDs to fetch fresh data with reaction counts
        const activityIds = bookmarkReactions.results.map(r => r.activity_id);
        console.log('📖 Activity IDs:', activityIds);

        // Fetch activities with current reaction counts from the global feed
        const feed = serverClient.feed('flat', 'global');
        const feedData = await feed.get({ 
          limit: 100, 
          withReactionCounts: true,
          withOwnReactions: true
        });

        console.log('📖 Feed activities found:', feedData.results?.length || 0);

        // Filter feed activities to only bookmarked ones and merge data
        const bookmarkedPosts = feedData.results
          ?.filter(activity => activityIds.includes(activity.id))
          .map(activity => {
            const bookmarkReaction = bookmarkReactions.results?.find(r => r.activity_id === activity.id);
            
            return {
              id: activity.id, // Use activity id for highlighting
              activity_id: activity.id,
              actor: activity.actor || 'Unknown',
              verb: activity.verb || 'post',
              object: activity.object || 'post',
              text: activity.text || 'No content',
              attachments: activity.attachments || [],
              custom: activity.custom || {},
              created_at: activity.created_at || activity.time,
              time: activity.created_at || activity.time,
              reaction_counts: activity.reaction_counts || {},
              own_reactions: activity.own_reactions || {},
              reaction_id: bookmarkReaction?.id, // Keep the reaction ID for removal
              bookmarked_at: bookmarkReaction?.created_at // When user bookmarked this post
            };
          })
          // Sort by bookmark date (newest bookmarks first)
          .sort((a, b) => new Date(b.bookmarked_at).getTime() - new Date(a.bookmarked_at).getTime()) || [];

        return res.json({
          success: true,
          bookmarkedPosts
        });

      default:
        console.log('⚠️ Unhandled action:', action);
        return res.json({
          success: true,
          message: `Action '${action}' logged (not implemented in local dev server)`,
          note: 'Some actions are only fully implemented in production'
        });
    }
    
  } catch (error) {
    console.error('💥 Error with feeds actions endpoint:', error);
    res.status(500).json({ error: 'Failed to process feeds action request' });
  }
});

// Stream Chat Create Channel endpoint
app.post('/api/stream/create-channel', upload.single('channelImage'), async (req, res) => {
  try {
    console.log('🏗️ Create channel request body:', req.body);
    console.log('🏗️ Create channel request files:', req.file);
    console.log('🏗️ Create channel request headers:', req.headers);
    console.log('🏗️ Raw request body keys:', Object.keys(req.body));
    console.log('🏗️ Raw request body values:', Object.values(req.body));
    
    const { channelName, selectedUsers, currentUserId } = req.body;
    
    console.log('🏗️ Creating new channel:', channelName);
    console.log('👥 Selected users:', selectedUsers);
    console.log('👤 Current user ID:', currentUserId);
    
    if (!channelName || !selectedUsers || !currentUserId) {
      return res.status(400).json({ 
        error: 'Channel name, selected users, and current user ID are required',
        received: { channelName, selectedUsers, currentUserId }
      });
    }

    // Check if we have Stream credentials
    if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
      console.error('❌ Missing Stream API credentials');
      return res.status(500).json({ 
        error: 'Stream API credentials not configured. Check your .env file.' 
      });
    }

    // Parse selected users
    let userIds;
    try {
      userIds = JSON.parse(selectedUsers);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid selected users format' });
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'At least one user must be selected' });
    }

    // Add current user to the channel members
    const allMembers = [currentUserId, ...userIds];
    
    console.log('👥 Channel members:', allMembers);
    console.log('👤 Current user ID:', currentUserId);
    console.log('👥 Selected user IDs:', userIds);

    // Ensure all users exist in Stream Chat before creating the channel
    console.log('👥 Upserting users in Stream Chat...');
    try {
      // Upsert the current user
      await streamClient.upsertUser({ id: currentUserId });
      console.log('✅ Current user upserted:', currentUserId);
      
      // Upsert the selected users
      for (const userId of userIds) {
        await streamClient.upsertUser({ id: userId });
        console.log('✅ User upserted:', userId);
      }
    } catch (upsertError) {
      console.error('❌ Error upserting users:', upsertError);
      return res.status(500).json({ 
        error: 'Failed to create users in Stream Chat',
        details: upsertError.message 
      });
    }

    // Prepare channel data
    const channelData = {
      name: channelName,
      members: allMembers,
      created_by_id: currentUserId,
    };
    
    console.log('🏗️ Channel data to be created:', channelData);

    // Handle channel image if uploaded
    if (req.file) {
      console.log('📸 Channel image uploaded:', req.file.originalname);
      console.log('📸 File size:', req.file.size, 'bytes');
      console.log('📸 MIME type:', req.file.mimetype);
      
      // Validate image file
      if (!req.file.mimetype.startsWith('image/')) {
        console.error('❌ Invalid file type:', req.file.mimetype);
        return res.status(400).json({ 
          error: 'Invalid file type. Only image files are allowed.',
          receivedType: req.file.mimetype
        });
      }
      
      // Check file size (limit to 5MB)
      if (req.file.size > 5 * 1024 * 1024) {
        console.error('❌ File too large:', req.file.size, 'bytes');
        return res.status(400).json({ 
          error: 'File too large. Maximum size is 5MB.',
          receivedSize: req.file.size,
          maxSize: 5 * 1024 * 1024
        });
      }
      
      try {
        // Convert the uploaded image to a data URL for immediate display
        const base64Image = req.file.buffer.toString('base64');
        const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;
        
        // Store the data URL in the channel data
        channelData.image = dataUrl;
        
        console.log('✅ Image converted to data URL successfully');
      } catch (imageError) {
        console.error('❌ Error processing image:', imageError);
        // Continue without image if processing fails
        channelData.image = undefined;
      }
    }

    // Create the channel using Stream Chat
    const channel = streamClient.channel('messaging', channelData);

    await channel.create();

    console.log('✅ Channel created successfully:', channel.id);
    console.log('🔍 Created channel data:', channel.data);
    console.log('🔍 Channel members after creation:', channel.state?.members);
    
    // Verify the channel was created with the correct members
    try {
      const createdChannel = streamClient.channel('messaging', channel.id);
      await createdChannel.watch();
      console.log('🔍 Retrieved channel data:', createdChannel.data);
      console.log('🔍 Retrieved channel members:', createdChannel.state?.members);
      
      // Also try to get the channel with the current user context
      const userChannel = streamClient.channel('messaging', channel.id);
      await userChannel.watch();
      console.log('🔍 User channel data:', userChannel.data);
      console.log('🔍 User channel members:', userChannel.state?.members);
    } catch (retrieveError) {
      console.error('⚠️ Could not retrieve created channel:', retrieveError);
    }

    res.json({
      success: true,
      message: 'Channel created successfully',
      channelId: channel.id,
      channel: {
        id: channel.id,
        name: channelName,
        members: allMembers,
        created_by_id: currentUserId,
        image: channelData.image
      }
    });
    
  } catch (error) {
    console.error('Error creating channel:', error);
    res.status(500).json({ 
      error: 'Failed to create channel',
      details: error.message 
    });
  }
});

// --- NEW: Unified seed endpoint for both Chat and Feeds ---
app.post("/api/stream/seed", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const me = userId.replace(/[^a-zA-Z0-9@_-]/g, "_").slice(0, 64);

    console.log('🌱 Seeding both Chat and Feeds for user:', me);

    // === CHAT SEEDING ===
    // Create current user + sample users
    await streamClient.upsertUser({ id: me });
    await streamClient.upsertUsers(SAMPLE_USERS);

    // General channel
    const general = streamClient.channel("messaging", "general", {
      name: "General",
      members: [
        me, 
        SAMPLE_USERS[0].id, 
        SAMPLE_USERS[1].id, 
        SAMPLE_USERS[2].id, 
        SAMPLE_USERS[3].id
      ],
      created_by_id: me
    });
    await general.create();

    // 1:1 channels with sample users
    for (const u of SAMPLE_USERS) {
      const dm = streamClient.channel("messaging", { 
        name: u.name,
        image: u.image,
        members: [me, u.id], 
        created_by_id: me 
      });
      await dm.create();

      const currentName  = (dm.data?.name);
      const currentImage = (dm.data?.image);
      if (!currentName || !currentImage) {
        await dm.update({ name: u.name, image: u.image });
      }
    }

    console.log('✅ Chat seeding completed');

    // === FEEDS SEEDING ===
    const { connect } = await import('getstream');
    const feedsServer = connect(process.env.STREAM_API_KEY, process.env.STREAM_API_SECRET);

    // Enhanced demo activities showcasing Stream Feeds features
    const sampleActivities = [
      {
        actor: 'david_brown',
        verb: 'post',
        object: 'post',
        text: '🚀 Just launched our new real-time activity feeds powered by @getstream! The performance is incredible - handling millions of activities with sub-100ms latency. #StreamChat #RealTime #ActivityFeeds',
        attachments: [{
          type: 'image',
          asset_url: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=600&fit=crop',
          mime_type: 'image/jpeg',
          title: 'Stream Dashboard Analytics'
        }],
        custom: {
          likes: 47, shares: 23, comments: 18, category: 'technology',
          hashtags: ['StreamChat', 'RealTime', 'ActivityFeeds'], sentiment: 'positive'
        }
      },
      {
        actor: 'alice_smith',
        verb: 'post',  
        object: 'post',
        text: '✨ Demo time! This activity feed you\'re looking at is powered by Stream Feeds. Try creating a post, liking, commenting - everything is real-time and scalable. Perfect for social apps, collaboration tools, or any app needing activity streams.',
        attachments: [{
          type: 'image',
          asset_url: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=600&fit=crop',
          mime_type: 'image/jpeg',
          title: 'Real-time Demo Interface'
        }],
        custom: {
          likes: 156, shares: 73, comments: 45, category: 'demo',
          hashtags: ['StreamFeeds', 'Demo', 'RealTime'], sentiment: 'positive', featured: true
        }
      },
      {
        actor: 'emma_davis',
        verb: 'post',
        object: 'post',
        text: 'Building scalable chat and feeds is no joke! 💪 Stream\'s SDK made it so much easier to implement real-time features. From prototype to production in days, not months. Highly recommend for any dev building social features!',
        custom: {
          likes: 92, shares: 41, comments: 29, category: 'technology',
          hashtags: ['GetStream', 'RealTime', 'SocialFeatures'], sentiment: 'positive'
        }
      }
    ];

    // Check if activities already exist and create them if they don't
    const existingActivities = await feedsServer.feed('flat', 'global').get({ limit: 100 });
    
    for (const activity of sampleActivities) {
      const activityExists = existingActivities.results.some(existing => 
        existing.actor === activity.actor && 
        existing.verb === activity.verb &&
        (existing.text === activity.text || 
         (existing.text && activity.text && existing.text.substring(0, 50) === activity.text.substring(0, 50)))
      );
      
      if (!activityExists) {
        const activityData = {
          actor: activity.actor,
          verb: activity.verb,
          object: activity.object,
          text: activity.text,
          attachments: activity.attachments || [],
          custom: activity.custom
        };

        // Add to flat:global feed
        await feedsServer.feed('flat', 'global').addActivity(activityData);
        console.log(`✅ Created feed activity: "${activity.text.substring(0, 50)}..." by ${activity.actor}`);
      } else {
        console.log(`⏭️  Feed activity already exists for ${activity.actor}, skipping`);
      }
    }

    console.log('✅ Feeds seeding completed');

    res.json({ 
      ok: true, 
      message: "Chat and Feeds data seeded successfully",
      chat: { users: SAMPLE_USERS.length + 1, channels: SAMPLE_USERS.length + 1 },
      feeds: { activities: sampleActivities.length }
    });
  } catch (err) {
    console.error("❌ Error seeding Stream data:", err);
    res.status(500).json({ error: "Failed to seed Stream data" });
  }
});



// Serve static files from the dist directory (built React app)
app.use(express.static(path.join(__dirname, 'dist')));

// Catch-all handler: send back React's index.html for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Local Development Server Running!');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Chat tokens: http://localhost:${PORT}/api/stream/chat-token`);
  console.log(`📰 Feed tokens: http://localhost:${PORT}/api/stream/feed-token`);
  console.log(`📊 Get posts: http://localhost:${PORT}/api/stream/get-posts`);
  console.log(`🌱 Unified seeding: http://localhost:${PORT}/api/stream/seed`);
  console.log(`🎯 Feed actions: http://localhost:${PORT}/api/stream/feed-actions`);
  console.log(`💬 Create Channel: http://localhost:${PORT}/api/stream/create-channel`);
  console.log('');
  console.log('🔧 Environment Variables Debug:');
  console.log(`   PORT: ${process.env.PORT || '5000 (default)'}`);
  console.log(`   STREAM_API_KEY: ${process.env.STREAM_API_KEY ? '✅ Set' : '❌ NOT SET'}`);
  console.log(`   STREAM_API_SECRET: ${process.env.STREAM_API_SECRET ? '✅ Set' : '❌ NOT SET'}`);
  console.log('');
  console.log('📁 Environment Files:');
  console.log('   .env loaded: ✅');
  console.log('   .env.local loaded: ✅');
  console.log('');
  if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
    console.log('⚠️  WARNING: Missing Stream API credentials!');
  }
});

export default app;
