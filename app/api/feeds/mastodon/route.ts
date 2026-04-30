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

export async function POST(request: NextRequest) {
  try {
    const { source, action, statusId } = await request.json() as {
      source: FeedSource
      action?: 'favourite' | 'unfavourite' | 'reblog' | 'unreblog'
      statusId?: string
    }
    
    const instance = source.credentials?.instance || source.url
    const accessToken = source.credentials?.accessToken
    
    if (!instance) {
      return NextResponse.json({ error: 'Instance URL is required' }, { status: 400 })
    }
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    }
    
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }
    
    // Handle interactions
    if (action && statusId && accessToken) {
      const actionUrl = `${instance}/api/v1/statuses/${statusId}/${action}`
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
    
    // Fetch timeline
    const endpoint = accessToken ? '/api/v1/timelines/home' : '/api/v1/timelines/public'
    const url = `${instance}${endpoint}?limit=40`
    
    const response = await fetch(url, { headers })
    
    if (!response.ok) {
      throw new Error(`Mastodon API error: ${response.status}`)
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
