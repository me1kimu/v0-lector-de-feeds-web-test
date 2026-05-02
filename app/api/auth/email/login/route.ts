import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyPassword } from '@/lib/encryption'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Get email auth record
    const { data: emailAuth, error: authError } = await supabase
      .from('email_auth')
      .select('*')
      .eq('email', email)
      .single()

    if (authError || !emailAuth) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Verify password
    const passwordValid = await verifyPassword(password, emailAuth.password_hash)
    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Create session
    const token = crypto.randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: emailAuth.user_id,
        token,
        method: 'email',
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
        userId: emailAuth.user_id,
        expiresAt: expiresAt.toISOString()
      }
    })
  } catch (error) {
    console.error('[v0] Email login error:', error)
    return NextResponse.json(
      { error: 'Failed to login' },
      { status: 500 }
    )
  }
}
