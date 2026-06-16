// Outreach Routes for UK Aesthetics Lead Engine
// Handles email drafting, approval, and sending

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const outreachWorker = require('../workers/outreach-worker');

const prisma = new PrismaClient();

// GET /api/outreach/queue - Get outreach queue
router.get('/queue', async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;

    const where = status ? { status: status.toUpperCase() } : {};

    const queue = await prisma.outreachQueue.findMany({
      where,
      include: {
        clinic: {
          select: {
            name: true,
            borough: true,
            email: true,
            websiteUrl: true
          }
        },
        scores: false // Avoid circular dependency
      },
      orderBy: { draftedAt: 'desc' },
      take: parseInt(limit)
    });

    res.json({
      success: true,
      data: queue,
      count: queue.length
    });
  } catch (error) {
    console.error('Error fetching queue:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/outreach/draft - Draft outreach for scored clinics
router.post('/draft', async (req, res) => {
  try {
    const { limit = 10 } = req.body;

    // Get scored clinics without outreach drafts
    const clinics = await prisma.clinic.findMany({
      where: {
        scores: {
          some: {}
        },
        outreachQueue: {
          none: {
            status: { in: ['DRAFTED', 'APPROVED', 'SENT'] }
          }
        }
      },
      include: {
        scores: true
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    if (clinics.length === 0) {
      return res.json({
        success: true,
        message: 'No clinics requiring outreach drafts found',
        drafted: 0
      });
    }

    // Generate drafts
    const results = await outreachWorker.generateDrafts(clinics);

    res.json({
      success: true,
      message: `Generated ${results.successful.length} outreach drafts`,
      drafted: results.successful.length,
      failed: results.failed.length,
      results: results.successful
    });
  } catch (error) {
    console.error('Error generating drafts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/outreach/:id/approve - Approve and send outreach
router.put('/:id/approve', async (req, res) => {
  try {
    const { body } = req.body; // Allow editing body before sending

    const outreach = await prisma.outreachQueue.update({
      where: { id: req.params.id },
      data: {
        status: 'APPROVED',
        body: body || undefined
      },
      include: {
        clinic: true
      }
    });

    // Send via Resend
    const sent = await outreachWorker.sendEmail(outreach);

    // Update status
    await prisma.outreachQueue.update({
      where: { id: req.params.id },
      data: {
        status: 'SENT',
        sentAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Outreach approved and sent successfully',
      data: sent
    });
  } catch (error) {
    console.error('Error approving outreach:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/outreach/:id/reject - Reject outreach draft
router.put('/:id/reject', async (req, res) => {
  try {
    await prisma.outreachQueue.update({
      where: { id: req.params.id },
      data: {
        status: 'CLOSED'
      }
    });

    res.json({
      success: true,
      message: 'Outreach rejected'
    });
  } catch (error) {
    console.error('Error rejecting outreach:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/outreach/webhook - Resend webhook handler
router.post('/webhook', async (req, res) => {
  try {
    const { event, data } = req.body;

    if (event === 'email.delivered') {
      await prisma.outreachQueue.updateMany({
        where: { subject: data.subject },
        data: { status: 'SENT' }
      });
    } else if (event === 'email.opened') {
      await prisma.outreachQueue.updateMany({
        where: { subject: data.subject },
        data: {
          status: 'OPENED',
          openedAt: new Date()
        }
      });
    } else if (event === 'email.clicked') {
      // Track link clicks for engagement
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
