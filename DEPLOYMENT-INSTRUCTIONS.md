# 🚀 UK Aesthetics Lead Engine - Deployment Guide

## ⚡ Quick Start Deployment

### Option 1: One-Click Deploy (Recommended)

```bash
cd aesthetics-leads-engine
./deploy-to-droplet.sh <your-droplet-ip>
```

This script will:
- SSH into your droplet
- Clone/update the repository
- Setup PostgreSQL database
- Install all dependencies
- Configure nginx reverse proxy
- Start the application with PM2
- Verify everything is running

### Option 2: Manual Deployment

If you prefer manual control, follow these steps:

## 1️⃣ Connect to Your Droplet

```bash
ssh root@your-droplet-ip
```

## 2️⃣ Clone the Repository

```bash
cd /var/www
git clone https://github.com/sskmusic7/aesthetics-leads-engine.git
cd aesthetics-leads-engine
```

## 3️⃣ Setup Environment Variables

Copy the `.env.production` file content to `.env`:

```bash
nano .env
```

Paste your production environment variables (already configured with your API keys).

**IMPORTANT:** Change the database password!

```env
DATABASE_URL="postgresql://postgres:YOUR_SECURE_PASSWORD@localhost:5432/aesthetics_leads_db"
```

## 4️⃣ Install Dependencies

```bash
# Backend dependencies
npm install

# Dashboard dependencies
cd dashboard && npm install && cd ..

# PM2 globally
npm install -g pm2
```

## 5️⃣ Setup PostgreSQL

```bash
# Start PostgreSQL
systemctl start postgresql

# Create database and user
sudo -u postgres psql
```

```sql
CREATE DATABASE aesthetics_leads_db;
CREATE USER aesthetics_user WITH PASSWORD 'YOUR_SECURE_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE aesthetics_leads_db TO aesthetics_user;
\c aesthetics_leads_db
GRANT ALL ON SCHEMA public TO aesthetics_user;
\q
```

## 6️⃣ Run Database Migrations

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy
```

## 7️⃣ Configure nginx

```bash
# Copy nginx config
cp nginx.conf /etc/nginx/sites-available/aesthetics-leads

# Enable the site
ln -s /etc/nginx/sites-available/aesthetics-leads /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Reload nginx
systemctl reload nginx
```

## 8️⃣ Start with PM2

```bash
# Start all processes
pm2 start ecosystem.config.js

# Save configuration
pm2 save

# Setup startup script
pm2 startup
```

## 🔧 Configure DNS

Add an A record in your DNS settings:

- **Subdomain**: `leads.playbookmpr.co.uk`
- **Type**: `A`
- **Points to**: Your droplet IP

## ✅ Verify Deployment

### Check PM2 Status
```bash
pm2 status
```

You should see 4 processes:
- aesthetics-backend
- aesthetics-dashboard
- scraper-worker
- scoring-worker

### Test the API
```bash
curl http://localhost:3000/health
```

### Check Logs
```bash
pm2 logs aesthetics-backend --lines 20
```

## 📊 Monitor Your System

### View Real-time Logs
```bash
pm2 logs
```

### Monitor Performance
```bash
pm2 monit
```

### Check Database
```bash
sudo -u postgres psql aesthetics_leads_db
```

```sql
-- Check clinics count
SELECT COUNT(*) FROM clinics;

-- Check scores count
SELECT COUNT(*) FROM scores;

-- Check outreach queue
SELECT status, COUNT(*) FROM outreach_queue GROUP BY status;

-- Exit
\q
```

## 🔄 Common Tasks

### Restart All Services
```bash
pm2 restart all
```

### Update the Application
```bash
cd /var/www/aesthetics-leads
git pull origin main
pm2 restart all
```

### View Specific Logs
```bash
pm2 logs scraper-worker
pm2 logs scoring-worker
pm2 logs aesthetics-backend
pm2 logs aesthetics-dashboard
```

### Stop Services
```bash
pm2 stop all
```

### Start Services
```bash
pm2 start ecosystem.config.js
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Check what's using the port
sudo lsof -i :3000
sudo lsof -i :3001

# Kill the process if needed
sudo kill -9 <PID>
```

### Database Connection Issues
```bash
# Check PostgreSQL status
systemctl status postgresql

# Start PostgreSQL if stopped
systemctl start postgresql

# Check database exists
sudo -u postgres psql -l
```

### nginx Not Starting
```bash
# Check nginx status
systemctl status nginx

# Test configuration
nginx -t

# Check error logs
tail -f /var/log/nginx/error.log
```

### PM2 Not Starting
```bash
# Flush PM2 logs
pm2 flush

# Clear PM2 cache
pm2 delete all
pm2 start ecosystem.config.js
```

## 📈 What Happens Next

Once deployed, your system will automatically:

1. **Every 4 hours**: Scrape new clinic data from all 5 sources
2. **Daily at 2 AM**: Score new clinics using AI (with automatic fallback)
3. **Real-time**: Generate personalized outreach drafts
4. **On approval**: Send emails via Resend

## 💰 Cost Monitoring

### Current Monthly Estimate
- **DigitalOcean**: $6-12 (you already pay this)
- **Apify**: $30-60 (Facebook ads scraping)
- **AI Services**: $40-80 (Anthropic/Gemini with fallback)
- **Resend**: $0-20 (free tier covers initial)
- **Total**: ~$80-150/month

### Cost Controls Built-in
- Daily token limit: 50,000 tokens
- Batch processing: 10 clinics per request
- Smart caching: Never re-score unchanged data
- Off-peak scheduling: Expensive operations at 2 AM

## 🔐 Security Best Practices

1. **Never commit .env files** (already in .gitignore)
2. **Use strong passwords** for database
3. **Rotate API keys** regularly
4. **Monitor logs** for suspicious activity
5. **Keep system updated** with security patches
6. **Use firewall rules** to restrict access

## 📞 Support

If you encounter issues:

1. **Check logs first**: `pm2 logs`
2. **Verify environment variables**: `cat .env`
3. **Check database connection**: Try connecting manually
4. **Verify DNS is pointing correctly**: Use `dig leads.playbookmpr.co.uk`
5. **Check nginx configuration**: `nginx -t`

## 🎯 Success Metrics

Your system is working correctly when:

- ✅ PM2 shows all 4 processes as "online"
- ✅ `curl http://localhost:3000/health` returns 200
- ✅ Database has clinics in the `clinics` table
- ✅ Scraper worker logs show successful data ingestion
- ✅ Scoring worker logs show AI scoring activity
- ✅ Dashboard loads at `https://leads.playbookmpr.co.uk`

---

**🎉 Your lead generation engine is now live and autonomous!**

The system will run 24/7, finding and scoring London aesthetic clinics while you sleep. Check back regularly to approve outreach emails and watch your pipeline grow!
