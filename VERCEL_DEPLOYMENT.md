# Vercel Deployment Guide

## 🚀 Quick Deployment

This project is configured for automatic deployment on Vercel. Here's what you need to know:

### ✅ What's Been Fixed

1. **Vercel Configuration** (`vercel.json`)
   - Updated to modern Vercel format
   - Proper SPA routing for React Router
   - API functions configuration

2. **API Functions Structure**
   - All API endpoints moved to `api/` folder
   - Proper TypeScript compilation
   - Fixed import paths and response handling

3. **Build Configuration**
   - `npm run build` creates `dist/` folder
   - Static assets properly configured
   - Source maps included for debugging

### 🔧 Required Environment Variables

Set these in your Vercel dashboard under **Settings > Environment Variables**:

#### Stream API (Required)
```
STREAM_API_KEY=your_stream_api_key_here
STREAM_API_SECRET=your_stream_api_secret_here
VITE_STREAM_API_KEY=your_stream_api_key_here
```

#### Auth0 Configuration (Required)
```
VITE_AUTH0_DOMAIN=dev-xxxxx.us.auth0.com
VITE_AUTH0_AUDIENCE=your_auth0_api_url
VITE_AUTH0_CLIENT_ID=your_auth0_client_id
AUTH0_ISSUER=https://dev-xxxxx.us.auth0.com/
AUTH0_AUDIENCE=your_auth0_api_url
```

### 📁 API Endpoints Available

After deployment, these endpoints will be available:

- `POST /api/stream/chat-token` - Generate Chat tokens
- `POST /api/stream/feed-token` - Generate Feeds tokens  
- `POST /api/stream/seed` - Seed demo data
- `POST /api/stream/feed-actions` - Handle feed interactions
- `POST /api/stream/get-posts` - Fetch feed posts

### 🐛 Common Issues & Solutions

#### 404 Error on Main Page
- **Cause**: Build files not found or routing misconfigured
- **Solution**: Ensure `npm run build` completes successfully and `dist/` folder exists

#### 404 Error on Assets (CSS/JS files)
- **Cause**: Static asset routing not configured properly
- **Solution**: Updated `vercel.json` to explicitly route `/assets/*` to `/dist/assets/*`
- **Files affected**: `/assets/index-*.js` and `/assets/index-*.css`

#### API Functions Not Working  
- **Cause**: Missing environment variables
- **Solution**: Add all required env vars to Vercel dashboard

#### Authentication Errors
- **Cause**: Auth0 configuration mismatch
- **Solution**: Verify Auth0 domain and audience settings

#### Stream API Errors
- **Cause**: Incorrect Stream credentials
- **Solution**: Double-check Stream API key and secret

### 🔍 Testing Deployment

1. **Homepage**: Should load React app with login
2. **API Health**: Test `/api/stream/feed-token` endpoint
3. **Authentication**: Login flow should work
4. **Feeds**: Activity feed should display after login

### 📝 Local vs Production

| Feature | Local (`npm run server`) | Production (Vercel) |
|---------|-------------------------|---------------------|
| Frontend | `localhost:3000` | `your-app.vercel.app` |
| API | `localhost:5000/api/*` | `your-app.vercel.app/api/*` |
| Build | Dev server | Static files in `dist/` |
| Environment | `.env` files | Vercel dashboard |

### 🚀 Deploy Steps

1. **Connect Repository**: Link your GitHub repo to Vercel
2. **Set Environment Variables**: Add all required env vars
3. **Deploy**: Vercel auto-deploys on git push
4. **Test**: Verify all functionality works

### 💡 Optimization Tips

- **Chunking Warning**: The build shows large chunk warnings. Consider code splitting for better performance.
- **Environment Variables**: Use `VITE_` prefix for frontend variables only.
- **Caching**: Vercel automatically handles caching for static assets.

---

## 🆘 Still Getting 404?

If you're still seeing 404 errors after following this guide:

1. Check Vercel build logs for errors
2. Verify all environment variables are set
3. Ensure the repository is connected properly
4. Check that `dist/index.html` exists after build
5. Verify API functions deploy successfully

The most common cause is missing environment variables - make sure all variables from `env.example` are configured in your Vercel dashboard!
