import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch user's feed items from cloud
export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: items, error } = await supabase
      .from('feed_items')
      .select('*')
      .eq('user_id', user.id)
      .order('published_at', { ascending: false })
      .limit(200)

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
