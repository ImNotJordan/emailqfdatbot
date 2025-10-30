/**
 * Zapier Code Step 2: Lookup Load Details
 * 
 * This code step authenticates with QuoteFactory via Auth0 and retrieves load details.
 * Uses HTTP requests instead of browser automation for Zapier compatibility.
 * 
 * INPUT FIELDS (from previous step):
 * - load_reference: The extracted load reference
 * - found: Boolean indicating if reference was found
 * - request_id: Request ID from previous step
 * - original_subject: Original email subject
 * - original_body: Original email body
 * 
 * ENVIRONMENT VARIABLES (set in Zapier):
 * - AUTH0_DOMAIN: Your Auth0 domain
 * - AUTH0_CLIENT_ID: Auth0 application client ID
 * - AUTH0_CLIENT_SECRET: Auth0 application client secret
 * - AUTH0_AUDIENCE: Auth0 API audience (optional)
 * - QUOTEFACTORY_USERNAME: QuoteFactory login username
 * - QUOTEFACTORY_PASSWORD: QuoteFactory login password
 * - QUOTEFACTORY_API_BASE: QuoteFactory API base URL (optional)
 * 
 * OUTPUT FIELDS:
 * - load_data: Complete load information (null if not found)
 * - lookup_success: Boolean indicating successful lookup
 * - lookup_attempted: Boolean indicating if lookup was attempted
 * - error_message: Error details if lookup failed
 * - processing_time_ms: Time taken to process
 * - scenario: Response scenario (load_found, load_pending, no_reference, error)
 */

// Auth0 Client class (embedded for Zapier)
class Auth0Client {
    constructor(config) {
        this.domain = config.auth0Domain;
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.audience = config.audience || `https://${config.auth0Domain}/api/v2/`;
    }

    async getUserToken(username, password) {
        const tokenUrl = `https://${this.domain}/oauth/token`;
        
        const payload = {
            grant_type: 'password',
            username: username,
            password: password,
            client_id: this.clientId,
            client_secret: this.clientSecret,
            audience: this.audience,
            scope: 'openid profile email'
        };

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Auth0 authentication failed: ${response.status} - ${error}`);
        }

        const data = await response.json();
        return {
            accessToken: data.access_token,
            idToken: data.id_token,
            expiresIn: data.expires_in
        };
    }
}

// QuoteFactory API Client class (embedded for Zapier)
class QuoteFactoryAPI {
    constructor(config) {
        this.baseUrl = config.baseUrl || 'https://api.quotefactory.com';
        this.auth0Client = config.auth0Client;
        this.username = config.username;
        this.password = config.password;
    }

    async searchLoad(loadReference) {
        // Get authentication token
        const authResult = await this.auth0Client.getUserToken(
            this.username,
            this.password
        );

        // Search for load
        const searchUrl = `${this.baseUrl}/api/v1/loads/search`;
        
        const response = await fetch(searchUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authResult.accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                query: loadReference,
                searchType: 'reference',
                includeDetails: true
            })
        });

        if (!response.ok) {
            throw new Error(`Load search failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            return this.transformLoadData(data.results[0]);
        }

