/**
 * Zapier Code Step 3: Format Email Response
 * 
 * This code step generates professional email responses based on the load lookup results.
 * 
 * INPUT FIELDS (from previous steps):
 * - scenario: Response scenario (load_found, load_pending, no_reference, error)
 * - load_data: Load details (if found)
 * - load_reference: Load reference number
 * - original_subject: Original email subject
 * - error_message: Error details (if applicable)
 * - request_id: Request ID for tracking
 * 
 * ENVIRONMENT VARIABLES (optional):
 * - COMPANY_NAME: Your company name (default: "Your Company")
 * - COMPANY_SIGNATURE: Custom signature block
 * 
 * OUTPUT FIELDS:
 * - reply_subject: Formatted subject line
 * - reply_body: Complete email body
 * - reply_body_html: HTML version of email body
 * - response_type: Type of response generated
 * - has_load_data: Boolean indicating if load details included
 */

// Response Formatter class (embedded for Zapier)
class ResponseFormatter {
    constructor(config = {}) {
        this.companyName = config.companyName || 'Your Company';
        this.signatureTemplate = config.signatureTemplate || this.getDefaultSignature();
    }

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

    formatLoadFoundResponse(data) {
        const { loadData, originalSubject, loadReference } = data;
        
        const subject = this.formatSubject(originalSubject, loadReference);
        
        let body = `Hello,

Thank you for your inquiry about load ${loadReference}. Here are the complete details:

📦 LOAD INFORMATION:
• Reference: ${loadReference}
• Equipment: ${loadData.equipment}
• Commodity: ${loadData.commodity.description}
• Weight: ${loadData.commodity.weight}`;

        if (loadData.distance) {
            body += `\n• Distance: ${loadData.distance}`;
        }

        if (loadData.commodity.hazmat) {
            body += `\n• ⚠️ HAZMAT: This load contains hazardous materials.`;
        }

        body += `

📍 PICKUP:
• Location: ${loadData.pickup.location}`;

        if (loadData.pickup.date) {
            body += `\n• Date: ${loadData.pickup.date}`;
        }

        if (loadData.pickup.time) {
            body += `\n• Time: ${loadData.pickup.time}`;
        }

        body += `

📍 DELIVERY:
• Location: ${loadData.delivery.location}`;

        if (loadData.delivery.date) {
            body += `\n• Date: ${loadData.delivery.date}`;
        }

        if (loadData.delivery.time) {
            body += `\n• Time: ${loadData.delivery.time}`;
        }

        body += `

💰 RATE: ${loadData.rate.formatted}

🚛 CAPACITY CONFIRMATION:
To confirm availability, please let us know:
1. When and where will you be empty for pickup?
2. Do you have the required equipment type available?
3. Any special requirements or concerns about this load?

We're ready to book this load immediately upon your confirmation.

`;
        
        body += this.signatureTemplate;
        
        return {
            subject,
            body,
            bodyHtml: this.plainTextToHtml(body),
            responseType: 'complete_details',
            hasLoadData: true
        };
    }

    formatLoadPendingResponse(data) {
        const { loadReference, originalSubject } = data;
        
        const subject = this.formatSubject(originalSubject, loadReference);
        
        let body = `Hello,

Thank you for your inquiry regarding load ${loadReference}.

I've located this load in our system and am pulling the complete details now. You'll receive:
• Pickup and delivery locations with dates
• Commodity information and weight
• Our competitive rate
• Any special requirements

This information will be sent within the next few minutes.

🚛 QUICK QUESTION: When and where will you be empty for pickup?

`;
        
        body += this.signatureTemplate;
        
        return {
            subject,
            body,
            bodyHtml: this.plainTextToHtml(body),
            responseType: 'pending_details',
            hasLoadData: false
        };
    }

