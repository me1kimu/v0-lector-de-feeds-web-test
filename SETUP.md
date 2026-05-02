# FeedReader - Setup Instructions

## Prerequisites

- Node.js 18+ and pnpm
- Supabase account with project created
- Environment variables configured in Vercel

## Environment Variables

Add these to your `.env.local` and Vercel project settings:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret_key_min_32_chars
NEXT_PUBLIC_ORIGIN=http://localhost:3000
```

## Database Setup

1. **Initialize Supabase Schema**:
   - Go to your Supabase project
   - Open the SQL Editor
   - Copy the contents of `lib/schema.sql`
   - Execute the SQL to create tables and RLS policies

2. **Verify Schema**:
   - Tables created: `users`, `passkeys`, `email_auth`, `feed_sources`, `encrypted_credentials`
   - All tables have RLS policies enabled

## Deployment Checklist

### Security
- [ ] Change `JWT_SECRET` to a strong random string (min 32 chars)
- [ ] Set `NODE_ENV=production` in Vercel
- [ ] Enable HTTPS only (Vercel default)
- [ ] Verify Supabase RLS policies are active

### Authentication
- [ ] Test passkey registration on your device
- [ ] Test email/password backup authentication
- [ ] Verify session cookies are httpOnly and secure
- [ ] Test logout functionality

### Data Encryption
- [ ] Verify credentials are encrypted before storage
- [ ] Test migration from local storage to Supabase
- [ ] Confirm encrypted data is unreadable in database

### PWA & Service Worker
- [ ] Test app can be installed
- [ ] Test offline mode with cached content
- [ ] Verify background sync works
- [ ] Test push notifications

## Troubleshooting

### Passkey Registration Fails
- Ensure browser supports WebAuthn (check device/OS compatibility)
- Verify Supabase is accessible
- Check browser console for specific error messages

### Session Cookie Issues
- Verify JWT_SECRET is set and matches on client/server
- Ensure cookies are enabled in browser
- Check Secure flag is appropriate for environment

### Data Not Syncing to Supabase
- Verify user session exists
- Check Supabase RLS policies allow user access
- Review API response for encryption errors

### Encryption/Decryption Errors
- Verify passphrase is consistent across requests
- Check that encrypted data format is valid JSON
- Ensure credentials are stringified before encryption

## Passkey Details

### Registration Flow
1. User enters email and passkey details
2. Server generates registration challenge
3. Browser's WebAuthn API prompts user for biometric/PIN
4. Credential created and stored in browser's secure enclave
5. Public key registered with backend, counter verified

### Authentication Flow
1. User enters email or selects account
2. Server generates authentication challenge
3. Browser's WebAuthn API prompts for biometric/PIN
4. User authorizes and sends signed assertion
5. Server verifies signature and updates counter
6. Session created if counter is valid (prevents cloning)

### Fallback Email Authentication
- Available if passkeys unavailable
- Uses bcrypt hashing with salt
- Session-based, same flow as passkey auth

## Managing Feed Sources

### From Settings Panel
1. Click "Agregar fuente"
2. Select source type (RSS, Mastodon, Bluesky, Twitter, Instagram)
3. Enter required credentials/handles
4. Set update frequency (default 3600 seconds)
5. Save - sources synced to Supabase

### Encrypted Credentials
- User credentials encrypted with AES-256-GCM
- Each user has their own encryption key
- Keys never sent to server
- Decryption happens client-side only

## Monitoring

### User Session Activity
```sql
SELECT user_id, last_seen, created_at 
FROM users 
ORDER BY last_seen DESC;
```

### Feed Update History
```sql
SELECT source_id, updated_at, status 
FROM feed_sources 
WHERE user_id = '[user_id]'
ORDER BY updated_at DESC;
```

### Passkey Security
```sql
SELECT id, user_id, name, counter 
FROM passkeys 
ORDER BY created_at DESC;
```

## Support

For issues with:
- **Supabase**: Visit https://supabase.com/docs
- **WebAuthn**: See https://webauthn.io
- **NextJS**: Check https://nextjs.org/docs
