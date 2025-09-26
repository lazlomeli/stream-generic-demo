import { StreamChat } from "stream-chat";
import { connect } from 'getstream';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { seedStreamDemo, type SeedingContext } from '../_utils/seeding';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Validate Stream API credentials
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      const errorMsg = "Missing Stream API credentials";
      console.error(`❌ ${errorMsg}`);
      return res.status(500).json({ 
        error: errorMsg,
        details: "Missing required environment variables for Stream API",
        required: ["STREAM_API_KEY", "STREAM_API_SECRET"]
      });
    }

    if (apiKey.length < 10 || apiSecret.length < 10) {
      const errorMsg = "Invalid Stream API credentials format";
      console.error(`❌ ${errorMsg}`);
      return res.status(500).json({ 
        error: errorMsg,
        details: "API credentials appear to be malformed"
      });
    }

    console.log("✅ Stream API credentials validated");

    // Test Stream connection
    console.log("🔌 Testing Stream connection...");
    try {
      const testChatServer = StreamChat.getInstance(apiKey, apiSecret);
      const testFeedsServer = connect(apiKey, apiSecret);
      
      // Test chat connection by trying to get app info
      await testChatServer.getAppSettings();
      console.log("✅ Stream Chat connection successful");
      
      // Test feeds connection by trying to get user info
      try {
        await testFeedsServer.user('test_user').get();
        console.log("✅ Stream Feeds connection successful");
      } catch (feedsTestError) {
        // This might fail if Feeds is not enabled, but that's okay
        console.log("⚠️  Stream Feeds test failed (might not be enabled):", feedsTestError);
      }
      
    } catch (connectionError) {
      const errorMsg = "Failed to connect to Stream API";
      console.error(`❌ ${errorMsg}:`, connectionError);
      return res.status(500).json({ 
        error: errorMsg,
        details: connectionError instanceof Error ? connectionError.message : String(connectionError),
        suggestion: "Please verify your Stream API credentials and ensure your Stream app is active"
      });
    }

    // Get user ID from request body
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const me = userId.replace(/[^a-zA-Z0-9@_-]/g, "_").slice(0, 64);

    // Initialize both Stream Chat and Feeds clients
    const chatServer = StreamChat.getInstance(apiKey, apiSecret);
    const feedsServer = connect(apiKey, apiSecret);

    // Create seeding context
    const context: SeedingContext = {
      streamClient: chatServer,
      serverFeedsClient: feedsServer,
      currentUserId: me
    };

    // Use unified seeding logic
    console.log("🌱 Starting unified seeding process...");
    
    const results = await seedStreamDemo(context);

    console.log("\n🎉 Unified seeding completed successfully!");
    console.log("📱 Your app is now ready with demo data for both Chat and Feeds!");
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`⏱️  Total seeding time: ${duration}ms`);

    return res.status(200).json({ 
      ok: true, 
      message: "Chat and Feeds data seeded successfully using unified seeding logic",
      timing: {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        durationMs: duration
      },
      chat: {
        users: results.users,
        channels: results.channels
      },
      feeds: {
        enabled: true,
        users: results.users,
        activities: results.activities,
        follows: results.followRelationships
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error("❌ Error in unified seeding:", err);
    console.error(`⏱️  Failed after ${duration}ms`);
    
    // Provide more specific error information
    let errorMessage = "Failed to seed Stream data";
    let errorDetails = {};
    
    if (err instanceof Error) {
      errorMessage = err.message;
      errorDetails = {
        name: err.name,
        message: err.message,
        stack: err.stack
      };
    } else if (typeof err === 'object' && err !== null) {
      errorDetails = err;
    }
    
    console.error("❌ Error details:", errorDetails);
    
    return res.status(500).json({ 
      error: errorMessage,
      details: errorDetails,
      timing: {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        durationMs: duration
      },
      timestamp: new Date().toISOString()
    });
  }
}