        return null;
    }

    transformLoadData(apiData) {
        if (!apiData) return null;

        return {
            loadReference: apiData.referenceNumber || apiData.id,
            status: apiData.status || 'UNKNOWN',
            pickup: {
                location: this.formatLocation(apiData.pickupLocation),
                date: apiData.pickupDate,
                time: apiData.pickupTime,
                contact: apiData.pickupContact
            },
            delivery: {
                location: this.formatLocation(apiData.deliveryLocation),
                date: apiData.deliveryDate,
                time: apiData.deliveryTime,
                contact: apiData.deliveryContact
            },
            commodity: {
                description: apiData.commodity || 'General Freight',
                weight: this.formatWeight(apiData.weight),
                pieces: apiData.pieces,
                pallets: apiData.pallets,
                hazmat: apiData.hazmat || false
            },
            rate: {
                amount: apiData.rate || apiData.customerRate,
                currency: 'USD',
                formatted: this.formatCurrency(apiData.rate || apiData.customerRate)
            },
            equipment: apiData.equipmentType || 'Dry Van',
            distance: apiData.distance,
            notes: apiData.notes || '',
            createdAt: apiData.createdAt,
            updatedAt: apiData.updatedAt
        };
    }

    formatLocation(location) {
        if (!location) return 'TBD';
        if (typeof location === 'string') return location;

        const parts = [
            location.city,
            location.state || location.province,
            location.postalCode
        ].filter(Boolean);

        return parts.join(', ') || 'TBD';
    }

    formatWeight(weight) {
        if (!weight) return 'TBD';
        if (typeof weight === 'number') {
            return `${weight.toLocaleString()} lbs`;
        }
        return weight.toString();
    }

    formatCurrency(amount) {
        if (!amount) return 'TBD';
        if (typeof amount === 'number') {
            return `$${amount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;
        }
        return amount.toString();
    }
}

// Main Zapier code step function
const startTime = Date.now();
const requestId = inputData.request_id || `lookup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

try {
    // Get input data from previous step
    const loadReference = inputData.load_reference;
    const referenceFound = inputData.found;
    const originalSubject = inputData.original_subject || '';
    const originalBody = inputData.original_body || '';

    console.log(`[${requestId}] Starting load lookup`, {
        loadReference,
        referenceFound,
        hasCredentials: !!(
            process.env.AUTH0_DOMAIN && 
            process.env.AUTH0_CLIENT_ID && 
            process.env.QUOTEFACTORY_USERNAME
        )
    });

    let loadData = null;
    let lookupAttempted = false;
    let lookupSuccess = false;
    let errorMessage = null;
    let scenario = 'no_reference';

    // Only attempt lookup if we have a reference and credentials
    if (referenceFound && loadReference) {
        // Check for required environment variables
        const requiredEnvVars = [
            'AUTH0_DOMAIN',
            'AUTH0_CLIENT_ID', 
            'AUTH0_CLIENT_SECRET',
            'QUOTEFACTORY_USERNAME',
            'QUOTEFACTORY_PASSWORD'
        ];

        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            errorMessage = `Missing required environment variables: ${missingVars.join(', ')}`;
            scenario = 'error';
            console.error(`[${requestId}] Configuration error:`, errorMessage);
        } else {
            lookupAttempted = true;
            
            try {
                // Initialize Auth0 client
                const auth0Client = new Auth0Client({
                    auth0Domain: process.env.AUTH0_DOMAIN,
                    clientId: process.env.AUTH0_CLIENT_ID,
                    clientSecret: process.env.AUTH0_CLIENT_SECRET,
                    audience: process.env.AUTH0_AUDIENCE
                });

                // Initialize QuoteFactory API client
                const quoteFactoryApi = new QuoteFactoryAPI({
                    baseUrl: process.env.QUOTEFACTORY_API_BASE,
                    auth0Client: auth0Client,
                    username: process.env.QUOTEFACTORY_USERNAME,
                    password: process.env.QUOTEFACTORY_PASSWORD
                });

                // Perform load lookup
                console.log(`[${requestId}] Searching for load: ${loadReference}`);
                loadData = await quoteFactoryApi.searchLoad(loadReference);

                if (loadData) {
                    lookupSuccess = true;
                    scenario = 'load_found';
                    console.log(`[${requestId}] Load data retrieved successfully`);
                } else {
                    scenario = 'load_pending';
                    console.log(`[${requestId}] Load reference found but no details available`);
                }

            } catch (error) {
                errorMessage = error.message;
                scenario = 'error';
                console.error(`[${requestId}] Lookup failed:`, error.message);
            }
        }
    } else if (referenceFound && loadReference) {
        // Reference found but no credentials configured
        scenario = 'load_pending';
        console.log(`[${requestId}] Reference found but lookup not configured`);
    } else {
        // No reference found
        scenario = 'no_reference';
        console.log(`[${requestId}] No load reference to lookup`);
    }

    const processingTime = Date.now() - startTime;

    console.log(`[${requestId}] Lookup completed in ${processingTime}ms`, {
        scenario,
        lookupAttempted,
        lookupSuccess,
        hasLoadData: !!loadData,
        errorMessage
    });

    // Output for next Zapier step
    output = {
        load_data: loadData,
        lookup_success: lookupSuccess,
        lookup_attempted: lookupAttempted,
        error_message: errorMessage,
        scenario: scenario,
        processing_time_ms: processingTime,
        request_id: requestId,
        timestamp: new Date().toISOString(),
        // Pass through data for response formatting
        load_reference: loadReference,
        reference_found: referenceFound,
        original_subject: originalSubject,
        original_body: originalBody,
        // Additional metadata
        has_complete_data: loadData ? this.isCompleteData(loadData) : false
    };

} catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error(`[${requestId}] Lookup step failed:`, {
        error: error.message,
        processingTimeMs: processingTime
    });

    // Output error state
    output = {
        load_data: null,
        lookup_success: false,
        lookup_attempted: true,
        error_message: error.message,
        scenario: 'error',
        processing_time_ms: processingTime,
        request_id: requestId,
        timestamp: new Date().toISOString(),
        // Pass through original data
        load_reference: inputData.load_reference,
        reference_found: inputData.found,
        original_subject: inputData.original_subject || '',
        original_body: inputData.original_body || '',
        has_complete_data: false
    };
}

// Helper function to check data completeness
function isCompleteData(loadData) {
    if (!loadData) return false;
    
    const requiredFields = [
        loadData.pickup?.location,
        loadData.delivery?.location,
        loadData.commodity?.weight,
        loadData.rate?.amount
    ];
    
    return requiredFields.every(field => field && field !== 'TBD');
}