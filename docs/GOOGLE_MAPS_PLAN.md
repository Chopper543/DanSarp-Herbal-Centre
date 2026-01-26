# Add Google Maps Embed Plan

## Overview
Add an embedded Google Maps component to display the clinic's main location on the contact page to help visitors easily find the clinic.

## Current State
- Contact page has address "Oframase New Road, Nkawkaw" but no map
- Branches page has links to Google Maps but no embedded map
- Database has branch coordinates stored (Nkawkaw: POINT(-0.7667, 6.5500))
- No Google Maps iframe or embed component exists

## Implementation Plan

### 1. Create Google Maps Component
- **File to create**: `components/features/GoogleMap.tsx`
- **Features**:
  - Embedded Google Maps iframe
  - Support for coordinates (lat/lng) or address
  - Responsive design
  - Loading state
  - Error handling

### 2. Update Contact Page
- **File to modify**: `app/(public)/contact/page.tsx`
- **Changes**:
  - Fetch main branch coordinates from database (or use default Nkawkaw coordinates)
  - Add Google Maps component below contact information
  - Make it responsive (full width on mobile, side-by-side on desktop)
  - Add "Get Directions" button

### Default Location
- **Main Clinic**: Nkawkaw Branch
- **Coordinates**: lat: 6.5500, lng: -0.7667
- **Address**: "Oframase New Road, Nkawkaw"

## Implementation Approach

### Simple iframe embed (No API key required)
- Use Google Maps embed URL with coordinates
- Format: `https://www.google.com/maps/embed?pb=...` or direct coordinates
- Alternative: `https://www.google.com/maps?q=lat,lng&output=embed`
