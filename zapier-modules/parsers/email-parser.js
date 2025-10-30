/**
 * Email Parser Module
 * Extracts load reference numbers from email content with validation
 */

class EmailParser {
    constructor() {
        // Patterns to exclude (false positives)
        this.exclusionPatterns = [
            /MC\s*\d+/i,
            /DOT\s*\d+/i,
            /USDOT\s*\d+/i,
            /invoice\s*#?\s*\d+/i,
            /bill\s*#?\s*\d+/i,
            /po\s*#?\s*\d+/i,
            /phone:?\s*\d+/i,
            /tel:?\s*\d+/i,
            /fax:?\s*\d+/i
        ];

        // Patterns to match load references
        this.loadPatterns = [
            // Explicit load references
            /(?:load\s*(?:ref|reference|number|id|#)[:\-\s]*)([A-Z0-9\-\_]+)/i,
            /(?:quote\s*(?:ref|reference|number|id|#)[:\-\s]*)([A-Z0-9\-\_]+)/i,
            /(?:order\s*#?\s*)(\d{6,8})/i,
            /(?:reference\s+number\s+)(\d{6,8})/i,
            /(?:ref[:\s]+)(\d{6,8})/i,
            
            // QuoteFactory specific patterns
            /(?:QF[-\s]?)(\d{6,8})/i,
            /(?:QUOTE[-\s]?)(\d{6,8})/i,
            
            // Alphanumeric patterns (company prefix + numbers)
            /([A-Z]{2,4}[\-\_\s]*\d{4,8}[\-\_\s]*[A-Z0-9]*)/,
            /([A-HJ-Z]+\d{4,8}[A-Z0-9]*)/,
            
            // Standalone numbers (last resort)
            /\b(\d{6})\b/
        ];

        // Validation rules
        this.validationRules = {
            minLength: 4,
            maxLength: 20,
            mustContainNumbers: true,
            bannedPrefixes: ['MC', 'DOT', 'PO', 'INV']
        };
    }

    /**
     * Extract load reference from email content
     * @param {string} emailContent - The email body content
     * @returns {Object} - Extraction result with reference and confidence
     */
    extractLoadReference(emailContent) {
        if (!emailContent || typeof emailContent !== 'string') {
            return {
                found: false,
                reference: null,
                confidence: 0,
                message: 'No email content provided'
            };
        }

        // Sanitize input
        let sanitizedContent = this.sanitizeContent(emailContent);

        // Remove exclusion patterns
        sanitizedContent = this.removeExclusions(sanitizedContent);

        // Try each pattern in order of specificity
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

    /**
     * Sanitize email content for safe processing
     */
    sanitizeContent(content) {
        return content
            .replace(/<[^>]*>/g, ' ') // Remove HTML tags
            .replace(/\s+/g, ' ') // Normalize whitespace
            .substring(0, 5000); // Limit length for performance
    }

    /**
     * Remove exclusion patterns from content
     */
    removeExclusions(content) {
        let processed = content;
        for (const pattern of this.exclusionPatterns) {
            processed = processed.replace(pattern, '');
        }
        return processed;
    }

    /**
     * Normalize extracted reference
     */
    normalizeReference(reference) {
        return reference
            .trim()
            .toUpperCase()
            .replace(/[^\w\-]/g, ''); // Keep only alphanumeric and hyphens
    }

    /**
     * Validate extracted reference
     */
    validateReference(reference) {
        const errors = [];

        // Length check
        if (reference.length < this.validationRules.minLength) {
            errors.push('Reference too short');
        }
        if (reference.length > this.validationRules.maxLength) {
            errors.push('Reference too long');
        }

        // Must contain numbers
        if (this.validationRules.mustContainNumbers && !/\d/.test(reference)) {
            errors.push('Reference must contain numbers');
        }

        // Check banned prefixes
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

    /**
     * Calculate confidence score for extraction
     */
    calculateConfidence(patternIndex, matchedText, originalContent) {
        let confidence = 100 - (patternIndex * 10); // Earlier patterns = higher confidence

        // Boost confidence for explicit mentions
        if (matchedText.toLowerCase().includes('load') || 
            matchedText.toLowerCase().includes('quote') ||
            matchedText.toLowerCase().includes('reference')) {
            confidence = Math.min(100, confidence + 20);
        }

        // Reduce confidence for standalone numbers
        if (patternIndex >= this.loadPatterns.length - 2) {
            confidence = Math.max(50, confidence - 30);
        }

        return confidence;
    }

    /**
     * Extract multiple load references (for batch processing)
     */
    extractMultipleReferences(emailContent, maxReferences = 5) {
        const references = [];
        let content = this.sanitizeContent(emailContent);
        content = this.removeExclusions(content);

        const foundReferences = new Set();

        for (const pattern of this.loadPatterns) {
            const matches = content.matchAll(new RegExp(pattern, 'gi'));
            
            for (const match of matches) {
                if (match[1] && references.length < maxReferences) {
                    const candidate = this.normalizeReference(match[1]);
                    
                    if (!foundReferences.has(candidate)) {
                        const validation = this.validateReference(candidate);
                        
                        if (validation.isValid) {
                            foundReferences.add(candidate);
                            references.push({
                                reference: candidate,
                                confidence: this.calculateConfidence(
                                    this.loadPatterns.indexOf(pattern),
                                    match[0],
                                    emailContent
                                )
                            });
                        }
                    }
                }
            }
        }

        return references.sort((a, b) => b.confidence - a.confidence);
    }
}

module.exports = EmailParser;