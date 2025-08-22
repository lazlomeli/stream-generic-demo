import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { StreamChat } from 'stream-chat';
import path from 'path';
import { fileURLToPath } from 'url';

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

// --- NEW: Seed sample users and channels ---
app.post("/api/stream/seed", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const me = userId.replace(/[^a-zA-Z0-9@_-]/g, "_").slice(0, 64);

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

    res.json({ ok: true, message: "Sample users and channels created." });
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
