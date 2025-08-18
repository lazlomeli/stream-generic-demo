import dotenv from "dotenv";
import { StreamChat } from "stream-chat";

// Load .env and .env.local
dotenv.config();
dotenv.config({ path: ".env.local" });

// Init Stream client with server API key/secret
const client = new StreamChat(
  process.env.STREAM_API_KEY!,
  process.env.STREAM_API_SECRET!
);

async function cleanup() {
  try {
    console.log("🚀 Starting cleanup...");

    // Fake users to delete
    const usersToDelete = [
      "emma_davis",
      "david_brown",
      "carol_williams",
      "bob_johnson",
      "alice_smith",
    ];

    // Channels to delete
    const channelsToDelete = [
      { type: "messaging", id: "general" },
      { type: "messaging", id: "fallback-emma_davis" },
      { type: "messaging", id: "fallback-david_brown" },
      { type: "messaging", id: "fallback-carol_williams" },
      { type: "messaging", id: "fallback-bob_johnson" },
      { type: "messaging", id: "fallback-alice_smith" },
    ];

    // Delete channels
    for (const ch of channelsToDelete) {
      try {
        const channel = client.channel(ch.type, ch.id);
        await channel.delete();
        console.log(`✅ Deleted channel: ${ch.type}:${ch.id}`);
      } catch (err: any) {
        console.warn(`⚠️ Could not delete channel ${ch.type}:${ch.id}`, err.message);
      }
    }

    // Delete users (and optionally hard delete messages/channels owned by them)
    for (const userId of usersToDelete) {
      try {
        await client.deleteUser(userId, {
          mark_messages_deleted: true,
          hard_delete: true,
        });
        console.log(`✅ Deleted user: ${userId}`);
      } catch (err: any) {
        console.warn(`⚠️ Could not delete user ${userId}`, err.message);
      }
    }

    console.log("🎉 Cleanup complete");
  } catch (err) {
    console.error("💥 Cleanup failed:", err);
  }
}

cleanup();
