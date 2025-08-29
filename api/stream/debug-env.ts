import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers for browser access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Debug environment variables
  const envCheck = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    streamEnvs: {
      STREAM_API_KEY: !!process.env.STREAM_API_KEY,
      STREAM_API_SECRET: !!process.env.STREAM_API_SECRET,
      VITE_STREAM_API_KEY: !!process.env.VITE_STREAM_API_KEY,
      VITE_STREAM_API_SECRET: !!process.env.VITE_STREAM_API_SECRET,
      STREAM_FEEDS_API_KEY: !!process.env.STREAM_FEEDS_API_KEY,
      STREAM_FEEDS_API_SECRET: !!process.env.STREAM_FEEDS_API_SECRET,
      VITE_STREAM_FEEDS_API_KEY: !!process.env.VITE_STREAM_FEEDS_API_KEY,
    },
    allStreamKeys: Object.keys(process.env).filter(key => key.includes('STREAM')),
    timestamp: new Date().toISOString()
  };

  console.log('🔍 Environment debug check:', envCheck);

  return res.json({
    success: true,
    environment: envCheck,
    message: 'Environment variables checked successfully'
  });
}
