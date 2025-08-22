import { StreamChat } from "stream-chat";
// @ts-ignore-next-line
import { StreamFeed } from "stream-feed";
import { requireAuth } from "./api/_utils/auth0"
import { json, bad, serverError } from "./api/_utils/responses";

const apiKey = process.env.STREAM_API_KEY!;
const apiSecret = process.env.STREAM_API_SECRET!;

const SAMPLE_USERS = [
  { id: "alice_smith", name: "Alice Smith", image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face" },
  { id: "bob_johnson", name: "Bob Johnson", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face" },
  { id: "carol_williams", name: "Carol Williams", image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face" },
  { id: "david_brown", name: "David Brown", image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face" },
  { id: "emma_davis", name: "Emma Davis", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face" },
];

export default async function handler(req: Request) {
  try {
    if (req.method !== "POST") return bad("Use POST");

    const { sub } = await requireAuth(req);
    const me = sub.replace(/[^a-zA-Z0-9@_-]/g, "_").slice(0, 64);

    // Initialize both Stream Chat and Feeds clients
    const chatServer = StreamChat.getInstance(apiKey, apiSecret);
    const feedsServer = new StreamFeed(apiKey, apiSecret);

    // === CHAT SEEDING ===
    console.log("🌱 Seeding Stream Chat data...");
    
    await chatServer.upsertUser({ id: me });
    await chatServer.upsertUsers(SAMPLE_USERS);

    const general = chatServer.channel("messaging", "general", {
        // @ts-ignore-next-line
        name: "General",
        image: "/general-channel.svg",
        members: [me, ...SAMPLE_USERS.map(u => u.id)],
        created_by_id: me,
    });
    await general.create();

    for (const u of SAMPLE_USERS) {
        // @ts-ignore-next-line
        const dm = chatServer.channel("messaging", {
          members: [me, u.id],
          name: u.name,
          image: u.image,
          created_by_id: me,
        });
      
        await dm.create(); // returns existing if already there
      
        // @ts-ignore-next-line
        const currentName  = (dm.data?.name  as string | undefined) ?? "";
        // @ts-ignore-next-line
        const currentImage = (dm.data?.image as string | undefined) ?? "";
      
        if (!currentName || currentName === "General" || !currentImage) {
          // @ts-ignore-next-line
          await dm.update({ name: u.name, image: u.image });
        }
    }

    console.log("✅ Stream Chat data seeded successfully");

    // === FEEDS SEEDING ===
    console.log("🌱 Seeding Stream Feeds data...");

    // Create users in Feeds
    for (const user of SAMPLE_USERS) {
      try {
        await feedsServer.users.add(user.id, {
          name: user.name,
          profileImage: user.image
        });
      } catch (error) {
        // User might already exist, continue
        console.log(`Feeds user ${user.id} already exists or error:`, error);
      }
    }

    // Create the current user in Feeds
    try {
      await feedsServer.users.add(me, {
        name: 'Current User',
        profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
      });
    } catch (error) {
      console.log(`Current feeds user ${me} already exists or error:`, error);
    }

    // Sample activities (posts) like X/Twitter or Reddit
    const sampleActivities = [
      {
        actor: 'alice_smith',
        verb: 'post',
        object: 'post',
        text: 'Just finished building my first React app! 🚀 The learning curve was steep but totally worth it. #React #WebDev #Coding',
        attachments: [
          {
            type: 'image',
            asset_url: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&h=600&fit=crop',
            mime_type: 'image/jpeg',
            title: 'React Code on Screen'
          }
        ],
        custom: {
          likes: 24,
          shares: 5,
          comments: 8,
          category: 'technology'
        }
      },
      {
        actor: 'bob_johnson',
        verb: 'post',
        object: 'post',
        text: 'Coffee and code - the perfect combination ☕️ Working on some new features for our app. What\'s everyone building today?',
        custom: {
          likes: 18,
          shares: 2,
          comments: 12,
          category: 'lifestyle'
        }
      },
      {
        actor: 'carol_williams',
        verb: 'post',
        object: 'post',
        text: 'Beautiful sunset from my balcony tonight! 🌅 Sometimes you just need to pause and appreciate the little moments.',
        attachments: [
          {
            type: 'image',
            asset_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
            mime_type: 'image/jpeg',
            title: 'Sunset View'
          }
        ],
        custom: {
          likes: 42,
          shares: 15,
          comments: 6,
          category: 'photography'
        }
      },
      {
        actor: 'david_brown',
        verb: 'post',
        object: 'post',
        text: 'Just released version 2.0 of our API! 🎉 Major performance improvements and new endpoints. Check out the docs: https://example.com/docs',
        custom: {
          likes: 31,
          shares: 28,
          comments: 15,
          category: 'technology'
        }
      },
      {
        actor: 'emma_davis',
        verb: 'post',
        object: 'post',
        text: 'Weekend hiking trip was amazing! 🏔️ Fresh air, great views, and good company. Nature is the best therapy.',
        attachments: [
          {
            type: 'image',
            asset_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
            mime_type: 'image/jpeg',
            title: 'Mountain Hiking'
          }
        ],
        custom: {
          likes: 56,
          shares: 22,
          comments: 9,
          category: 'outdoors'
        }
      }
    ];

    // Create activities and add them to feeds
    for (const activity of sampleActivities) {
      try {
        // Add activity to the user's feed
        await feedsServer.feed('user', activity.actor).addActivity({
          actor: activity.actor,
          verb: activity.verb,
          object: activity.object,
          text: activity.text,
          attachments: activity.attachments || [],
          custom: activity.custom
        });

        // Add to timeline feed (public feed)
        await feedsServer.feed('timeline', 'global').addActivity({
          actor: activity.actor,
          verb: activity.verb,
          object: activity.object,
          text: activity.text,
          attachments: activity.attachments || [],
          custom: activity.custom
        });

        // Add to category feeds
        if (activity.custom?.category) {
          await feedsServer.feed('category', activity.custom.category).addActivity({
            actor: activity.actor,
            verb: activity.verb,
            object: activity.object,
            text: activity.text,
            attachments: activity.attachments || [],
            custom: activity.custom
          });
        }
      } catch (error) {
        console.error(`Error creating feeds activity for ${activity.actor}:`, error);
      }
    }

    // Create follow relationships for feeds
    const followRelationships = [
      { follower: me, following: 'alice_smith' },
      { follower: me, following: 'bob_johnson' },
      { follower: me, following: 'carol_williams' },
      { follower: me, following: 'david_brown' },
      { follower: me, following: 'emma_davis' }
    ];

    for (const relationship of followRelationships) {
      try {
        await feedsServer.follow(relationship.follower, relationship.following);
      } catch (error) {
        console.log(`Follow relationship already exists or error:`, error);
      }
    }

    console.log("✅ Stream Feeds data seeded successfully");

    return json({ 
      ok: true, 
      message: "Chat and Feeds data seeded successfully",
      chat: {
        users: SAMPLE_USERS.length + 1,
        channels: SAMPLE_USERS.length + 1
      },
      feeds: {
        users: SAMPLE_USERS.length + 1,
        activities: sampleActivities.length,
        followRelationships: followRelationships.length
      }
    });

  } catch (err) {
    console.error("❌ Error seeding Stream data:", err);
    return serverError("Failed to seed Stream data");
  }
}
