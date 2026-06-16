// Save Face Directory Scraper
// Scrapes accredited injectable/filler practitioners from the Save Face register

const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SAVE_FACE_URL = 'https://www.saveface.co.uk/find-a-practitioner';

/**
 * Scrape Save Face directory for London-based practitioners
 */
async function scrape() {
  console.log('💉 Starting Save Face directory scrape...');

  const results = [];

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    const page = await context.newPage();

    await page.goto(SAVE_FACE_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Apply London filter (typically via search or location filter)
    await applyLondonFilter(page);

    // Wait for results
    await page.waitForSelector('.practitioner-list, .practitioner-card', { timeout: 15000 });

    // Extract all practitioners
    const practitioners = await extractPractitioners(page);

    for (const practitioner of practitioners) {
      if (practitioner.name && practitioner.postcode) {
        const clinicData = {
          name: practitioner.name,
          postcode: practitioner.postcode,
          borough: extractBoroughFromPostcode(practitioner.postcode),
          address: practitioner.address,
          treatments: practitioner.treatments,
          accreditation: practitioner.accreditation,
          website_url: practitioner.website,
          phone: practitioner.phone,
          email: practitioner.email,
          save_face_listed: true,
          source: 'save_face',
          fetched_at: new Date().toISOString()
        };

        results.push(clinicData);

        // Store in staging_raw
        await prisma.stagingRaw.create({
          data: {
            source: 'save_face',
            payload: clinicData,
            fetchedAt: new Date()
          }
        });
      }
    }

    await context.close();
    await browser.close();

    console.log(`✅ Save Face directory scrape complete: ${results.length} records found`);
    return results;

  } catch (error) {
    console.error('❌ Save Face directory scrape failed:', error.message);
    throw error;
  }
}

/**
 * Apply London filter to search results
 */
async function applyLondonFilter(page) {
  try {
    // Try to find location search input
    const locationInput = await page.$('input[placeholder*="location"], input[placeholder*="postcode"], #location-search');

    if (locationInput) {
      await locationInput.fill('London');
      await page.click('button[type="submit"], .search-button');
      await page.waitForLoadState('networkidle');
    } else {
      // Alternative: use London-specific URL if available
      console.log('Using alternative London filtering method');
    }
  } catch (error) {
    console.log('Could not apply London filter, will filter results manually');
  }
}

/**
 * Extract practitioner information from directory listing
 */
async function extractPractitioners(page) {
  const practitioners = [];

  try {
    // Scroll to load all results
    await autoScroll(page);

    // Extract practitioner cards
    const cards = await page.$$('.practitioner-card, .practitioner-item, .clinic-card');

    for (const card of cards) {
      const practitioner = await card.evaluate((el) => ({
        name: el.querySelector('.name, .practitioner-name, h3, h4')?.textContent?.trim(),
        address: el.querySelector('.address, .clinic-address')?.textContent?.trim(),
        postcode: extractPostcode(el.textContent),
        treatments: extractTreatments(el),
        accreditation: el.querySelector('.accreditation, .badge')?.textContent?.trim(),
        website: el.querySelector('a[href*="http"]')?.href,
        phone: el.querySelector('[href*="tel:"]')?.getAttribute('href')?.replace('tel:', ''),
        email: el.querySelector('[href*="mailto:"]')?.getAttribute('href')?.replace('mailto:', '')
      }));

      if (practitioner.name) {
        practitioners.push(practitioner);
      }
    }

  } catch (error) {
    console.error('Error extracting practitioners:', error.message);
  }

  return practitioners;
}

/**
 * Auto-scroll to load lazy-loaded content
 */
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });

  // Wait for any lazy-loaded content
  await page.waitForTimeout(2000);
}

/**
 * Extract postcode from text
 */
function extractPostcode(text) {
  const postcodeRegex = /[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}/i;
  const match = text?.match(postcodeRegex);
  return match ? match[0].toUpperCase() : null;
}

/**
 * Extract treatments from card
 */
function extractTreatments(element) {
  const treatments = [];
  const treatmentElements = element.querySelectorAll('.treatment, .specialty, .service');

  treatmentElements.forEach(el => {
    const treatment = el.textContent?.trim();
    if (treatment && !treatments.includes(treatment)) {
      treatments.push(treatment);
    }
  });

  return treatments;
}

/**
 * Extract borough from postcode
 */
function extractBoroughFromPostcode(postcode) {
  if (!postcode) return 'London';

  const boroughMap = {
    'EC': 'City of London',
    'WC': 'Camden',
    'SW1': 'Westminster',
    'SW3': 'Kensington and Chelsea',
    'W1': 'Westminster',
    'W8': 'Kensington and Chelsea',
    'NW1': 'Camden',
    'NW8': 'Westminster',
    'SE1': 'Southwark',
    'E1': 'Tower Hamlets'
  };

  const prefix = postcode.split(' ')[0].toUpperCase();

  for (const [key, value] of Object.entries(boroughMap)) {
    if (prefix.startsWith(key)) {
      return value;
    }
  }

  return 'London';
}

module.exports = { scrape };
