// Outreach Worker with AI Fallback
// Handles email drafting with AI service (Anthropic/Gemini) and Resend integration

const Resend = require('resend');
const { PrismaClient } = require('@prisma/client');
const aiService = require('../lib/ai-service');
const cacheControl = require('../lib/cache-control');

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

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
 * Generate email draft using AI service with fallback
 */
async function generateEmailDraft(clinic, score) {
  try {
    // Use AI service with automatic fallback
    const email = await aiService.generateEmail(clinic, score);

    console.log(`  📧 Generated email for ${clinic.name} (${email.provider})`);
    return `SUBJECT: ${email.subject}\n\n${email.body}`;

  } catch (error) {
    console.error(`Error generating email for ${clinic.name}:`, error.message);
    throw error;
  }
}

/**
 * Generate LinkedIn DM using AI service
 */
async function generateLinkedInDM(clinic, score) {
  try {
    // For LinkedIn DMs, we'll use a simpler prompt through the AI service
    const dmPrompt = `Generate a short LinkedIn DM (under 100 words) for ${clinic.name}.

Context: They scored ${score.icpScore}/100 on our ICP fit.
Pain points: ${score.painPoints?.join(', ')}
Service to pitch: ${score.serviceToPitch}

Write a professional, concise LinkedIn message that:
1. References their specific situation
2. Mentions one relevant pain point
3. Suggests a quick call
4. Is conversational but professional
5. Under 100 words`;

    // Use the email generation as a base for LinkedIn DMs
    const email = await aiService.generateEmail(clinic, {
      ...score,
      service_to_pitch: 'linkedin_connection'
    });

    // Extract just the body and convert to LinkedIn DM format
    const dmText = email.body
      .replace(/\n\n+/g, '\n\n')  // Normalize spacing
      .split('\n\n')[0] + '\n\nWould you be open to a quick call?';

    console.log(`  💼 Generated LinkedIn DM for ${clinic.name} (${email.provider})`);
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
