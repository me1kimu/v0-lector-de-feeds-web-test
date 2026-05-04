import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch user's sources
export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: sources, error } = await supabase
      .from('feed_sources')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Fetch sources error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch sources' },
        { status: 500 }
      )
    }

    return NextResponse.json({ sources })
  } catch (error) {
    console.error('Sources GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new source
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      id,
      source_type, 
      name, 
      url, 
      encrypted_credentials, 
      refresh_interval,
      enabled 
    } = body

    if (!source_type || !name) {
      return NextResponse.json(
        { error: 'source_type and name are required' },
        { status: 400 }
      )
    }

    const { data: source, error } = await supabase
      .from('feed_sources')
      .insert({
        ...(id ? { id } : {}),
        user_id: user.id,
        type: source_type,
        name,
        url,
        refresh_interval: refresh_interval || 300000,
        enabled: enabled ?? true,
      })
      .select()
      .single()

    if (error) {
      console.error('Create source error:', error)
      return NextResponse.json(
        { error: 'Failed to create source' },
        { status: 500 }
      )
    }

    return NextResponse.json({ source })
  } catch (error) {
    console.error('Sources POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update a source
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, source_type, name, url, handle, refresh_interval, enabled } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Source id is required' },
        { status: 400 }
      )
    }

    // Ensure user owns this source
    const { data: existingSource } = await supabase
      .from('feed_sources')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existingSource) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      )
    }

    const { data: source, error } = await supabase
      .from('feed_sources')
      .update({
        ...(source_type !== undefined && { type: source_type }),
        ...(name !== undefined && { name }),
        ...(url !== undefined && { url }),
        ...(handle !== undefined && { handle }),
        ...(refresh_interval !== undefined && { refresh_interval }),
        ...(enabled !== undefined && { enabled }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Update source error:', error)
      return NextResponse.json(
        { error: 'Failed to update source' },
        { status: 500 }
      )
    }

    return NextResponse.json({ source })
  } catch (error) {
    console.error('Sources PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a source
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const deleteAll = searchParams.get('deleteAll') === 'true'

    if (deleteAll) {
      const { error } = await supabase
        .from('feed_sources')
        .delete()
        .eq('user_id', user.id)

      if (error) {
        console.error('Delete all sources error:', error)
        return NextResponse.json(
          { error: 'Failed to delete all sources' },
          { status: 500 }
        )
      }
      return NextResponse.json({ success: true })
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Source id is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('feed_sources')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Delete source error:', error)
      return NextResponse.json(
        { error: 'Failed to delete source' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Sources DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
