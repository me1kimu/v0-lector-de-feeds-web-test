import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || 'localhost'
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST(request: NextRequest) {
  try {
    const { userId, credential, challenge } = await request.json()

    if (!userId || !credential || !challenge) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify challenge
    const { data: challengeData, error: challengeError } = await supabase
      .from('passkey_challenges')
      .select('*')
      .eq('user_id', userId)
      .eq('challenge', challenge)
      .eq('challenge_type', 'authentication')
      .gt('expires_at', new Date().toISOString())
      .single()

    if (challengeError || !challengeData) {
      return NextResponse.json(
        { error: 'Invalid or expired challenge' },
        { status: 400 }
      )
    }

    // Get the credential being used
    const { data: storedCredential, error: credError } = await supabase
      .from('passkey_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('credential_id', credential.id)
      .single()

    if (credError || !storedCredential) {
      return NextResponse.json(
        { error: 'Credential not found' },
        { status: 401 }
      )
    }

    try {
      // Verify the authentication response
      const verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        credential: {
          id: Buffer.from(storedCredential.credential_id, 'base64url'),
          publicKey: Buffer.from(storedCredential.credential_public_key, 'base64'),
          counter: storedCredential.counter,
          transports: storedCredential.transports || []
        }
      })

      if (!verification.verified) {
        return NextResponse.json(
          { error: 'Authentication verification failed' },
          { status: 401 }
        )
      }

      // Check for cloned authenticator (counter should increase)
      if (verification.authenticationInfo && verification.authenticationInfo.newCounter <= storedCredential.counter) {
        console.warn('[v0] Possible cloned authenticator detected for user', userId)
      }

      // Update counter and last used time
      const { error: updateError } = await supabase
        .from('passkey_credentials')
        .update({
          counter: verification.authenticationInfo?.newCounter || storedCredential.counter,
          last_used_at: new Date().toISOString()
        })
        .eq('id', storedCredential.id)

      if (updateError) {
        console.error('[v0] Failed to update credential counter:', updateError)
      }

      // Delete the challenge
      await supabase
        .from('passkey_challenges')
        .delete()
        .eq('id', challengeData.id)

      // Create session
      const token = crypto.randomBytes(32).toString('base64url')
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const { error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: userId,
          token,
          method: 'passkey',
          expires_at: expiresAt.toISOString(),
          ip_address: request.ip,
          user_agent: request.headers.get('user-agent')
        })

      if (sessionError) {
        console.error('[v0] Session creation error:', sessionError)
        return NextResponse.json(
          { error: 'Failed to create session' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        session: {
          token,
          expiresAt: expiresAt.toISOString()
        }
      })
    } catch (verifyError) {
      console.error('[v0] Verification error:', verifyError)
      return NextResponse.json(
        { error: 'Failed to verify authentication' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('[v0] Authentication complete error:', error)
    return NextResponse.json(
      { error: 'Failed to complete authentication' },
      { status: 500 }
    )
  }
}
