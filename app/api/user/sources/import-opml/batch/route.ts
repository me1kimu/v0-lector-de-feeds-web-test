import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Item = { title?: string; url?: string }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const items: Item[] = body.items || []

    if (!items || !Array.isArray(items)) {
      return new Response(JSON.stringify({ error: 'items array required' }), { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    let inserted = 0
    let skipped = 0

    for (const it of items) {
      const xmlUrl = (it.url || '').toString().trim()
      const title = (it.title || '').toString().trim()
      if (!xmlUrl) {
        skipped++
        continue
      }

      const { data: existing } = await supabase
        .from('feed_sources')
        .select('id')
        .eq('user_id', user.id)
        .eq('url', xmlUrl)
        .maybeSingle()

      if (existing) {
        skipped++
        continue
      }

      const { error: insertErr } = await supabase.from('feed_sources').insert({
        user_id: user.id,
        type: 'rss',
        name: title || xmlUrl,
        url: xmlUrl,
      })

      if (insertErr) {
        console.error('Batch insert error', insertErr)
        skipped++
      } else {
        inserted++
      }
    }

    return new Response(JSON.stringify({ inserted, skipped }), { status: 200 })
  } catch (error) {
    console.error('Batch import error', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