    formatNoReferenceResponse(data) {
        const { originalSubject } = data;
        
        const subject = `Re: ${originalSubject} - Reference Number Needed`;
        
        let body = `Hello,

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
        
        body += this.signatureTemplate;
        
        return {
            subject,
            body,
            bodyHtml: this.plainTextToHtml(body),
            responseType: 'reference_request',
            hasLoadData: false
        };
    }

    formatErrorResponse(data) {
        const { originalSubject, errorMessage } = data;
        
        const subject = `Re: ${originalSubject}`;
        
        let body = `Hello,

Thank you for your email. We experienced a temporary issue while processing your request.

Our team has been notified and we're working to resolve this quickly. In the meantime, please feel free to:
• Reply with your load reference number
• Call us directly at your convenience
• Send any additional load details you have

We apologize for any inconvenience and look forward to assisting you with this load opportunity.

`;
        
        body += this.signatureTemplate;
        
        return {
            subject,
            body,
            bodyHtml: this.plainTextToHtml(body),
            responseType: 'error_response',
            hasLoadData: false
        };
    }

    formatSubject(originalSubject, loadReference) {
        if (!originalSubject) {
            return loadReference ? `Load ${loadReference} - Quote Details` : 'Load Inquiry Response';
        }

        let subject = originalSubject;
        subject = subject.replace(/^(re:|fwd:|fw:)\s*/gi, '').trim();
        
        if (loadReference && !subject.includes(loadReference)) {
            subject = `${subject} - Load ${loadReference}`;
        }
        
        return `Re: ${subject}`;
    }

    getDefaultSignature() {
        return `Best regards,
${this.companyName}

---
This is an automated response with real-time load data.
For immediate assistance, please reply to this email.`;
    }

    plainTextToHtml(plainText) {
        return plainText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/\n/g, '<br>\n')
            .replace(/^(•|✓|⚠️)/gm, '<strong>$1</strong>')
            .replace(/^(📦|📍|💰|🚛)/gm, '<strong>$1</strong>');
    }
}

// Main Zapier code step function
const startTime = Date.now();
const requestId = inputData.request_id || `format_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

try {
    // Get input data from previous steps
    const scenario = inputData.scenario || 'error';
    const loadData = inputData.load_data;
    const loadReference = inputData.load_reference;
    const originalSubject = inputData.original_subject || '';
    const errorMessage = inputData.error_message;

    console.log(`[${requestId}] Starting response formatting`, {
        scenario,
        hasLoadData: !!loadData,
        loadReference,
        originalSubject
    });

    // Initialize formatter with configuration
    const formatter = new ResponseFormatter({
        companyName: process.env.COMPANY_NAME || 'Your Company',
        signatureTemplate: process.env.COMPANY_SIGNATURE
    });

    // Prepare data for formatting
    const formatData = {
        loadData,
        loadReference,
        originalSubject,
        errorMessage
    };

    // Generate response
    const response = formatter.formatResponse(scenario, formatData);

    const processingTime = Date.now() - startTime;

    console.log(`[${requestId}] Response formatted in ${processingTime}ms`, {
        responseType: response.responseType,
        subjectLength: response.subject.length,
        bodyLength: response.body.length,
        hasLoadData: response.hasLoadData
    });

    // Output for Zapier email sending
    output = {
        reply_subject: response.subject,
        reply_body: response.body,
        reply_body_html: response.bodyHtml,
        response_type: response.responseType,
        has_load_data: response.hasLoadData,
        processing_time_ms: processingTime,
        request_id: requestId,
        timestamp: new Date().toISOString(),
        // Include metadata for tracking
        original_scenario: scenario,
        load_reference: loadReference,
        // Character counts for Zapier limits
        subject_length: response.subject.length,
        body_length: response.body.length,
        html_length: response.bodyHtml.length
    };

} catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error(`[${requestId}] Response formatting failed:`, {
        error: error.message,
        processingTimeMs: processingTime
    });

    // Generate fallback response
    const fallbackSubject = inputData.original_subject ? 
        `Re: ${inputData.original_subject}` : 
        'Load Inquiry Response';
    
    const fallbackBody = `Hello,

Thank you for your email. We are processing your inquiry and will respond with details shortly.

Best regards,
${process.env.COMPANY_NAME || 'Your Company'}

---
Automated response system`;

    output = {
        reply_subject: fallbackSubject,
        reply_body: fallbackBody,
        reply_body_html: fallbackBody.replace(/\n/g, '<br>\n'),
        response_type: 'fallback',
        has_load_data: false,
        processing_time_ms: processingTime,
        request_id: requestId,
        timestamp: new Date().toISOString(),
        error: error.message,
        original_scenario: inputData.scenario || 'unknown',
        load_reference: inputData.load_reference,
        subject_length: fallbackSubject.length,
        body_length: fallbackBody.length,
        html_length: fallbackBody.replace(/\n/g, '<br>\n').length
    };
}