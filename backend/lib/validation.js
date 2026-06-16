// Validation utilities for clinic data

/**
 * Validate URL format
 */
function validateUrl(url) {
  if (!url) return null;

  // Remove whitespace
  let cleanUrl = url.trim();

  // Add protocol if missing
  if (!cleanUrl.match(/^https?:\/\//i)) {
    cleanUrl = 'https://' + cleanUrl;
  }

  // Basic URL format validation
  try {
    const urlObj = new URL(cleanUrl);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return null;
    }

    return cleanUrl;
  } catch (error) {
    console.warn(`Invalid URL: ${url}`);
    return null;
  }
}

/**
 * Validate UK postcode format
 */
function validatePostcode(postcode) {
  if (!postcode) return false;

  // UK postcode regex (simplified)
  const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i;

  const normalized = postcode.toUpperCase().trim();
  const formatted = normalized.replace(/\s/g, '').replace(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/, '$1 $2');

  return postcodeRegex.test(formatted);
}

/**
 * Validate email format
 */
function validateEmail(email) {
  if (!email) return false;

  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return emailRegex.test(email);
}

/**
 * Validate phone number format
 */
function validatePhone(phone) {
  if (!phone) return false;

  // Remove all non-numeric characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // UK numbers should be 10-12 digits (with or without country code)
  if (cleaned.startsWith('+44')) {
    return cleaned.length === 13; // +44 + 10 digits
  } else if (cleaned.startsWith('44')) {
    return cleaned.length === 12; // 44 + 10 digits
  } else if (cleaned.startsWith('07')) {
    return cleaned.length === 11; // 07 + 9 digits
  }

  return false;
}

/**
 * Validate SIC code format
 */
function validateSicCode(sicCode) {
  if (!sicCode) return false;

  // SIC codes are 5 digits
  const sicCodeRegex = /^\d{5}$/;

  return sicCodeRegex.test(sicCode);
}

/**
 * Check if clinic data is complete enough for outreach
 */
function isClinicDataComplete(clinic) {
  const requiredFields = ['name', 'postcode', 'borough'];

  for (const field of requiredFields) {
    if (!clinic[field]) {
      return false;
    }
  }

  return true;
}

/**
 * Check if clinic has at least one contact method
 */
function hasContactMethod(clinic) {
  return !!(clinic.email || clinic.phone || clinic.websiteUrl);
}

/**
 * Validate clinic record quality
 */
function getClinicQualityScore(clinic) {
  let score = 0;
  const maxScore = 10;

  // Basic information (3 points)
  if (clinic.name) score += 1;
  if (clinic.address) score += 1;
  if (clinic.borough) score += 1;

  // Contact information (3 points)
  if (clinic.websiteUrl) score += 1;
  if (clinic.email) score += 1;
  if (clinic.phone) score += 1;

  // Regulatory information (2 points)
  if (clinic.cqcRegistered) score += 1;
  if (clinic.saveFaceListed) score += 1;

  // Data source diversity (2 points)
  if (clinic.sources && clinic.sources.length >= 2) score += 1;
  if (clinic.sources && clinic.sources.length >= 3) score += 1;

  return score;
}

/**
 * Filter high-quality clinics
 */
function filterHighQualityClinics(clinics) {
  return clinics.filter(clinic => {
    return isClinicDataComplete(clinic) &&
           hasContactMethod(clinic) &&
           getClinicQualityScore(clinic) >= 6;
  });
}

/**
 * Sanitize text input to prevent XSS
 */
function sanitizeText(text) {
  if (!text) return '';

  return text
    .replace(/[<>]/g, '') // Remove potentially dangerous characters
    .trim()
    .substring(0, 1000); // Limit length
}

/**
 * Validate and sanitize company name
 */
function validateCompanyName(name) {
  if (!name || name.length < 2) {
    return null;
  }

  return sanitizeText(name);
}

module.exports = {
  validateUrl,
  validatePostcode,
  validateEmail,
  validatePhone,
  validateSicCode,
  isClinicDataComplete,
  hasContactMethod,
  getClinicQualityScore,
  filterHighQualityClinics,
  sanitizeText,
  validateCompanyName
};
