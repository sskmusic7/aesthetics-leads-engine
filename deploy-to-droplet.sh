#!/bin/bash

# UK Aesthetics Lead Engine - One-Click Droplet Deployment
# This script deploys the entire system to your DigitalOcean droplet

set -e

echo "🚀 UK Aesthetics Lead Engine - Deployment Script"
echo "================================================"

# Check if droplet IP is provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide your droplet IP address"
    echo "Usage: ./deploy-to-droplet.sh <your-droplet-ip>"
    exit 1
fi

DROPLET_IP=$1
DROPLET_USER="root"  # Change if you use a different user
PROJECT_NAME="aesthetics-leads"
DEPLOY_PATH="/var/www/$PROJECT_NAME"

echo "📡 Deploying to: $DROPLET_USER@$DROPLET_IP"
echo ""

# Step 1: Test SSH connection
echo "1️⃣ Testing SSH connection..."
if ! ssh -o ConnectTimeout=5 "$DROPLET_USER@$DROPLET_IP" "echo 'SSH connection successful'"; then
    echo "❌ Failed to connect to droplet. Please check:"
    echo "   - Droplet IP is correct: $DROPLET_IP"
    echo "   - SSH key is properly configured"
    echo "   - Droplet is running and accessible"
    exit 1
fi
echo "✅ SSH connection successful"
echo ""

# Step 2: Create deployment directory
echo "2️⃣ Creating deployment directory..."
ssh "$DROPLET_USER@$DROPLET_IP" "mkdir -p $DEPLOY_PATH"
echo "✅ Directory created: $DEPLOY_PATH"
echo ""

# Step 3: Clone or update repository
echo "3️⃣ Setting up repository..."
if ssh "$DROPLET_USER@$DROPLET_IP" "[ -d $DEPLOY_PATH/.git ]"; then
    echo "   Repository exists, pulling latest changes..."
    ssh "$DROPLET_USER@$DROPLET_IP" "cd $DEPLOY_PATH && git pull origin main"
else
    echo "   Cloning repository..."
    ssh "$DROPLET_USER@$DROPLET_IP" "git clone https://github.com/sskmusic7/aesthetics-leads-engine.git $DEPLOY_PATH"
fi
echo "✅ Repository ready"
echo ""

# Step 4: Copy .env file
echo "4️⃣ Copying environment variables..."
if [ -f ".env.production" ]; then
    scp .env.production "$DROPLET_USER@$DROPLET_IP:$DEPLOY_PATH/.env"
    echo "✅ Environment variables copied"
    echo "   ⚠️  Remember to change the database password!"
else
    echo "❌ Error: .env.production file not found"
    echo "   Please create it first with your API keys"
    exit 1
fi
echo ""

# Step 5: Install dependencies
echo "5️⃣ Installing dependencies..."
ssh "$DROPLET_USER@$DROPLET_IP" << 'ENDSSH'
cd /var/www/aesthetics-leads

# Install Node.js dependencies
npm install
cd dashboard && npm install && cd ..

# Install PM2 globally if not already installed
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# Install Prisma CLI
npm install -g prisma
ENDSSH
echo "✅ Dependencies installed"
echo ""

# Step 6: Setup PostgreSQL
echo "6️⃣ Setting up PostgreSQL..."
ssh "$DROPLET_USER@$DROPLET_IP" << 'ENDSSH'
# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "   Installing PostgreSQL..."
    apt-get update
    apt-get install -y postgresql postgresql-contrib
fi

# Start PostgreSQL if not running
if ! systemctl is-active --quiet postgresql; then
    systemctl start postgresql
fi

# Create database and user (will ask for password)
echo "   Creating database and user..."
sudo -u postgres psql << 'SQL'
-- Create database (will skip if exists)
CREATE DATABASE aesthetics_leads_db;

-- Create user (will skip if exists)
-- IMPORTANT: Change 'your_secure_password' to a strong password
CREATE USER aesthetics_user WITH PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE aesthetics_leads_db TO aesthetics_user;

-- Connect to database and grant schema privileges
\c aesthetics_leads_db
GRANT ALL ON SCHEMA public TO aesthetics_user;

-- Exit
\q
SQL

echo "⚠️  IMPORTANT: Update the DATABASE_URL in .env with the password you set!"
ENDSSH
echo "✅ PostgreSQL setup complete"
echo ""

# Step 7: Run database migrations
echo "7️⃣ Running database migrations..."
ssh "$DROPLET_USER@$DROPLET_IP" << 'ENDSSH'
cd /var/www/aesthetics-leads

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy --name init

# Seed database (optional)
# npx prisma db seed
ENDSSH
echo "✅ Database migrations complete"
echo ""

# Step 8: Configure nginx
echo "8️⃣ Configuring nginx..."
ssh "$DROPLET_USER@$DROPLET_IP" << 'ENDSSH'
# Copy nginx config
cp /var/www/aesthetics-leads/nginx.conf /etc/nginx/sites-available/aesthetics-leads

# Create symlink if it doesn't exist
if [ ! -L /etc/nginx/sites-enabled/aesthetics-leads ]; then
    ln -s /etc/nginx/sites-available/aesthetics-leads /etc/nginx/sites-enabled/aesthetics-leads
fi

# Test nginx configuration
nginx -t

# Reload nginx if test passed
if nginx -t 2>/dev/null; then
    systemctl reload nginx
    echo "✅ nginx configured and reloaded"
else
    echo "❌ nginx configuration test failed"
    exit 1
fi
ENDSSH
echo ""

# Step 9: Setup PM2
echo "9️⃣ Setting up PM2 process manager..."
ssh "$DROPLET_USER@$DROPLET_IP" << 'ENDSSH'
cd /var/www/aesthetics-leads

# Start application with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup | tail -n 1 | grep -E '^sudo|^su|^sh' | sh
ENDSSH
echo "✅ PM2 configured"
echo ""

# Step 10: Verify deployment
echo "🔟 Verifying deployment..."
ssh "$DROPLET_USER@$DROPLET_IP" << 'ENDSSH'
cd /var/www/aesthetics-leads

echo "PM2 Process Status:"
pm2 status

echo ""
echo "Recent Logs:"
pm2 logs --lines 10 --nostream
ENDSSH
echo ""

# Final instructions
echo "🎉 DEPLOYMENT COMPLETE!"
echo "======================"
echo ""
echo "Your system is now live at: https://leads.playbookmpr.co.uk"
echo ""
echo "📋 Important Notes:"
echo "1. Update the database password in .env file"
echo "2. Configure DNS A record for leads.playbookmpr.co.uk"
echo "3. Monitor logs: ssh $DROPLET_USER@$DROPLET_IP 'pm2 logs'"
echo "4. Check status: ssh $DROPLET_USER@$DROPLET_IP 'pm2 status'"
echo ""
echo "🔗 Useful Commands:"
echo "- View logs: pm2 logs aesthetics-backend"
echo "- Restart: pm2 restart all"
echo "- Stop: pm2 stop all"
echo "- Monitor: pm2 monit"
echo ""
echo "✨ Your lead generation engine is now running!"
