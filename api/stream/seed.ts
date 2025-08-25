import { StreamChat } from "stream-chat";
import { connect } from 'getstream';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const apiKey = process.env.STREAM_API_KEY!;
const apiSecret = process.env.STREAM_API_SECRET!;

const SAMPLE_USERS = [
  { 
    id: "alice_smith", 
    name: "Alice Smith", 
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face",
    role: "Frontend Developer",
    company: "Stream"
  },
  { 
    id: "bob_johnson", 
    name: "Bob Johnson", 
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    role: "Backend Engineer", 
    company: "TechCorp"
  },
  { 
    id: "carol_williams", 
    name: "Carol Williams", 
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
    role: "Product Designer",
    company: "Design Studio"
  },
  { 
    id: "david_brown", 
    name: "David Brown", 
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
    role: "DevRel Engineer",
    company: "Stream"
  },
  { 
    id: "emma_davis", 
    name: "Emma Davis", 
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face",
    role: "Full-stack Developer",
    company: "StartupCo"
  },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(400).json({ error: "Use POST" });
    }

    // For now, use a default user for seeding (in production, you'd want proper auth)
    // const { sub } = await requireAuth(req);
    const me = "default_seed_user";

    // Initialize both Stream Chat and Feeds clients
    const chatServer = StreamChat.getInstance(apiKey, apiSecret);
    const feedsServer = connect(apiKey, apiSecret);

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
    
    try {
      await general.create();
    } catch (error) {
      // Channel might already exist, try to update it
      console.log('General channel already exists, updating...');
      try {
        await general.update({
          // @ts-ignore-next-line
          name: "General",
          // @ts-ignore-next-line
          image: "/general-channel.svg",
        });
      } catch (updateError) {
        console.log('Channel update failed:', updateError);
      }
    }

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
    console.log("📊 Using API Key:", apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET');
    console.log("🔑 Using API Secret:", apiSecret ? `${apiSecret.substring(0, 10)}...` : 'NOT SET');

    // Check if Feeds is enabled by testing for feed groups
    console.log("🔍 Checking if Feeds is enabled...");
    const testFeedGroups = ['user', 'timeline', 'flat'];
    let availableFeedGroups = [];
    
    for (const feedGroup of testFeedGroups) {
      try {
        await feedsServer.feed(feedGroup, 'test').get({ limit: 1 });
        availableFeedGroups.push(feedGroup);
        console.log(`✅ ${feedGroup} feed group is available`);
      } catch (error) {
        console.log(`⚠️  ${feedGroup} feed group not available`);
      }
    }

    if (availableFeedGroups.length === 0) {
      console.log("❌ No feed groups are available. Please enable Feeds in your Stream Dashboard:");
      console.log("   1. Go to https://dashboard.getstream.io/");
      console.log("   2. Select your Stream app");
      console.log("   3. Enable 'Feeds' and create feed groups: user, timeline, flat");
      console.log("   4. Run this seed script again");
      
      return res.status(400).json({ 
        ok: false, 
        message: "Feeds not enabled. Please configure feed groups in Stream Dashboard.",
        feedsEnabled: false,
        availableFeedGroups: [],
        instructions: "Enable Feeds in Dashboard and create feed groups: user, timeline, flat"
      });
    }

    console.log(`✅ Found ${availableFeedGroups.length} available feed groups:`, availableFeedGroups);

    // Create users in Feeds
    for (const user of SAMPLE_USERS) {
      try {
        await feedsServer.user(user.id).create({
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
      await feedsServer.user(me).create({
        name: 'Current User',
        profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
      });
    } catch (error) {
      console.log(`Current feeds user ${me} already exists or error:`, error);
    }

    // Enhanced demo activities showcasing Stream Feeds features
    const sampleActivities = [
      {
        actor: 'david_brown',
        verb: 'post',
        object: 'post',
        text: '🚀 Just launched our new real-time activity feeds powered by @getstream! The performance is incredible - handling millions of activities with sub-100ms latency. #StreamChat #RealTime #ActivityFeeds',
        attachments: [
          {
            type: 'image',
            asset_url: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=600&fit=crop',
            mime_type: 'image/jpeg',
            title: 'Stream Dashboard Analytics'
          }
        ],
        custom: {
          likes: 47,
          shares: 23,
          comments: 18,
          category: 'technology',
          hashtags: ['StreamChat', 'RealTime', 'ActivityFeeds'],
          sentiment: 'positive'
        }
      },
      {
        actor: 'emma_davis',
        verb: 'post',
        object: 'post',
        text: 'Building scalable chat and feeds is no joke! 💪 Stream\'s SDK made it so much easier to implement real-time features. From prototype to production in days, not months. Highly recommend for any dev building social features!',
        custom: {
          likes: 92,
          shares: 41,
          comments: 29,
          category: 'technology',
          hashtags: ['GetStream', 'RealTime', 'SocialFeatures'],
          sentiment: 'positive'
        }
      },
      {
        actor: 'alice_smith',
        verb: 'post',  
        object: 'post',
        text: '✨ Demo time! This activity feed you\'re looking at is powered by Stream Feeds. Try creating a post, liking, commenting - everything is real-time and scalable. Perfect for social apps, collaboration tools, or any app needing activity streams.',
        attachments: [
          {
            type: 'image',
            asset_url: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=600&fit=crop',
            mime_type: 'image/jpeg',
            title: 'Real-time Demo Interface'
          }
        ],
        custom: {
          likes: 156,
          shares: 73,
          comments: 45,
          category: 'demo',
          hashtags: ['StreamFeeds', 'Demo', 'RealTime'],
          sentiment: 'positive',
          featured: true
        }
      },
      {
        actor: 'bob_johnson',
        verb: 'share',
        object: 'article',
        text: '📖 Great read on implementing activity feeds at scale! Stream\'s approach to feed aggregation and fanout is brilliant. The way they handle millions of users with personalized timelines is next level engineering.',
        attachments: [
          {
            type: 'link',
            asset_url: 'https://getstream.io/blog/how-to-build-activity-feed/',
            mime_type: 'text/html',
            title: 'How to Build Scalable Activity Feeds'
          }
        ],
        custom: {
          likes: 38,
          shares: 12,
          comments: 7,
          category: 'education',
          hashtags: ['ActivityFeeds', 'Scalability', 'Engineering'],
          sentiment: 'informative'
        }
      },
      {
        actor: 'carol_williams',
        verb: 'post',
        object: 'post',
        text: '🎨 UI/UX tip: Activity feeds should feel effortless! Stream\'s SDKs include built-in components that handle all the complex real-time updates, pagination, and state management. More time for design, less time fighting WebSockets! 🙌',
        attachments: [
          {
            type: 'image',
            asset_url: 'https://images.unsplash.com/photo-1586717799252-bd134ad00e26?w=800&h=600&fit=crop',
            mime_type: 'image/jpeg',
            title: 'Beautiful Feed UI Design'
          }
        ],
        custom: {
          likes: 67,
          shares: 28,
          comments: 14,
          category: 'design',
          hashtags: ['UIUX', 'StreamSDK', 'RealTime'],
          sentiment: 'positive'
        }
      },
      {
        actor: 'david_brown',
        verb: 'announcement',
        object: 'update',
        text: '📢 New Stream Feeds features just dropped! ⚡ Reactions system, advanced filtering, and improved analytics. The reaction counts you see on posts? All handled automatically by Stream. Check out the docs for implementation details!',
        custom: {
          likes: 124,
          shares: 89,
          comments: 31,
          category: 'announcement',
          hashtags: ['StreamFeeds', 'NewFeatures', 'Reactions'],
          sentiment: 'exciting',
          featured: true,
          announcement: true
        }
      },
      {
        actor: 'emma_davis',
        verb: 'post',
        object: 'post',
        text: '💡 Pro tip: Stream Feeds automatically handles complex scenarios like duplicate detection, rate limiting, and spam prevention. What you see here is production-ready infrastructure that scales to millions of users out of the box!',
        custom: {
          likes: 83,
          shares: 45,
          comments: 22,
          category: 'tips',
          hashtags: ['ProTip', 'StreamFeeds', 'Production'],
          sentiment: 'helpful'
        }
      },
      {
        actor: 'alice_smith',
        verb: 'celebration',
        object: 'milestone',
        text: '🎉 This demo showcases real Stream Feeds in action! Every interaction you make is stored in Stream\'s infrastructure and synced in real-time. Try it out - create posts, like, comment, and see the magic happen! ✨',
        attachments: [
          {
            type: 'image', 
            asset_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=600&fit=crop',
            mime_type: 'image/jpeg',
            title: 'Celebration and Success'
          }
        ],
        custom: {
          likes: 198,
          shares: 127,
          comments: 56,
          category: 'celebration',
          hashtags: ['Demo', 'StreamFeeds', 'RealTime', 'Interactive'],
          sentiment: 'celebratory',
          featured: true,
          pinned: true
        }
      }
    ];

    // Create activities and add them to feeds (only if they don't exist)
    for (const activity of sampleActivities) {
      try {
        // Check if activity already exists by looking for similar content
        // Use the first available feed group for checking
        const primaryFeedGroup = availableFeedGroups[0];
        const existingActivities = await feedsServer.feed(primaryFeedGroup, 'global').get({ limit: 100 });
        
        // More robust duplicate detection using multiple criteria
        const activityExists = existingActivities.results.some((existing: any) => 
          existing.actor === activity.actor && 
          existing.verb === activity.verb &&
          (existing.text === activity.text || 
           (existing.text && activity.text && existing.text.substring(0, 50) === activity.text.substring(0, 50)))
        );
        
        if (activityExists) {
          console.log(`⏭️  Activity "${activity.text.substring(0, 50)}..." by ${activity.actor} already exists, skipping`);
          continue;
        }

        // Create the activity since it doesn't exist
        const activityData = {
          actor: activity.actor,
          verb: activity.verb,
          object: activity.object,
          text: activity.text,
          attachments: activity.attachments || [],
          custom: activity.custom
        };

        // Add to available feed groups
        for (const feedGroup of availableFeedGroups) {
          if (feedGroup === 'user') {
            // Add to user's personal feed
            await feedsServer.feed('user', activity.actor).addActivity(activityData);
          } else {
            // Add to global feed (timeline, flat, etc.)
            await feedsServer.feed(feedGroup, 'global').addActivity(activityData);
          }
        }
        
        console.log(`✅ Created new activity: "${activity.text.substring(0, 50)}..." by ${activity.actor}`);
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
        // Create follow relationships using Stream's feed following API
        const userFeed = feedsServer.feed('user', relationship.follower);
        await userFeed.follow('user', relationship.following);
      } catch (error) {
        console.log(`Follow relationship already exists or error:`, error);
      }
    }

    console.log("✅ Stream Feeds data seeded successfully");
    
    // Count created activities by category for demo showcase
    const activitiesByCategory: { [key: string]: number } = {};
    const activitiesByActor: { [key: string]: number } = {};
    let totalActivities = 0;
    
    for (const activity of sampleActivities) {
      const category = activity.custom?.category || 'general';
      activitiesByCategory[category] = (activitiesByCategory[category] || 0) + 1;
      activitiesByActor[activity.actor] = (activitiesByActor[activity.actor] || 0) + 1;
      totalActivities++;
    }
    
    console.log("\n📊 Demo Feed Summary:");
    console.log(`🎯 Total demo activities: ${totalActivities}`);
    console.log(`📂 Categories: ${Object.keys(activitiesByCategory).join(', ')}`);
    console.log(`👥 Active users: ${Object.keys(activitiesByActor).length}`);
    console.log(`📱 Features showcased: Real-time feeds, reactions, attachments, hashtags, categories`);
    console.log(`🚀 Perfect for demonstrating Stream Feeds capabilities!`);

    // Verify feeds were created by checking feed counts
    try {
      for (const feedGroup of availableFeedGroups) {
        if (feedGroup === 'user') {
          const userFeed = await feedsServer.feed('user', 'david_brown').get({ limit: 1 });
          console.log(`👤 David Brown's ${feedGroup} feed activities count:`, userFeed.results.length);
        } else {
          const globalFeed = await feedsServer.feed(feedGroup, 'global').get({ limit: 1 });
          console.log(`📊 Global ${feedGroup} feed activities count:`, globalFeed.results.length);
        }
      }
    } catch (error) {
      console.log("⚠️  Could not verify feed counts:", error);
    }

    return res.status(200).json({ 
      ok: true, 
      message: "Chat and Feeds data seeded successfully",
      chat: {
        users: SAMPLE_USERS.length + 1,
        channels: SAMPLE_USERS.length + 1
      },
      feeds: {
        enabled: true,
        availableFeedGroups: availableFeedGroups,
        users: SAMPLE_USERS.length + 1,
        activities: sampleActivities.length,
        followRelationships: followRelationships.length
      }
    });

  } catch (err) {
    console.error("❌ Error seeding Stream data:", err);
    return res.status(500).json({ error: "Failed to seed Stream data" });
  }
}
