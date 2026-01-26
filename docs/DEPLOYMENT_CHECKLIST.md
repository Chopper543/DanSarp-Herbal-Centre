# Pre-Deployment Checklist

Use this checklist before every production deployment to ensure everything is ready.

## Environment Variables

### Required Variables
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Set and valid
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Set and valid
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Set and valid (keep secret!)
- [ ] `NEXT_PUBLIC_SITE_URL` - Set to production domain
- [ ] `CSRF_SECRET` - Set (32+ characters, random)
- [ ] `NODE_ENV` - Set to `production`

### Recommended Variables
- [ ] `NEXT_PUBLIC_SENTRY_DSN` - Error monitoring configured
- [ ] `UPSTASH_REDIS_REST_URL` - Rate limiting configured
- [ ] `UPSTASH_REDIS_REST_TOKEN` - Rate limiting token set
- [ ] `RESEND_API_KEY` - Email service configured
- [ ] `PAYSTACK_SECRET_KEY` or `FLUTTERWAVE_SECRET_KEY` - Payment processing configured
- [ ] `CLOUDINARY_CLOUD_NAME` - Media optimization (optional)
- [ ] `NEXT_PUBLIC_GA_ID` or `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` - Analytics configured

### Validation
- [ ] Run `npm run validate:env:strict` - All checks pass
- [ ] No warnings for critical production variables

## Code Quality

- [ ] Type checking passes: `npm run type-check`
- [ ] Linting passes: `npm run lint`
- [ ] No TypeScript errors
- [ ] No ESLint errors or warnings
- [ ] All tests pass (if applicable): `npm test`

## Build & Deployment

- [ ] Production build succeeds: `npm run build`
- [ ] No build warnings or errors
- [ ] Bundle size is acceptable
- [ ] All environment variables are set in deployment platform
- [ ] Build command configured correctly
- [ ] Output directory configured correctly

## Database

- [ ] All migrations applied to production database
- [ ] Database schema matches expected structure
- [ ] Row Level Security (RLS) policies are active
- [ ] Database backups are configured
- [ ] Connection pooling is enabled (Supabase handles this)
- [ ] Test database connection works

## Security

- [ ] Security headers are configured (CSP, X-Frame-Options, etc.)
- [ ] Rate limiting is configured and working
- [ ] CSRF protection is enabled
- [ ] Input sanitization is in place
- [ ] Webhook signature verification is working
- [ ] HTTPS is enforced
- [ ] No sensitive data in code or logs
- [ ] API keys are stored securely (not in code)

## Monitoring & Logging

- [ ] Sentry error monitoring is configured
- [ ] Health check endpoint is accessible: `/api/health`
- [ ] Uptime monitoring is set up
- [ ] Logging is configured for production
- [ ] Alerts are configured for critical errors
- [ ] Analytics tracking is set up (if applicable)

## Performance

- [ ] Image optimization is configured
- [ ] Static assets are being cached
- [ ] CDN is configured (Vercel Edge Network)
- [ ] Database queries are optimized
- [ ] No performance regressions detected

## Functionality Testing

### Core Features
- [ ] Homepage loads correctly
- [ ] User registration works
- [ ] User login works
- [ ] Password reset works
- [ ] Email verification works

### Appointment System
- [ ] Appointment booking works
- [ ] Appointment confirmation emails sent
- [ ] Appointment reminders work
- [ ] Appointment cancellation works

### Payment System
- [ ] Payment processing works
- [ ] Payment webhooks are verified
- [ ] Payment receipts are generated
- [ ] Payment status updates correctly

### Admin Features
- [ ] Admin login works
- [ ] Admin dashboard accessible
- [ ] Content management works
- [ ] User management works
- [ ] Audit logs are working

### Public Features
- [ ] Blog posts display correctly
- [ ] Gallery images load
- [ ] Testimonials display
- [ ] Contact form works
- [ ] Google Maps embed works

## Pre-Deployment Script

Run the automated pre-deployment check:

```bash
npm run pre-deploy
```

- [ ] All automated checks pass
- [ ] No errors in pre-deployment output
- [ ] Ready to deploy message shown

## Documentation

- [ ] README.md is up to date
- [ ] API documentation is current
- [ ] Deployment procedures are documented
- [ ] Environment variables are documented
- [ ] Rollback procedures are documented

## Backup & Recovery

- [ ] Database backup strategy is in place
- [ ] Backup restoration procedure is tested
- [ ] Rollback plan is documented
- [ ] Previous deployment can be restored if needed

## Communication

- [ ] Team is notified of deployment
- [ ] Maintenance window scheduled (if needed)
- [ ] Stakeholders are informed
- [ ] Support team is ready

## Post-Deployment Verification

After deployment, verify:

- [ ] Application is accessible
- [ ] Health check returns `healthy` status
- [ ] No errors in Sentry
- [ ] All critical features work
- [ ] Performance is acceptable
- [ ] Monitoring is active
- [ ] No security warnings

## Emergency Contacts

- [ ] DevOps contact information available
- [ ] Database admin contact available
- [ ] Service provider support contacts available
- [ ] On-call engineer contact available

## Sign-Off

- [ ] All checklist items completed
- [ ] Pre-deployment script passed
- [ ] Ready for production deployment
- [ ] Deployment approved by: _________________

## Quick Reference Commands

```bash
# Validate environment
npm run validate:env:strict

# Run all checks
npm run pre-deploy

# Type check
npm run type-check

# Lint
npm run lint

# Build
npm run build

# Test health endpoint (after deployment)
curl https://your-domain.com/api/health
```

## Notes

- Keep this checklist updated as new requirements are added
- Review and update before each major deployment
- Document any deviations or exceptions
- Store completed checklists for audit purposes
