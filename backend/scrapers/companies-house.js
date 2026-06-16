// Companies House API Scraper
// Targets SIC codes 86220 (specialist medical) and 96020 (beauty treatment)
// Filters to Greater London postcodes

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const COMPANIES_HOUSE_API = 'https://api.companieshouse.gov.uk';
const API_KEY = process.env.COMPANIES_HOUSE_API_KEY;

// London postcode prefixes (EC, WC, SE, SW, W, NW, N, E)
const LONDON_POSTCODES = ['EC', 'WC', 'SE', 'SW', 'W', 'NW', 'N', 'E'];

// Target SIC codes for aesthetic clinics
const TARGET_SIC_CODES = ['86220', '96020'];

/**
 * Scrape Companies House API for newly incorporated aesthetic clinics
 */
async function scrape() {
  console.log('🏢 Starting Companies House scrape...');

  if (!API_KEY) {
    throw new Error('COMPANIES_HOUSE_API_KEY not found in environment');
  }

  const results = [];

  try {
    // Search for companies with target SIC codes in London
    for (const sicCode of TARGET_SIC_CODES) {
      console.log(`Searching SIC code: ${sicCode}`);

      // Search companies by SIC code and location
      const searchResponse = await searchCompanies(`sics:${sicCode} AND location:"London"`, 100);

      for (const company of searchResponse.items || []) {
        // Filter by London postcodes
        const address = company.address?.postal_code || '';
        const postcodePrefix = address.split(' ')[0].toUpperCase();

        if (LONDON_POSTCODES.includes(postcodePrefix)) {
          // Fetch detailed company information
          const companyDetails = await getCompanyDetails(company.company_number);

          const clinicData = {
            company_number: company.company_number,
            name: company.title,
            postcode: address,
            borough: extractBoroughFromPostcode(address),
            address: formatAddress(company.address),
            sic_codes: companyDetails.sic_codes || [],
            incorporation_date: companyDetails.creation_date,
            status: companyDetails.company_status,
            website_url: await findWebsite(company.company_number),
            source: 'companies_house',
            fetched_at: new Date().toISOString()
          };

          results.push(clinicData);

          // Store in staging_raw
          await prisma.stagingRaw.create({
            data: {
              source: 'companies_house',
              payload: clinicData,
              fetchedAt: new Date()
            }
          });
        }
      }

      // Rate limiting - Companies House allows 300 requests per 5 minutes
      await sleep(1000);
    }

    console.log(`✅ Companies House scrape complete: ${results.length} records found`);
    return results;

  } catch (error) {
    console.error('❌ Companies House scrape failed:', error.message);
    throw error;
  }
}

/**
 * Search companies by query
 */
async function searchCompanies(query, limit = 100) {
  try {
    const response = await axios.get(`${COMPANIES_HOUSE_API}/advanced-search/companies`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(API_KEY + ':').toString('base64')}`
      },
      params: {
        q: query,
        start_index: 0,
        items_per_page: limit,
        size: 'advanced'
      }
    });

    return response.data;
  } catch (error) {
    if (error.response?.status === 429) {
      console.log('Rate limit hit, waiting 60 seconds...');
      await sleep(60000);
      return searchCompanies(query, limit);
    }
    throw error;
  }
}

/**
 * Get detailed company information
 */
async function getCompanyDetails(companyNumber) {
  try {
    const response = await axios.get(`${COMPANIES_HOUSE_API}/company/${companyNumber}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(API_KEY + ':').toString('base64')}`
      }
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching details for ${companyNumber}:`, error.message);
    return {};
  }
}

/**
 * Find website from company officers and registered office address
 */
async function findWebsite(companyNumber) {
  try {
    const response = await axios.get(`${COMPANIES_HOUSE_API}/company/${companyNumber}/registered-office-address`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(API_KEY + ':').toString('base64')}`
      }
    });

    // Check if there's a website in the registered office address
    // This would need manual verification or additional scraping
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract borough from postcode
 */
function extractBoroughFromPostcode(postcode) {
  // Simplified borough extraction based on postcode prefixes
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

  // Find matching borough
  for (const [key, value] of Object.entries(boroughMap)) {
    if (prefix.startsWith(key)) {
      return value;
    }
  }

  return 'London'; // Default fallback
}

/**
 * Format address from Companies House format
 */
function formatAddress(address) {
  const parts = [
    address.premises,
    address.address_line_1,
    address.address_line_2,
    address.locality,
    address.country
  ].filter(Boolean);

  return parts.join(', ');
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { scrape };
