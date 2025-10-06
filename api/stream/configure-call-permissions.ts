import { StreamClient } from '@stream-io/node-sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔧 CONFIGURE-CALL-PERMISSIONS: Request received');

    // Get Stream API credentials
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('❌ CONFIGURE-CALL-PERMISSIONS: Missing Stream API credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Initialize Stream client
    const streamClient = new StreamClient(apiKey, apiSecret);

    console.log('⚙️ CONFIGURE-CALL-PERMISSIONS: Configuring call type permissions...');

    // Configure the "default" call type with proper permissions
    await streamClient.updateCallType('default', {
      settings: {
        limits: {
          max_duration_seconds: 3600, // 1 hour max call duration
          max_participants: 100,
        },
        audio: {
          access_request_enabled: false,
          default_device: 'speaker',
          mic_default_on: true,
          speaker_default_on: true,
        },
        video: {
          access_request_enabled: false,
          camera_default_on: true,
          camera_facing: 'front',
          target_resolution: {
            width: 1280,
            height: 720,
            bitrate: 1000000,
          },
        },
        backstage: {
          enabled: true,
          join_ahead_time_seconds: 300, // 5 minutes
        },
        broadcasting: {
          enabled: true,
          hls: {
            enabled: true,
            auto_on: false,
            layout: {
              name: 'spotlight',
              options: {
                spotlight_user_id: '',
              },
            },
            quality_tracks: [
              { name: '720p', width: 1280, height: 720, bitrate: 1000000 },
              { name: '480p', width: 854, height: 480, bitrate: 500000 },
              { name: '360p', width: 640, height: 360, bitrate: 300000 },
            ],
          },
        },
        recording: {
          mode: 'disabled', // Disable by default to avoid costs
        },
        ring: {
          auto_cancel_timeout_ms: 30000, // 30 seconds
          incoming_call_timeout_ms: 30000,
        },
        screensharing: {
          access_request_enabled: false,
          enabled: true,
        },
      },
      grants: {
        admin: [
          'create-call',
          'join-call',
          'join-ended-call',
          'send-audio',
          'send-video',
          'mute-users',
          'screenshare',
          'end-call',
          'update-call-settings',
          'update-call-permissions',
          'remove-call-member',
        ],
        user: [
          'create-call',
          'join-call',
          'join-ended-call',
          'send-audio',
          'send-video',
          'screenshare',
        ],
        call_member: [
          'join-call',
          'join-ended-call',
          'send-audio',
          'send-video',
          'screenshare',
        ],
      },
    });

    console.log('✅ CONFIGURE-CALL-PERMISSIONS: Call type permissions configured successfully');
    
    return res.status(200).json({
      success: true,
      message: 'Call type permissions configured successfully',
      callType: 'default',
    });

  } catch (error) {
    console.error('❌ CONFIGURE-CALL-PERMISSIONS: Error configuring permissions:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return res.status(500).json({ 
      error: 'Failed to configure call permissions',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
