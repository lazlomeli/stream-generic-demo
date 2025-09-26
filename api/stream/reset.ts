import { StreamChat } from "stream-chat";
import { connect } from 'getstream';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resetStreamDemo, type SeedingContext } from '../_utils/seeding';

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

    console.log("✅ Stream API credentials validated");

    // Get user ID from request body
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const me = userId.replace(/[^a-zA-Z0-9@_-]/g, "_").slice(0, 64);

    // Initialize both Stream Chat and Feeds clients
    const streamClient = StreamChat.getInstance(apiKey, apiSecret);
    const serverFeedsClient = connect(apiKey, apiSecret);

    // Create seeding context
    const context: SeedingContext = {
      streamClient,
      serverFeedsClient,
      currentUserId: me
    };

    // Use unified reset logic (cleanup + fresh seeding)
    console.log("🔄 Starting unified reset process...");
    
    const results = await resetStreamDemo(context);

    console.log("\n🎉 Unified reset completed successfully!");
    console.log("📱 Your app is now ready with fresh demo data!");
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`⏱️  Total reset time: ${duration}ms`);

    return res.status(200).json({ 
      ok: true, 
      message: "App reset and seeded successfully with fresh sample data",
      timing: {
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
        followRelationships: results.followRelationships
      }
    });

  } catch (err) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error("❌ Error in unified reset:", err);
    console.error(`⏱️  Failed after ${duration}ms`);
    
    // Provide more specific error information
    let errorMessage = "Failed to reset app";
    let errorDetails = {};
    
    if (err instanceof Error) {
      errorMessage = err.message;
      errorDetails = {
        name: err.name,
        message: err.message
      };
    } else if (typeof err === 'object' && err !== null) {
      errorDetails = err;
    }
    
    console.error("❌ Error details:", errorDetails);
    
    return res.status(500).json({ 
      error: errorMessage,
      details: errorDetails,
      timing: {
        durationMs: duration
      }
    });
  }
}