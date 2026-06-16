// Claude Opus 4.8 Scoring Worker
// Scores clinics using Claude API with ICP scoring and personalized outreach hooks

const Anthropic = require('@anthropic-ai/sdk');
const { PrismaClient } = require('@prisma/client');
const buildScoringPrompt = require('../lib/scoring-prompts');

const prisma = new PrismaClient();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 1000;
const MAX_DAILY_TOKENS = parseInt(process.env.MAX_DAILY_TOKENS || '50000');

/**
 * Main scoring worker function
 */
async function runScoring() {
  console.log('🤖 Starting Claude Opus 4.8 scoring...');

  try {
    // Get clinics without scores
    const unscoredClinics = await prisma.clinic.findMany({
      where: {
        scores: {
          none: {}
        }
      },
      include: {
        ads: {
          where: {
            lastSeen: {
              gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
            }
          },
          orderBy: { lastSeen: 'desc' }
        }
      },
      take: 10 // Process in batches
    });

    if (unscoredClinics.length === 0) {
      console.log('No unscored clinics found');
      return;
    }

    console.log(`Scoring ${unscoredClinics.length} clinics...`);

    const results = await scoreBatch(unscoredClinics);

    console.log(`✅ Scoring complete: ${results.successful.length} scored, ${results.failed.length} failed`);

    return results;

  } catch (error) {
    console.error('❌ Scoring worker failed:', error.message);
    throw error;
  }
}

/**
 * Score a batch of clinics
 */
async function scoreBatch(clinics) {
  const successful = [];
  const failed = [];

  for (const clinic of clinics) {
    try {
      const score = await scoreClinic(clinic);

      if (score) {
        successful.push({ clinic: clinic.name, score: score.compositeScore });
      } else {
        failed.push({ clinic: clinic.name, error: 'Scoring returned null' });
      }

      // Rate limiting between requests
      await sleep(500);

    } catch (error) {
      console.error(`Error scoring ${clinic.name}:`, error.message);
      failed.push({ clinic: clinic.name, error: error.message });
    }
  }

  return { successful, failed };
}

/**
 * Score individual clinic using Claude Opus 4.8
 */
async function scoreClinic(clinic) {
  try {
    // Build input object for Claude
    const input = {
      clinic_name: clinic.name,
      borough: clinic.borough,
      sic_codes: clinic.sicCodes || [],
      cqc_registered: clinic.cqcRegistered,
      save_face_listed: clinic.saveFaceListed,
      licence_type: clinic.licenceType,
      website_url: clinic.websiteUrl,
      website_load_seconds: clinic.websiteUrl ? await measureWebsiteLoad(clinic.websiteUrl) : null,
      active_ads: clinic.ads.map(ad => ({
        ad_text: ad.adText,
        creative_url: ad.creativeUrl,
        media_type: ad.mediaType,
        platforms: ad.platforms,
        last_seen: ad.lastSeen
      }))
    };

    console.log(`Scoring: ${clinic.name} (${clinic.borough})`);

    // Call Claude API
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{
        role: 'user',
        content: buildScoringPrompt(input)
      }]
    });

    // Parse JSON response
    const responseText = response.content[0].text;
    const scoreData = parseJsonResponse(responseText);

    if (!scoreData) {
      throw new Error('Failed to parse Claude response as JSON');
    }

    // Store score in database
    const score = await prisma.score.create({
      data: {
        clinicId: clinic.id,
        icpScore: scoreData.icp_score,
        compositeScore: scoreData.composite_score,
        painPoints: scoreData.pain_points,
        serviceToPitch: scoreData.service_to_pitch,
        personalisedHook: scoreData.personalised_hook,
        contactConfidence: scoreData.contact_confidence,
        adAuditFlag: scoreData.ad_audit_flag,
        modelVersion: MODEL
      }
    });

    console.log(`  ✅ Scored: ${score.compositeScore}/100 - ${scoreData.service_to_pitch}`);
    return score;

  } catch (error) {
    console.error(`Error scoring clinic ${clinic.name}:`, error.message);
    throw error;
  }
}

/**
 * Parse JSON response from Claude
 */
function parseJsonResponse(text) {
  try {
    // Remove markdown code blocks if present
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();

    // Parse JSON
    const parsed = JSON.parse(cleaned);

    // Validate required fields
    const requiredFields = ['icp_score', 'composite_score', 'pain_points', 'service_to_pitch', 'personalised_hook', 'contact_confidence', 'ad_audit_flag'];

    for (const field of requiredFields) {
      if (parsed[field] === undefined) {
        console.warn(`Missing field in response: ${field}`);
        parsed[field] = getDefaultFieldValue(field);
      }
    }

    return parsed;
  } catch (error) {
    console.error('Error parsing JSON response:', error.message);
    console.error('Response text:', text);
    return null;
  }
}

/**
 * Get default value for missing fields
 */
function getDefaultFieldValue(field) {
  const defaults = {
    icp_score: 50,
    composite_score: 50,
    pain_points: [],
    service_to_pitch: 'website',
    personalised_hook: 'We can help improve your clinic\'s online presence',
    contact_confidence: 50,
    ad_audit_flag: false
  };

  return defaults[field];
}

/**
 * Measure website load time (simplified)
 */
async function measureWebsiteLoad(url) {
  try {
    const start = Date.now();

    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    const loadTime = (Date.now() - start) / 1000;

    return Math.round(loadTime * 10) / 10; // Round to 1 decimal place

  } catch (error) {
    console.warn(`Could not measure load time for ${url}:`, error.message);
    return null;
  }
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run scoring if called directly
 */
if (require.main === module) {
  runScoring()
    .then(() => {
      console.log('Scoring worker completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Scoring worker failed:', error);
      process.exit(1);
    });
}

module.exports = { runScoring, scoreBatch };
