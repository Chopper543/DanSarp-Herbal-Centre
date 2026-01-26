# Google Maps API Key Setup Guide

This guide will help you obtain and configure a Google Maps API key for the DanSarp Herbal Centre website. The Maps Embed API is **completely free** with unlimited usage, but requires a Google Cloud account with billing enabled (you won't be charged for typical usage).

## Quick Start

If you prefer an automated setup, use the helper script:

```bash
npm run setup:google-maps
```

This script will guide you through the process interactively. For manual setup, follow the steps below.

## Prerequisites

- A Google account (Gmail, Google Workspace, etc.)
- A credit card or payment method (required for billing setup, but you won't be charged for Maps Embed API usage)

## Step-by-Step Setup

### Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top of the page
3. Click **"New Project"**
4. Enter a project name (e.g., "DanSarp Herbal Centre")
5. Click **"Create"**
6. Wait for the project to be created, then select it from the project dropdown

### Step 2: Enable Billing

**Important**: Billing must be enabled even though Maps Embed API is free. You won't be charged for typical usage.

1. In the Google Cloud Console, go to **"Billing"** in the left sidebar
2. Click **"Link a billing account"**
3. If you don't have a billing account:
   - Click **"Create billing account"**
   - Fill in your billing information
   - Google offers a **$300 free credit** for new accounts (90 days or until credit is used)
4. Link your billing account to the project you created

### Step 3: Enable Maps Embed API

1. In the Google Cloud Console, go to **"APIs & Services" > "Library"**
2. Search for **"Maps Embed API"**
3. Click on **"Maps Embed API"** from the results
4. Click **"Enable"**
5. Wait for the API to be enabled (usually takes a few seconds)

### Step 4: Create an API Key

1. Go to **"APIs & Services" > "Credentials"**
2. Click **"Create Credentials"** at the top of the page
3. Select **"API key"** from the dropdown
4. Your API key will be generated and displayed
5. **Copy the API key** - you'll need it in the next step

### Step 5: Restrict the API Key (Recommended for Security)

**Important**: Restricting your API key prevents unauthorized usage and potential charges.

1. Click on the API key you just created (or click **"Edit API key"** if the dialog is still open)
2. Under **"API restrictions"**:
   - Select **"Restrict key"**
   - Check **"Maps Embed API"** only
   - This ensures the key can only be used for Maps Embed API
3. Under **"Application restrictions"**:
   - Select **"HTTP referrers (web sites)"**
   - Click **"Add an item"**
   - Add your website domains:
     - `http://localhost:3000/*` (for development)
     - `https://dansarpherbal.com/*` (for production)
     - `https://*.vercel.app/*` (if using Vercel preview deployments)
   - Click **"Save"**

### Step 6: Add the Key to Your Project

#### Option A: Using the Helper Script (Recommended)

```bash
npm run setup:google-maps
```

The script will:
- Validate your API key format
- Test the key with a sample request
- Automatically insert it into `.env.local`

#### Option B: Manual Setup

1. Open `.env.local` in your project root
2. Find the line: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=`
3. Add your API key after the equals sign:
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyYourActualKeyHere
   ```
4. Save the file
5. Restart your development server if it's running

### Step 7: Verify the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```
2. Navigate to the contact page: `http://localhost:3000/contact`
3. Check that the Google Map loads correctly
4. If you see an error, check the browser console for details

## Troubleshooting

### "This API key is not authorized for this API"

**Solution**: Make sure you've enabled the Maps Embed API in Step 3.

1. Go to **"APIs & Services" > "Library"**
2. Search for "Maps Embed API"
3. Ensure it shows **"Enabled"**
4. If not, click **"Enable"**

### "RefererNotAllowedMapError"

**Solution**: Your API key restrictions are blocking the request.

1. Go to **"APIs & Services" > "Credentials"**
2. Click on your API key
3. Under **"Application restrictions"**, verify your HTTP referrers include:
   - `http://localhost:3000/*`
   - Your production domain
4. Make sure there are no typos in the referrer patterns

### Map Shows "For Development Purposes Only"

**Solution**: This usually means:
- The API key is not set in your environment variables
- The API key is invalid
- The Maps Embed API is not enabled

Check:
1. Verify `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set in `.env.local`
2. Restart your development server
3. Verify the API key is correct in Google Cloud Console

### "Billing Not Enabled" Error

**Solution**: Enable billing for your Google Cloud project (Step 2).

Even though Maps Embed API is free, Google requires billing to be enabled.

### API Key Not Working After Deployment

**Solution**: Make sure you've added the API key to your deployment platform's environment variables.

**For Vercel**:
1. Go to your project settings in Vercel
2. Navigate to **"Environment Variables"**
3. Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` with your API key value
4. Redeploy your application

**For Other Platforms**:
- Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to your platform's environment variable settings

## Security Best Practices

1. **Always restrict your API key** to specific APIs (Maps Embed API only)
2. **Use HTTP referrer restrictions** to limit which websites can use your key
3. **Never commit your API key** to version control (it's already in `.gitignore`)
4. **Rotate your key** if you suspect it's been compromised
5. **Monitor usage** in Google Cloud Console to detect unusual activity

## Cost Information

- **Maps Embed API**: Completely free with unlimited usage
- **No charges** for typical website usage
- **Billing account required** but you won't be charged for Embed API requests
- Google provides **$300 free credit** for new accounts

## Additional Resources

- [Google Maps Embed API Documentation](https://developers.google.com/maps/documentation/embed)
- [Google Cloud Console](https://console.cloud.google.com/)
- [API Key Best Practices](https://developers.google.com/maps/api-security-best-practices)
- [Maps Embed API Usage and Billing](https://developers.google.com/maps/documentation/embed/usage-and-billing)

## Need Help?

If you encounter issues not covered in this guide:

1. Check the [Google Maps Platform Support](https://developers.google.com/maps/support)
2. Review the browser console for error messages
3. Verify all steps were completed correctly
4. Use the helper script: `npm run setup:google-maps` for automated validation
