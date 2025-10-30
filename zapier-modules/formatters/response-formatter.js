/**
 * Response Formatter Module
 * Generates professional email responses based on load data
 */

class ResponseFormatter {
    constructor(config = {}) {
        this.companyName = config.companyName || 'Balto Booking';
        this.responseTemplates = {
            loadFound: config.loadFoundTemplate || this.getDefaultLoadFoundTemplate(),
            loadPending: config.loadPendingTemplate || this.getDefaultLoadPendingTemplate(),
            noReference: config.noReferenceTemplate || this.getDefaultNoReferenceTemplate(),
            error: config.errorTemplate || this.getDefaultErrorTemplate()
        };
        this.signatureTemplate = config.signatureTemplate || this.getDefaultSignature();
    }

    /**
     * Format response based on scenario
     */
    formatResponse(scenario, data = {}) {
        const formatters = {
            'load_found': () => this.formatLoadFoundResponse(data),
            'load_pending': () => this.formatLoadPendingResponse(data),
            'no_reference': () => this.formatNoReferenceResponse(data),
            'error': () => this.formatErrorResponse(data)
        };

        const formatter = formatters[scenario];
        if (!formatter) {
            throw new Error(`Unknown scenario: ${scenario}`);
        }

        return formatter();
    }

    /**
     * Format response when load details are found
     */
    formatLoadFoundResponse(data) {
        const { loadData, originalSubject, loadReference } = data;
        
        const subject = this.formatSubject(originalSubject, loadReference);
        
        let body = this.responseTemplates.loadFound;
        
        // Replace placeholders
        body = body.replace('{{LOAD_REFERENCE}}', loadReference);
        body = body.replace('{{PICKUP_LOCATION}}', loadData.pickup.location);
        body = body.replace('{{PICKUP_DATE}}', loadData.pickup.date || 'TBD');
        body = body.replace('{{DELIVERY_LOCATION}}', loadData.delivery.location);
        body = body.replace('{{DELIVERY_DATE}}', loadData.delivery.date || 'TBD');
        body = body.replace('{{COMMODITY}}', loadData.commodity.description);
        body = body.replace('{{WEIGHT}}', loadData.commodity.weight);
        body = body.replace('{{EQUIPMENT}}', loadData.equipment);
        body = body.replace('{{RATE}}', loadData.rate.formatted);
        body = body.replace('{{DISTANCE}}', loadData.distance || 'TBD');
        
        // Add any special notes
        if (loadData.commodity.hazmat) {
            body = body.replace('{{SPECIAL_NOTES}}', '\n⚠️ HAZMAT: This load contains hazardous materials.');
        } else {
            body = body.replace('{{SPECIAL_NOTES}}', '');
        }
        
        body += this.signatureTemplate;
        
        return {
            subject,
            body,
            metadata: {
                scenario: 'load_found',
                loadReference,
                hasCompleteData: this.isCompleteData(loadData)
            }
        };
    }

    /**
     * Format response when load reference found but details pending
     */
    formatLoadPendingResponse(data) {
        const { loadReference, originalSubject } = data;
        
        const subject = this.formatSubject(originalSubject, loadReference);
        
        let body = this.responseTemplates.loadPending;
        body = body.replace('{{LOAD_REFERENCE}}', loadReference);
        body += this.signatureTemplate;
        
        return {
            subject,
            body,
            metadata: {
                scenario: 'load_pending',
                loadReference
            }
        };
    }

    /**
     * Format response when no load reference is found
     */
    formatNoReferenceResponse(data) {
        const { originalSubject } = data;
        
        const subject = `Re: ${originalSubject} - Reference Number Needed`;
        
        let body = this.responseTemplates.noReference;
        body += this.signatureTemplate;
        
        return {
            subject,
            body,
            metadata: {
                scenario: 'no_reference'
            }
        };
    }

