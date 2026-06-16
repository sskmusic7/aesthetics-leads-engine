// Deduplication Worker
// Merges staging_raw records into deduped clinic records

const { PrismaClient } = require('@prisma/client');
const normalization = require('../lib/normalization');
const validation = require('../lib/validation');

const prisma = new PrismaClient();

/**
 * Main deduplication process
 */
async function runDedupe() {
  console.log('🔄 Starting deduplication process...');

  try {
    // Get unprocessed staging_raw records
    const unprocessedRecords = await prisma.stagingRaw.findMany({
      where: {
        processedAt: null
      },
      orderBy: {
        fetchedAt: 'asc'
      },
      take: 100 // Process in batches
    });

    if (unprocessedRecords.length === 0) {
      console.log('No unprocessed records found');
      return;
    }

    console.log(`Processing ${unprocessedRecords.length} records...`);

    let created = 0;
    let merged = 0;
    let errors = 0;

    for (const record of unprocessedRecords) {
      try {
        // Extract name and postcode from payload
        const { name, postcode } = extractNamePostcode(record.payload);

        if (!name || !postcode) {
          console.log('Skipping record with missing name/postcode');
          await markProcessed(record.id);
          continue;
        }

        // Normalize data
        const normalizedName = normalization.normalizeName(name);
        const normalizedPostcode = normalization.normalizePostcode(postcode);

        // Find existing clinic
        const existingClinic = await prisma.clinic.findUnique({
          where: {
            name_postcode: {
              name: normalizedName,
              postcode: normalizedPostcode
            }
          }
        });

        if (existingClinic) {
          // Merge with existing clinic
          await mergeClinic(existingClinic, record);
          merged++;
          console.log(`Merged: ${normalizedName} (${normalizedPostcode})`);
        } else {
          // Create new clinic
          await createClinic(record, normalizedName, normalizedPostcode);
          created++;
          console.log(`Created: ${normalizedName} (${normalizedPostcode})`);
        }

        // Mark as processed
        await markProcessed(record.id);

      } catch (error) {
        console.error(`Error processing record ${record.id}:`, error.message);
        errors++;
      }
    }

    console.log(`✅ Deduplication complete: ${created} created, ${merged} merged, ${errors} errors`);

  } catch (error) {
    console.error('❌ Deduplication failed:', error.message);
    throw error;
  }
}

/**
 * Extract name and postcode from payload
 */
function extractNamePostcode(payload) {
  // Handle different payload structures from different sources
  if (typeof payload === 'string') {
    payload = JSON.parse(payload);
  }

  let name = payload.name || payload.company_name || payload.establishment_name || payload.page_name;
  let postcode = payload.postcode || payload.address?.postal_code || '';

  return { name, postcode };
}

/**
 * Create new clinic from staging record
 */
async function createClinic(stagingRecord, normalizedName, normalizedPostcode) {
  const payload = typeof stagingRecord.payload === 'string'
    ? JSON.parse(stagingRecord.payload)
    : stagingRecord.payload;

  // Extract and normalize fields
  const data = {
    name: normalizedName,
    postcode: normalizedPostcode,
    borough: extractBorough(payload, stagingRecord.source),
    address: extractAddress(payload),
    sicCodes: extractSicCodes(payload),
    cqcRegistered: extractCqcRegistered(payload),
    saveFaceListed: extractSaveFaceListed(payload),
    licenceType: extractLicenceType(payload),
    websiteUrl: validation.validateUrl(payload.website_url || payload.website),
    phone: validation.normalizePhone(payload.phone),
    email: payload.email,
    sources: [stagingRecord.source]
  };

  // Create clinic
  const clinic = await prisma.clinic.create({
    data
  });

  // Link staging record to clinic
  await prisma.stagingRaw.update({
    where: { id: stagingRecord.id },
    data: {
      clinicMatchId: clinic.id,
      processedAt: new Date()
    }
  });

  // Process ads if present (for Facebook ads)
  if (stagingRecord.source === 'facebook_ads') {
    await createAdFromPayload(clinic.id, payload);
  }

  return clinic;
}

