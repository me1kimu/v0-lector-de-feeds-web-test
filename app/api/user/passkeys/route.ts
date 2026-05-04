import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch user's passkey credentials
export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: passkeys, error } = await supabase
      .from('passkey_credentials')
      .select('id, device_name, created_at, last_used_at, transports')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Fetch passkeys error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch passkeys' },
        { status: 500 }
      )
    }

    return NextResponse.json({ passkeys: passkeys || [] })
  } catch (error) {
    console.error('Passkeys GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove a passkey credential
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { credentialId } = await request.json()

    if (!credentialId) {
      return NextResponse.json(
        { error: 'credentialId is required' },
        { status: 400 }
      )
    }

    // Check that the credential belongs to the user
    const { data: credential, error: fetchError } = await supabase
      .from('passkey_credentials')
      .select('id')
      .eq('id', credentialId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !credential) {
      return NextResponse.json(
        { error: 'Credential not found' },
        { status: 404 }
      )
    }

    // Delete the credential
    const { error: deleteError } = await supabase
      .from('passkey_credentials')
      .delete()
      .eq('id', credentialId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Delete passkey error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete passkey' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Passkeys DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
