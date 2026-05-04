import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch user profile information
export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user data from users table. Use maybeSingle() because some
    // accounts may exist only in auth.users and not have a row in public.users.
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, display_name, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle()

    if (userError) {
      console.error('Fetch user error:', userError)
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      )
    }

    // If there's no row in public.users, fall back to the auth user object
    const profileId = userData?.id || user.id
    const profileEmail = user.email || userData?.email || null
    const profileDisplayName = userData?.display_name || null
    const profileCreatedAt = userData?.created_at || (user?.created_at as unknown as string) || null

    return NextResponse.json({
      userId: profileId,
      email: profileEmail,
      displayName: profileDisplayName,
      createdAt: profileCreatedAt,
    })
  } catch (error) {
    console.error('Profile GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
