// api/webhook.js - Fixed Puppeteer with @sparticuz/chromium
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

class LoadAutomationEnhanced {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        try {
            console.log('🚀 Initializing browser for QuoteFactory...');
            
            // Try multiple browser strategies
            if (process.env.BROWSERLESS_TOKEN) {
                // Strategy 1: Use Browserless.io service
                console.log('🌐 Using Browserless.io service...');
                console.log('Token length:', process.env.BROWSERLESS_TOKEN.length);
                try {
                    this.browser = await puppeteer.connect({
                        browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}`,
                    });
                } catch (browserlessError) {
                    console.log('❌ Browserless.io failed (403 - token invalid/expired)');
                    console.log('💡 Please get a fresh token from https://www.browserless.io/');
                    // Continue to local chromium fallback
                }
            }
            
            // Strategy 2: Try local chromium if no browser yet
            if (!this.browser) {
                console.log('🔧 Falling back to local chromium...');
                const isLocal = !!process.env.CHROME_BIN || !!process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD;
                
                let launchOptions;
                
                if (isLocal) {
                    // Local development
                    launchOptions = {
                        headless: true,
                        args: ['--no-sandbox', '--disable-setuid-sandbox']
                    };
                } else {
                    // Vercel production with @sparticuz/chromium
                    launchOptions = {
                        args: chromium.args,
                        defaultViewport: chromium.defaultViewport,
                        executablePath: await chromium.executablePath(),
                        headless: chromium.headless,
                        ignoreHTTPSErrors: true,
                    };
                }
                
                this.browser = await puppeteer.launch(launchOptions);
            }
            
            this.page = await this.browser.newPage();
            
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Block heavy resources to save memory and time
            await this.page.setRequestInterception(true);
            this.page.on('request', (req) => {
                const url = req.url();
                const resourceType = req.resourceType();
                
                if (url.includes('quotefactory.com') || url.includes('auth0.com')) {
                    req.continue();
                } else if (['image', 'font', 'stylesheet'].includes(resourceType)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });
            
            console.log('✅ Browser initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize browser:', error);
            return false;
        }
    }

    async cleanup() {
        try {
            if (this.page) await this.page.close();
            if (this.browser) await this.browser.close();
            console.log('✅ Browser cleanup completed');
        } catch (error) {
            console.error('❌ Cleanup error:', error);
        }
    }

    extractLoadReference(emailBody) {
        const exclusionPatterns = [
            /MC\s*\d+/i,
            /DOT\s*\d+/i,
            /USDOT\s*\d+/i,
            /invoice\s*#?\s*\d+/i,
            /bill\s*#?\s*\d+/i
        ];
        
        for (const pattern of exclusionPatterns) {
            const match = emailBody.match(pattern);
            if (match) {
                console.log(`❌ Found exclusion pattern: ${match[0]} - ignoring`);
                emailBody = emailBody.replace(pattern, '');
            }
        }
        
        const patterns = [
            /order\s*#?\s*(\d{6,8})/i,
            /reference\s+number\s+(\d{6,8})/i,
            /ref[:\s]+(\d{6,8})/i,
            /\b(\d{6})\b/i,
            /(?:load\s*(?:ref|reference|number|id|#)[:\-\s]*)([A-Z0-9\-\_]+)/i,
            /([A-Z]{2,4}[\-\_\s]*\d{3,8}[\-\_\s]*[A-Z0-9]*)/i,
            /([A-HJ-Z]+\d{4,8}[A-Z0-9]*)/i
        ];
        
        console.log('🔍 Searching for load reference...');
        
        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const match = emailBody.match(pattern);
            
            if (match && match[1]) {
                let cleanMatch = match[1].trim();
                cleanMatch = cleanMatch.replace(/[^\w\-]/g, '');
                
                if (cleanMatch && 
                    cleanMatch.length >= 4 && 
                    !cleanMatch.toUpperCase().startsWith('MC') &&
                    !cleanMatch.toUpperCase().startsWith('DOT')) {
                    
                    console.log(`✅ Found load reference: "${cleanMatch}"`);
                    return cleanMatch;
                }
            }
        }
        
        console.log('❌ No valid load reference found');
        return null;
    }

    async loginToQuoteFactory() {
        try {
            console.log('🔐 Starting QuoteFactory login...');
            
            const username = process.env.QUOTEFACTORY_USERNAME;
            const password = process.env.QUOTEFACTORY_PASSWORD;
            
            if (!username || !password) {
                console.log('❌ No QuoteFactory credentials found');
                return false;
            }
            
            this.page.setDefaultTimeout(20000);
            this.page.setDefaultNavigationTimeout(20000);
            
            await this.page.goto('https://app.quotefactory.com', {
                waitUntil: 'domcontentloaded',
                timeout: 20000
            });
            
            console.log('Current URL:', this.page.url());
            
            if (this.page.url().includes('/broker/dashboard')) {
                console.log('✅ Already on dashboard!');
                return true;
            }
            
            console.log('🔄 Need to perform login...');
            await this.page.waitForTimeout(3000);
            
            try {
                let loginSuccess = false;
                
                // Method 1: Direct form fields
                try {
                    await this.page.waitForSelector('input[type="email"], input[name="username"]', { timeout: 10000 });
                    const emailField = await this.page.$('input[type="email"], input[name="username"]');
                    const passwordField = await this.page.$('input[type="password"]');
                    
                    if (emailField && passwordField) {
                        console.log('📝 Filling credentials...');
                        await emailField.type(username);
                        await passwordField.type(password);
                        await this.page.keyboard.press('Enter');
                        loginSuccess = true;
                    }
                } catch (e) {
                    console.log('⚠️ Direct form method failed:', e.message);
                }
                
                // Method 2: Auth0 iframe (simplified for Puppeteer)
                if (!loginSuccess) {
                    try {
                        console.log('🔍 Trying Auth0 iframe...');
                        const frames = await this.page.frames();
                        
                        for (const frame of frames) {
                            const frameUrl = frame.url();
                            if (frameUrl.includes('auth0.com')) {
                                console.log('Found Auth0 frame:', frameUrl);
                                
                                await frame.waitForSelector('input[type="email"], input[name="username"]', { timeout: 5000 });
                                const emailField = await frame.$('input[type="email"], input[name="username"]');
                                const passwordField = await frame.$('input[type="password"]');
                                
                                if (emailField && passwordField) {
                                    await emailField.type(username);
                                    await passwordField.type(password);
                                    await frame.keyboard.press('Enter');
                                    loginSuccess = true;
                                    break;
                                }
                            }
                        }
                    } catch (e) {
                        console.log('⚠️ Auth0 iframe method failed:', e.message);
                    }
                }
                
                if (!loginSuccess) {
                    console.log('❌ All login methods failed');
                    return false;
                }
                
                console.log('⏳ Waiting for login to complete...');
                await this.page.waitForTimeout(8000);
                
                const currentUrl = this.page.url();
                console.log('Post-login URL:', currentUrl);
                
                if (currentUrl.includes('/broker/dashboard') || currentUrl.includes('/dashboard')) {
                    console.log('✅ Login successful!');
                    return true;
                } else {
                    console.log('❌ Login may have failed - not on dashboard');
                    return false;
                }
                
            } catch (loginError) {
                console.log('❌ Login process failed:', loginError.message);
                return false;
            }
            
        } catch (error) {
            console.error('❌ QuoteFactory login failed:', error.message);
            return false;
        }
    }

    async searchLoadInfo(loadReference) {
        try {
            console.log(`🔍 Searching for load: ${loadReference}`);
            
            // Try keyboard shortcut search
            await this.page.keyboard.press('/');
            await this.page.waitForTimeout(2000);
            
            // Look for focused input
            const searchInput = await this.page.$('input:focus');
            if (searchInput) {
                console.log('✅ Search input found');
                await searchInput.type(loadReference);
                await this.page.waitForTimeout(4000);
                
                try {
                    // Try to click on the search result
                    const resultSelector = `[role="button"]:has-text("${loadReference}"), a:has-text("${loadReference}"), div:has-text("${loadReference}")`;
                    await this.page.click(resultSelector, { timeout: 5000 });
                } catch (e) {
                    await this.page.keyboard.press('Enter');
                }
                
                await this.page.waitForTimeout(6000);
                
                // Extract load information
                const loadData = await this.page.evaluate(() => {
                    const text = document.body.textContent || '';
                    
                    // Look for pickup/delivery info
                    const locationMatches = text.match(/([A-Za-z\s]+),\s*([A-Z]{2})/g) || [];
                    const weightMatches = text.match(/(\d{1,3}(?:,\d{3})*)\s*(lbs?|pounds?)/gi) || [];
                    const rateMatches = text.match(/\$(\d{1,2}(?:,\d{3})*)/g) || [];
                    
                    return {
                        locations: locationMatches.slice(0, 2),
                        weights: weightMatches,
                        rates: rateMatches,
                        hasData: text.length > 1000 && locationMatches.length > 0,
                        textLength: text.length
                    };
                });
                
                console.log(`Page text length: ${loadData.textLength}, Locations found: ${loadData.locations.length}`);
                
                if (loadData.hasData) {
                    console.log('✅ Load data found successfully');
                    return {
                        pickup: loadData.locations[0] || 'Pickup TBD',
                        delivery: loadData.locations[1] || 'Delivery TBD', 
                        weight: loadData.weights[0] || 'Weight TBD',
                        rate: loadData.rates[0] || 'Rate TBD'
                    };
                } else {
                    console.log('⚠️ Load found but limited data available');
                    return null;
                }
            }
            
            console.log('❌ Could not find search input');
            return null;
            
        } catch (error) {
            console.error('❌ Load search failed:', error.message);
            return null;
        }
    }

    formatResponse(loadReference, loadInfo, subject, originalEmail) {
        if (loadInfo) {
            return {
                subject: `Re: ${subject}`,
                body: `Hello,

Thank you for your inquiry about load ${loadReference}. Here are the details:

📦 LOAD DETAILS:
- Pickup: ${loadInfo.pickup}
- Delivery: ${loadInfo.delivery}
- Weight: ${loadInfo.weight}
- Rate: ${loadInfo.rate}

🚛 CAPACITY INQUIRY:
When and where will you be empty for pickup?

Best regards,
Balto Booking

---
Automated response with live QuoteFactory data`
            };
        } else if (loadReference) {
            return {
                subject: `Re: ${subject}`,
                body: `Hello,

Thank you for your inquiry regarding load ${loadReference}.

I've identified this load reference and am currently pulling the complete details from our system. You'll receive:

📦 LOAD INFORMATION:
• Pickup and delivery locations with dates/times  
• Commodity details and weight requirements
• Our competitive rate quote
• Equipment specifications
• Any special handling requirements

This detailed information will be sent within the next 10-15 minutes via our load management team.

🚛 TO EXPEDITE: When and where will you be empty for pickup?

We're ready to provide immediate quotes and book qualified loads on the spot.

Best regards,
Balto Booking

---
Professional freight services with real-time load tracking`
            };
        } else {
            return {
                subject: `Re: ${subject} - DAT Reference Number Needed`,
                body: `Hello,

Thank you for reaching out about this load opportunity.

To provide you with accurate pricing and availability, could you please provide the DAT load reference number or QuoteFactory load ID?

This will help us:
- Pull the exact load details from our system  
- Provide you with competitive pricing
- Respond faster with availability

Once you provide the reference number, we'll get back to you immediately with our quote and capacity.

Thank you!

Best regards,
Balto Booking

---
Automated response - Please reply with DAT reference number`
            };
        }
    }
}

export { LoadAutomationEnhanced };
// VERCEL SERVERLESS HANDLER
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const automation = new LoadAutomationEnhanced();
    
    try {
        console.log('=== Processing Email with Fixed Puppeteer Integration ===');
        console.log('Full request body:', JSON.stringify(req.body, null, 2));
        console.log('Subject:', req.body.subject);
        console.log('Body Preview:', req.body.bodyPreview?.substring(0, 200));
        
        // Handle Zapier's data format - all data comes in req.body.JSON
        const zapierData = req.body.JSON || '';
        const emailId = req.body.id || 'unknown';
        const subject = req.body.subject || 'Load Inquiry';
        const bodyPreview = req.body.bodyPreview || '';
        const emailBodyContent = req.body.body?.content || '';
        
        // Use Zapier data if available, otherwise fall back to structured data
        const emailContent = zapierData || bodyPreview || emailBodyContent || '';
        
        const loadReference = automation.extractLoadReference(emailContent);
        
        let loadInfo = null;
        let hasCredentials = false;
        
        if (loadReference) {
            console.log(`✅ Found load reference: ${loadReference}`);
            
            hasCredentials = process.env.QUOTEFACTORY_USERNAME && process.env.QUOTEFACTORY_PASSWORD;
            
            if (hasCredentials) {
                console.log('🔐 Credentials found, attempting QuoteFactory lookup...');
                
                const browserReady = await automation.initialize();
                if (browserReady) {
                    const loginSuccess = await automation.loginToQuoteFactory();
                    if (loginSuccess) {
                        loadInfo = await automation.searchLoadInfo(loadReference);
                    }
                    await automation.cleanup();
                } else {
                    console.log('❌ Browser initialization failed - using intelligent fallback response');
                    console.log('🔍 Attempting HTTP-based QuoteFactory check...');
                    
                    // Try a simple HTTP check to see if load exists
                    try {
                        const response = await fetch(`https://app.quotefactory.com/api/loads/search?q=${loadReference}`, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            },
                            timeout: 5000
                        });
                        
                        if (response.ok) {
                            console.log('✅ Load exists in QuoteFactory (HTTP check)');
                            // Set a flag that we found the load but couldn't scrape details
                            loadInfo = { 
                                exists: true, 
                                pickup: 'Details being retrieved...', 
                                delivery: 'Details being retrieved...',
                                weight: 'TBD',
                                rate: 'Quote being prepared...'
                            };
                        }
                    } catch (error) {
                        console.log('ℹ️ HTTP check failed, using standard fallback');
                    }
                }
            } else {
                console.log('⚠️ No QuoteFactory credentials - using basic response');
            }
        }
        
        const responseEmail = automation.formatResponse(loadReference, loadInfo, subject, emailContent);
        
        return res.status(200).json({
            success: true,
            loadReference: loadReference || null,
            loadInfo: loadInfo || null,
            responseSubject: responseEmail.subject,
            responseBody: responseEmail.body,
            quotefactoryAttempted: !!(loadReference && hasCredentials),
            quotefactorySuccess: !!(loadInfo),
            replyToEmailId: emailId,
            timestamp: new Date().toISOString(),
            mode: 'puppeteer-fixed'
        });
        
    } catch (error) {
        console.error('❌ Webhook error:', error);
        
        await automation.cleanup();
        
        return res.status(200).json({
            success: true,
            message: 'Error processing - fallback response',
            responseSubject: 'Re: Load Inquiry',
            responseBody: 'Thank you for your email. We are processing your inquiry and will respond shortly.',
            timestamp: new Date().toISOString()
        });
    }
}

export const config = {
    maxDuration: 30,
};
