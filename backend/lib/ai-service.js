// AI Service with Anthropic/Gemini Fallback
// Tries Anthropic first, falls back to Gemini if it fails

const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
  constructor() {
    // Initialize Anthropic
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // Initialize Gemini
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.geminiModel = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Configuration
    this.primaryProvider = process.env.AI_PRIMARY_PROVIDER || 'anthropic';
    this.timeout = parseInt(process.env.AI_TIMEOUT_MS || '30000');
  }

  /**
   * Generate clinic score with fallback
   */
  async scoreClinic(clinicData) {
    const prompt = this.buildScoringPrompt(clinicData);

    try {
      // Try primary provider first
      if (this.primaryProvider === 'anthropic') {
        return await this.scoreWithAnthropic(prompt);
      } else {
        return await this.scoreWithGemini(prompt);
      }
    } catch (error) {
      console.error(`Primary AI provider failed: ${error.message}`);

      // Fallback to secondary provider
      if (this.primaryProvider === 'anthropic') {
        console.log('Falling back to Gemini...');
        return await this.scoreWithGemini(prompt);
      } else {
        console.log('Falling back to Anthropic...');
        return await this.scoreWithAnthropic(prompt);
      }
    }
  }

  /**
   * Score with Anthropic (Claude)
   */
  async scoreWithAnthropic(prompt) {
    const response = await this.anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });

    const content = response.content[0].text;
    return this.parseScoreResponse(content, 'anthropic');
  }

  /**
   * Score with Gemini
   */
  async scoreWithGemini(prompt) {
    const response = await this.geminiModel.generateContent({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1000,
        responseFormat: 'JSON_OBJECT'
      }
    });

    const content = response.response.text();
    return this.parseScoreResponse(content, 'gemini');
  }

  /**
   * Generate outreach email with fallback
   */
  async generateEmail(clinicData, scoreData) {
    const prompt = this.buildEmailPrompt(clinicData, scoreData);

    try {
      if (this.primaryProvider === 'anthropic') {
        return await this.emailWithAnthropic(prompt);
      } else {
        return await this.emailWithGemini(prompt);
      }
    } catch (error) {
      console.error(`Primary AI provider failed for email: ${error.message}`);

      if (this.primaryProvider === 'anthropic') {
        console.log('Falling back to Gemini for email...');
        return await this.emailWithGemini(prompt);
      } else {
        console.log('Falling back to Anthropic for email...');
        return await this.emailWithAnthropic(prompt);
      }
    }
  }

  /**
   * Generate email with Anthropic
   */
  async emailWithAnthropic(prompt) {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });

    return {
      subject: this.extractEmailSubject(response.content[0].text),
      body: this.extractEmailBody(response.content[0].text),
      provider: 'anthropic'
    };
  }

  /**
   * Generate email with Gemini
   */
  async emailWithGemini(prompt) {
    const response = await this.geminiModel.generateContent({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500
      }
    });

    const content = response.response.text();
    return {
      subject: this.extractEmailSubject(content),
      body: this.extractEmailBody(content),
      provider: 'gemini'
    };
  }

  /**
   * Parse score response from either provider
   */
  parseScoreResponse(content, provider) {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const scoreData = JSON.parse(jsonMatch[0]);

      // Validate required fields
      return {
        icp_score: this.ensureRange(scoreData.icp_score || scoreData.icpScore, 0, 100),
        composite_score: this.ensureRange(scoreData.composite_score || scoreData.compositeScore, 0, 100),
        pain_points: scoreData.pain_points || scoreData.painPoints || [],
        service_to_pitch: scoreData.service_to_pitch || scoreData.serviceToPitch || 'website',
        personalised_hook: scoreData.personalised_hook || scoreData.personalisedHook || '',
        contact_confidence: this.ensureRange(scoreData.contact_confidence || scoreData.contactConfidence, 0, 100),
        ad_audit_flag: scoreData.ad_audit_flag || scoreData.adAuditFlag || false,
        provider: provider,
        model_version: provider === 'anthropic' ? 'claude-opus-4-8' : 'gemini-1.5-flash'
      };
    } catch (error) {
      console.error(`Failed to parse ${provider} response: ${error.message}`);

      // Return default score
      return {
        icp_score: 50,
        composite_score: 50,
        pain_points: ['Unable to analyze'],
        service_to_pitch: 'website',
        personalised_hook: 'We help aesthetic clinics grow their online presence.',
        contact_confidence: 30,
        ad_audit_flag: false,
        provider: provider,
        model_version: provider === 'anthropic' ? 'claude-opus-4-8' : 'gemini-1.5-flash',
        error: true
      };
    }
  }

  /**
   * Ensure value is within range
   */
  ensureRange(value, min, max) {
    const num = parseInt(value) || 50;
    return Math.max(min, Math.min(max, num));
  }

  /**
   * Extract email subject from response
   */
  extractEmailSubject(content) {
    const subjectMatch = content.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
    return subjectMatch ? subjectMatch[1].trim() : 'Growing Your Aesthetic Clinic';
  }

  /**
   * Extract email body from response
   */
  extractEmailBody(content) {
    // Remove subject line and return body
    return content.replace(/SUBJECT:\s*.+?\n/i, '').trim();
  }

  /**
   * Build scoring prompt
   */
  buildScoringPrompt(clinicData) {
    return `You are a B2B lead qualification expert for aesthetic clinics. Score this clinic and determine the best service to pitch.

CLINIC DATA:
${JSON.stringify(clinicData, null, 2)}

SCORING CRITERIA:
1. ICP Score (0-100): How well they fit our ideal customer profile
   - High score: Established clinic, multiple practitioners, good location, active marketing
   - Low score: New clinic, single practitioner, poor location, no online presence

2. Pain Points: Identify their main challenges (website, SEO, ads, branding, etc.)

3. Service to Pitch: Choose one - "website", "backlink", "facebook_ads", "branding", "full_service"

4. Personalized Hook: Unique insight about their specific situation

5. Contact Confidence (0-100): How confident are we that we can reach them

6. Ad Audit Flag: Set to true if they're running Facebook ads (needs creative audit)

Return ONLY JSON in this exact format:
{
  "icp_score": 75,
  "composite_score": 80,
  "pain_points": ["outdated website", "no SEO", "poor ad performance"],
  "service_to_pitch": "website",
  "personalalised_hook": "I noticed your clinic was established in 2019 and has great reviews but your website doesn't reflect that quality...",
  "contact_confidence": 85,
  "ad_audit_flag": true
}`;
  }

  /**
   * Build email prompt
   */
  buildEmailPrompt(clinicData, scoreData) {
    return `Generate a personalized cold email for this aesthetic clinic.

CLINIC DATA:
${JSON.stringify(clinicData, null, 2)}

SCORE INSIGHTS:
${JSON.stringify(scoreData, null, 2)}

SERVICE TO PITCH: ${scoreData.service_to_pitch}

Generate a personalized cold email that:
1. References their specific situation (use the personalised_hook)
2. Mentions relevant pain points
3. Proposes the appropriate service
4. Has a clear call-to-action
5. Is professional but conversational
6. Under 150 words

Start with "SUBJECT:" followed by the subject line, then the email body.

Example format:
SUBJECT: Quick question about [clinic_name]'s website

Hi [name],

I noticed [personalized_hook]...

[Body of email]

Best,
Your name`;
  }
}

module.exports = new AIService();
