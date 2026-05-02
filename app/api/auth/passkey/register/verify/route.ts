import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { base64urlDecode, bufferToBase64 } from '@/lib/encryption'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { credential, email, displayName, challenge } = await request.json()

    if (!credential || !email || !challenge) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify the challenge exists and hasn't expired
    const { data: storedChallenge, error: challengeError } = await supabase
      .from('webauthn_challenges')
      .select('*')
      .eq('challenge', challenge)
      .eq('type', 'registration')
      .single()

    if (challengeError || !storedChallenge) {
      return NextResponse.json(
        { error: 'Invalid or expired challenge' },
        { status: 400 }
      )
    }

    if (new Date(storedChallenge.expires_at) < new Date()) {
      await supabase
        .from('webauthn_challenges')
        .delete()
        .eq('id', storedChallenge.id)
      
      return NextResponse.json(
        { error: 'Challenge expired' },
        { status: 400 }
      )
    }

    // Delete the used challenge
    await supabase
      .from('webauthn_challenges')
      .delete()
      .eq('id', storedChallenge.id)

    // Parse the client data to verify the challenge
    const clientDataJSON = JSON.parse(
      new TextDecoder().decode(base64urlDecode(credential.response.clientDataJSON))
    )

    if (clientDataJSON.challenge !== challenge) {
      return NextResponse.json(
        { error: 'Challenge mismatch' },
        { status: 400 }
      )
    }

    if (clientDataJSON.type !== 'webauthn.create') {
      return NextResponse.json(
        { error: 'Invalid credential type' },
        { status: 400 }
      )
    }

    // Extract public key from attestation object (simplified - in production use a proper library)
    const attestationObject = base64urlDecode(credential.response.attestationObject)
    
    // Create user in Supabase Auth
    // We use email + random password since passkey is the primary auth method
    const randomPassword = bufferToBase64(crypto.getRandomValues(new Uint8Array(32)))
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: randomPassword,
      options: {
        data: {
          display_name: displayName || email.split('@')[0],
          auth_method: 'passkey',
        },
      },
    })

    if (authError) {
      // Check if user already exists
      if (authError.message.includes('already registered')) {
        return NextResponse.json(
          { error: 'Email already registered. Please sign in instead.' },
          { status: 400 }
        )
      }
      console.error('Auth signup error:', authError)
      return NextResponse.json(
        { error: 'Failed to create account' },
        { status: 500 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Store the passkey credential (using service role via API)
    // We need to use the admin client or handle this carefully with RLS
    const { error: passkeyError } = await supabase
      .from('passkeys')
      .insert({
        user_id: authData.user.id,
        credential_id: credential.rawId,
        public_key: bufferToBase64(attestationObject),
        counter: 0,
        device_type: credential.authenticatorAttachment || 'platform',
        backed_up: false,
        transports: ['internal'],
      })

    if (passkeyError) {
      console.error('Passkey storage error:', passkeyError)
      // Don't fail the registration, the user can add passkey later
    }

    // Set the session cookie
    const cookieStore = await cookies()
    if (authData.session) {
      cookieStore.set('sb-access-token', authData.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      })
      cookieStore.set('sb-refresh-token', authData.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        displayName: displayName || email.split('@')[0],
      },
      requiresEmailVerification: !authData.session,
    })
  } catch (error) {
    console.error('Registration verify error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
