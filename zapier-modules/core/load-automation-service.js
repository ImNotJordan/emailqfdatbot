/**
 * Load Automation Service - Main Orchestrator
 * Coordinates all modules for the complete automation workflow
 */

const EmailParser = require('../parsers/email-parser');
const Auth0Client = require('../auth/auth0-client');
const QuoteFactoryAPI = require('../api/quotefactory-api');
const ResponseFormatter = require('../formatters/response-formatter');

class LoadAutomationService {
    constructor(config) {
        this.config = this.validateAndSetDefaults(config);
        this.logger = this.createLogger();
        
        // Initialize modules
        this.emailParser = new EmailParser();
        this.auth0Client = new Auth0Client(this.config.auth0);
        this.quoteFactoryAPI = new QuoteFactoryAPI({
            ...this.config.quoteFactory,
            auth0Client: this.auth0Client,
            logger: this.logger
        });
        this.responseFormatter = new ResponseFormatter(this.config.formatting);
        
        // Metrics tracking
        this.metrics = {
            processedEmails: 0,
            successfulExtractions: 0,
            successfulLookups: 0,
            errors: 0
        };
    }

    /**
     * Main processing method - orchestrates the complete workflow
     */
    async processEmail(emailData) {
        const startTime = Date.now();
        const requestId = this.generateRequestId();
        
        this.logger.log(`[${requestId}] Starting email processing`, {
            subject: emailData.subject,
            hasBody: !!emailData.body,
            timestamp: new Date().toISOString()
        });

        try {
            this.metrics.processedEmails++;

            // Step 1: Parse email for load reference
            const extractionResult = this.emailParser.extractLoadReference(emailData.body);
            
            this.logger.log(`[${requestId}] Extraction result:`, {
                found: extractionResult.found,
                reference: extractionResult.reference,
                confidence: extractionResult.confidence
            });

            let response;

            if (!extractionResult.found) {
                // No reference found - request it from sender
                response = this.responseFormatter.formatResponse('no_reference', {
                    originalSubject: emailData.subject
                });
            } else {
                this.metrics.successfulExtractions++;
                const loadReference = extractionResult.reference;

                // Step 2: Look up load details
                let loadData = null;
                let lookupError = null;

                try {
                    if (this.config.enableQuoteFactoryLookup) {
                        this.logger.log(`[${requestId}] Looking up load: ${loadReference}`);
                        loadData = await this.quoteFactoryAPI.searchLoad(loadReference);
                        
                        if (loadData) {
                            this.metrics.successfulLookups++;
                            this.logger.log(`[${requestId}] Load data retrieved successfully`);
                        } else {
                            this.logger.log(`[${requestId}] Load not found in QuoteFactory`);
                        }
                    }
                } catch (error) {
                    lookupError = error;
                    this.logger.error(`[${requestId}] QuoteFactory lookup failed:`, error.message);
                }

                // Step 3: Format response based on results
                if (loadData) {
                    response = this.responseFormatter.formatResponse('load_found', {
                        loadData,
                        loadReference,
                        originalSubject: emailData.subject
                    });
                } else if (lookupError) {
                    response = this.responseFormatter.formatResponse('error', {
                        originalSubject: emailData.subject,
                        errorType: 'retrieving load details'
                    });
                } else {
                    response = this.responseFormatter.formatResponse('load_pending', {
                        loadReference,
                        originalSubject: emailData.subject
                    });
                }
            }

            const processingTime = Date.now() - startTime;
            
            // Build comprehensive result
            const result = {
                success: true,
                requestId,
                processingTimeMs: processingTime,
                extraction: extractionResult,
                loadData: loadData || null,
                response,
                metrics: this.getMetricsSummary(),
                timestamp: new Date().toISOString()
            };

            this.logger.log(`[${requestId}] Processing completed successfully in ${processingTime}ms`);
            return result;

        } catch (error) {
            this.metrics.errors++;
            const processingTime = Date.now() - startTime;

            this.logger.error(`[${requestId}] Processing failed:`, {
                error: error.message,
                stack: error.stack,
                processingTimeMs: processingTime
            });

            // Return error response that can still be used
            const errorResponse = this.responseFormatter.formatResponse('error', {
                originalSubject: emailData.subject,
                errorType: 'processing your email'
            });

            return {
                success: false,
                requestId,
                processingTimeMs: processingTime,
                error: this.sanitizeError(error),
                response: errorResponse,
                metrics: this.getMetricsSummary(),
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Batch process multiple emails
     */
    async processMultipleEmails(emailsData) {
        const results = [];
        const batchId = this.generateRequestId();
        
        this.logger.log(`[${batchId}] Starting batch processing of ${emailsData.length} emails`);

        for (let i = 0; i < emailsData.length; i++) {
            try {
                const result = await this.processEmail(emailsData[i]);
                result.batchId = batchId;
                result.batchIndex = i;
                results.push(result);
            } catch (error) {
                results.push({
                    success: false,
                    batchId,
                    batchIndex: i,
                    error: this.sanitizeError(error),
                    timestamp: new Date().toISOString()
                });
            }
        }

        this.logger.log(`[${batchId}] Batch processing completed`);
        return {
            batchId,
            totalProcessed: emailsData.length,
            results,
            summary: this.calculateBatchSummary(results)
        };
    }

    /**
     * Health check for all services
     */
    async healthCheck() {
        const checks = {};
        
        try {
            // Check QuoteFactory API
            checks.quoteFactoryAPI = await this.quoteFactoryAPI.healthCheck();
        } catch (error) {
            checks.quoteFactoryAPI = {
                healthy: false,
                message: error.message
            };
        }

        const overallHealth = Object.values(checks).every(check => check.healthy);

        return {
            healthy: overallHealth,
            checks,
            metrics: this.getMetricsSummary(),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Validate and set configuration defaults
     */
    validateAndSetDefaults(config) {
        if (!config) {
            throw new Error('Configuration is required');
        }

        // Validate required Auth0 config
        if (!config.auth0?.domain || !config.auth0?.clientId || !config.auth0?.clientSecret) {
            throw new Error('Auth0 configuration (domain, clientId, clientSecret) is required');
        }

        // Validate QuoteFactory credentials
        if (!config.quoteFactory?.username || !config.quoteFactory?.password) {
            throw new Error('QuoteFactory credentials (username, password) are required');
        }

        return {
            enableQuoteFactoryLookup: config.enableQuoteFactoryLookup !== false,
            auth0: {
                domain: config.auth0.domain,
                clientId: config.auth0.clientId,
                clientSecret: config.auth0.clientSecret,
                audience: config.auth0.audience
            },
            quoteFactory: {
                baseUrl: config.quoteFactory.baseUrl || 'https://api.quotefactory.com',
                username: config.quoteFactory.username,
                password: config.quoteFactory.password
            },
            formatting: {
                companyName: config.formatting?.companyName || 'Your Company',
                ...config.formatting
            },
            logging: {
                level: config.logging?.level || 'info',
                ...config.logging
            }
        };
    }

    /**
     * Create logger with appropriate configuration
     */
    createLogger() {
        const logLevel = this.config.logging.level;
        
        return {
            log: (message, data) => {
                if (logLevel === 'debug' || logLevel === 'info') {
                    console.log(message, data ? JSON.stringify(data, null, 2) : '');
                }
            },
            error: (message, data) => {
                console.error(message, data ? JSON.stringify(data, null, 2) : '');
            },
            debug: (message, data) => {
                if (logLevel === 'debug') {
                    console.debug(message, data ? JSON.stringify(data, null, 2) : '');
                }
            }
        };
    }

    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get metrics summary
     */
    getMetricsSummary() {
        return {
            ...this.metrics,
            successRate: this.metrics.processedEmails > 0 
                ? (this.metrics.successfulExtractions / this.metrics.processedEmails * 100).toFixed(2) + '%'
                : '0%',
            lookupSuccessRate: this.metrics.successfulExtractions > 0
                ? (this.metrics.successfulLookups / this.metrics.successfulExtractions * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * Calculate batch processing summary
     */
    calculateBatchSummary(results) {
        const successful = results.filter(r => r.success).length;
        const failed = results.length - successful;
        const extractionsFound = results.filter(r => r.extraction?.found).length;
        const loadsFound = results.filter(r => r.loadData).length;

        return {
            total: results.length,
            successful,
            failed,
            extractionsFound,
            loadsFound,
            successRate: `${(successful / results.length * 100).toFixed(1)}%`,
            extractionRate: `${(extractionsFound / results.length * 100).toFixed(1)}%`,
            lookupRate: extractionsFound > 0 ? `${(loadsFound / extractionsFound * 100).toFixed(1)}%` : '0%'
        };
    }

    /**
     * Sanitize error for safe logging/returning
     */
    sanitizeError(error) {
        return {
            message: error.message,
            name: error.name,
            // Don't expose stack traces in production
            stack: this.config.logging.level === 'debug' ? error.stack : undefined
        };
    }
}

module.exports = LoadAutomationService;