# API Documentation

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://dansarpherbal.com`

## Authentication

Most endpoints require authentication via Supabase. Include the session cookie in requests.

## Rate Limiting

API routes are rate-limited:
- **Auth endpoints**: 5 requests per 60 seconds
- **Payment endpoints**: 10 requests per 60 seconds
- **Newsletter**: 3 requests per 60 seconds
- **General API**: 30 requests per 60 seconds

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Response Format

### Success Response
```json
{
  "data": {...},
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### Error Response
```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

## Endpoints

### Health Check

#### GET `/api/health`

Check application health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-26T12:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0",
  "database": "healthy"
}
```

---

### Authentication

#### POST `/api/auth/2fa/generate`

Generate 2FA QR code for user.

**Requires**: Authentication

**Env required**: `TWO_FA_ENC_KEY` (≥32 chars) for encrypting TOTP secrets and hashing backup codes.

**Response:**
```json
{
  "secret": "base32_secret",
  "qrCode": "data:image/png;base64,..."
}
```

#### POST `/api/auth/2fa/verify`

Verify 2FA setup.

**Body:**
```json
{
  "code": "123456"
}
```

#### POST `/api/auth/2fa/verify-login`

Verify 2FA during login.

**Body:**
```json
{
  "code": "123456"
}
```

#### POST `/api/auth/2fa/disable`

Disable 2FA for user.

**Requires**: Authentication

---

### Appointments

#### GET `/api/appointments`

Get user's appointments.

**Requires**: Authentication

**Query Parameters:**
- `status` (optional): Filter by status
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response:**
```json
{
  "appointments": [...],
  "pagination": {...}
}
```

#### POST `/api/appointments`

Create new appointment.

**Requires**: Authentication (User role only)

**Body:**
```json
{
  "branch_id": "uuid",
  "appointment_date": "2025-01-30T10:00:00Z",
  "treatment_type": "consultation",
  "notes": "Optional notes",
  "payment_id": "payment_uuid"
}
```

---

### Payments

#### GET `/api/payments`

Get user's payments.

**Requires**: Authentication

**Query Parameters:**
- `status` (optional): Filter by status
- `page` (optional): Page number

#### POST `/api/payments`

Create payment.

**Requires**: Authentication

**Body:**
```json
{
  "amount": 100,
  "currency": "GHS",
  "payment_method": "paystack|flutterwave|mtn_momo|vodafone_cash|airteltigo|bank_transfer",
  "provider": "paystack|flutterwave|custom",
  "phone_number": "0244123456", // For mobile money
  "appointment_data": {
    "branch_id": "uuid",
    "appointment_date": "2025-01-30T10:00:00Z",
    "treatment_type": "consultation",
    "notes": "Optional"
  }
}
```

#### GET `/api/payments/[id]/receipt`

Get payment receipt PDF.

**Requires**: Authentication

---

### Reviews

#### GET `/api/reviews`

Get reviews.

**Query Parameters:**
- `approved` (optional): Filter by approval status (default: true)
- `page` (optional): Page number
- `limit` (optional): Items per page

#### POST `/api/reviews`

Create review.

**Requires**: Authentication (User role only)

**Body:**
```json
{
  "rating": 5,
  "title": "Great service",
  "content": "Review content"
}
```

#### PATCH `/api/reviews`

Update review (approve/reject).

**Requires**: Authentication (Admin role)

**Body:**
```json
{
  "id": "review_id",
  "is_approved": true,
  "admin_notes": "Optional notes"
}
```

---

### Blog

#### GET `/api/blog`

Get blog posts.

**Query Parameters:**
- `slug` (optional): Get single post by slug
- `include_drafts` (optional): Include draft posts (admin only)
- `status` (optional): Filter by status
- `page` (optional): Page number
- `limit` (optional): Items per page

#### POST `/api/blog`

Create blog post.

**Requires**: Authentication (Admin role)

**Body:**
```json
{
  "title": "Post Title",
  "slug": "post-slug",
  "excerpt": "Short excerpt",
  "content": "Full content",
  "featured_image_url": "https://...",
  "status": "draft|published"
}
```

---

### Gallery

#### GET `/api/gallery`

Get gallery items.

**Query Parameters:**
- `id` (optional): Get single item by ID
- `type` (optional): Filter by type
- `page` (optional): Page number
- `limit` (optional): Items per page

#### POST `/api/gallery`

Create gallery item.

**Requires**: Authentication (Admin role)

**Body:**
```json
{
  "type": "doctor|event|facility",
  "title": "Item Title",
  "description": "Description",
  "image_urls": ["https://..."],
  "video_url": "https://...",
  "is_featured": false
}
```

---

### Testimonials

#### GET `/api/testimonials`

Get testimonials.

**Query Parameters:**
- `id` (optional): Get single testimonial by ID
- `approved` (optional): Filter by approval (default: true)
- `page` (optional): Page number
- `limit` (optional): Items per page

#### POST `/api/testimonials`

Create testimonial.

**Requires**: Authentication (Admin role)

**Body:**
```json
{
  "patient_name": "Patient Name",
  "content": "Testimonial content",
  "media_type": "image|audio|video",
  "media_url": "https://...",
  "is_approved": false
}
```

---

### Treatments

#### GET `/api/treatments`

Get treatments.

**Query Parameters:**
- `id` (optional): Get single treatment by ID
- `slug` (optional): Get single treatment by slug
- `include_inactive` (optional): Include inactive treatments

#### POST `/api/treatments`

Create treatment.

**Requires**: Authentication (Admin role)

**Body:**
```json
{
  "name": "Treatment Name",
  "slug": "treatment-slug",
  "description": "Description",
  "condition_type": "condition",
  "pricing": {
    "consultation": 100,
    "follow_up": 50
  },
  "is_active": true
}
```

---

### Branches

#### GET `/api/branches`

Get branches.

**Query Parameters:**
- `id` (optional): Get single branch by ID

#### POST `/api/branches`

Create branch.

**Requires**: Authentication (Admin role)

---

### Messages

#### GET `/api/messages`

Get user messages.

**Requires**: Authentication

**Query Parameters:**
- `conversation_id` (optional): Filter by conversation

#### POST `/api/messages`

Send message.

**Requires**: Authentication

**Body:**
```json
{
  "recipient_id": "user_id",
  "content": "Message content"
}
```

---

### Newsletter

#### POST `/api/newsletter`

Subscribe to newsletter.

**Body:**
```json
{
  "email": "user@example.com"
}
```

#### GET `/api/newsletter`

Get subscribers (Admin only).

**Requires**: Authentication (Admin role)

---

### Profile

#### GET `/api/profile`

Get user profile.

**Requires**: Authentication

**Query Parameters:**
- `user_id` (optional): Get specific user profile (own profile or admin)

#### PUT `/api/profile`

Update profile.

**Requires**: Authentication

**Body:**
```json
{
  "full_name": "Full Name",
  "phone": "+233244123456",
  "date_of_birth": "1990-01-01",
  "address": "Address"
}
```

#### POST `/api/profile/avatar`

Upload avatar.

**Requires**: Authentication

**Body:** FormData with `file` field

---

### Organization

#### GET `/api/organization`

Get organization profile.

#### POST `/api/organization`

Update organization profile.

**Requires**: Authentication (Admin role)

---

### Webhooks

#### POST `/api/webhooks/payments`

Payment webhook handler.

**Headers:**
- `x-provider`: `paystack|flutterwave`
- `x-paystack-signature`: Signature (for Paystack)
- `verif-hash`: Signature (for Flutterwave)

---

## Error Codes

- `400`: Bad Request - Invalid input
- `401`: Unauthorized - Authentication required
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource not found
- `413`: Payload Too Large - Request body too large
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error - Server error
- `503`: Service Unavailable - Service degraded
