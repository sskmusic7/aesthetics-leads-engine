// Normalization utilities for clinic data

/**
 * Normalize clinic name for deduplication
 */
function normalizeName(name) {
  if (!name) return '';

  return name
    .toLowerCase()
    .trim()
    // Remove common suffixes
    .replace(/\s+(ltd|limited|llc|plc|inc)\.?$/i, '')
    .replace(/\s+(clinic|clinics|aesthetics|medical|centre|center|associates|partners)$/i, '')
    // Remove special characters except spaces and hyphens
    .replace(/[^\w\s-]/g, '')
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize postcode for deduplication
 */
function normalizePostcode(postcode) {
  if (!postcode) return '';

  return postcode
    .toUpperCase()
    .trim()
    // Remove spaces and add them in correct place
    .replace(/\s/g, '')
    .replace(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/, '$1 $2');
}

/**
 * Normalize phone number
 */
function normalizePhone(phone) {
  if (!phone) return null;

  // Remove all non-numeric characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // UK numbers should start with 44 or 07
  if (cleaned.startsWith('07')) {
    return '+44 ' + cleaned.substring(1);
  } else if (cleaned.startsWith('44') && cleaned.length === 12) {
    return '+44 ' + cleaned.substring(2);
  }

  return cleaned || null;
}

/**
 * Extract borough from postcode
 */
function extractBoroughFromPostcode(postcode) {
  if (!postcode) return 'London';

  const prefix = postcode.toUpperCase().split(' ')[0];

  const boroughMap = {
    'EC': 'City of London',
    'WC': 'Camden',
    'SW1A': 'Westminster',
    'SW1E': 'Westminster',
    'SW1W': 'Westminster',
    'SW1P': 'Westminster',
    'SW1H': 'Westminster',
    'SW1V': 'Westminster',
    'SW1X': 'Westminster',
    'SW1Y': 'Westminster',
    'SW3': 'Kensington and Chelsea',
    'SW7': 'Kensington and Chelsea',
    'SW5': 'Kensington and Chelsea',
    'SW10': 'Kensington and Chelsea',
    'W1A': 'Westminster',
    'W1B': 'Westminster',
    'W1D': 'Westminster',
    'W1F': 'Westminster',
    'W1G': 'Westminster',
    'W1H': 'Westminster',
    'W1J': 'Westminster',
    'W1K': 'Westminster',
    'W1M': 'Westminster',
    'W1S': 'Westminster',
    'W1U': 'Westminster',
    'W1W': 'Westminster',
    'W8': 'Kensington and Chelsea',
    'NW1': 'Camden',
    'NW8': 'Westminster',
    'NW3': 'Camden',
    'NW5': 'Camden',
    'SE1': 'Southwark',
    'SE11': 'Lambeth',
    'E1': 'Tower Hamlets',
    'E1W': 'Tower Hamlets',
    'EC1A': 'Islington',
    'EC1V': 'Islington',
    'EC2N': 'City of London',
    'EC4V': 'City of London'
  };

  // Find best matching borough
  for (const [key, value] of Object.entries(boroughMap)) {
    if (prefix.startsWith(key)) {
      return value;
    }
  }

  return 'London';
}

/**
 * Merge clinic data sources
 */
function mergeClinicData(existing, newData) {
  const merged = { ...existing };

  // Only update if field is missing or new data is more reliable
  if (!merged.address && newData.address) {
    merged.address = newData.address;
  }

  if (!merged.websiteUrl && newData.websiteUrl) {
    merged.websiteUrl = newData.websiteUrl;
  }

  if (!merged.phone && newData.phone) {
    merged.phone = newData.phone;
  }

  if (!merged.email && newData.email) {
    merged.email = newData.email;
  }

  // Update regulatory flags
  if (newData.cqcRegistered) {
    merged.cqcRegistered = true;
  }

  if (newData.saveFaceListed) {
    merged.saveFaceListed = true;
  }

  // Add to sources if not present
  if (!merged.sources.includes(newData.source)) {
    merged.sources.push(newData.source);
  }

  return merged;
}

module.exports = {
  normalizeName,
  normalizePostcode,
  normalizePhone,
  extractBoroughFromPostcode,
  mergeClinicData
};
