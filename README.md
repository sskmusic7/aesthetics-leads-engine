# UK Aesthetics Lead Engine

An autonomous pipeline that finds, scores, and queues outreach to London aesthetic clinics (Botox, dermal filler, surgical procedures) as B2B targets for website, backlink, and Facebook ad campaign services.

## Architecture

```
[5 Data Sources] -> [Playwright Scrapers] -> [staging_raw] -> [Dedupe] -> [clinics]
                                                                       |
                                          [Claude Opus 4.8 Scoring]
                                                                       |
                                                    [scores + outreach_queue]
                                                                       |
              [Next.js Dashboard] <- nginx <- subdomain                |
                                                                       |
                           [Human Approval] -> [Resend Email]
```

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Next.js 14 + Tailwind + Leaflet
- **Database**: PostgreSQL + Prisma ORM
- **AI**: Claude Opus 4.8 (scoring), Sonnet 4.6 (email/parsing)
- **Email**: Resend with domain authentication
- **Scraping**: Playwright + Apify Actor
- **Deployment**: DigitalOcean droplet + nginx + PM2

## Data Sources

1. **Companies House API** - Free API, SIC codes 86220/96020
2. **CQC** - Medical aesthetic providers
3. **Save Face register** - Accredited injectable practitioners
4. **Borough licenses** - Westminster, Camden, Kensington & Chelsea
5. **Facebook Ad Library** - Apify Actor + Meta API v25.0

## Quick Start

### 1. Clone and Setup

```bash
cd aesthetics-leads-engine

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your API keys
```

### 2. Setup Database

```bash
# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev --name init

# Or use the setup script
node setup-database.js
```

### 3. Configure API Keys

Update `.env` with your credentials:

```bash
# Required API Keys
COMPANIES_HOUSE_API_KEY="your_key"
APIFY_TOKEN="your_token"
APIFY_FB_ADS_ACTOR="actor_id"
META_ADLIB_TOKEN="your_meta_token"
ANTHROPIC_API_KEY="your_anthropic_key"
RESEND_API_KEY="your_resend_key"

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/aesthetics_leads_db"
```

### 4. Run Development Server

```bash
# Start backend
cd backend
npm run dev

# Start dashboard (in separate terminal)
cd dashboard
npm run dev
```

### 5. Run Workers Manually

```bash
# Run all scrapers
node backend/workers/scraper-worker.js

# Run deduplication
node backend/workers/dedupe-worker.js

# Run scoring
node backend/workers/scoring-worker.js

# Run outreach generation
node backend/workers/outreach-worker.js
```

## Production Deployment

### 1. Deploy to Droplet

```bash
# Copy files to droplet
scp -r aesthetics-leads-engine/ root@your-droplet:/var/www/aesthetics-leads

# SSH into droplet
ssh root@your-droplet

# Install dependencies
cd /var/www/aesthetics-leads
npm install --production

# Setup database
npx prisma generate
npx prisma migrate deploy
```

### 2. Configure nginx

```bash
# Copy nginx config
cp nginx.conf /etc/nginx/sites-available/aesthetics-leads
ln -s /etc/nginx/sites-available/aesthetics-leads /etc/nginx/sites-enabled/

# Test and restart nginx
nginx -t
systemctl restart nginx
```

### 3. Start with PM2

```bash
# Start all processes
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

## Database Schema

### 5 Tables

- **Clinic** - Deduplicated clinic records
- **StagingRaw** - Raw data before deduplication
- **Ad** - Facebook ads tied to clinics
- **Score** - Claude API scoring output
- **OutreachQueue** - Drafted messages awaiting approval

## API Endpoints

### Scraping
- `POST /api/scrape/companies-house` - Trigger Companies House scrape
- `POST /api/scrape/borough-licenses` - Trigger borough license scrape
- `POST /api/scrape/save-face` - Trigger Save Face scrape
- `POST /api/scrape/facebook-ads` - Trigger Facebook Ad Library scrape
- `POST /api/scrape/all` - Trigger all scrapers

### Clinics
- `GET /api/clinics` - Get all clinics with filters
- `GET /api/clinics/:id` - Get single clinic by ID
- `GET /api/clinics/stats/overview` - Get clinic statistics

### Scores
- `GET /api/scores` - Get all scores with filters
- `POST /api/scores/generate` - Trigger scoring for unscored clinics
- `GET /api/scores/stats/overview` - Get score statistics

### Outreach
- `GET /api/outreach/queue` - Get outreach queue
- `POST /api/outreach/draft` - Draft outreach for scored clinics
- `PUT /api/outreach/:id/approve` - Approve and send outreach
- `PUT /api/outreach/:id/reject` - Reject outreach draft

## Worker Processes (PM2)

1. **aesthetics-backend** - Express API server (port 3000)
2. **aesthetics-dashboard** - Next.js dashboard (port 3001)
3. **scraper-worker** - Scrapes all 5 sources (every 4 hours)
4. **scoring-worker** - Scores clinics with Claude (2 AM daily)
5. **outreach-worker** - Generates outreach drafts (every 6 hours)

## Cost Controls

| Service | Monthly Estimate |
|---------|------------------|
| Companies House | $0 (free) |
| Apify Facebook Ads | $30-60 |
| Claude Opus 4.8 | $50-100 |
| Claude Sonnet 4.6 | $10-20 |
| Resend | $0-20 |
| DigitalOcean | $6-12 (existing) |
| **Total** | **$96-212/month** |

**Daily token limit**: 50k tokens/day
**Batch processing**: 10 clinics per batch
**Off-peak scheduling**: 2 AM daily for scoring

## Environment Variables

See `.env.example` for all required environment variables.

## Monitoring

### Health Check
```bash
curl http://leads.playbookmpr.co.uk/health
```

### PM2 Status
```bash
pm2 status
pm2 logs aesthetics-backend
```

### Database Stats
```bash
# In backend directory
node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.clinic.count().then(c => console.log('Clinics:', c))"
```

## Troubleshooting

### Scrapers failing
- Check API keys in `.env`
- Verify rate limits haven't been exceeded
- Check Playwright browser logs

### Scoring not working
- Verify Anthropic API key
- Check daily token usage
- Ensure database has clinics to score

### Outreach not sending
- Verify Resend API key
- Check email domains are verified
- Ensure clinics have valid email addresses

## Development

### Run Tests
```bash
# Test individual scraper
node backend/workers/scraper-worker.js --test --source=companies_house

# Test deduplication
node backend/workers/dedupe-worker.js
```

### View Logs
```bash
# PM2 logs
pm2 logs

# Application logs
tail -f logs/backend-out.log
tail -f logs/scraper-out.log
```

## Next Steps

1. Setup all API credentials
2. Run initial scraper to populate database
3. Test deduplication process
4. Run scoring on first batch of clinics
5. Generate and review outreach drafts
6. Deploy to droplet with nginx and PM2

## Timeline

**Realistic build time from zero to first outreach**: 12-18 focused days

**Sprint breakdown**:
- Sprint 0: Foundation (0.5 days)
- Sprint 1: Scrapers (3-4 days)
- Sprint 2: Deduplication (3-5 days)
- Sprint 3: Scoring (2-3 days)
- Sprint 4: Dashboard (2-3 days)
- Sprint 5: Outreach (2-3 days)

## License

Proprietary - Playbook MPR
