// Scores Routes for UK Aesthetics Lead Engine
// Handles scoring operations and score retrieval

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const scoreWorker = require('../workers/scoring-worker');

const prisma = new PrismaClient();

// GET /api/scores - Get all scores with filters
router.get('/', async (req, res) => {
  try {
    const { min_score, max_score, service, limit = 100 } = req.query;

    const where = {};
    if (min_score) where.compositeScore = { ...where.compositeScore, gte: parseInt(min_score) };
    if (max_score) where.compositeScore = { ...where.compositeScore, lte: parseInt(max_score) };
    if (service) where.serviceToPitch = service;

    const scores = await prisma.score.findMany({
      where,
      include: {
        clinic: {
          select: {
            name: true,
            borough: true,
            postcode: true,
            websiteUrl: true
          }
        }
      },
      orderBy: { compositeScore: 'desc' },
      take: parseInt(limit)
    });

    res.json({
      success: true,
      data: scores,
      count: scores.length
    });
  } catch (error) {
    console.error('Error fetching scores:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/scores/generate - Trigger scoring for unscored clinics
router.post('/generate', async (req, res) => {
  try {
    const { limit = 10 } = req.body;

    // Get unscored clinics
    const unscoredClinics = await prisma.clinic.findMany({
      where: {
        scores: {
          none: {}
        }
      },
      include: {
        ads: true
      },
      take: parseInt(limit)
    });

    if (unscoredClinics.length === 0) {
      return res.json({
        success: true,
        message: 'No unscored clinics found',
        scored: 0
      });
    }

    // Score clinics using background worker
    const results = await scoreWorker.scoreBatch(unscoredClinics);

    res.json({
      success: true,
      message: `Scored ${results.successful.length} clinics`,
      scored: results.successful.length,
      failed: results.failed.length,
      results: results.successful
    });
  } catch (error) {
    console.error('Error generating scores:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/scores/stats - Get score statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const scores = await prisma.score.findMany();

    const stats = {
      total_scores: scores.length,
      avg_icp_score: scores.reduce((sum, s) => sum + s.icpScore, 0) / scores.length || 0,
      avg_composite_score: scores.reduce((sum, s) => sum + s.compositeScore, 0) / scores.length || 0,
      by_service: {
        website: scores.filter(s => s.serviceToPitch === 'website').length,
        backlinks: scores.filter(s => s.serviceToPitch === 'backlinks').length,
        facebook_ads: scores.filter(s => s.serviceToPitch === 'facebook_ads').length
      },
      high_priority: scores.filter(s => s.compositeScore >= 70).length,
      medium_priority: scores.filter(s => s.compositeScore >= 40 && s.compositeScore < 70).length,
      low_priority: scores.filter(s => s.compositeScore < 40).length,
      ad_audit_flags: scores.filter(s => s.adAuditFlag).length
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching score stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
