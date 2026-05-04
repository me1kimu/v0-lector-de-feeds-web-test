import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { hashPassword } from '@/lib/encryption'
import crypto from 'crypto'

/**
 * POST /api/auth/test-login
 * Test endpoint to create and login test user
 * ONLY FOR DEVELOPMENT - remove before production
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test endpoint not available in production' },
      { status: 403 }
    )
  }

  try {
    const { email = 'test@test.com', password = 'TestPassword123!' } = await request.json()

    // Create client with service role key (has full permissions)
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Try to get existing user or create new one
    let authUser
    let authUserError
    
    // First, try to list users with this email (to check if exists)
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)
    
    if (existingUser) {
      authUser = { user: existingUser }
      // Update password for existing user
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        { password }
      )
      if (updateError) {
        console.error('[v0] Auth user update error:', updateError)
        throw new Error(`Failed to update auth user: ${updateError.message}`)
      }
    } else {
      // Create new user
      const { data: newAuthUser, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
      })
      authUser = newAuthUser
      authUserError = error
    }

    if (authUserError || !authUser.user) {
      console.error('[v0] Auth user creation error:', authUserError)
      throw new Error(`Failed to create auth user: ${authUserError?.message || 'Unknown error'}`)
    }

    // Generate encryption key salt
    const encryptionKeySalt = crypto.randomBytes(16).toString('base64')

    // Upsert public user record (create or update)
    const { error: userError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: authUser.user.id,
        email,
        display_name: email.split('@')[0],
        encryption_key_salt: encryptionKeySalt,
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    if (userError) {
      console.error('[v0] User creation error:', userError)
      throw new Error(`Failed to create user: ${userError.message}`)
    }

    // Create or update email auth
    const passwordHash = await hashPassword(password)
    const { error: authError } = await supabaseAdmin
      .from('email_auth')
      .upsert({
        user_id: authUser.user.id,
        email,
        password_hash: passwordHash,
        verified: true,
        created_at: new Date().toISOString(),
      }, { onConflict: 'email' })

    if (authError) {
      console.error('[v0] Email auth creation error:', authError)
      throw new Error(`Failed to create email auth: ${authError.message}`)
    }

    // Create session
    const token = crypto.randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const { error: sessionError } = await supabaseAdmin
      .from('sessions')
      .insert({
        user_id: authUser.user.id,
        token,
        method: 'email',
        expires_at: expiresAt.toISOString(),
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        created_at: new Date().toISOString(),
      })

    if (sessionError) {
      console.error('[v0] Session creation error:', sessionError)
      throw new Error(`Failed to create session: ${sessionError.message}`)
    }

    return NextResponse.json({
      success: true,
      session: {
        token,
        userId: authUser.user.id,
        expiresAt: expiresAt.toISOString(),
      },
      user: {
        email,
        userId: authUser.user.id,
      },
    })
  } catch (error) {
    console.error('[v0] Test login error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create test session' },
      { status: 500 }
    )
  }
}
