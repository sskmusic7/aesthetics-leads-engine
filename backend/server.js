// Express Server for UK Aesthetics Lead Engine
// Based on SSK Newsletter System patterns

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'aesthetics-leads-backend',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/scrape', require('./routes/scrape'));
app.use('/api/clinics', require('./routes/clinics'));
app.use('/api/scores', require('./routes/scores'));
app.use('/api/outreach', require('./routes/outreach'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { message: 'Route not found', status: 404 } });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Aesthetics Leads Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
