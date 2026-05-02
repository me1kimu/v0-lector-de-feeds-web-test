import { NextRequest, NextResponse } from 'next/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || 'localhost'
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST(request: NextRequest) {
  try {
    const { userId, credential, challenge, deviceName } = await request.json()

    if (!userId || !credential || !challenge) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify the challenge exists and hasn't expired
    const { data: challengeData, error: challengeError } = await supabase
      .from('passkey_challenges')
      .select('*')
      .eq('user_id', userId)
      .eq('challenge', challenge)
      .eq('challenge_type', 'registration')
      .gt('expires_at', new Date().toISOString())
      .single()

    if (challengeError || !challengeData) {
      return NextResponse.json(
        { error: 'Invalid or expired challenge' },
        { status: 400 }
      )
    }

    // Verify the credential attestation
    try {
      const verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID
      })

      if (!verification.verified) {
        return NextResponse.json(
          { error: 'Credential verification failed' },
          { status: 400 }
        )
      }

      // Store the passkey credential
      const credentialId = credential.id
      const publicKeyBuffer = Buffer.from(verification.registrationInfo?.credentialPublicKey || [])
      const publicKeyBase64 = publicKeyBuffer.toString('base64')

      const { error: insertError, data: newCredential } = await supabase
        .from('passkey_credentials')
        .insert({
          user_id: userId,
          credential_id: credentialId,
          credential_public_key: publicKeyBase64,
          counter: verification.registrationInfo?.counter || 0,
          transports: credential.response?.transports || [],
          device_name: deviceName || 'Unnamed device'
        })
        .select()
        .single()

      if (insertError) {
        console.error('[v0] Credential storage error:', insertError)
        return NextResponse.json(
          { error: 'Failed to store credential' },
          { status: 500 }
        )
      }

      // Delete the challenge
      await supabase
        .from('passkey_challenges')
        .delete()
        .eq('id', challengeData.id)

      // Create a session
      const token = crypto.randomBytes(32).toString('base64url')
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      await supabase
        .from('sessions')
        .insert({
          user_id: userId,
          token,
          method: 'passkey',
          expires_at: expiresAt.toISOString(),
          ip_address: request.ip,
          user_agent: request.headers.get('user-agent')
        })

      return NextResponse.json({
        success: true,
        credential: newCredential,
        session: {
          token,
          expiresAt: expiresAt.toISOString()
        }
      })
    } catch (verifyError) {
      console.error('[v0] Verification error:', verifyError)
      return NextResponse.json(
        { error: 'Failed to verify credential' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[v0] Registration complete error:', error)
    return NextResponse.json(
      { error: 'Failed to complete registration' },
      { status: 500 }
    )
  }
}
