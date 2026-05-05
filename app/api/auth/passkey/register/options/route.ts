import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { base64urlEncode } from '@/lib/encryption'

export async function POST(request: NextRequest) {
  try {
    const { email, displayName } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Generate a random challenge
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const challengeBase64 = base64urlEncode(challenge.buffer)

    // Generate a random user ID for the passkey
    const userId = crypto.getRandomValues(new Uint8Array(16))
    const userIdBase64 = base64urlEncode(userId.buffer)

    // Store the challenge temporarily (expires in 5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    
    // Use service role to bypass RLS for challenge storage
    const { error: challengeError } = await supabase
      .from('webauthn_challenges')
      .insert({
        challenge: challengeBase64,
        type: 'registration',
        expires_at: expiresAt,
      })

    if (challengeError) {
      console.error('Challenge storage error:', challengeError)
      return NextResponse.json(
        { error: 'Failed to create registration challenge' },
        { status: 500 }
      )
    }

    // Get existing passkeys for this email (if user exists)
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    let excludeCredentials: Array<{ id: string; type: 'public-key' }> = []

    if (existingUser) {
      const { data: existingPasskeys } = await supabase
        .from('passkeys')
        .select('credential_id')
        .eq('user_id', existingUser.id)

      excludeCredentials = (existingPasskeys || []).map((pk) => ({
        id: pk.credential_id,
        type: 'public-key' as const,
      }))
    }

    // Get RP ID - use localhost for development, otherwise extract registrable domain
    const requestUrl = new URL(request.url)
    const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host') || requestUrl.hostname
    const urlHostname = hostHeader.split(':')[0]
    
    const rpId = urlHostname === 'localhost' || urlHostname.includes('127.0.0.1')
      ? 'localhost'
      : urlHostname // For vusercontent.net or production domains
    
    // Return registration options
    const options = {
      challenge: challengeBase64,
      rp: {
        name: 'FeedReader',
        id: rpId,
      },
      user: {
        id: userIdBase64,
        name: email,
        displayName: displayName || email.split('@')[0],
      },
      pubKeyCredParams: [
        { type: 'public-key' as const, alg: -7 },  // ES256
        { type: 'public-key' as const, alg: -257 }, // RS256
      ],
      timeout: 60000,
      attestation: 'none' as const,
      authenticatorSelection: {
        authenticatorAttachment: 'platform' as const,
        userVerification: 'preferred' as const,
        residentKey: 'preferred' as const,
      },
      excludeCredentials,
    }

    return NextResponse.json(options)
  } catch (error) {
    console.error('Registration options error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
