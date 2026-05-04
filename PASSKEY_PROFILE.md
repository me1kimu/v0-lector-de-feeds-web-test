# Passkey Management Profile Feature

## Overview
The passkey management feature allows users to securely manage their WebAuthn/Passkey credentials from their user profile page at `/profile`.

## Features

### Add Passkey
Users can register new passkeys through the "Add Passkey" button:
1. Opens a dialog with optional device name input
2. Triggers the WebAuthn registration flow
3. Uses the device's biometric or security method (Face ID, Touch ID, Windows Hello, etc.)
4. Stores the passkey securely in the database

### View Passkeys
Users can see all their registered passkeys with:
- Device name
- Creation date
- Last used date (if applicable)
- List of authentication transports

### Delete Passkey
Users can remove passkeys they no longer need:
- Click the delete button on any passkey
- Passkey is immediately removed from the database
- User is logged out if they delete their only authentication method

## Technical Details

### API Endpoints

#### GET `/api/user/passkeys`
Retrieves all passkeys for the authenticated user.

**Response:**
```json
{
  "passkeys": [
    {
      "id": "uuid",
      "device_name": "iPhone 15",
      "created_at": "2026-05-04T10:30:00Z",
      "last_used_at": "2026-05-04T14:20:00Z",
      "transports": ["internal", "ble"]
    }
  ]
}
```

#### DELETE `/api/user/passkeys`
Removes a specific passkey by ID.

**Request:**
```json
{
  "credentialId": "uuid"
}
```

#### GET `/api/user/profile`
Retrieves the user's profile information.

**Response:**
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "displayName": "John Doe",
  "createdAt": "2026-01-01T00:00:00Z"
}
```

#### POST `/api/auth/logout`
Signs out the current user session.

### Database Tables

#### passkey_credentials
- `id`: UUID - Primary key
- `user_id`: UUID - Foreign key to users table
- `credential_id`: String - Unique credential identifier
- `credential_public_key`: String - Base64 encoded public key
- `counter`: Integer - Counter for cloned credential detection
- `transports`: Array - Authentication transports available
- `device_name`: String - User-friendly device name
- `created_at`: Timestamp - When passkey was registered
- `last_used_at`: Timestamp - Last authentication time

#### passkey_challenges
- `id`: UUID - Primary key
- `user_id`: UUID - Foreign key to users table
- `challenge`: String - WebAuthn challenge
- `challenge_type`: String - 'registration' or 'authentication'
- `created_at`: Timestamp - Challenge creation time
- `expires_at`: Timestamp - Challenge expiration (10 minutes)

### Row Level Security (RLS)
- Users can only read their own passkeys
- Users can only insert passkeys for their own account
- Users can only update their own passkeys
- Users can only delete their own passkeys

## Components

### PasskeyManager (`components/profile/passkey-manager.tsx`)
Main client component for passkey management:
- Displays list of registered passkeys
- Provides add passkey dialog
- Handles deletion with confirmation
- Shows loading states and error messages
- Integrates with WebAuthn utilities

### Profile Page (`app/profile/page.tsx`)
User profile page containing:
- Account information section
- PasskeyManager component
- Sign out functionality
- Protected route (redirects to login if unauthorized)

## Usage Flow

1. **User navigates to profile**: Clicks "Perfil" in header dropdown
2. **Page loads**: Fetches user profile and existing passkeys
3. **Add passkey**: 
   - User clicks "Add Passkey"
   - Enters optional device name
   - Clicks "Register Passkey"
   - Device prompts for biometric/security verification
   - Passkey is registered and stored
4. **View passkeys**: User can see all their registered passkeys
5. **Delete passkey**: User can remove any passkey with delete button

## Error Handling
- Invalid/expired challenges
- Failed credential verification
- Missing required fields
- Unauthorized access attempts
- Database errors

All errors are logged and displayed to the user with appropriate toast notifications.

## Security Considerations
- WebAuthn handles all cryptographic operations
- Public keys only stored, not private keys
- Challenges expire after 10 minutes
- Counter-based cloned credential detection
- RLS policies enforce data isolation
- HTTPS required for WebAuthn in production

## Future Enhancements
- [ ] Rename passkey after registration
- [ ] Last used date tracking and display
- [ ] Passkey backup codes
- [ ] Account recovery options
- [ ] Admin passkey management
- [ ] Session management (view active sessions)
