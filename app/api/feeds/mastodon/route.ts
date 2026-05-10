import { NextRequest, NextResponse } from 'next/server'
import type { FeedItem, FeedSource, MediaAttachment } from '@/lib/types'

interface MastodonStatus {
  id: string
  created_at: string
  content: string
  url: string
  account: {
    id: string
    username: string
    display_name: string
    avatar: string
    url: string
    acct: string
  }
  media_attachments: Array<{
    id: string
    type: 'image' | 'video' | 'gifv' | 'audio'
    url: string
    preview_url: string
    description: string | null
    meta?: {
      original?: { width: number; height: number }
    }
  }>
  favourites_count: number
  reblogs_count: number
  replies_count: number
  favourited?: boolean
  reblogged?: boolean
  reblog?: MastodonStatus
  spoiler_text?: string
  sensitive?: boolean
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase()

  if (host === 'localhost' || host === '::1') return true

  // IPv4 checks
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number)
    if (octets.some((o) => o < 0 || o > 255)) return true
    const [a, b] = octets
    if (a === 10) return true
    if (a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 0) return true
  }

  // IPv6 checks (basic)
  if (host.includes(':')) {
    if (host === '::1') return true
    if (host.startsWith('fc') || host.startsWith('fd')) return true // unique local
    if (host.startsWith('fe80:')) return true // link-local
  }

  return false
}

function normalizeAndValidateInstanceUrl(rawInstance: string): string | null {
  let value = (rawInstance || '').trim().replace(/\/+$/, '')
  if (!value) return null

  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    value = `https://${value}`
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return null
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  if (!parsed.hostname) return null
  if (parsed.username || parsed.password) return null
  if (isPrivateOrLocalHostname(parsed.hostname)) return null

  return parsed.origin
}

export async function POST(request: NextRequest) {
  try {
    const { source, action, statusId } = await request.json() as {
      source: FeedSource
      action?: 'favourite' | 'unfavourite' | 'reblog' | 'unreblog'
      statusId?: string
    }
    
    // Get and validate instance URL (SSRF protection)
    const rawInstance = source.credentials?.instance || source.url || ''
    const instance = normalizeAndValidateInstanceUrl(rawInstance)
    
    const accessToken = source.credentials?.accessToken
    
    if (!instance) {
      return NextResponse.json({ error: 'A valid public instance URL is required' }, { status: 400 })
    }

    // Enforce server-side allowlist to prevent SSRF via arbitrary public hosts
    const allowedInstances = (process.env.MASTODON_ALLOWED_INSTANCES || '')
      .split(',')
      .map((v) => v.trim().replace(/\/+$/, ''))
      .filter(Boolean)

    if (allowedInstances.length === 0) {
      console.error('MASTODON_ALLOWED_INSTANCES is not configured')
      return NextResponse.json({ error: 'Mastodon instance allowlist is not configured' }, { status: 500 })
    }

    if (!allowedInstances.includes(instance)) {
      return NextResponse.json({ error: 'Instance is not allowed' }, { status: 400 })
    }
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
    
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }
    
    // Handle interactions
    if (action && statusId && accessToken) {
      const allowedActions = new Set(['favourite', 'unfavourite', 'reblog', 'unreblog'])
      if (!allowedActions.has(action)) {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
      }

      // Mastodon status IDs are numeric strings; reject unsafe path input
      if (!/^\d+$/.test(statusId)) {
        return NextResponse.json({ error: 'Invalid statusId' }, { status: 400 })
      }

      const safeStatusId = encodeURIComponent(statusId)
      const actionUrl = `${instance}/api/v1/statuses/${safeStatusId}/${action}`
      const response = await fetch(actionUrl, {
        method: 'POST',
        headers
      })
      
      if (!response.ok) {
        throw new Error(`Failed to ${action} status`)
      }
      
      const result = await response.json()
      return NextResponse.json({ success: true, status: result })
    }
    
    // Determine which timeline to fetch based on credentials
    const timelineType = source.credentials?.timelineType || 'public'
    let endpoint: string
    let queryParams = 'limit=40'
    
    if (timelineType === 'home' && accessToken) {
      // Authenticated home timeline
      endpoint = '/api/v1/timelines/home'
    } else if (timelineType === 'local') {
      // Local instance timeline (no federation)
      endpoint = '/api/v1/timelines/public'
      queryParams += '&local=true'
    } else {
      // Public federated timeline (default)
      endpoint = '/api/v1/timelines/public'
    }
    
    const url = `${instance}${endpoint}?${queryParams}`
    
    const response = await fetch(url, { 
      headers,
      next: { revalidate: 0 }
    })
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error('[v0] Mastodon API error:', response.status, errorText)
      throw new Error(`Mastodon API error: ${response.status} - ${errorText}`)
    }
    
    const statuses: MastodonStatus[] = await response.json()
    
    const items: FeedItem[] = statuses.map((status) => {
      const actualStatus = status.reblog || status
      
      const media: MediaAttachment[] = actualStatus.media_attachments.map((m) => ({
        type: m.type === 'gifv' ? 'gif' : m.type,
        url: m.url,
        previewUrl: m.preview_url,
        alt: m.description || undefined,
        width: m.meta?.original?.width,
        height: m.meta?.original?.height
      }))
      
      return {
        id: `${source.id}-${status.id}`,
        sourceId: source.id,
        sourceType: 'mastodon',
        sourceName: source.name,
        content: actualStatus.content.replace(/<[^>]*>/g, ''),
        contentHtml: actualStatus.content,
        author: {
          name: actualStatus.account.display_name || actualStatus.account.username,
          handle: `@${actualStatus.account.acct}`,
          avatar: actualStatus.account.avatar,
          url: actualStatus.account.url
        },
        url: actualStatus.url,
        publishedAt: new Date(actualStatus.created_at).getTime(),
        media: media.length > 0 ? media : undefined,
        interactions: {
          likes: actualStatus.favourites_count,
          reposts: actualStatus.reblogs_count,
          replies: actualStatus.replies_count,
          liked: actualStatus.favourited,
          reposted: actualStatus.reblogged
        },
        raw: status
      }
    })
    
    return NextResponse.json({ items })
  } catch (error) {
    console.error('Mastodon fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Mastodon feed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
