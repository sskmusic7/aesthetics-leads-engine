// PM2 Ecosystem Configuration for UK Aesthetics Lead Engine
// Based on Arlington VPS deployment patterns

module.exports = {
  apps: [
    {
      name: 'aesthetics-backend',
      script: './backend/server.js',
      cwd: '/var/www/aesthetics-leads',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      instances: 1,
      exec_mode: 'fork'
    },
    {
      name: 'aesthetics-dashboard',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/aesthetics-leads/dashboard',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/dashboard-error.log',
      out_file: './logs/dashboard-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      instances: 1,
      exec_mode: 'fork'
    },
    {
      name: 'scraper-worker',
      script: './backend/workers/scraper-worker.js',
      cwd: '/var/www/aesthetics-leads',
      cron_restart: '0 */4 * * *', // Run every 4 hours
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/scraper-error.log',
      out_file: './logs/scraper-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      instances: 1,
      exec_mode: 'fork'
    },
    {
      name: 'scoring-worker',
      script: './backend/workers/scoring-worker.js',
      cwd: '/var/www/aesthetics-leads',
      cron_restart: '0 2 * * *', // Run at 2 AM daily
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/scoring-error.log',
      out_file: './logs/scoring-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      instances: 1,
      exec_mode: 'fork'
    },
    {
      name: 'outreach-worker',
      script: './backend/workers/outreach-worker.js',
      cwd: '/var/www/aesthetics-leads',
      cron_restart: '0 */6 * * *', // Run every 6 hours
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/outreach-error.log',
      out_file: './logs/outreach-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      instances: 1,
      exec_mode: 'fork'
    }
  ]
};
