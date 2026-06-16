// Clinics Routes for UK Aesthetics Lead Engine
// Handles clinic data retrieval and management

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET /api/clinics - Get all clinics with filters
router.get('/', async (req, res) => {
  try {
    const {
      borough,
      min_score,
      max_score,
      service,
      status = 'all',
      limit = 100,
      offset = 0
    } = req.query;

    const where = {};

    // Filter by borough
    if (borough) {
      where.borough = borough;
    }

    // Filter by score range
    if (min_score || max_score) {
      where.scores = {
        some: {}
      };
      if (min_score) where.scores.some.compositeScore = { gte: parseInt(min_score) };
      if (max_score) where.scores.some.compositeScore = { lte: parseInt(max_score) };
    }

    // Filter by service to pitch
    if (service) {
      where.scores = {
        some: {
          serviceToPitch: service
        }
      };
    }

    const clinics = await prisma.clinic.findMany({
      where,
      include: {
        scores: true,
        ads: true,
        outreachQueue: {
          where: status !== 'all' ? { status: status.toUpperCase() } : undefined,
          orderBy: { draftedAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const total = await prisma.clinic.count({ where });

    res.json({
      success: true,
      data: clinics,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: parseInt(offset) + parseInt(limit) < total
      }
    });
  } catch (error) {
    console.error('Error fetching clinics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/clinics/:id - Get single clinic by ID
router.get('/:id', async (req, res) => {
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: req.params.id },
      include: {
        scores: true,
        ads: {
          orderBy: { lastSeen: 'desc' }
        },
        stagingRecords: {
          orderBy: { fetchedAt: 'desc' },
          take: 5
        },
        outreachQueue: {
          orderBy: { draftedAt: 'desc' }
        }
      }
    });

    if (!clinic) {
      return res.status(404).json({
        success: false,
        error: 'Clinic not found'
      });
    }

    res.json({
      success: true,
      data: clinic
    });
  } catch (error) {
    console.error('Error fetching clinic:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/clinics/stats - Get clinic statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const [
      total_clinics,
      cqc_registered,
      save_face_listed,
      with_scores,
      with_ads,
      boroughs
    ] = await Promise.all([
      prisma.clinic.count(),
      prisma.clinic.count({ where: { cqcRegistered: true } }),
      prisma.clinic.count({ where: { saveFaceListed: true } }),
      prisma.clinic.count({ where: { scores: { some: {} } } }),
      prisma.clinic.count({ where: { ads: { some: {} } } }),
      prisma.clinic.groupBy({
        by: ['borough'],
        _count: true
      })
    ]);

    res.json({
      success: true,
      data: {
        total_clinics,
        cqc_registered,
        save_face_listed,
        with_scores,
        with_ads,
        by_borough: boroughs.map(b => ({
          borough: b.borough,
          count: b._count
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
