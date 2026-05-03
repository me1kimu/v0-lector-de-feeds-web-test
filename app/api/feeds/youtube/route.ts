import { NextRequest, NextResponse } from 'next/server'
import Parser from 'rss-parser'
import type { FeedItem, FeedSource } from '@/lib/types'

const parser = new Parser({
  customFields: {
    item: [
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:content', 'mediaContent'],
      ['yt:videoId', 'videoId'],
    ]
  }
})

function extractChannelId(url: string): string | null {
  // Extract from various YouTube URL formats
  // youtube.com/@username or youtube.com/c/channelname or youtube.com/channel/UCxxxxx
  
  const patterns = [
    /(?:youtube\.com\/channel\/|youtube\.com\/c\/|youtube\.com\/@)([a-zA-Z0-9_-]+)/,
    /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
    /(UC[a-zA-Z0-9_-]{21}[AQww])/,
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  
  return null
}

function buildYouTubeFeedUrl(input: string): string {
  // Try to extract channel ID from various formats
  const channelId = extractChannelId(input)
  
  if (channelId) {
    // If it's a @username or channel ID
    if (channelId.startsWith('UC')) {
      // It's a channel ID
      return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    } else {
      // It's a username - use custom URL format
      return `https://www.youtube.com/feeds/videos.xml?user=${channelId}`
    }
  }
  
  // If user provided direct RSS URL
  if (input.includes('youtube.com/feeds')) {
    return input
  }
  
  throw new Error('Invalid YouTube URL. Use channel ID (UC...), @username, or direct channel URL')
}

export async function POST(request: NextRequest) {
  try {
    const { source } = await request.json() as { source: FeedSource }
    
    if (!source.url && !source.credentials?.channelId) {
      return NextResponse.json(
        { error: 'YouTube URL or channel ID is required' },
        { status: 400 }
      )
    }
    
    const feedUrl = source.credentials?.channelId
      ? `https://www.youtube.com/feeds/videos.xml?channel_id=${source.credentials.channelId}`
      : buildYouTubeFeedUrl(source.url)
    
    console.log('[v0] Fetching YouTube feed:', feedUrl)
    
    const feed = await parser.parseURL(feedUrl)
    
    const items: FeedItem[] = (feed.items || [])
      .filter((item): item is typeof item => !!item.link)
      .slice(0, 40)
      .map((item) => {
        // Extract video ID from YouTube feed
        const videoIdMatch = item.link?.match(/v=([a-zA-Z0-9_-]{11})/) || 
                            (item as Record<string, unknown>).videoId
        const videoId = Array.isArray(videoIdMatch) ? videoIdMatch[1] : videoIdMatch
        
        // Get thumbnail
        const thumbnail = (item as Record<string, unknown>).mediaThumbnail as Record<string, unknown> | undefined
        const thumbnailUrl = thumbnail?.url as string || 
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        
        // Parse description for better content
        const description = item.contentSnippet || item.content || ''
        const plainText = description
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        
        return {
          id: `youtube-${source.id}-${videoId}`,
          sourceId: source.id,
          sourceType: 'youtube',
          sourceName: source.name || feed.title || 'YouTube',
          title: item.title,
          content: plainText || 'New video',
          author: {
            name: feed.title || item.author || 'YouTube',
            url: feed.link,
          },
          url: item.link,
          publishedAt: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
          media: [
            {
              type: 'video',
              url: `https://www.youtube.com/watch?v=${videoId}`,
              previewUrl: thumbnailUrl,
            }
          ],
          raw: item
        }
      })
    
    return NextResponse.json({ items }, { status: 200 })
  } catch (error) {
    console.error('[v0] YouTube feed error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: 'Failed to fetch YouTube feed',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}
