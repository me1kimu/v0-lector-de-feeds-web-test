import { NextRequest, NextResponse } from 'next/server'
import { syncFeedItems } from '@/lib/feed-sync'
import type { FeedSource } from '@/lib/types'
import { logger } from '@/lib/logger'

/**
 * Generic feed sync endpoint that handles all feed types
 * POST /api/feeds/sync
 * 
 * Request body:
 * {
 *   source: FeedSource (with credentials)
 *   items: FeedItem[]
 *   updateExisting?: boolean (default: true)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { source, items, updateExisting = true } = body

    if (!source || !source.id) {
      return NextResponse.json(
        { error: 'Source is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Items must be an array' },
        { status: 400 }
      )
    }

    console.log(
      `[v0] FeedSync: Syncing ${items.length} items for source ${source.id} (${source.name})`
    )

    // Call the synchronization service
    const result = await syncFeedItems(items, {
      sourceId: source.id,
      updateExisting,
    })

    console.log('[v0] FeedSync: Sync completed for source %s:', source.id, {
      itemsAdded: result.itemsAdded,
      itemsUpdated: result.itemsUpdated,
      itemsSkipped: result.itemsSkipped,
      errors: result.errors.length,
      duration: result.syncDuration,
    })

    return NextResponse.json({
      success: result.success,
      data: {
        itemsFetched: result.itemsFetched,
        itemsAdded: result.itemsAdded,
        itemsUpdated: result.itemsUpdated,
        itemsSkipped: result.itemsSkipped,
        errors: result.errors,
        syncDuration: result.syncDuration,
        syncLogId: result.logId,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const stack = error instanceof Error ? error.stack : ''
logger.error('FeedSync', 'FeedSync API Error', error)

    return NextResponse.json(
      {
        error: 'Synchronization failed',
        details: message,
      },
      { status: 500 }
    )
  }
}
