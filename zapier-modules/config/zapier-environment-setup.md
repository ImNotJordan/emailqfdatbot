# Zapier Environment Setup Guide

This guide explains how to configure your Zapier environment variables and set up the workflow for the Load Automation System.

## Environment Variables

Set these environment variables in your Zapier account (Code Steps > Environment Variables):

### Required Variables

#### Auth0 Configuration
```
AUTH0_DOMAIN=your-auth0-domain.auth0.com
AUTH0_CLIENT_ID=your_client_id_here
AUTH0_CLIENT_SECRET=your_client_secret_here
AUTH0_AUDIENCE=https://your-auth0-domain.auth0.com/api/v2/
```

#### QuoteFactory Credentials
```
QUOTEFACTORY_USERNAME=your_quotefactory_username
QUOTEFACTORY_PASSWORD=your_quotefactory_password
QUOTEFACTORY_API_BASE=https://api.quotefactory.com
```

### Optional Variables

#### Company Branding
```
COMPANY_NAME=Your Company Name
COMPANY_SIGNATURE=Custom signature block (optional)
```

## Zapier Workflow Setup

### Step 1: Email Trigger
- **App**: Gmail, Outlook, or Email Parser by Zapier
- **Trigger**: New Email
- **Configuration**: 
  - Set up filters for incoming load inquiry emails
  - Ensure body content is captured in plain text

### Step 2: Extract Load Reference (Code Step)
- **Type**: Run JavaScript
- **Code**: Copy from `zapier-code-steps/extract-load-reference.js`
- **Input Fields**:
  - `email_subject`: Subject from trigger
  - `email_body`: Body from trigger
  - `email_from`: From address from trigger (optional)

### Step 3: Conditional Logic (Filter)
- **Condition**: Only continue if load reference found OR always continue for no-reference responses
- **Filter**: `found` equals `true` OR always pass through

### Step 4: Lookup Load Details (Code Step)
- **Type**: Run JavaScript
- **Code**: Copy from `zapier-code-steps/lookup-load-details.js`
- **Input Fields**: All outputs from Step 2

### Step 5: Format Email Response (Code Step)
- **Type**: Run JavaScript
- **Code**: Copy from `zapier-code-steps/format-email-response.js`
- **Input Fields**: All outputs from Step 4

### Step 6: Send Email Reply
- **App**: Gmail, Outlook, or Email by Zapier
- **Action**: Send Email
- **Configuration**:
  - **To**: Original sender's email
  - **Subject**: `reply_subject` from Step 5
  - **Body**: `reply_body` from Step 5 (plain text) or `reply_body_html` (HTML)
  - **Reply-To**: Set appropriate reply-to address

## Security Best Practices

### Environment Variable Security
1. Never hardcode credentials in the code steps
2. Use Zapier's environment variables feature
3. Regularly rotate Auth0 client secrets
4. Use dedicated service accounts for QuoteFactory

### Data Handling
1. Email content is processed in memory only
2. No sensitive data is logged to Zapier's logs
3. Request IDs allow tracking without exposing data
4. Credentials are never included in output data

### Error Handling
1. All errors generate user-friendly responses
2. Technical details are not exposed to email senders
3. Failed authentications fall back to pending responses
4. System monitors all processing steps

## Monitoring and Troubleshooting

### Zapier Built-in Monitoring
- Use Zapier's task history to monitor workflow execution
- Check for failed steps and error messages
- Monitor processing times for performance issues

### Custom Logging
Each code step includes structured logging:
```javascript
console.log(`[${requestId}] Processing stage`, {
    key: 'value',
    timestamp: new Date().toISOString()
});
```

### Common Issues and Solutions

#### Authentication Failures
- **Symptom**: All lookups fail with auth errors
- **Solution**: Verify Auth0 environment variables
- **Check**: Test credentials with Auth0 directly

#### No Load References Found
- **Symptom**: All emails result in "reference needed" responses
- **Solution**: Review email parsing patterns
- **Check**: Test with known good reference formats

#### API Timeouts
- **Symptom**: Random lookup failures
- **Solution**: Implement retry logic or contact QuoteFactory
- **Check**: API endpoint availability

#### Memory/Time Limits
- **Symptom**: Code steps fail with timeout errors
- **Solution**: Optimize code or split into more steps
- **Check**: Email body size and processing complexity

## Performance Optimization

### Processing Speed
1. **Authentication Caching**: Tokens are cached within each step
2. **Content Limiting**: Email content is truncated to 5000 characters
3. **Pattern Optimization**: Most specific patterns are tried first
4. **Early Exit**: Processing stops as soon as a valid reference is found

### Memory Usage
1. **Minimal Dependencies**: All classes are embedded, no external packages
2. **Garbage Collection**: Variables are cleared after use
3. **Stream Processing**: Large responses are processed in chunks

### Error Recovery
1. **Graceful Degradation**: System always generates a response
2. **Fallback Responses**: Generic responses when processing fails
3. **Partial Success**: Load reference extraction can succeed even if lookup fails

## Testing Your Setup

### Test Scenarios

#### 1. Complete Success Path
- **Test Email**: Contains clear load reference
- **Expected**: Full load details response
- **Verify**: All steps complete successfully

#### 2. Reference Found, Lookup Fails
- **Test Email**: Contains load reference
- **Mock**: Disable API credentials
- **Expected**: "Details pending" response

#### 3. No Reference Found
- **Test Email**: Generic inquiry without reference
- **Expected**: "Reference number needed" response

#### 4. API Errors
- **Test**: Invalid credentials
- **Expected**: Error response with professional message

### Validation Checklist
- [ ] All environment variables are set correctly
- [ ] Email trigger captures subject and body
- [ ] Load reference extraction works with your typical emails
- [ ] Auth0 authentication succeeds
- [ ] QuoteFactory API calls return data
- [ ] Email responses are professional and accurate
- [ ] Error handling produces user-friendly messages
- [ ] Processing completes within Zapier's time limits

## Advanced Configuration

### Custom Response Templates
You can customize response templates by modifying the embedded ResponseFormatter class in the format-email-response.js step.

### Additional Load Patterns
Add custom load reference patterns by modifying the loadPatterns array in the EmailParser class.

### Extended API Features
The QuoteFactory API client can be extended to support additional endpoints and data transformation requirements.

### Multi-Company Support
The system can be extended to support multiple companies by adding company identification logic and separate credential sets.