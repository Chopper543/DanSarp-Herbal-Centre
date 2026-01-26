# Production Deployment Guide

This guide covers everything you need to deploy DanSarp Herbal Centre to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Pre-Deployment Checklist](#pre-deployment-checklist)
5. [Deployment Steps](#deployment-steps)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Monitoring Setup](#monitoring-setup)
8. [Troubleshooting](#troubleshooting)
9. [Rollback Procedures](#rollback-procedures)
10. [Performance Optimization](#performance-optimization)

## Prerequisites

Before deploying to production, ensure you have:

- [ ] Node.js 18+ installed
- [ ] All required service accounts created:
  - Supabase project
  - Vercel account (or your hosting provider)
  - Upstash Redis (for rate limiting)
  - Sentry account (for error monitoring)
  - Resend account (for emails)
  - Payment provider accounts (Paystack/Flutterwave)
  - Cloudinary account (optional, for media optimization)

## Environment Setup

### 1. Environment Variables

Copy `.env.example` to your production environment and fill in all values:

```bash
cp .env.example .env.production
```

#### Required Variables

These must be set for production:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (keep secret!)
- `NEXT_PUBLIC_SITE_URL` - Your production domain (e.g., https://dansarpherbal.com)
- `CSRF_SECRET` - Random 32+ character string for CSRF protection

Generate CSRF secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Recommended Variables

These are recommended for production:

- `NEXT_PUBLIC_SENTRY_DSN` - Error monitoring
- `UPSTASH_REDIS_REST_URL` - Rate limiting (required for production)
- `UPSTASH_REDIS_REST_TOKEN` - Rate limiting token
- `RESEND_API_KEY` - Email functionality
- `PAYSTACK_SECRET_KEY` or `FLUTTERWAVE_SECRET_KEY` - Payment processing

### 2. Validate Environment Variables

Before deploying, validate your environment variables:

```bash
npm run validate:env:strict
```

This will check all required variables and warn about missing recommended ones.

## Database Setup

### 1. Run Migrations

Apply all database migrations to your production Supabase database:

1. Connect to your Supabase project dashboard
2. Go to SQL Editor
3. Run the migration file: `supabase/migrations/000_consolidated_schema.sql`
4. Verify all tables and policies are created

### 2. Verify Row Level Security (RLS)

Ensure RLS is enabled on all tables. Check in Supabase dashboard:
- Authentication > Policies
- Verify policies are active for all tables

### 3. Set Up Database Backups

Configure automatic backups in Supabase:
- Go to Settings > Database
- Enable Point-in-Time Recovery (PITR)
- Set backup retention period

## Pre-Deployment Checklist

Run the pre-deployment validation script:

```bash
npm run pre-deploy
```

This will:
- ✅ Validate environment variables
- ✅ Run TypeScript type checking
- ✅ Run ESLint
- ✅ Test production build

See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for the complete checklist.

## Deployment Steps

### Vercel Deployment

1. **Push code to repository**
   ```bash
   git add .
   git commit -m "Production deployment"
   git push origin main
   ```

2. **Import project in Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your GitHub repository

3. **Configure environment variables**
   - In Vercel project settings, go to "Environment Variables"
   - Add all variables from `.env.example`
   - Set them for "Production" environment
   - Ensure `NODE_ENV=production` is set

4. **Configure build settings**
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

5. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Verify deployment status

### Custom Deployment

If deploying to a custom server:

1. **Build the application**
   ```bash
   npm ci
   npm run build
   ```

2. **Start the production server**
   ```bash
   npm start
   ```

3. **Set up process manager** (PM2 recommended)
   ```bash
   npm install -g pm2
   pm2 start npm --name "dansarp-herbal" -- start
   pm2 save
   pm2 startup
   ```

## Post-Deployment Verification

### 1. Health Check

Verify the health endpoint is working:

```bash
curl https://your-domain.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-26T...",
  "uptime": 123.45,
  "environment": "production",
  "version": "1.0.0",
  "checks": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

### 2. Functional Tests

Test key functionality:
- [ ] Homepage loads
- [ ] User registration/login works
- [ ] Appointment booking works
- [ ] Payment processing works
- [ ] Admin dashboard accessible
- [ ] API endpoints respond correctly

### 3. Security Verification

- [ ] HTTPS is enforced
- [ ] Security headers are present (check with [SecurityHeaders.com](https://securityheaders.com))
- [ ] Rate limiting is working
- [ ] CSRF protection is active

## Monitoring Setup

### 1. Sentry Error Monitoring

1. Create account at [sentry.io](https://sentry.io)
2. Create a new project (Next.js)
3. Copy the DSN
4. Add `NEXT_PUBLIC_SENTRY_DSN` to environment variables
5. Verify errors are being captured

### 2. Uptime Monitoring

Set up uptime monitoring for your health endpoint:
- [UptimeRobot](https://uptimerobot.com) - Free tier available
- [Pingdom](https://www.pingdom.com)
- [StatusCake](https://www.statuscake.com)

Monitor: `https://your-domain.com/api/health`

### 3. Analytics

Configure analytics:
- Google Analytics: Add `NEXT_PUBLIC_GA_ID`
- Plausible: Add `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`

### 4. Log Monitoring

For custom deployments, set up log aggregation:
- [Logtail](https://logtail.com)
- [Datadog](https://www.datadoghq.com)
- [New Relic](https://newrelic.com)

## Troubleshooting

### Build Fails

**Error**: Environment variable validation failed
- **Solution**: Run `npm run validate:env:strict` and fix missing variables

**Error**: TypeScript errors
- **Solution**: Run `npm run type-check` and fix type errors

**Error**: Build timeout
- **Solution**: Increase build timeout in Vercel settings or optimize build

### Application Errors

**Error**: Database connection failed
- **Solution**: Verify Supabase credentials and network access

**Error**: Rate limiting not working
- **Solution**: Verify Upstash Redis credentials are set

**Error**: Emails not sending
- **Solution**: Verify Resend API key and domain verification

### Performance Issues

- Enable Vercel Analytics
- Check database query performance
- Optimize images (already configured with Cloudinary)
- Enable CDN caching
- Review bundle size with `npm run build -- --analyze`

## Rollback Procedures

### Vercel Rollback

1. Go to Vercel dashboard
2. Navigate to "Deployments"
3. Find previous working deployment
4. Click "..." menu > "Promote to Production"

### Custom Server Rollback

1. Checkout previous version:
   ```bash
   git checkout <previous-commit-hash>
   ```

2. Rebuild and restart:
   ```bash
   npm run build
   pm2 restart dansarp-herbal
   ```

### Database Rollback

If database changes need to be rolled back:
1. Use Supabase PITR to restore to previous point
2. Or manually revert migration SQL

## Performance Optimization

### 1. Image Optimization

Images are automatically optimized via:
- Next.js Image component
- Cloudinary (if configured)
- AVIF/WebP formats

### 2. Caching

- Static pages are cached automatically
- API routes have cache headers configured
- Use Vercel Edge Network for global CDN

### 3. Database Optimization

- Enable connection pooling in Supabase
- Add database indexes for frequently queried columns
- Use Supabase query optimization features

### 4. Bundle Size

- Code splitting is automatic with Next.js
- Dynamic imports for heavy components
- Tree shaking enabled

## Security Best Practices

1. **Never commit `.env.local`** - Already in `.gitignore`
2. **Rotate secrets regularly** - Especially API keys and CSRF secret
3. **Enable 2FA** on all service accounts
4. **Monitor for security vulnerabilities**:
   ```bash
   npm audit
   ```
5. **Keep dependencies updated**:
   ```bash
   npm outdated
   npm update
   ```

## Support

For issues or questions:
- Check [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- Review [API.md](./API.md) for API documentation
- Check application logs in Sentry
- Review health check endpoint for system status

## Next Steps

After successful deployment:
1. Set up monitoring alerts
2. Configure backup schedules
3. Set up staging environment for testing
4. Document any custom configurations
5. Train team on deployment procedures
