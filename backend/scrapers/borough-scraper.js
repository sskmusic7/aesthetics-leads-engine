// Borough License Scraper
// Scrapes special treatment registers from Westminster, Camden, Kensington & Chelsea

const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Scrape borough special treatment licenses
 */
async function scrape(boroughs = ['westminster', 'camden', 'kensington']) {
  console.log('🏛️ Starting borough license scrape...');

  const results = [];

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    for (const borough of boroughs) {
      console.log(`Scraping ${borough}...`);

      const boroughResults = await scrapeBorough(context, borough);
      results.push(...boroughResults);

      // Rate limiting between boroughs
      await sleep(2000);
    }

    await context.close();
    await browser.close();

    console.log(`✅ Borough license scrape complete: ${results.length} records found`);
    return results;

  } catch (error) {
    console.error('❌ Borough license scrape failed:', error.message);
    throw error;
  }
}

/**
 * Scrape individual borough
 */
async function scrapeBorough(context, borough) {
  const results = [];

  try {
    const page = await context.newPage();

    // Borough-specific URLs and configurations
    const boroughConfigs = {
      westminster: {
        url: 'https://www.westminster.gov.uk/special-treatments-register',
        searchSelector: '.special-treatment-list',
        itemSelector: '.treatment-item'
      },
      camden: {
        url: 'https://www.camden.gov.uk/special-treatments-register',
        searchSelector: '.register-list',
        itemSelector: '.register-item'
      },
      kensington: {
        url: 'https://www.rbkc.gov.uk/special-treatments-register',
        searchSelector: '.treatment-register',
        itemSelector: '.establishment'
      }
    };

    const config = boroughConfigs[borough];
    if (!config) {
      console.log(`No configuration for ${borough}, skipping...`);
      return results;
    }

    await page.goto(config.url, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for results to load
    await page.waitForSelector(config.searchSelector, { timeout: 15000 });

    // Extract establishment data
    const establishments = await page.evaluate((selector) => {
      const items = document.querySelectorAll(selector);
      return Array.from(items).map(item => ({
        name: item.querySelector('.name')?.textContent?.trim() || item.textContent.split('\n')[0],
        address: item.querySelector('.address')?.textContent?.trim(),
        postcode: item.querySelector('.postcode')?.textContent?.trim(),
        licence_type: item.querySelector('.licence-type')?.textContent?.trim(),
        licence_number: item.querySelector('.licence-number')?.textContent?.trim(),
        expiry_date: item.querySelector('.expiry-date')?.textContent?.trim()
      }));
    }, config.itemSelector);

    for (const establishment of establishments) {
      if (establishment.name && establishment.postcode) {
        const clinicData = {
          name: establishment.name,
          postcode: establishment.postcode,
          borough: formatBoroughName(borough),
          address: establishment.address,
          licence_type: establishment.licence_type || 'special treatments',
          licence_number: establishment.licence_number,
          expiry_date: establishment.expiry_date,
          source: 'borough_licence',
          fetched_at: new Date().toISOString()
        };

        results.push(clinicData);

        // Store in staging_raw
        await prisma.stagingRaw.create({
          data: {
            source: 'borough_licence',
            payload: clinicData,
            fetchedAt: new Date()
          }
        });
      }
    }

    await page.close();
    console.log(`  ✅ ${borough}: ${results.length} records`);

  } catch (error) {
    console.error(`  ❌ Error scraping ${borough}:`, error.message);
  }

  return results;
}

/**
 * Format borough name
 */
function formatBoroughName(borough) {
  const names = {
    westminster: 'Westminster',
    camden: 'Camden',
    kensington: 'Kensington and Chelsea'
  };
  return names[borough] || borough;
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { scrape };
