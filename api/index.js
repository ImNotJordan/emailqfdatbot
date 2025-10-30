export default function handler(req, res) {
    res.json({
        service: 'Load Email Automation - Serverless Version',
        status: 'running',
        version: '41.0.0',
        credentialsConfigured: !!(process.env.QUOTEFACTORY_USERNAME && process.env.QUOTEFACTORY_PASSWORD),
        timestamp: new Date().toISOString(),
        platform: 'Vercel Serverless'
    });
}
