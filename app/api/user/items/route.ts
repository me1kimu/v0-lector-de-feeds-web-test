import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch user's feed items from cloud
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sourceId = searchParams.get('sourceId')
    const sourceType = searchParams.get('sourceType')
    const limit = parseInt(searchParams.get('limit') || '200', 10)

    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let query = supabase
      .from('feed_items')
      .select('*')
      .eq('user_id', user.id)

    if (sourceId) {
      query = query.eq('source_id', sourceId)
    }

    if (sourceType) {
      query = query.eq('source_type', sourceType)
    }

    query = query.order('published_at', { ascending: false }).limit(limit)

    const { data: items, error } = await query

    if (error) {
      console.error('Fetch cloud items error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch items' },
        { status: 500 }
      )
    }

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Items GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
