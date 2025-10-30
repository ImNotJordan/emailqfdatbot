/**
 * Auth0 Authentication Client for QuoteFactory
 * Handles OAuth2 flow with Auth0 for API access
 */

class Auth0Client {
    constructor(config) {
        this.domain = config.auth0Domain;
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.audience = config.audience || `https://${config.auth0Domain}/api/v2/`;
        this.tokenCache = null;
        this.tokenExpiry = null;
    }

    /**
     * Get access token using client credentials flow
     * Implements caching to avoid unnecessary auth requests
     */
    async getAccessToken() {
        // Check cache first
        if (this.tokenCache && this.tokenExpiry && new Date() < this.tokenExpiry) {
            return this.tokenCache;
        }

        const tokenUrl = `https://${this.domain}/oauth/token`;
        
        const payload = {
            grant_type: 'client_credentials',
            client_id: this.clientId,
            client_secret: this.clientSecret,
            audience: this.audience
        };

        try {
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Auth0 token request failed: ${response.status} - ${error}`);
            }

            const data = await response.json();
            
            // Cache token with expiry
            this.tokenCache = data.access_token;
            // Set expiry 5 minutes before actual expiry for safety
            this.tokenExpiry = new Date(Date.now() + (data.expires_in - 300) * 1000);
            
            return data.access_token;
        } catch (error) {
            throw new Error(`Auth0 authentication failed: ${error.message}`);
        }
    }

    /**
     * Get user authentication token using Resource Owner Password flow
     * Note: This flow should only be used for trusted applications
     */
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

        try {
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Auth0 user authentication failed: ${response.status} - ${error}`);
            }

            const data = await response.json();
            return {
                accessToken: data.access_token,
                idToken: data.id_token,
                expiresIn: data.expires_in
            };
        } catch (error) {
            throw new Error(`User authentication failed: ${error.message}`);
        }
    }
}

module.exports = Auth0Client;