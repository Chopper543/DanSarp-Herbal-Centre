# DanSarp Herbal Centre - Full Production Platform

A comprehensive, production-ready web platform for DanSarp Herbal Centre, built with Next.js 16.1.1, Supabase, and modern web technologies.

## Features

- **Ultra-Modern Landing Page** with parallax effects, botanical particles, and smooth animations
- **Doctor & Events Gallery** with admin upload and public display
- **Achievements & Certifications** timeline
- **User Accounts & Reviews** with admin moderation
- **Appointment Booking** with real-time scheduling and notifications
- **Patient Testimonies** with image, audio, and video support
- **Herbal Clinic Gallery** showcasing facilities
- **Treatment & Pricing Directory** with structured pricing
- **Organization Profile** with mission, vision, and values
- **Contact & Communication** with WhatsApp integration
- **Branch Locations** with interactive maps
- **CMS Blog** for articles and health tips
- **Multi-Rail Payment System** for Ghana (Paystack, Flutterwave, Mobile Money)
- **Comprehensive Admin Dashboard** with RBAC

## Tech Stack

- **Framework:** Next.js 16.1.1 (App Router, React Server Components)
- **Styling:** TailwindCSS
- **Animations:** Framer Motion, Three.js
- **Database & Auth:** Supabase (PostgreSQL, Storage, Auth)
- **Media Optimization:** Cloudinary
- **Email:** Resend
- **WhatsApp:** Twilio WhatsApp API
- **Payments:** Paystack, Flutterwave, Custom Ghana payment rails
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Cloudinary account (optional)
- Resend account
- Twilio account (for WhatsApp)
- Payment provider accounts (Paystack/Flutterwave)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd dansarp-herbal-centre
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Fill in your environment variables in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
RESEND_API_KEY=your_resend_api_key
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
VONAGE_API_KEY=your_vonage_api_key
VONAGE_API_SECRET=your_vonage_api_secret
VONAGE_FROM_NUMBER=your_vonage_phone_number_or_brand_name
# ... and other variables
```

4. Set up Supabase database:
   - Create a new Supabase project
   - Run the migrations in `supabase/migrations/` in order:
     - `001_initial_schema.sql`
     - `002_rls_policies.sql`
     - `003_triggers.sql`

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
dansarp-herbal-centre/
├── app/                    # Next.js App Router
│   ├── (public)/          # Public routes
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # User dashboard
│   ├── (admin)/           # Admin routes
│   └── api/               # API routes
├── components/            # React components
├── lib/                   # Utility libraries
├── types/                 # TypeScript types
├── supabase/             # Database migrations
└── public/               # Static assets
```

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy

The project is configured for Vercel deployment with `vercel.json`.

## Security

- Row Level Security (RLS) enabled on all Supabase tables
- Role-based access control (RBAC) for admin routes
- Invite-only admin system
- Payment webhook signature verification
- Input validation and sanitization

## License

Copyright © 2025 DanSarp Herbal Centre. All rights reserved.
