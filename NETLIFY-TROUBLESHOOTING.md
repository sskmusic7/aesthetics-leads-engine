# 🔧 Netlify Deployment Troubleshooting

## Current Status
✅ **Backend**: Working perfectly at `http://46.101.74.92:3001/health`
✅ **CORS**: Configured correctly for all origins
✅ **Static Build**: Local test successful
❌ **Netlify Frontend**: Currently showing 404

## Why Netlify is Showing 404

The issue is likely that Netlify needs to rebuild with the new configuration. The build might be cached or the build settings need updating.

## Quick Fixes

### Option 1: Force Redeploy in Netlify Dashboard (Easiest)

1. Go to: [app.netlify.com](https://app.netlify.com)
2. Find your site: `aesthetics-leads-engine`
3. Click "Deploys" 
4. Click "Trigger deploy" → "Deploy site"
5. Wait 2-3 minutes and test again

### Option 2: Update Build Settings in Netlify

1. In Netlify dashboard → Site settings → Build & deploy
2. Update these settings:
   - **Build command**: `cd dashboard && npm install && npm run build`
   - **Publish directory**: `dashboard/out`
   - **Node version**: `18`

### Option 3: Clear Cache and Redeploy

1. Go to Site settings → Build & deploy
2. Scroll to "Post processing" 
3. Click "Clear cache and deploy site"

### Option 4: Manual Deploy (Fallback)

If automated builds don't work, deploy manually:

1. **Build locally**:
   ```bash
   cd aesthetics-leads-engine/dashboard
   npm install
   npm run build
   ```

2. **Deploy manually to Netlify**:
   - In Netlify dashboard → "Add new site" → "Deploy manually"
   - Drag and drop the `dashboard/out` folder
   - Your site will be live immediately

## What Should Be Working

Once deployed correctly:
- Frontend: `https://aesthetics-leads-engine.netlify.app`
- Backend API: `http://46.101.74.92:3001`
- Health check: Should show dashboard with loading spinner

## GitHub Integration Status

✅ **Pushed to GitHub**: Updated config files
✅ **Netlify connected**: Should auto-deploy
⏳ **Pending**: Netlify needs to rebuild with new config

## Test the Connection

Once Netlify is working, test the connection:

1. Open browser: `https://aesthetics-leads-engine.netlify.app`
2. Should see dashboard UI
3. Check browser console (F12) for any API connection errors
4. API calls should go to: `http://46.101.74.92:3001/api/...`

## Alternative: Use Different Subdomain

If the main site is stuck, you can deploy to a different subdomain:

1. In Netlify dashboard → Site settings → Domain management
2. Add new domain: `aesthetics-dashboard.netlify.app`
3. Deploy to new URL
