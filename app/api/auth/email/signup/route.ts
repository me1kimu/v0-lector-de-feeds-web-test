import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { hashPassword, generateEncryptionKey } from '@/lib/encryption'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const { data: existing } = await supabase
      .from('email_auth')
      .select('id')
      .eq('email', email)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      )
    }

    // Create user ID
    const userId = crypto.randomUUID()

    // Hash password
    const passwordHash = await hashPassword(password)

    // Generate encryption key salt
    const encryptionKeySalt = crypto.randomBytes(16).toString('base64')

    // Create user
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email,
        display_name: displayName || email.split('@')[0],
        encryption_key_salt: encryptionKeySalt
      })

    if (userError) {
      console.error('[v0] User creation error:', userError)
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Create email auth
    const { error: authError } = await supabase
      .from('email_auth')
      .insert({
        user_id: userId,
        email,
        password_hash: passwordHash,
        verified: false
      })

    if (authError) {
      console.error('[v0] Email auth creation error:', authError)
      // Clean up user if email auth fails
      await supabase.from('users').delete().eq('id', userId)
      return NextResponse.json(
        { error: 'Failed to create email authentication' },
        { status: 500 }
      )
    }

    // Create session
    const token = crypto.randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
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
      user: {
        id: userId,
        email,
        displayName: displayName || email.split('@')[0]
      },
      session: {
        token,
        expiresAt: expiresAt.toISOString()
      }
    })
  } catch (error) {
    console.error('[v0] Email signup error:', error)
    return NextResponse.json(
      { error: 'Failed to signup' },
      { status: 500 }
    )
  }
}
