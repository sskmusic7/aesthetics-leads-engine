// Scraper Worker - Orchestrates all data scrapers
// Runs via cron every 4 hours to fetch data from all 5 sources

const { PrismaClient } = require('@prisma/client');
const companiesHouse = require('../scrapers/companies-house');
const boroughScraper = require('../scrapers/borough-scraper');
const saveFace = require('../scrapers/save-face');
const facebookAds = require('../scrapers/facebook-ads');

const prisma = new PrismaClient();

/**
 * Main scraper worker function
 */
async function runScrapers() {
  console.log('🕷️ Starting scraper worker...');

  const results = {
    companies_house: { success: false, count: 0, error: null },
    borough_licenses: { success: false, count: 0, error: null },
    save_face: { success: false, count: 0, error: null },
    facebook_ads: { success: false, count: 0, error: null }
  };

  try {
    // Run Companies House scraper
    console.log('\n--- Companies House ---');
    try {
      const chResults = await companiesHouse.scrape();
      results.companies_house = { success: true, count: chResults.length, error: null };
      console.log(`✅ Companies House: ${chResults.length} records`);
    } catch (error) {
      results.companies_house = { success: false, count: 0, error: error.message };
      console.error(`❌ Companies House failed: ${error.message}`);
    }

    // Run Borough License scrapers
    console.log('\n--- Borough Licenses ---');
    try {
      const boroughResults = await boroughScraper.scrape(['westminster', 'camden', 'kensington']);
      results.borough_licenses = { success: true, count: boroughResults.length, error: null };
      console.log(`✅ Borough Licenses: ${boroughResults.length} records`);
    } catch (error) {
      results.borough_licenses = { success: false, count: 0, error: error.message };
      console.error(`❌ Borough Licenses failed: ${error.message}`);
    }

    // Run Save Face scraper
    console.log('\n--- Save Face Directory ---');
    try {
      const saveFaceResults = await saveFace.scrape();
      results.save_face = { success: true, count: saveFaceResults.length, error: null };
      console.log(`✅ Save Face: ${saveFaceResults.length} records`);
    } catch (error) {
      results.save_face = { success: false, count: 0, error: error.message };
      console.error(`❌ Save Face failed: ${error.message}`);
    }

    // Run Facebook Ad Library scraper
    console.log('\n--- Facebook Ad Library ---');
    try {
      const fbResults = await facebookAds.scrape(['botox', 'lip filler', 'dermal filler', 'aesthetics']);
      results.facebook_ads = { success: true, count: fbResults.length, error: null };
      console.log(`✅ Facebook Ads: ${fbResults.length} ads`);
    } catch (error) {
      results.facebook_ads = { success: false, count: 0, error: error.message };
      console.error(`❌ Facebook Ads failed: ${error.message}`);
    }

    // Summary
    console.log('\n=== SCRAPER SUMMARY ===');
    const totalRecords = Object.values(results).reduce((sum, r) => sum + r.count, 0);
    const successfulSources = Object.values(results).filter(r => r.success).length;

    console.log(`Total records fetched: ${totalRecords}`);
    console.log(`Successful sources: ${successfulSources}/4`);

    for (const [source, result] of Object.entries(results)) {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${source}: ${result.count} records${result.error ? ` (${result.error})` : ''}`);
    }

    console.log('========================\n');

    return results;

  } catch (error) {
    console.error('❌ Scraper worker failed:', error.message);
    throw error;
  }
}

/**
 * Get scraper statistics
 */
async function getScraperStats() {
  try {
    const stats = await prisma.stagingRaw.groupBy({
      by: ['source'],
      _count: true,
      orderBy: { _count: { source: 'desc' } }
    });

    const summary = {
      total: 0,
      by_source: {}
    };

    for (const stat of stats) {
      summary.by_source[stat.source] = stat._count;
      summary.total += stat._count;
    }

    // Get latest fetch times
    const latestFetches = await prisma.stagingRaw.groupBy({
      by: ['source'],
      _max: {
        fetchedAt: true
      }
    });

    summary.last_fetches = {};
    for (const fetch of latestFetches) {
      summary.last_fetches[fetch.source] = fetch._max.fetchedAt;
    }

    return summary;

  } catch (error) {
    console.error('Error getting scraper stats:', error.message);
    return { total: 0, by_source: {}, last_fetches: {} };
  }
}

/**
 * Test individual scraper
 */
async function testScraper(sourceName) {
  console.log(`Testing ${sourceName}...`);

  let result;

  switch (sourceName) {
    case 'companies_house':
      result = await companiesHouse.scrape();
      break;
    case 'borough_licenses':
      result = await boroughScraper.scrape(['westminster']); // Test one borough
      break;
    case 'save_face':
      result = await saveFace.scrape();
      break;
    case 'facebook_ads':
      result = await facebookAds.scrape(['botox']); // Test one keyword
      break;
    default:
      throw new Error(`Unknown scraper: ${sourceName}`);
  }

  console.log(`✅ ${sourceName} test complete: ${result.length} records`);
  return result;
}

/**
 * Run scraper if called directly
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  const testMode = args.includes('--test');
  const testSource = args.find(arg => arg.startsWith('--source='))?.split('=')[1];

  if (testMode && testSource) {
    // Test individual scraper
    testScraper(testSource)
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Test failed:', error);
        process.exit(1);
      });
  } else {
    // Run all scrapers
    runScrapers()
      .then(() => {
        console.log('Scraper worker completed');
        process.exit(0);
      })
      .catch(error => {
        console.error('Scraper worker failed:', error);
        process.exit(1);
      });
  }
}

module.exports = {
  runScrapers,
  getScraperStats,
  testScraper
};
