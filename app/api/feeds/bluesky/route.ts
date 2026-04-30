import { NextRequest, NextResponse } from 'next/server'
import { BskyAgent } from '@atproto/api'
import type { FeedItem, FeedSource, MediaAttachment } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const { source, action, postUri, postCid } = await request.json() as {
      source: FeedSource
      action?: 'like' | 'unlike' | 'repost' | 'unrepost'
      postUri?: string
      postCid?: string
    }
    
    const agent = new BskyAgent({ service: 'https://bsky.social' })
    
    const handle = source.credentials?.handle
    const appPassword = source.credentials?.appPassword
    
    // Login if credentials provided
    if (handle && appPassword) {
      await agent.login({
        identifier: handle,
        password: appPassword
      })
    }
    
    // Handle interactions
    if (action && postUri && postCid && agent.session) {
      if (action === 'like') {
        await agent.like(postUri, postCid)
      } else if (action === 'unlike') {
        // Note: unlike requires the like URI, simplified here
        // In practice, you'd need to track the like record URI
      } else if (action === 'repost') {
        await agent.repost(postUri, postCid)
      }
      
      return NextResponse.json({ success: true })
    }
    
    // Fetch timeline
    let feed
    if (agent.session) {
      const response = await agent.getTimeline({ limit: 50 })
      feed = response.data.feed
    } else {
      // Public feed for unauthenticated users - discover feed
      const response = await agent.app.bsky.feed.getFeed({
        feed: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
        limit: 50
      })
      feed = response.data.feed
    }
    
    const items: FeedItem[] = feed.map((item) => {
      const post = item.post
      const record = post.record as { text: string; createdAt: string; embed?: unknown }
      const author = post.author
      
      const media: MediaAttachment[] = []
      
      // Extract images from embed
      const embed = post.embed as Record<string, unknown> | undefined
      if (embed) {
        if (embed.$type === 'app.bsky.embed.images#view') {
          const images = embed.images as Array<{
            fullsize: string
            thumb: string
            alt?: string
            aspectRatio?: { width: number; height: number }
          }>
          images?.forEach((img) => {
            media.push({
              type: 'image',
              url: img.fullsize,
              previewUrl: img.thumb,
              alt: img.alt,
              width: img.aspectRatio?.width,
              height: img.aspectRatio?.height
            })
          })
        } else if (embed.$type === 'app.bsky.embed.video#view') {
          const video = embed as { playlist?: string; thumbnail?: string; alt?: string }
          if (video.playlist) {
            media.push({
              type: 'video',
              url: video.playlist,
              previewUrl: video.thumbnail,
              alt: video.alt
            })
          }
        }
      }
      
      const metrics = post.likeCount !== undefined ? {
        likes: post.likeCount as number,
        reposts: post.repostCount as number,
        replies: post.replyCount as number,
        liked: (post.viewer as { like?: string })?.like !== undefined,
        reposted: (post.viewer as { repost?: string })?.repost !== undefined
      } : undefined
      
      return {
        id: `${source.id}-${post.cid}`,
        sourceId: source.id,
        sourceType: 'bluesky',
        sourceName: source.name,
        content: record.text,
        author: {
          name: author.displayName || author.handle,
          handle: `@${author.handle}`,
          avatar: author.avatar,
          url: `https://bsky.app/profile/${author.handle}`
        },
        url: `https://bsky.app/profile/${author.handle}/post/${post.uri.split('/').pop()}`,
        publishedAt: new Date(record.createdAt).getTime(),
        media: media.length > 0 ? media : undefined,
        interactions: metrics,
        raw: { uri: post.uri, cid: post.cid, ...item }
      }
    })
    
    return NextResponse.json({ items })
  } catch (error) {
    console.error('Bluesky fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Bluesky feed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
