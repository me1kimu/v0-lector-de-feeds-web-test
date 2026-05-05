import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { base64urlEncode } from '@/lib/encryption'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { email } = body

    const supabase = await createClient()

    // Generate a random challenge
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const challengeBase64 = base64urlEncode(challenge.buffer)

    // Store the challenge temporarily (expires in 5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    
    const { error: challengeError } = await supabase
      .from('webauthn_challenges')
      .insert({
        challenge: challengeBase64,
        type: 'authentication',
        expires_at: expiresAt,
      })

    if (challengeError) {
      console.error('Challenge storage error:', challengeError)
      return NextResponse.json(
        { error: 'Failed to create authentication challenge' },
        { status: 500 }
      )
    }

    let allowCredentials: Array<{
      id: string
      type: 'public-key'
      transports: string[]
    }> = []

    // If email is provided, get credentials for that user
    if (email) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()

      if (profile) {
        const { data: passkeys } = await supabase
          .from('passkeys')
          .select('credential_id, transports')
          .eq('user_id', profile.id)

        allowCredentials = (passkeys || []).map((pk) => ({
          id: pk.credential_id,
          type: 'public-key' as const,
          transports: pk.transports || ['internal'],
        }))
      }
    }

    // Get RP ID - use localhost for development, otherwise use the current hostname
    const requestUrl = new URL(request.url)
    const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host') || requestUrl.hostname
    const urlHostname = hostHeader.split(':')[0]
    
    const rpId = urlHostname === 'localhost' || urlHostname.includes('127.0.0.1')
      ? 'localhost'
      : urlHostname

    // Return authentication options
    const options = {
      challenge: challengeBase64,
      timeout: 60000,
      rpId: rpId,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: 'preferred' as const,
    }

    return NextResponse.json(options)
  } catch (error) {
    console.error('Authentication options error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
