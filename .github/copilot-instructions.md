# DanSarp Herbal Centre - AI Coding Guidelines

## Architecture Overview
This is a Next.js 16.1.1 healthcare management platform using Supabase as the backend. The app manages appointments, clinical records, payments, and patient communications for a herbal clinic.

**Key Components:**
- **Frontend:** Next.js App Router with React Server Components
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Styling:** TailwindCSS with Framer Motion animations
- **Payments:** Paystack/Flutterwave (Ghana-focused)
- **Communications:** Twilio WhatsApp, SMS, Resend email
- **Media:** Cloudinary for image optimization
- **Monitoring:** Sentry error tracking
- **Deployment:** Vercel with pre-deployment validation

## Data Flow & Service Boundaries
- **Authentication:** Supabase Auth with custom RBAC (super_admin, admin, doctor, nurse, patient roles)
- **API Routes:** All business logic in `app/api/` - appointments, clinical notes, payments, etc.
- **Database:** Row Level Security (RLS) enabled on all tables
- **File Structure:** `app/(public|auth|dashboard|admin)/` for route groups, `components/` by feature, `lib/` for utilities

## Critical Developer Workflows

### Environment Setup
```bash
cp .env.example .env.local
npm run validate:env  # Check required variables
npm run setup:google-maps  # Configure Google Maps API
```

### Database & Migrations
- Migrations in `supabase/migrations/` - run in order
- Use `lib/supabase/client.ts` (browser) or `server.ts` (SSR)
- Always check RLS policies for data access

### Testing & Quality
```bash
npm run type-check    # TypeScript validation
npm run lint         # ESLint checks
npm run test         # Jest unit tests
npm run test:e2e     # Playwright E2E tests
npm run pre-deploy   # Production readiness checks
```

### Role-Based Access Control
Use `lib/auth/rbac.ts` functions:
```typescript
import { isClinicalStaff, hasRole } from '@/lib/auth/rbac'

// Check permissions before API operations
if (!isClinicalStaff(userRole)) return unauthorized()
```

## Project-Specific Patterns

### API Route Structure
```typescript
// app/api/appointments/route.ts
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/rbac'

export async function GET() {
  const supabase = await createClient()
  const userRole = await getUserRole()
  // Business logic with RBAC checks
}
```

### Component Organization
- `components/ui/` - Reusable UI components
- `components/dashboard/` - Patient dashboard components
- `components/admin/` - Admin-specific components
- `components/features/` - Feature-specific components

### Error Handling
- Use Sentry for error tracking (`lib/monitoring/`)
- Validate inputs with Zod schemas
- Sanitize HTML content with DOMPurify
- Rate limiting via Upstash Redis

### Payment Integration
- Webhooks in `app/api/webhooks/` with signature verification
- Payment ledger tracking in `payment-ledger` table
- Support for multiple Ghanaian payment methods

### Notifications
- WhatsApp via Twilio (`lib/whatsapp/`)
- SMS via Vonage (`lib/sms/`)
- Email via Resend (`lib/email/`)

## Key Files to Reference
- `types/database.ts` - Complete database schema types
- `lib/auth/rbac.ts` - Role-based access control utilities
- `lib/config/env-validation.ts` - Environment variable validation
- `supabase/migrations/` - Database schema evolution
- `scripts/validate-env.ts` - Environment setup validation
- `docs/IMPLEMENTATION_SUMMARY.md` - Security and production features

## Common Pitfalls to Avoid
- Forgetting RLS policies when adding new database operations
- Not checking user roles before sensitive operations
- Missing environment variable validation in production
- Not sanitizing user-generated HTML content
- Bypassing rate limiting on new API endpoints</content>
<parameter name="filePath">/Users/danieldampare/DanSarp Herbal Centre/.github/copilot-instructions.md