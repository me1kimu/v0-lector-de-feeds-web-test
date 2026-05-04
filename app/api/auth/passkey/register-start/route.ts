import { NextRequest, NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { supabase } from '@/lib/supabase'
import type { PasskeyRegistrationRequest } from '@/lib/auth-types'
import crypto from 'crypto'

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || 'localhost'
const RP_NAME = 'FeedReader'
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST(request: NextRequest) {
  try {
    const { userId, email, displayName, rpId: bodyRpId } = await request.json()

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'userId and email are required' },
        { status: 400 }
      )
    }

    // Generate a random challenge
    const challenge = crypto.randomBytes(32).toString('base64url')

    // Store challenge in database with expiry (10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    
    const { error: challengeError } = await supabase
      .from('passkey_challenges')
      .insert({
        user_id: userId,
        challenge,
        challenge_type: 'registration',
        expires_at: expiresAt.toISOString()
      })

    if (challengeError) {
      console.error('[v0] Challenge storage error:', challengeError)
      return NextResponse.json(
        { error: 'Failed to create registration challenge' },
        { status: 500 }
      )
    }

    // Generate WebAuthn registration options
    const requestUrl = new URL(request.url)
    const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host') || requestUrl.hostname
    const dynamicRpId = bodyRpId || hostHeader.split(':')[0]

    const options = await generateRegistrationOptions({
      rpID: dynamicRpId,
      rpName: RP_NAME,
      // simplewebauthn v13+ requires userID as bytes (Uint8Array), not string.
      userID: Buffer.from(userId, 'utf8'),
      userName: email,
      userDisplayName: displayName || email,
      attestationType: 'direct',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred'
      },
      supportedAlgorithmIDs: [-7, -257] // ES256 and RS256
    })

    // Update challenge with actual challenge from options
    const { error: updateError } = await supabase
      .from('passkey_challenges')
      .update({ challenge: options.challenge })
      .eq('challenge', challenge)

    if (updateError) {
      console.error('[v0] Challenge update error:', updateError)
    }

    return NextResponse.json({
      options,
      challenge: options.challenge
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[v0] Registration start error: Failed to start passkey registration - ${errorMessage}`)
    return NextResponse.json(
      { error: 'Failed to start passkey registration', details: errorMessage },
      { status: 500 }
    )
  }
}