    /**
     * Format error response
     */
    formatErrorResponse(data) {
        const { originalSubject, errorType } = data;
        
        const subject = `Re: ${originalSubject}`;
        
        let body = this.responseTemplates.error;
        body = body.replace('{{ERROR_TYPE}}', errorType || 'processing your request');
        body += this.signatureTemplate;
        
        return {
            subject,
            body,
            metadata: {
                scenario: 'error',
                errorType
            }
        };
    }

    /**
     * Format email subject line
     */
    formatSubject(originalSubject, loadReference) {
        if (!originalSubject) {
            return loadReference ? `Load ${loadReference} - Quote Details` : 'Load Inquiry Response';
        }

        // Clean up subject
        let subject = originalSubject;
        subject = subject.replace(/^(re:|fwd:|fw:)\s*/gi, '').trim();
        
        // Add load reference if not already present
        if (loadReference && !subject.includes(loadReference)) {
            subject = `${subject} - Load ${loadReference}`;
        }
        
        return `Re: ${subject}`;
    }

    /**
     * Check if load data is complete
     */
    isCompleteData(loadData) {
        const requiredFields = [
            loadData.pickup?.location,
            loadData.delivery?.location,
            loadData.commodity?.weight,
            loadData.rate?.amount
        ];
        
        return requiredFields.every(field => field && field !== 'TBD');
    }

    /**
     * Default templates
     */
    getDefaultLoadFoundTemplate() {
        return `Hello,

Thank you for your inquiry about load {{LOAD_REFERENCE}}. Here are the complete details:

📦 LOAD INFORMATION:
• Reference: {{LOAD_REFERENCE}}
• Equipment: {{EQUIPMENT}}
• Commodity: {{COMMODITY}}
• Weight: {{WEIGHT}}
• Distance: {{DISTANCE}}{{SPECIAL_NOTES}}

📍 PICKUP:
• Location: {{PICKUP_LOCATION}}
• Date: {{PICKUP_DATE}}

📍 DELIVERY:
• Location: {{DELIVERY_LOCATION}}
• Date: {{DELIVERY_DATE}}

💰 RATE: {{RATE}}

🚛 CAPACITY CONFIRMATION:
To confirm availability, please let us know:
1. When and where will you be empty for pickup?
2. Do you have the required equipment type available?
3. Any special requirements or concerns about this load?

We're ready to book this load immediately upon your confirmation.

`;
    }

    getDefaultLoadPendingTemplate() {
        return `Hello,

Thank you for your inquiry regarding load {{LOAD_REFERENCE}}.

I've located this load in our system and am pulling the complete details now. You'll receive:
• Pickup and delivery locations with dates
• Commodity information and weight
• Our competitive rate
• Any special requirements

This information will be sent within the next few minutes.

🚛 QUICK QUESTION: When and where will you be empty for pickup?

`;
    }

    getDefaultNoReferenceTemplate() {
        return `Hello,

Thank you for reaching out about this load opportunity.

To provide you with accurate pricing and availability, could you please provide one of the following:
• DAT load reference number
• QuoteFactory load ID
• Your internal load/order number

This will help us:
✓ Pull exact load details from our system
✓ Provide competitive and accurate pricing
✓ Confirm equipment availability
✓ Respond faster with a complete quote

Once you provide the reference number, we'll get back to you immediately with our availability and rate.

`;
    }

    getDefaultErrorTemplate() {
        return `Hello,

Thank you for your email. We experienced a temporary issue while {{ERROR_TYPE}}.

Our team has been notified and we're working to resolve this quickly. In the meantime, please feel free to:
• Reply with your load reference number
• Call us directly at your convenience
• Send any additional load details you have

We apologize for any inconvenience and look forward to assisting you with this load opportunity.

`;
    }

    getDefaultSignature() {
        return `Best regards,
${this.companyName}

---
This is an automated response with real-time load data.
For immediate assistance, please reply to this email.`;
    }

    /**
     * Generate plain text version from HTML
     */
    htmlToPlainText(html) {
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
    }
}

module.exports = ResponseFormatter;