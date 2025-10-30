/**
 * QuoteFactory API Client
 * Handles all API interactions with QuoteFactory using HTTP requests
 */

class QuoteFactoryAPI {
    constructor(config) {
        this.baseUrl = config.baseUrl || 'https://api.quotefactory.com';
        this.auth0Client = config.auth0Client;
        this.username = config.username;
        this.password = config.password;
        this.sessionToken = null;
        this.sessionExpiry = null;
        this.logger = config.logger || console;
    }

    /**
     * Initialize session with QuoteFactory
     */
    async initialize() {
        try {
            // Get Auth0 token
            const authResult = await this.auth0Client.getUserToken(
                this.username,
                this.password
            );

            this.sessionToken = authResult.accessToken;
            this.sessionExpiry = new Date(Date.now() + (authResult.expiresIn - 300) * 1000);

            this.logger.log('QuoteFactory session initialized successfully');
            return true;
        } catch (error) {
            this.logger.error('Failed to initialize QuoteFactory session:', error.message);
            throw new Error(`QuoteFactory initialization failed: ${error.message}`);
        }
    }

    /**
     * Ensure we have a valid session
     */
    async ensureSession() {
        if (!this.sessionToken || !this.sessionExpiry || new Date() >= this.sessionExpiry) {
            await this.initialize();
        }
    }

    /**
     * Search for a load by reference number
     */
    async searchLoad(loadReference) {
        await this.ensureSession();

        const searchUrl = `${this.baseUrl}/api/v1/loads/search`;
        
        try {
            const response = await fetch(searchUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`,
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
                if (response.status === 401) {
                    // Token expired, retry once
                    await this.initialize();
                    return this.searchLoad(loadReference);
                }
                throw new Error(`Search failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                // Return the first match
                return this.transformLoadData(data.results[0]);
            }

            return null;
        } catch (error) {
            this.logger.error('Load search error:', error.message);
            throw new Error(`Failed to search load: ${error.message}`);
        }
    }

    /**
     * Get detailed load information
     */
    async getLoadDetails(loadId) {
        await this.ensureSession();

        const detailsUrl = `${this.baseUrl}/api/v1/loads/${loadId}`;
        
        try {
            const response = await fetch(detailsUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get load details: ${response.status}`);
            }

            const data = await response.json();
            return this.transformLoadData(data);
        } catch (error) {
            this.logger.error('Load details error:', error.message);
            throw new Error(`Failed to get load details: ${error.message}`);
        }
    }

    /**
     * Transform API response to standardized format
     */
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

    /**
     * Format location data
     */
    formatLocation(location) {
        if (!location) return 'TBD';

        if (typeof location === 'string') {
            return location;
        }

        const parts = [
            location.city,
            location.state || location.province,
            location.postalCode
        ].filter(Boolean);

        return parts.join(', ') || 'TBD';
    }

    /**
     * Format weight
     */
    formatWeight(weight) {
        if (!weight) return 'TBD';
        
        if (typeof weight === 'number') {
            return `${weight.toLocaleString()} lbs`;
        }
        
        return weight.toString();
    }

    /**
     * Format currency
     */
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

    /**
     * Batch search for multiple loads
     */
    async searchMultipleLoads(loadReferences) {
        const results = {};
        
        for (const reference of loadReferences) {
            try {
                const loadData = await this.searchLoad(reference);
                results[reference] = {
                    success: true,
                    data: loadData
                };
            } catch (error) {
                results[reference] = {
                    success: false,
                    error: error.message
                };
            }
        }
        
        return results;
    }

    /**
     * Health check for API connectivity
     */
    async healthCheck() {
        try {
            await this.ensureSession();
            
            const response = await fetch(`${this.baseUrl}/api/v1/health`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`
                }
            });

            return {
                healthy: response.ok,
                status: response.status,
                message: response.ok ? 'API is accessible' : 'API health check failed'
            };
        } catch (error) {
            return {
                healthy: false,
                status: 0,
                message: error.message
            };
        }
    }
}

module.exports = QuoteFactoryAPI;