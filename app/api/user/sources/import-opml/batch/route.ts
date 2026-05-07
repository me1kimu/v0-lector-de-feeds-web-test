import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Item = { title?: string; url?: string; htmlUrl?: string }

function detectSourceType(url: string, htmlUrl?: string): string {
  const candidates = [url, htmlUrl].flatMap((value) => {
    if (!value) return []

    try {
      return [new URL(value).hostname.toLowerCase()]
    } catch {
      return [value.toLowerCase()]
    }
  })

  const matchesHost = (host: string, domain: string) =>
    host === domain || host.endsWith(`.${domain}`)

  if (candidates.some((host) => matchesHost(host, 'instagram.com'))) return 'instagram';
  if (candidates.some((host) => matchesHost(host, 'bsky.app') || matchesHost(host, 'bsky.social'))) return 'bluesky';
  if (candidates.some((host) => matchesHost(host, 'youtube.com') || matchesHost(host, 'youtu.be'))) return 'youtube';
  if (candidates.some((host) => matchesHost(host, 'twitter.com') || matchesHost(host, 'x.com') || host.startsWith('nitter.'))) return 'twitter';
  if (candidates.some((host) => host.includes('mastodon') || host.includes('mstdn'))) return 'mastodon';
  if (candidates.some((host) => host.includes('pixelfed'))) return 'pixelfed';
  if (candidates.some((host) => matchesHost(host, 'inkbunny.net'))) return 'inkbunny';
  return 'rss';
}

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
      const htmlUrl = (it.htmlUrl || '').toString().trim()
      
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
        type: detectSourceType(xmlUrl, htmlUrl),
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
