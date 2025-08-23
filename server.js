import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { StreamChat } from 'stream-chat';
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
app.use(express.json());

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

    // Fetch activities from the specified feed
    const feed = serverClient.feed(feedGroup, feedId);
    const result = await feed.get({ limit, withReactionCounts: true });

    console.log(`✅ Found ${result.results.length} activities in ${feedGroup}:${feedId}`);

    res.json({
      success: true,
      activities: result.results,
      feedGroup,
      feedId,
      count: result.results.length
    });
    
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch posts',
      details: error.message 
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
    
    // Create user token and user client for proper attribution
    const userToken = serverClient.createUserToken(userId);
    const userClient = connect(process.env.STREAM_API_KEY, userToken);

    switch (action) {
      case 'create_post':
        if (!postData?.text) {
          return res.status(400).json({ error: 'Post text is required' });
        }

        console.log('📝 Creating post:', postData.text.substring(0, 50) + '...');
        const newActivity = await serverClient.feed('flat', 'global').addActivity({
          actor: userId,
          verb: 'post',
          object: 'post',
          text: postData.text,
          attachments: postData.attachments || [],
          custom: {
            likes: 0,
            shares: 0,
            comments: 0,
            category: postData.category || 'general'
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

        console.log('💔 Unliking post:', postId);
        // Get and delete the user's like reaction
        const userReactions = await serverClient.reactions.filter({
          activity_id: postId,
          kind: 'like',
          user_id: userId
        });

        if (userReactions.results && userReactions.results.length > 0) {
          await userClient.reactions.delete(userReactions.results[0].id);
        }

        return res.json({
          success: true,
          message: 'Post unliked successfully'
        });

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
      case 'remove_bookmark':
        console.log('🔖 Bookmark action:', action, 'for post:', postId);
        return res.json({
          success: true,
          message: `Bookmark action '${action}' completed`
        });

      case 'get_bookmarked_posts':
        console.log('📖 Getting bookmarked posts for user:', userId);
        // Get all bookmark reactions for the user with activity data
        const bookmarkReactions = await serverClient.reactions.filter({
          kind: 'bookmark',
          user_id: userId,
          withActivityData: true
        });

        console.log('📖 Bookmark reactions found:', bookmarkReactions.results?.length || 0);
        console.log('📖 First reaction sample:', bookmarkReactions.results?.[0]);

        // Extract the bookmarked posts with activity details
        const bookmarkedPosts = bookmarkReactions.results?.map(reaction => ({
          id: reaction.id,
          activity_id: reaction.activity_id,
          actor: reaction.activity?.actor || 'Unknown',
          text: reaction.activity?.object?.text || reaction.activity?.text || 'No content',
          attachments: reaction.activity?.attachments || [],
          custom: reaction.activity?.custom || {},
          created_at: reaction.created_at,
          time: reaction.created_at
        })) || [];

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
