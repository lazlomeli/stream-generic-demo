export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🏗️  Setting up feed groups with URL enrichment...');

    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Missing Stream API credentials' });
    }

    // Import V3 client for feed group creation  
    const { FeedsClient } = await import('@stream-io/feeds-client');
    const serverClient = new FeedsClient({
      apiKey,
      secret: apiSecret,
    });

    console.log('🔧 FeedsClient methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(serverClient)));
    console.log('🔧 FeedsClient instance:', serverClient);

    // Create feed group with Open Graph metadata enrichment processor
    const feedGroupResponse = await serverClient.createFeedGroup({
      id: "user_enriched",
      activity_processors: [
        { type: "og_metadata_enrichment" },
      ],
    });

    console.log('✅ Created feed group with OG enrichment:', feedGroupResponse);

    // Also create timeline feed group for aggregated feeds
    const timelineFeedGroupResponse = await serverClient.createFeedGroup({
      id: "timeline_enriched", 
      activity_processors: [
        { type: "og_metadata_enrichment" },
      ],
    });

    console.log('✅ Created timeline feed group with OG enrichment:', timelineFeedGroupResponse);

    return res.json({
      success: true,
      message: 'Feed groups created with URL enrichment processors',
      feedGroups: {
        user_enriched: feedGroupResponse,
        timeline_enriched: timelineFeedGroupResponse
      }
    });

  } catch (error) {
    console.error('❌ Error setting up feed groups:', error);
    
    // Check if feed groups already exist
    if (error?.message?.includes('already exists') || error?.code === 4) {
      console.log('ℹ️  Feed groups already exist, which is fine');
      return res.json({
        success: true,
        message: 'Feed groups already exist with URL enrichment',
        note: 'This is expected if setup was run before'
      });
    }

    return res.status(500).json({ 
      error: 'Failed to setup feed groups',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
