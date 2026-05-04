import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { XMLParser } from 'fast-xml-parser'

function collectOutlines(node: any, out: any[] = []) {
  if (!node) return out
  if (Array.isArray(node)) {
    node.forEach(item => collectOutlines(item, out))
    return out
  }

  // Outline element may be under different keys depending on parser
  const children = node.outline || node.body || node.opml || []
  if (node['@_xmlUrl'] || node['xmlUrl'] || node['@_xmlurl']) {
    out.push(node)
  }

  if (node.outline) {
    collectOutlines(node.outline, out)
  } else if (children && Array.isArray(children)) {
    children.forEach((c: any) => collectOutlines(c, out))
  }

  return out
}

export async function POST(request: NextRequest) {
  try {
    const { opml } = await request.json()

    if (!opml || typeof opml !== 'string') {
      return new Response(JSON.stringify({ error: 'opml is required' }), { status: 400 })
    }

    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
    const parsed = parser.parse(opml)

    // Walk the parsed object to extract outline entries with xmlUrl
    let outlines: any[] = []
    try {
      if (parsed?.opml?.body) {
        outlines = collectOutlines(parsed.opml.body)
      } else if (parsed?.body) {
        outlines = collectOutlines(parsed.body)
      } else {
        outlines = collectOutlines(parsed)
      }
    } catch (err) {
      console.error('OPML parse traversal error', err)
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    let inserted = 0
    let skipped = 0

    for (const o of outlines) {
      const xmlUrl = (o['@_xmlUrl'] || o.xmlUrl || o['@_xmlurl'] || o['xmlurl'])?.toString?.().trim()
      const title = (o['@_title'] || o.title || o['@_text'] || o.text || '')?.toString?.().trim()
      const htmlUrl = (o['@_htmlUrl'] || o.htmlUrl || o['@_htmlurl'] || o.htmlurl || '')?.toString?.().trim()

      if (!xmlUrl) {
        skipped++
        continue
      }

      // Check if the user already has this URL
      const { data: existing, error: fetchErr } = await supabase
        .from('feed_sources')
        .select('id')
        .eq('user_id', user.id)
        .eq('url', xmlUrl)
        .maybeSingle()

      if (fetchErr) {
        console.error('Error checking existing source', fetchErr)
      }

      if (existing) {
        skipped++
        continue
      }

      const { error: insertErr } = await supabase.from('feed_sources').insert({
        user_id: user.id,
        type: 'rss',
        name: title || xmlUrl,
        url: xmlUrl,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (insertErr) {
        console.error('Error inserting feed source', insertErr)
        skipped++
      } else {
        inserted++
      }
    }

    return new Response(JSON.stringify({ inserted, skipped }), { status: 200 })
  } catch (error) {
    console.error('Import OPML error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
