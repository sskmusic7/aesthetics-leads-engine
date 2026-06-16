// Scrape Routes for UK Aesthetics Lead Engine
// Handles data ingestion from all 5 sources

const express = require('express');
const router = express.Router();

// Import scrapers
const companiesHouseScraper = require('../scrapers/companies-house');
const boroughScraper = require('../scrapers/borough-scraper');
const saveFaceScraper = require('../scrapers/save-face');
const facebookAdsScraper = require('../scrapers/facebook-ads');

// POST /api/scrape/companies-house - Trigger Companies House scrape
router.post('/companies-house', async (req, res) => {
  try {
    const results = await companiesHouseScraper.scrape();
    res.json({
      success: true,
      source: 'companies_house',
      records_processed: results.length,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/scrape/borough-licenses - Trigger borough license scrape
router.post('/borough-licenses', async (req, res) => {
  try {
    const { boroughs = ['westminster', 'camden', 'kensington'] } = req.body;
    const results = await boroughScraper.scrape(boroughs);
    res.json({
      success: true,
      source: 'borough_licenses',
      records_processed: results.length,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/scrape/save-face - Trigger Save Face directory scrape
router.post('/save-face', async (req, res) => {
  try {
    const results = await saveFaceScraper.scrape();
    res.json({
      success: true,
      source: 'save_face',
      records_processed: results.length,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/scrape/facebook-ads - Trigger Facebook Ad Library scrape
router.post('/facebook-ads', async (req, res) => {
  try {
    const { keywords = ['botox', 'filler', 'aesthetics'] } = req.body;
    const results = await facebookAdsScraper.scrape(keywords);
    res.json({
      success: true,
      source: 'facebook_ads',
      records_processed: results.length,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/scrape/all - Trigger all scrapers
router.post('/all', async (req, res) => {
  try {
    const results = await Promise.allSettled([
      companiesHouseScraper.scrape(),
      boroughScraper.scrape(['westminster', 'camden', 'kensington']),
      saveFaceScraper.scrape(),
      facebookAdsScraper.scrape(['botox', 'filler', 'aesthetics'])
    ]);

    const summary = results.map((result, index) => ({
      source: ['companies_house', 'borough_licenses', 'save_face', 'facebook_ads'][index],
      success: result.status === 'fulfilled',
      records: result.status === 'fulfilled' ? result.value.length : 0,
      error: result.status === 'rejected' ? result.reason.message : null
    }));

    res.json({
      success: true,
      message: 'All scrapers completed',
      summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
