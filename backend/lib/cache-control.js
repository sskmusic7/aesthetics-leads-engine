// Cache Control for Claude API Usage
// Prevents redundant API calls and manages token budget

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Token budget limits
const MAX_DAILY_TOKENS = parseInt(process.env.MAX_DAILY_TOKENS || '50000');
const SCORING_BATCH_SIZE = parseInt(process.env.SCORING_BATCH_SIZE || '10');

/**
 * Check if clinic score is cached and still valid
 */
async function getCachedScore(clinicId) {
  try {
    const score = await prisma.score.findUnique({
      where: { clinicId }
    });

    if (!score) {
      return null;
    }

    // Check if score is still valid (30 days)
    const daysSinceScored = (Date.now() - score.scoredAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceScored > 30) {
      console.log(`Score for clinic ${clinicId} is ${Math.round(daysSinceScored)} days old, refreshing...`);
      return null;
    }

    console.log(`Using cached score for clinic ${clinicId} (${Math.round(daysSinceScored)} days old)`);
    return score;

  } catch (error) {
    console.error('Error checking cached score:', error.message);
    return null;
  }
}

/**
 * Check if clinic data has changed since last score
 */
async function hasDataChanged(clinic, lastScoredAt) {
  try {
    // Get latest staging records for this clinic
    const latestRecords = await prisma.stagingRaw.findMany({
      where: {
        clinicMatchId: clinic.id,
        fetchedAt: {
          gte: lastScoredAt
        }
      },
      orderBy: { fetchedAt: 'desc' }
    });

    // If no new records, data hasn't changed
    return latestRecords.length > 0;

  } catch (error) {
    console.error('Error checking data changes:', error.message);
    return false;
  }
}

/**
 * Get daily token usage statistics
 */
async function getDailyTokenUsage() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count scores created today
    const scoresToday = await prisma.score.count({
      where: {
        scoredAt: {
          gte: today
        }
      }
    });

    // Estimate token usage (rough estimate based on average prompt + response)
    const estimatedTokensUsed = scoresToday * 1500; // Average 1500 tokens per score

    return {
      scores_today: scoresToday,
      estimated_tokens_used: estimatedTokensUsed,
      estimated_tokens_remaining: MAX_DAILY_TOKENS - estimatedTokensUsed,
      percentage_used: (estimatedTokensUsed / MAX_DAILY_TOKENS) * 100,
      max_daily_tokens: MAX_DAILY_TOKENS
    };

  } catch (error) {
    console.error('Error getting daily token usage:', error.message);
    return {
      scores_today: 0,
      estimated_tokens_used: 0,
      estimated_tokens_remaining: MAX_DAILY_TOKENS,
      percentage_used: 0,
      max_daily_tokens: MAX_DAILY_TOKENS
    };
  }
}

/**
 * Check if we should proceed with scoring based on budget
 */
async function shouldProceedWithScoring() {
  const usage = await getDailyTokenUsage();

  if (usage.estimated_tokens_remaining < 1000) {
    console.warn('⚠️ Daily token budget nearly exhausted, skipping scoring');
    return false;
  }

  if (usage.percentage_used > 90) {
    console.warn(`⚠️ ${usage.percentage_used.toFixed(1)}% of daily token budget used, recommend waiting until tomorrow`);
    return false;
  }

  return true;
}

/**
 * Get optimal batch size based on remaining budget
 */
async function getOptimalBatchSize() {
  const usage = await getDailyTokenUsage();

  // Calculate how many more scores we can afford
  const remainingBudget = usage.estimated_tokens_remaining;
  const tokensPerScore = 1500; // Conservative estimate

  const maxScores = Math.floor(remainingBudget / tokensPerScore);

  // Return the smaller of configured batch size or budget-limited size
  return Math.min(SCORING_BATCH_SIZE, maxScores);
}

/**
 * Track API call for monitoring
 */
async function trackApiCall(model, inputTokens, outputTokens) {
  console.log(`📊 API Call: ${model} | Input: ${inputTokens} | Output: ${outputTokens} | Total: ${inputTokens + outputTokens}`);

  // In a production system, this would log to a monitoring table
  // For now, just console log for debugging
}

/**
 * Get cost estimate for operations
 */
function getCostEstimate(operations) {
  // Claude Opus 4.8 pricing (as of 2025)
  const opusInput = 3.00; // $3.00 per million input tokens
  const opusOutput = 15.00; // $15.00 per million output tokens

  // Claude Sonnet 4.6 pricing
  const sonnetInput = 3.00;
  const sonnetOutput = 15.00;

  let totalCost = 0;

  for (const op of operations) {
    if (op.model === 'claude-opus-4-8') {
      totalCost += (op.input / 1000000) * opusInput;
      totalCost += (op.output / 1000000) * opusOutput;
    } else if (op.model === 'claude-sonnet-4-6') {
      totalCost += (op.input / 1000000) * sonnetInput;
      totalCost += (op.output / 1000000) * sonnetOutput;
    }
  }

  return {
    total_cost: totalCost,
    cost_per_operation: totalCost / operations.length,
    operations: operations.length
  };
}

/**
 * Log cache statistics
 */
async function logCacheStats() {
  try {
    const totalClinics = await prisma.clinic.count();
    const scoredClinics = await prisma.score.count();
    const cacheHitRate = totalClinics > 0 ? (scoredClinics / totalClinics) * 100 : 0;

    console.log(`
📊 Cache Statistics:
- Total Clinics: ${totalClinics}
- Scored Clinics: ${scoredClinics}
- Cache Hit Rate: ${cacheHitRate.toFixed(1)}%
- Unscored Clinics: ${totalClinics - scoredClinics}
    `);

    return {
      total_clinics: totalClinics,
      scored_clinics: scoredClinics,
      cache_hit_rate: cacheHitRate,
      unscored_clinics: totalClinics - scoredClinics
    };

  } catch (error) {
    console.error('Error logging cache stats:', error.message);
  }
}

module.exports = {
  getCachedScore,
  hasDataChanged,
  getDailyTokenUsage,
  shouldProceedWithScoring,
  getOptimalBatchSize,
  trackApiCall,
  getCostEstimate,
  logCacheStats
};
