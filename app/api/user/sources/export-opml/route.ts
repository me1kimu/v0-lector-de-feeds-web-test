import { createClient } from '@/lib/supabase/server'

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { data: sources, error } = await supabase
      .from('feed_sources')
      .select('id, name, url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Export OPML fetch error:', error)
      return new Response(JSON.stringify({ error: 'Failed to fetch sources' }), { status: 500 })
    }

    let body = ''
    if (sources && Array.isArray(sources)) {
      for (const s of sources) {
        if (!s.url) continue
        const name = s.name || s.url
        body += `  <outline text="${escapeXml(name)}" title="${escapeXml(name)}" type="rss" xmlUrl="${escapeXml(s.url)}" />\n`
      }
    }

    const opml = `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="1.0">\n<head>\n  <title>Feeds export</title>\n</head>\n<body>\n${body}</body>\n</opml>`

    return new Response(opml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': 'attachment; filename="feeds.opml"',
      },
    })
  } catch (error) {
    console.error('Export OPML error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