/**
 * Merge with existing clinic
 */
async function mergeClinic(clinic, stagingRecord) {
  const payload = typeof stagingRecord.payload === 'string'
    ? JSON.parse(stagingRecord.payload)
    : stagingRecord.payload;

  // Build update data (only overwrite if new source has better data)
  const updateData = {
    sources: {
      push: stagingRecord.source
    },
    lastVerifiedAt: new Date()
  };

  // Add missing fields
  if (!clinic.address && payload.address) {
    updateData.address = extractAddress(payload);
  }

  if (!clinic.websiteUrl && payload.website_url) {
    updateData.websiteUrl = validation.validateUrl(payload.website_url);
  }

  if (!clinic.phone && payload.phone) {
    updateData.phone = validation.normalizePhone(payload.phone);
  }

  if (!clinic.email && payload.email) {
    updateData.email = payload.email;
  }

  // Update regulatory flags
  if (payload.cqc_registered) {
    updateData.cqcRegistered = true;
  }

  if (payload.save_face_listed) {
    updateData.saveFaceListed = true;
  }

  if (payload.licence_type) {
    updateData.licenceType = payload.licence_type;
  }

  // Update clinic
  await prisma.clinic.update({
    where: { id: clinic.id },
    data: updateData
  });

  // Link staging record
  await prisma.stagingRaw.update({
    where: { id: stagingRecord.id },
    data: {
      clinicMatchId: clinic.id,
      processedAt: new Date()
    }
  });

  // Process ads if present
  if (stagingRecord.source === 'facebook_ads') {
    await createAdFromPayload(clinic.id, payload);
  }

  return clinic;
}

/**
 * Create ad record from Facebook Ad payload
 */
async function createAdFromPayload(clinicId, payload) {
  try {
    await prisma.ad.create({
      data: {
        clinicId,
        adText: payload.ad_text || '',
        creativeUrl: payload.creative_url || '',
        mediaType: payload.media_type || 'IMAGE',
        platforms: payload.platforms || ['facebook'],
        firstSeen: payload.first_seen || new Date(),
        lastSeen: payload.last_seen || new Date(),
        source: payload.source || 'facebook_ads'
      }
    });
  } catch (error) {
    console.error('Error creating ad record:', error.message);
  }
}

/**
 * Extract borough from payload
 */
function extractBorough(payload, source) {
  if (payload.borough) return payload.borough;

  // Extract from postcode
  if (payload.postcode) {
    const prefix = payload.postcode.split(' ')[0].toUpperCase();
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

    for (const [key, value] of Object.entries(boroughMap)) {
      if (prefix.startsWith(key)) return value;
    }
  }

  return 'London';
}

/**
 * Extract address from payload
 */
function extractAddress(payload) {
  if (payload.address) return payload.address;
  if (payload.address_line_1 || payload.address_line_2) {
    return [payload.address_line_1, payload.address_line_2, payload.locality, payload.country]
      .filter(Boolean)
      .join(', ');
  }
  return null;
}

/**
 * Extract SIC codes from payload
 */
function extractSicCodes(payload) {
  if (payload.sic_codes) return payload.sic_codes;
  if (payload.sicCodes) return payload.sicCodes;
  return [];
}

/**
 * Extract CQC registered flag
 */
function extractCqcRegistered(payload) {
  return payload.cqc_registered || payload.cqcRegistered || false;
}

/**
 * Extract Save Face listed flag
 */
function extractSaveFaceListed(payload) {
  return payload.save_face_listed || payload.saveFaceListed || false;
}

/**
 * Extract licence type
 */
function extractLicenceType(payload) {
  return payload.licence_type || payload.licenceType || null;
}

/**
 * Mark staging record as processed
 */
async function markProcessed(recordId) {
  await prisma.stagingRaw.update({
    where: { id: recordId },
    data: { processedAt: new Date() }
  });
}

/**
 * Run dedupe if called directly
 */
if (require.main === module) {
  runDedupe()
    .then(() => {
      console.log('Dedupe worker completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Dedupe worker failed:', error);
      process.exit(1);
    });
}

module.exports = { runDedupe };
