// Outreach Worker
// Handles email drafting with Claude Sonnet 4.6 and Resend integration

const Anthropic = require('@anthropic-ai/sdk');
const Resend = require('resend');
const { PrismaClient } = require('@prisma/client');
const { buildEmailPrompt, buildLinkedInDMPrompt } = require('../lib/scoring-prompts');
const cacheControl = require('../lib/cache-control');

const prisma = new PrismaClient();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_MODEL = 'claude-sonnet-4-6';
const MAX_EMAIL_TOKENS = 800;

/**
 * Main outreach worker function
 */
async function runOutreach() {
  console.log('📧 Starting outreach worker...');

  try {
    // Check budget
    const shouldProceed = await cacheControl.shouldProceedWithScoring();

    if (!shouldProceed) {
      console.log('Budget limit reached, skipping outreach generation');
      return;
    }

    // Get scored clinics without outreach drafts
    const clinicsNeedingOutreach = await prisma.clinic.findMany({
      where: {
        scores: {
          some: {}
        },
        outreachQueue: {
          none: {
            status: {
              in: ['DRAFTED', 'APPROVED', 'SENT']
            }
          }
        }
      },
      include: {
        scores: {
          where: {
            modelVersion: 'claude-opus-4-8'
          },
          orderBy: { scoredAt: 'desc' },
          take: 1
        },
        ads: {
          where: {
            lastSeen: {
              gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            }
          },
          take: 3
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    if (clinicsNeedingOutreach.length === 0) {
      console.log('No clinics requiring outreach found');
      return;
    }

    console.log(`Generating outreach for ${clinicsNeedingOutreach.length} clinics...`);

    const results = await generateDrafts(clinicsNeedingOutreach);

    console.log(`✅ Outreach generation complete: ${results.successful.length} drafted, ${results.failed.length} failed`);

    return results;

  } catch (error) {
    console.error('❌ Outreach worker failed:', error.message);
    throw error;
  }
}

/**
 * Generate outreach drafts for multiple clinics
 */
async function generateDrafts(clinics) {
  const successful = [];
  const failed = [];

  for (const clinic of clinics) {
    try {
      const score = clinic.scores[0]; // Get most recent score

      // Generate email draft
      const emailDraft = await generateEmailDraft(clinic, score);

      // Generate LinkedIn DM
      const linkedinDM = await generateLinkedInDM(clinic, score);

      // Create outreach queue entries
      await prisma.outreachQueue.createMany({
        data: [
          {
            clinicId: clinic.id,
            channel: 'email',
            subject: `Helping ${clinic.name} improve ${score.serviceToPitch}`,
            body: emailDraft,
            status: 'DRAFTED'
          },
          {
            clinicId: clinic.id,
            channel: 'linkedin_dm',
            subject: null,
            body: linkedinDM,
            status: 'DRAFTED'
          }
        ]
      });

      successful.push({ clinic: clinic.name, channels: ['email', 'linkedin_dm'] });

      // Rate limiting
      await sleep(300);

    } catch (error) {
      console.error(`Error generating outreach for ${clinic.name}:`, error.message);
      failed.push({ clinic: clinic.name, error: error.message });
    }
  }

  return { successful, failed };
}

/**
 * Generate email draft using Claude Sonnet 4.6
 */
async function generateEmailDraft(clinic, score) {
  try {
    const prompt = buildEmailPrompt(clinic, score);

    const response = await anthropic.messages.create({
      model: EMAIL_MODEL,
      max_tokens: MAX_EMAIL_TOKENS,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const emailText = response.content[0].text;

    // Track API call
    await cacheControl.trackApiCall(
      EMAIL_MODEL,
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    console.log(`  📧 Generated email for ${clinic.name}`);
    return emailText;

  } catch (error) {
    console.error(`Error generating email for ${clinic.name}:`, error.message);
    throw error;
  }
}

/**
 * Generate LinkedIn DM using Claude Sonnet 4.6
 */
async function generateLinkedInDM(clinic, score) {
  try {
    const prompt = buildLinkedInDMPrompt(clinic, score);

    const response = await anthropic.messages.create({
      model: EMAIL_MODEL,
      max_tokens: 300, // LinkedIn DMs are short
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const dmText = response.content[0].text;

    // Track API call
    await cacheControl.trackApiCall(
      EMAIL_MODEL,
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    console.log(`  💼 Generated LinkedIn DM for ${clinic.name}`);
    return dmText;

  } catch (error) {
    console.error(`Error generating LinkedIn DM for ${clinic.name}:`, error.message);
    throw error;
  }
}

/**
 * Send email via Resend
 */
async function sendEmail(outreach) {
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: outreach.clinicId }
    });

    if (!clinic.email) {
      throw new Error('Clinic has no email address');
    }

    const response = await resend.emails.send({
      from: 'playbookmpr@playbookmpr.co.uk',
      to: clinic.email,
      subject: outreach.subject || 'Improving Your Clinic\'s Online Presence',
      html: outreach.body
    });

    console.log(`✅ Email sent to ${clinic.name} (${clinic.email})`);
    return response;

  } catch (error) {
    console.error(`Error sending email:`, error.message);
    throw error;
  }
}

/**
 * Update outreach status based on webhook
 */
async function handleWebhook(event, data) {
  try {
    switch (event) {
      case 'email.delivered':
        // Email was successfully delivered
        break;

      case 'email.opened':
        await prisma.outreachQueue.updateMany({
          where: { subject: data.subject },
          data: {
            status: 'OPENED',
            openedAt: new Date()
          }
        });
        console.log(`📖 Email opened: ${data.subject}`);
        break;

      case 'email.clicked':
        // Track link clicks for engagement
        console.log(`🖱️ Email clicked: ${data.subject}`);
        break;

      case 'email.bounced':
        await prisma.outreachQueue.updateMany({
          where: { subject: data.subject },
          data: {
            status: 'BOUNCED'
          }
        });
        console.log(`❌ Email bounced: ${data.subject}`);
        break;

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

  } catch (error) {
    console.error(`Error handling webhook:`, error.message);
  }
}

/**
 * Get outreach queue statistics
 */
async function getOutreachStats() {
  try {
    const stats = await prisma.outreachQueue.groupBy({
      by: ['status'],
      _count: true
    });

    const summary = {
      total: 0,
      drafted: 0,
      approved: 0,
      sent: 0,
      opened: 0,
      replied: 0,
      bounced: 0,
      closed: 0
    };

    for (const stat of stats) {
      const status = stat.status.toLowerCase();
      summary[status] = stat._count;
      summary.total += stat._count;
    }

    return summary;

  } catch (error) {
    console.error('Error getting outreach stats:', error.message);
    return {};
  }
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run outreach if called directly
 */
if (require.main === module) {
  runOutreach()
    .then(() => {
      console.log('Outreach worker completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Outreach worker failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runOutreach,
  generateDrafts,
  sendEmail,
  handleWebhook,
  getOutreachStats
};
