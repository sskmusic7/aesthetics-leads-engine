# 🚀 Netlify Deployment Guide - Aesthetics Lead Engine Dashboard

## ✅ Why Netlify is Perfect for This

- **Static deployment** - No server needed
- **Free tier** - No monthly costs  
- **Fast CDN** - Global edge caching
- **Zero conflicts** - Frontend and backend completely separated
- **Always on** - Netlify handles uptime, not your droplet

## 🎯 Architecture

```
Netlify (Frontend)  →  Droplet Backend (API)
  leads.playbookmpr.co.uk     46.101.74.92:3001
```

- **Frontend**: Static Next.js app on Netlify (free)
- **Backend**: Node.js API on droplet (you already pay for this)
- **Database**: SQLite on droplet (no extra cost)

## 📋 Deployment Steps

### 1. Build the Dashboard (Already Done!)

```bash
cd aesthetics-leads-engine/dashboard
npm install
npm run build
```

✅ **Build completed** - Static files generated in `.next/` directory

### 2. Deploy to Netlify (2 minutes)

**Option A: Drag & Drop (Easiest)**
1. Go to [netlify.com](https://netlify.com)
2. Sign up/login 
3. Click "Add new site" → "Deploy manually"
4. Drag the `dashboard/out` folder to the deploy area
5. Your site is live!

**Option B: Git Integration (Better for updates)**
1. Push your code to GitHub
2. In Netlify: "New site from Git"
3. Select your repo
4. Build settings:
   - **Build command**: `cd dashboard && npm run build`
   - **Publish directory**: `dashboard/.next`
5. Add environment variable:
   - **NEXT_PUBLIC_API_URL**: `http://46.101.74.92:3001`

### 3. Configure DNS (Optional)

Add CNAME record:
```
leads.playbookmpr.co.uk → your-site.netlify.app
```

## 💰 Costs

- **Netlify**: $0 (free tier covers up to 100GB bandwidth/month)
- **Droplet**: $6-12/month (you already pay this)
- **API costs**: $0 until you actually use the system

**Total extra cost: $0/month**

## 🔧 Configuration

The dashboard connects to your droplet backend via:

```
NEXT_PUBLIC_API_URL=http://46.101.74.92:3001
```

**Important**: Make sure your droplet backend:
- ✅ Running on port 3001 (not 3000 - AR uses that)
- ✅ Has CORS enabled for Netlify domains
- ✅ Firewall allows external connections

## 🌍 Access URLs

**Development**: 
- Local: `http://localhost:3000` 
- Droplet: `http://46.101.74.92:3001`

**Production**:
- Netlify: `https://your-site.netlify.app`
- Custom domain: `https://leads.playbookmpr.co.uk`

## 🔄 Updates

When you make changes:

```bash
# Update dashboard
cd dashboard
npm run build

# Redeploy to Netlify
# Either drag & drop the new build folder or git push
```

Netlify automatically handles:
- ✅ CDN updates
- ✅ Cache invalidation  
- ✅ SSL certificates
- ✅ Global distribution

## 🎯 Benefits vs Droplet Deployment

| Feature | Netlify | Droplet |
|---------|---------|----------|
| **Monthly cost** | FREE | $0 (already paid) |
| **Setup complexity** | 2 minutes | Requires nginx config |
| **Performance** | Global CDN | Single location |
| **SSL** | Automatic | Manual setup |
| **Updates** | One command | Restart services |
| **Separation** | Complete | Mixed with backend |
| **Port conflicts** | Impossible | Needs management |

## ⚠️ Important Notes

1. **Backend must stay running on droplet** - Netlify is just the frontend UI
2. **API calls go to droplet** - Netlify doesn't process data, just displays it
3. **Keep droplet backend secure** - Use authentication for API endpoints
4. **Monitor droplet resources** - Backend still runs there

## 🚀 Quick Deploy Command

```bash
# From your local machine
cd aesthetics-leads-engine
git add .
git commit -m "Update dashboard for Netlify deployment"
git push origin main

# Then deploy in Netlify dashboard
```

That's it! Your dashboard is live on Netlify for free! 🎉
