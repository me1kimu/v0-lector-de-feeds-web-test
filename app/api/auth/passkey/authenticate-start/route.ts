import { NextRequest, NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || 'localhost'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Find user by email
    const { data: userData, error: userError } = await supabase
      .from('email_auth')
      .select('user_id')
      .eq('email', email)
      .single()

    if (userError || !userData) {
      // Don't reveal if user exists for security
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const userId = userData.user_id

    // Get user's passkey credentials
    const { data: credentials, error: credError } = await supabase
      .from('passkey_credentials')
      .select('credential_id, transports')
      .eq('user_id', userId)

    if (credError || !credentials || credentials.length === 0) {
      return NextResponse.json(
        { error: 'No passkeys registered for this account' },
        { status: 401 }
      )
    }

    // Generate challenge
    const challenge = crypto.randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    const { error: challengeError } = await supabase
      .from('passkey_challenges')
      .insert({
        user_id: userId,
        challenge,
        challenge_type: 'authentication',
        expires_at: expiresAt.toISOString()
      })

    if (challengeError) {
      console.error('[v0] Challenge creation error:', challengeError)
      return NextResponse.json(
        { error: 'Failed to create authentication challenge' },
        { status: 500 }
      )
    }

    // Generate WebAuthn authentication options
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: credentials.map(cred => ({
        id: Buffer.from(cred.credential_id, 'base64url'),
        type: 'public-key' as const,
        transports: cred.transports as any[]
      })),
      userVerification: 'preferred'
    })

    return NextResponse.json({
      options,
      challenge: options.challenge,
      userId
    })
  } catch (error) {
    console.error('[v0] Authentication start error:', error)
    return NextResponse.json(
      { error: 'Failed to start authentication' },
      { status: 500 }
    )
  }
}
