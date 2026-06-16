// Facebook Ad Library Scraper
// Uses Apify Actor as primary source, Meta API as secondary for EU-reach ads

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_FB_ADS_ACTOR = process.env.APIFY_FB_ADS_ACTOR;
const META_ADLIB_TOKEN = process.env.META_ADLIB_TOKEN;
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v25.0';

/**
 * Scrape Facebook Ad Library for aesthetic clinic ads
 */
async function scrape(keywords = ['botox', 'lip filler', 'dermal filler', 'aesthetics']) {
  console.log('📱 Starting Facebook Ad Library scrape...');

  const results = [];

  try {
    // Primary: Use Apify Actor
    const apifyResults = await scrapeWithApify(keywords);
    results.push(...apifyResults);

    // Secondary: Use Meta API for additional EU-reach ads
    if (META_ADLIB_TOKEN) {
      const metaResults = await scrapeWithMetaAPI(keywords);
      results.push(...metaResults);
    }

    console.log(`✅ Facebook Ad Library scrape complete: ${results.length} ads found`);
    return results;

  } catch (error) {
    console.error('❌ Facebook Ad Library scrape failed:', error.message);
    throw error;
  }
}

/**
 * Scrape using Apify Actor (primary method)
 */
async function scrapeWithApify(keywords) {
  console.log('🤖 Using Apify Actor for Facebook Ad Library...');

  const results = [];

  try {
    if (!APIFY_TOKEN || !APIFY_FB_ADS_ACTOR) {
      console.log('Apify credentials not configured, skipping...');
      return results;
    }

    for (const keyword of keywords) {
      console.log(`Searching for: ${keyword}`);

      // Call Apify Actor
      const response = await axios.post(
        `https://api.apify.com/v2/acts/${APIFY_FB_ADS_ACTOR}/runs`,
        {
          query: keyword,
          location: 'United Kingdom',
          adType: 'ALL',
          maxItems: 100
        },
        {
          headers: {
            'Authorization': `Bearer ${APIFY_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const runId = response.data.data.id;
      console.log(`Apify run started: ${runId}`);

      // Wait for run to complete and fetch results
      const ads = await waitForApifyResults(runId, keyword);

      for (const ad of ads) {
        const adData = {
          page_name: ad.pageName,
          page_id: ad.pageId,
          ad_text: ad.adText || ad.primaryText || ad.caption,
          creative_url: ad.videoUrl || ad.imageUrl,
          media_type: ad.videoUrl ? 'VIDEO' : 'IMAGE',
          platforms: ['facebook', 'instagram'].filter(p => ad.platforms?.includes(p)),
          first_seen: ad.adStartTime,
          last_seen: ad.adDeliveryTime || new Date().toISOString(),
          target_keywords: keywords,
          source: 'apify',
          fetched_at: new Date().toISOString()
        };

        results.push(adData);

        // Store in staging_raw
        await prisma.stagingRaw.create({
          data: {
            source: 'facebook_ads',
            payload: adData,
            fetchedAt: new Date()
          }
        });
      }

      // Rate limiting
      await sleep(1000);
    }

    console.log(`✅ Apify scrape complete: ${results.length} ads found`);
    return results;

  } catch (error) {
    console.error('❌ Apify scrape failed:', error.message);
    return results;
  }
}

/**
 * Scrape using Meta Graph API (secondary method for EU-reach ads)
 */
async function scrapeWithMetaAPI(keywords) {
  console.log('📘 Using Meta Graph API for additional ads...');

  const results = [];

  try {
    for (const keyword of keywords) {
      console.log(`Searching Meta API for: ${keyword}`);

      // Search ads using Meta Graph API
      const response = await axios.get(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/ads_archive`,
        {
          params: {
            access_token: META_ADLIB_TOKEN,
            ad_type: 'ALL',
            ad_reached_countries: 'GB',
            search_terms: keyword,
            fields: 'id,ad_snapshot_url,ad_delivery_start_time,ad_delivery_stop_time,ad_creative_bodies,ad_creative_link_captions,ad_creative_link_descriptions,ad_creative_link_titles,page_id,page_name,primary_currency,demographic_distribution,region_distribution',
            limit: 100
          }
        }
      );

      const ads = response.data.data || [];

      for (const ad of ads) {
        const adData = {
          page_name: ad.page_name,
          page_id: ad.page_id,
          ad_text: (ad.ad_creative_bodies || [ad.ad_creative_link_captions, ad.ad_creative_link_descriptions, ad.ad_creative_link_titles].filter(Boolean).join(' ')).join(' '),
          creative_url: ad.ad_snapshot_url?.[0],
          media_type: 'IMAGE',
          platforms: ['facebook'],
          first_seen: ad.ad_delivery_start_time,
          last_seen: ad.ad_delivery_stop_time || new Date().toISOString(),
          target_keywords: keywords,
          source: 'meta_api',
          fetched_at: new Date().toISOString()
        };

        results.push(adData);

        // Store in staging_raw
        await prisma.stagingRaw.create({
          data: {
            source: 'facebook_ads',
            payload: adData,
            fetchedAt: new Date()
          }
        });
      }

      // Rate limiting
      await sleep(2000);
    }

    console.log(`✅ Meta API scrape complete: ${results.length} additional ads found`);
    return results;

  } catch (error) {
    console.error('❌ Meta API scrape failed:', error.message);
    // Don't throw here, just return empty results since this is secondary
    return results;
  }
}

/**
 * Wait for Apify run to complete and fetch results
 */
async function waitForApifyResults(runId, keyword, maxAttempts = 30) {
  const apiUrl = `https://api.apify.com/v2/acts/${APIFY_FB_ADS_ACTOR}/runs/${runId}`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Check run status
      const statusResponse = await axios.get(apiUrl, {
        headers: {
          'Authorization': `Bearer ${APIFY_TOKEN}`
        }
      });

      const status = statusResponse.data.data.status;

      if (status === 'SUCCEEDED') {
        console.log(`Apify run ${runId} completed for ${keyword}`);

        // Fetch results
        const resultsResponse = await axios.get(`${apiId}/dataset/items`, {
          headers: {
            'Authorization': `Bearer ${APIFY_TOKEN}`
          }
        });

        return resultsResponse.data.data || [];

      } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        console.log(`Apify run ${runId} failed with status: ${status}`);
        return [];
      }

      // Still running, wait and retry
      console.log(`Apify run ${runId} status: ${status}, waiting...`);
      await sleep(5000);

    } catch (error) {
      console.error(`Error checking Apify run status:`, error.message);
      await sleep(5000);
    }
  }

  console.log(`Apify run ${runId} timed out`);
  return [];
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { scrape };
