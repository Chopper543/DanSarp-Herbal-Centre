# Auth email templates — switch to the `token_hash` (verifyOtp) flow

This makes email links (signup confirmation, password reset, magic link, email
change) work **across devices** and survive **email-scanner prefetch**, fixing
`PKCE code verifier not found in storage`.

The app side is already done: a server route at **`/auth/confirm`** calls
`verifyOtp({ token_hash, type })`, sets the session in cookies, and redirects.
You just need to point the email templates at it.

---

## 1. Dashboard → Authentication → URL Configuration
- **Site URL**: your app's canonical URL.
  - Production: `https://your-domain.com`
  - Local dev: `http://localhost:3000`
- **Redirect URLs**: add (one per line)
  ```
  http://localhost:3000/**
  https://your-domain.com/**
  ```
  (`{{ .SiteURL }}` is used directly below, but keep these allowed for the in-app `redirectTo`s.)
  

## 2. Dashboard → Authentication → Email Templates
For each template, replace the link line. The pattern is:
```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<TYPE>&next=<PATH>
```
Only `<TYPE>` and `<PATH>` change per template.

### Confirm signup
Replace the `{{ .ConfirmationURL }}` link with:
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/dashboard">
  Confirm your email
</a>
```

### Reset Password (Recovery)
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">
  Reset your password
</a>
```

### Magic Link (only if you use it)
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/dashboard">
  Log in
</a>
```

### Change Email Address
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/dashboard">
  Confirm your new email
</a>
```

### Invite user (only if you use Supabase invites)
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/dashboard">
  Accept the invite
</a>
```

---

## Notes
- `<TYPE>` **must match** the template — `verifyOtp` validates it. The route accepts:
  `signup`, `recovery`, `magiclink`, `email_change`, `invite`, `email`.
- `<PATH>` is an **app-relative** path (the route rejects absolute/off-site `next` to
  prevent open redirects). Recovery should land on `/reset-password`; everything else
  on `/dashboard` (adjust as you like).
- The in-app `emailRedirectTo` / `redirectTo` values in `signup` and `forgot-password`
  are now harmless leftovers — the **template** controls the link. You can leave them.
- The old client `/auth/callback` page is kept for any OAuth `?code=` flow; email links
  no longer use it once the templates above are in place.

## Quick test after updating templates
1. Sign up with a real inbox, open the confirmation email **on a different device** →
   you should land authenticated on `/dashboard` (this is what used to fail).
2. Forgot password → open the email → you should reach `/reset-password` able to set a
   new password (works even for a 2FA-enrolled account).
3. Click a reset link **twice** → the second click should redirect to `/forgot-password`
   with an "expired link" message, not a crash.
