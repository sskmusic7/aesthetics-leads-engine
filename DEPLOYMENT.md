# UK Aesthetics Lead Engine - Deployment Guide

## Step 1: Get Missing API Keys

### Companies House API (FREE)
1. Go to: https://developer.company-information.service.gov.uk/
2. Sign up for an account
3. Get your API key from the dashboard
4. Add to .env: `COMPANIES_HOUSE_API_KEY="your_key"`

### Anthropic API (You likely have this)
1. Go to: https://console.anthropic.com/
2. Get your API key
3. Add to .env: `ANTHROPIC_API_KEY="your_key"`

## Step 2: Deploy to Your Droplet

### SSH into your droplet:
```bash
ssh root@your-droplet-ip
```

### Clone the repository:
```bash
cd /var/www
git clone https://github.com/sskmusic7/aesthetics-leads-engine.git
cd aesthetics-leads-engine
```

### Create .env file on droplet:
```bash
nano .env
```

Paste your environment variables (NEVER commit .env to GitHub!):
```env
DATABASE_URL="postgresql://postgres:your_secure_password@localhost:5432/aesthetics_leads_db"
COMPANIES_HOUSE_API_KEY="your_companies_house_key"
APIFY_TOKEN="your_apify_token"
APIFY_FB_ADS_ACTOR="your_apify_actor_id"
ANTHROPIC_API_KEY="your_anthropic_key"
RESEND_API_KEY="your_resend_key"
RESEND_FROM_EMAIL="noreply@playbookmpr.co.uk"
NODE_ENV="production"
PORT=3000
DASHBOARD_PORT=3001
MAX_DAILY_TOKENS=50000
SCORING_BATCH_SIZE=10
```

### Install dependencies:
```bash
npm install
cd dashboard && npm install && cd ..
```

### Setup PostgreSQL:
```bash
sudo -u postgres psql << 'SQL'
CREATE DATABASE aesthetics_leads_db;
CREATE USER aesthetics_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE aesthetics_leads_db TO aesthetics_user;
\q
SQL
```

### Run database migrations:
```bash
npx prisma generate
npx prisma migrate deploy
```

### Setup nginx reverse proxy:
```bash
sudo cp nginx.conf /etc/nginx/sites-available/aesthetics-leads
sudo ln -s /etc/nginx/sites-available/aesthetics-leads /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Start with PM2:
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Step 3: Configure DNS

Add A record in your DNS settings:
- Subdomain: `leads.playbookmpr.co.uk`
- Points to: Your droplet IP

## Step 4: Test

1. Check health: `curl http://leads.playbookmpr.co.uk/health`
2. View dashboard: `https://leads.playbookmpr.co.uk`
3. Check PM2 status: `pm2 status`

## What Happens Next

The system will automatically:
- Every 4 hours: Scrape new clinic data from all sources
- Daily at 2 AM: Score new clinics with Claude AI
- Real-time: Generate personalized outreach drafts
- On approval: Send emails via Resend

## Troubleshooting

### Check logs:
```bash
pm2 logs aesthetics-backend
pm2 logs aesthetics-dashboard
pm2 logs scraper-worker
pm2 logs scoring-worker
pm2 logs outreach-worker
```

### Restart services:
```bash
pm2 restart all
```

### Monitor database:
```bash
sudo -u postgres psql aesthetics_leads_db
```

## Cost Summary

- DigitalOcean: $6-12/month (you already pay this)
- Apify: $30-60/month (Facebook ads scraping)
- Claude API: $50-100/month (scoring + emails)
- Resend: $0-20/month (free tier covers initial)
- **Total: ~$100-150/month**

## Security Notes

- .env file is in .gitignore - never commit it
- Use strong passwords for database
- Keep API keys rotated regularly
- Monitor usage to prevent cost overrun
