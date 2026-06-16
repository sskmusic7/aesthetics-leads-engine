#!/bin/bash

# UK Aesthetics Lead Engine - Deployment Script
# Deploy to existing DigitalOcean droplet

set -e

DROPLET_IP=$1
PROJECT_NAME="aesthetics-leads"
DEPLOY_PATH="/var/www/$PROJECT_NAME"

if [ -z "$DROPLET_IP" ]; then
  echo "Usage: ./deploy.sh <droplet_ip>"
  exit 1
fi

echo "🚀 Deploying UK Aesthetics Lead Engine to droplet at $DROPLET_IP..."

# Create project directory on droplet
echo "Creating project directory..."
ssh root@$DROPLET_IP "mkdir -p $DEPLOY_PATH/logs"

# Copy project files
echo "Copying project files..."
scp -r backend/ dashboard/ prisma/ root@$DROPLET_IP:$DEPLOY_PATH/
scp package.json root@$DROPLET_IP:$DEPLOY_PATH/
scp ecosystem.config.js root@$DROPLET_IP:$DEPLOY_PATH/
scp nginx.conf root@$DROPLET_IP:$DEPLOY_PATH/
cp .env.example root@$DROPLET_IP:$DEPLOY_PATH/.env

# Install dependencies
echo "Installing dependencies..."
ssh root@$DROPLET_IP "cd $DEPLOY_PATH && npm install --production"

# Setup database
echo "Setting up database..."
ssh root@$DROPLET_IP "cd $DEPLOY_PATH && npx prisma generate && npx prisma migrate deploy"

# Setup nginx
echo "Configuring nginx..."
ssh root@$DROPLET_IP "cp $DEPLOY_PATH/nginx.conf /etc/nginx/sites-available/$PROJECT_NAME"
ssh root@$DROPLET_IP "ln -sf /etc/nginx/sites-available/$PROJECT_NAME /etc/nginx/sites-enabled/$PROJECT_NAME"
ssh root@$DROPLET_IP "nginx -t && systemctl reload nginx"

# Start with PM2
echo "Starting services with PM2..."
ssh root@$DROPLET_IP "cd $DEPLOY_PATH && pm2 start ecosystem.config.js"
ssh root@$DROPLET_IP "pm2 save"

echo "✅ Deployment complete!"
echo "🌐 Dashboard: http://leads.playbookmpr.co.uk"
echo "📊 API: http://leads.playbookmpr.co.uk/api"
echo "❤️ Health: http://leads.playbookmpr.co.uk/health"
