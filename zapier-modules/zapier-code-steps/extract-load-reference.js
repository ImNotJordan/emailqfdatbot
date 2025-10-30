/**
 * Zapier Code Step 1: Extract Load Reference
 * 
 * This code step extracts load reference numbers from incoming emails.
 * 
 * INPUT FIELDS:
 * - email_subject: Email subject line
 * - email_body: Email body content (plain text or HTML)
 * - email_from: Sender email address (optional, for logging)
 * 
 * OUTPUT FIELDS:
 * - load_reference: Extracted load reference (null if not found)
 * - confidence: Confidence score (0-100)
 * - found: Boolean indicating if reference was found
 * - message: Human-readable result message
 * - processing_time_ms: Time taken to process
 * - request_id: Unique identifier for this request
 */

// EmailParser class (embedded for Zapier)
class EmailParser {
    constructor() {
        this.exclusionPatterns = [
            /MC\s*\d+/i, /DOT\s*\d+/i, /USDOT\s*\d+/i,
            /invoice\s*#?\s*\d+/i, /bill\s*#?\s*\d+/i, /po\s*#?\s*\d+/i,
            /phone:?\s*\d+/i, /tel:?\s*\d+/i, /fax:?\s*\d+/i
        ];

        this.loadPatterns = [
            /(?:load\s*(?:ref|reference|number|id|#)[:\-\s]*)([A-Z0-9\-\_]+)/i,
            /(?:quote\s*(?:ref|reference|number|id|#)[:\-\s]*)([A-Z0-9\-\_]+)/i,
            /(?:order\s*#?\s*)(\d{6,8})/i,
            /(?:reference\s+number\s+)(\d{6,8})/i,
            /(?:ref[:\s]+)(\d{6,8})/i,
            /(?:QF[-\s]?)(\d{6,8})/i,
            /(?:QUOTE[-\s]?)(\d{6,8})/i,
            /([A-Z]{2,4}[\-\_\s]*\d{4,8}[\-\_\s]*[A-Z0-9]*)/,
            /([A-HJ-Z]+\d{4,8}[A-Z0-9]*)/,
            /\b(\d{6})\b/
        ];

        this.validationRules = {
            minLength: 4,
            maxLength: 20,
            mustContainNumbers: true,
            bannedPrefixes: ['MC', 'DOT', 'PO', 'INV']
        };
    }

    extractLoadReference(emailContent) {
        if (!emailContent || typeof emailContent !== 'string') {
            return {
                found: false,
                reference: null,
                confidence: 0,
                message: 'No email content provided'
            };
        }

        let sanitizedContent = this.sanitizeContent(emailContent);
        sanitizedContent = this.removeExclusions(sanitizedContent);

        for (let i = 0; i < this.loadPatterns.length; i++) {
            const pattern = this.loadPatterns[i];
            const matches = sanitizedContent.matchAll(new RegExp(pattern, 'gi'));
            
            for (const match of matches) {
                if (match[1]) {
                    const candidate = this.normalizeReference(match[1]);
                    const validation = this.validateReference(candidate);
                    
                    if (validation.isValid) {
                        return {
                            found: true,
                            reference: candidate,
                            confidence: this.calculateConfidence(i, match[0], emailContent),
                            matchedPattern: pattern.toString(),
                            message: 'Load reference successfully extracted'
                        };
                    }
                }
            }
        }

        return {
            found: false,
            reference: null,
            confidence: 0,
            message: 'No valid load reference found in email'
        };
    }

    sanitizeContent(content) {
        return content
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .substring(0, 5000);
    }

    removeExclusions(content) {
        let processed = content;
        for (const pattern of this.exclusionPatterns) {
            processed = processed.replace(pattern, '');
        }
        return processed;
    }

    normalizeReference(reference) {
        return reference
            .trim()
            .toUpperCase()
            .replace(/[^\w\-]/g, '');
    }

    validateReference(reference) {
        const errors = [];

        if (reference.length < this.validationRules.minLength) {
            errors.push('Reference too short');
        }
        if (reference.length > this.validationRules.maxLength) {
            errors.push('Reference too long');
        }
        if (this.validationRules.mustContainNumbers && !/\d/.test(reference)) {
            errors.push('Reference must contain numbers');
        }
        for (const prefix of this.validationRules.bannedPrefixes) {
            if (reference.startsWith(prefix)) {
                errors.push(`Invalid prefix: ${prefix}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    calculateConfidence(patternIndex, matchedText, originalContent) {
        let confidence = 100 - (patternIndex * 10);

        if (matchedText.toLowerCase().includes('load') || 
            matchedText.toLowerCase().includes('quote') ||
            matchedText.toLowerCase().includes('reference')) {
            confidence = Math.min(100, confidence + 20);
        }

        if (patternIndex >= this.loadPatterns.length - 2) {
            confidence = Math.max(50, confidence - 30);
        }

        return confidence;
    }
}

// Main Zapier code step function
const startTime = Date.now();
const requestId = `extract_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

try {
    // Get input data from Zapier
    const emailSubject = inputData.email_subject || '';
    const emailBody = inputData.email_body || '';
    const emailFrom = inputData.email_from || '';

    // Log processing start
    console.log(`[${requestId}] Starting load reference extraction`, {
        hasSubject: !!emailSubject,
        hasBody: !!emailBody,
        bodyLength: emailBody.length,
        from: emailFrom
    });

    // Combine subject and body for analysis
    const combinedContent = `${emailSubject}\n\n${emailBody}`;

    // Initialize parser and extract reference
    const parser = new EmailParser();
    const extractionResult = parser.extractLoadReference(combinedContent);

    const processingTime = Date.now() - startTime;

    // Log results
    console.log(`[${requestId}] Extraction completed in ${processingTime}ms`, {
        found: extractionResult.found,
        reference: extractionResult.reference,
        confidence: extractionResult.confidence,
        message: extractionResult.message
    });

    // Output for next Zapier step
    output = {
        load_reference: extractionResult.reference,
        confidence: extractionResult.confidence,
        found: extractionResult.found,
        message: extractionResult.message,
        matched_pattern: extractionResult.matchedPattern || null,
        processing_time_ms: processingTime,
        request_id: requestId,
        timestamp: new Date().toISOString(),
        // Include original data for next steps
        original_subject: emailSubject,
        original_body: emailBody,
        original_from: emailFrom
    };

} catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error(`[${requestId}] Extraction failed:`, {
        error: error.message,
        processingTimeMs: processingTime
    });

    // Output error state
    output = {
        load_reference: null,
        confidence: 0,
        found: false,
        message: `Extraction failed: ${error.message}`,
        matched_pattern: null,
        processing_time_ms: processingTime,
        request_id: requestId,
        timestamp: new Date().toISOString(),
        error: error.message,
        // Include original data for next steps
        original_subject: inputData.email_subject || '',
        original_body: inputData.email_body || '',
        original_from: inputData.email_from || ''
    };
}