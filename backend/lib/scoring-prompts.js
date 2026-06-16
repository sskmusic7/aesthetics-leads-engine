// Scoring Prompts for Claude Opus 4.8
// Builds structured prompts for clinic scoring and lead qualification

/**
 * Build scoring prompt for Claude
 */
function buildScoringPrompt(input) {
  return `You are a B2B lead qualification expert for UK aesthetic medical clinics. Score this clinic and determine the best service to pitch.

CLINIC DATA:
${JSON.stringify(input, null, 2)}

SCORING CRITERIA:

ICP Score (0-100): Evaluate how well this fits our ideal customer profile
- 80-100: Clear medical aesthetic focus (Botox, fillers, surgical), active advertising, multiple accreditations
- 60-79: Medical aesthetic focus with some signs of activity
- 40-59: Mixed medical/beauty or unclear focus
- 0-39: Generic beauty salon, nail bar, or non-medical

Composite Score (0-100): ICP score adjusted for opportunity factors
- High signals: Active Facebook ads, recent incorporation (<2 years), CQC registered, Save Face listed
- Medium signals: Website exists but basic, some regulatory presence
- Low signals: No web presence, generic beauty focus, inactive

Pain Points: Identify specific weaknesses we can fix
- Slow website (load time > 3 seconds)
- Generic/stock photo ads vs authentic medical photography
- Thin web presence (no website or basic listing)
- Poor medical authority presentation
- No clear pricing or treatment information

Service to Pitch: Choose ONE based on detected weakness
- "website" - When site is slow, reads like beauty salon vs medical, lacks authority/pricing
- "backlinks" - When web presence is thin, needs local London health/wellness mentions
- "facebook_ads" - When active ads use airbrushed/stock imagery vs authentic medical photos

Personalised Hook: ONE specific sentence referencing their situation
- Reference specific treatments advertised (if any)
- Mention specific weakness detected (slow site, stock photos, etc.)
- Reference their location/borough
- Keep it professional and medical, not salesy

Contact Confidence (0-100): Email validity likelihood
- 90-100: Professional domain (@clinicname.co.uk)
- 70-89: Generic but professional domain (@gmail.com, @outlook.com with clinic name)
- 50-69: Generic email address
- 0-49: No email found

Ad Audit Flag: Set true if ads use obvious stock photos, heavy filters, or airbrushing vs authentic iPhone-quality medical photography

RESPOND WITH JSON ONLY (no markdown, no explanation):
{
  "icp_score": 0-100,
  "composite_score": 0-100,
  "pain_points": ["specific weakness 1", "specific weakness 2"],
  "service_to_pitch": "website | backlinks | facebook_ads",
  "personalised_hook": "one specific sentence about this clinic",
  "contact_confidence": 0-100,
  "ad_audit_flag": true/false
}`;
}

/**
 * Build email drafting prompt for Claude Sonnet 4.6
 */
function buildEmailPrompt(clinic, score) {
  const painPoints = Array.isArray(score.painPoints)
    ? score.painPoints.join(', ')
    : JSON.stringify(score.painPoints);

  return `You are a B2B copywriter specialising in aesthetic medical clinics. Write a cold email for this clinic.

CLINIC:
Name: ${clinic.name}
Location: ${clinic.borough}, ${clinic.postcode}
Website: ${clinic.websiteUrl || 'Not found'}
CQC Registered: ${clinic.cqcRegistered ? 'Yes' : 'No'}
Save Face Listed: ${clinic.saveFaceListed ? 'Yes' : 'No'}

SCORE ANALYSIS:
Pain Points: ${painPoints}
Service to Pitch: ${score.serviceToPitch}
Personalized Hook: ${score.personalisedHook}
Active Facebook Ads: ${clinic.ads?.length > 0 ? 'Yes (' + clinic.ads.length + ' active)' : 'No'}

Write a 150-word cold email that:
1. Opens with the personalized hook (${score.personalisedHook})
2. References their specific pain points (${painPoints})
3. Pitch one service: ${score.serviceToPitch}
4. Include social proof (we work with London aesthetic clinics)
5. Clear CTA: 15-minute discovery call
6. Professional medical tone, not salesy
7. Maximum 3 sentences per paragraph
8. Include email signature

RESPOND WITH THE EMAIL TEXT ONLY (no JSON, no explanation)`;
}

/**
 * Build LinkedIn DM prompt
 */
function buildLinkedInDMPrompt(clinic, score) {
  return `You are a B2B copywriter for aesthetic clinics. Write a LinkedIn DM for this clinic.

CLINIC: ${clinic.name} in ${clinic.borough}
Pain Points: ${Array.isArray(score.painPoints) ? score.painPoints.join(', ') : score.painPoints}
Service: ${score.serviceToPitch}

Write a LinkedIn DM (max 300 characters) that:
1. References their specific situation (${score.personalisedHook})
2. Mentions one pain point
3. Offers to help with ${score.serviceToPitch}
4. Professional and conversational
5. Ends with open question

RESPOND WITH THE DM TEXT ONLY (no JSON, no explanation)`;
}

/**
 * Build ad analysis prompt for visual audit
 */
function buildAdAnalysisPrompt(adData) {
  return `You are an expert in medical aesthetic advertising. Analyze this Facebook ad for an aesthetic clinic.

AD DATA:
${JSON.stringify(adData, null, 2)}

Analyse and respond with JSON only:
{
  "uses_stock_photos": true/false,
  "airbrushed_or_heavily_filtered": true/false,
  "authentic_medical_photography": true/false,
  "professional_quality": true/false,
  "medical_focused": true/false,
  "specific_issues": ["issue 1", "issue 2"],
  "improvement_suggestions": ["suggestion 1", "suggestion 2"]
}

Criteria:
- Stock photos: Generic models, obvious studio backgrounds, non-medical setting
- Airbrushed: Smooth skin filters, unnatural lighting, heavy retouching
- Authentic: Real patients, clinic environment, iPhone-quality, deep depth of field
- Medical focus: Shows actual procedures, medical equipment, professional setting
- Professional: Good lighting, clear branding, consistent style

RESPOND WITH JSON ONLY`;
}

module.exports = {
  buildScoringPrompt,
  buildEmailPrompt,
  buildLinkedInDMPrompt,
  buildAdAnalysisPrompt
};
