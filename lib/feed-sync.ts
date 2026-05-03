import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import type { FeedItem } from './types'

export interface SyncOptions {
  sourceId: string
  maxRetries?: number
  timeoutMs?: number
  updateExisting?: boolean
}

export interface SyncResult {
  success: boolean
  itemsFetched: number
  itemsAdded: number
  itemsUpdated: number
  itemsSkipped: number
  errors: Array<{ message: string; code: string }>
  syncDuration: number
  logId: string
}

/**
 * Compute a hash of feed item content for detecting updates
 */
function computeItemHash(item: FeedItem): string {
  const hashContent = JSON.stringify({
    title: item.title,
    content: item.content,
    contentHtml: item.contentHtml,
  })
  return crypto.createHash('sha256').update(hashContent).digest('hex')
}

/**
 * Generate a unique external ID for deduplication
 * Uses provided ID, falls back to URL, then title+date
 */
function generateExternalId(item: FeedItem): string {
  if (item.id) return item.id
  if (item.url) return item.url
  return crypto
    .createHash('sha256')
    .update(`${item.title}${item.publishedAt}`)
    .digest('hex')
}

/**
 * Synchronize feed items for a source
 * Handles deduplication, updates, and stores items in database
 */
export async function syncFeedItems(
  items: FeedItem[],
  options: SyncOptions
): Promise<SyncResult> {
  const startTime = Date.now()
  const supabase = await createClient()
  const errors: Array<{ message: string; code: string }> = []
  
  let itemsAdded = 0
  let itemsUpdated = 0
  let itemsSkipped = 0
  
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Unauthorized: Cannot sync without authenticated user')
  }

  // Create sync log entry
  const { data: syncLog, error: logError } = await supabase
    .from('feed_sync_logs')
    .insert({
      user_id: user.id,
      source_id: options.sourceId,
      status: 'pending',
      items_fetched: items.length,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (logError) {
    console.error('[FeedSync] Failed to create sync log:', logError)
    throw new Error('Failed to create sync log')
  }

  const syncLogId = syncLog.id

  try {
    // Fetch existing items for this source to detect duplicates
    const { data: existingItems, error: fetchError } = await supabase
      .from('feed_items')
      .select('id, external_id, sync_hash')
      .eq('user_id', user.id)
      .eq('source_id', options.sourceId)

    if (fetchError) {
      console.error('[FeedSync] Failed to fetch existing items:', fetchError)
      throw new Error(`Failed to fetch existing items: ${fetchError.message}`)
    }

    const existingMap = new Map(
      (existingItems || []).map((item) => [item.external_id, item])
    )

    // Process each item
    const itemsToInsert: any[] = []
    const itemsToUpdate: Array<{ id: string; updates: any }> = []

    for (const item of items) {
      try {
        const externalId = generateExternalId(item)
        const newHash = computeItemHash(item)
        const existing = existingMap.get(externalId)

        if (existing) {
          // Check if content changed
          if (existing.sync_hash === newHash && !options.updateExisting) {
            itemsSkipped++
            continue
          }

          // Update existing item
          if (options.updateExisting || existing.sync_hash !== newHash) {
            itemsToUpdate.push({
              id: existing.id,
              updates: {
                title: item.title,
                content: item.content,
                content_html: item.contentHtml,
                author_name: item.author?.name,
                author_url: item.author?.url,
                item_url: item.url,
                media_urls: item.media?.map((m) => m.url) || [],
                sync_hash: newHash,
                last_synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            })
            itemsUpdated++
          }
        } else {
          // New item - prepare for bulk insert
          itemsToInsert.push({
            user_id: user.id,
            source_id: options.sourceId,
            external_id: externalId,
            title: item.title || 'Untitled',
            content: item.content || '',
            content_html: item.contentHtml,
            source_type: item.sourceType,
            source_name: item.sourceName,
            author_name: item.author?.name,
            author_url: item.author?.url,
            item_url: item.url,
            media_urls: item.media?.map((m) => m.url) || [],
            published_at: new Date(item.publishedAt).toISOString(),
            sync_hash: newHash,
            last_synced_at: new Date().toISOString(),
          })
          itemsAdded++
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('[FeedSync] Error processing item:', message, item)
        errors.push({
          message: `Failed to process item "${item.title}": ${message}`,
          code: 'ITEM_PROCESS_ERROR',
        })
      }
    }

    // Bulk insert new items
    if (itemsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('feed_items')
        .insert(itemsToInsert)

      if (insertError) {
        console.error('[FeedSync] Bulk insert error:', insertError)
        throw new Error(
          `Failed to insert items: ${insertError.message}`
        )
      }
    }

    // Update existing items
    for (const { id, updates } of itemsToUpdate) {
      const { error: updateError } = await supabase
        .from('feed_items')
        .update(updates)
        .eq('id', id)

      if (updateError) {
        console.error('[FeedSync] Update error for item', id, updateError)
        errors.push({
          message: `Failed to update item: ${updateError.message}`,
          code: 'ITEM_UPDATE_ERROR',
        })
      }
    }

    // Update sync log with results
    const syncStatus =
      errors.length === 0
        ? 'success'
        : errors.length < items.length
          ? 'partial'
          : 'error'

    const { error: updateLogError } = await supabase
      .from('feed_sync_logs')
      .update({
        status: syncStatus,
        items_fetched: items.length,
        items_added: itemsAdded,
        items_updated: itemsUpdated,
        items_skipped: itemsSkipped,
        completed_at: new Date().toISOString(),
        metadata: {
          duration_ms: Date.now() - startTime,
          error_count: errors.length,
        },
      })
      .eq('id', syncLogId)

    if (updateLogError) {
      console.warn('[FeedSync] Failed to update sync log:', updateLogError)
    }

    return {
      success: errors.length === 0,
      itemsFetched: items.length,
      itemsAdded,
      itemsUpdated,
      itemsSkipped,
      errors,
      syncDuration: Date.now() - startTime,
      logId: syncLogId,
    }
  } catch (error) {
    // Update sync log with error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const { error: updateLogError } = await supabase
      .from('feed_sync_logs')
      .update({
        status: 'error',
        error_message: errorMessage,
        error_code: 'SYNC_ERROR',
        completed_at: new Date().toISOString(),
        metadata: {
          duration_ms: Date.now() - startTime,
        },
      })
      .eq('id', syncLogId)

    if (updateLogError) {
      console.error('[FeedSync] Failed to update error log:', updateLogError)
    }

    throw error
  }
}

/**
 * Fetch items for a user from database
 */
export async function getFeedItems(
  userId: string,
  options?: {
    sourceId?: string
    sourceType?: string
    limit?: number
    offset?: number
    since?: number
  }
) {
  const supabase = await createClient()
  
  let query = supabase
    .from('feed_items')
    .select('*')
    .eq('user_id', userId)

  if (options?.sourceId) {
    query = query.eq('source_id', options.sourceId)
  }
  
  if (options?.sourceType) {
    query = query.eq('source_type', options.sourceType)
  }
  
  if (options?.since) {
    query = query.gt('published_at', new Date(options.since).toISOString())
  }

  query = query.order('published_at', { ascending: false })

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
  } else if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('[FeedSync] Error fetching feed items:', error)
    throw error
  }

  return data
}

/**
 * Get sync history for a source
 */
export async function getSyncHistory(
  sourceId: string,
  limit: number = 50
) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('feed_sync_logs')
    .select('*')
    .eq('source_id', sourceId)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[FeedSync] Error fetching sync history:', error)
    throw error
  }

  return data
}

/**
 * Clean up old items (older than specified date)
 */
export async function cleanupOldItems(
  userId: string,
  olderThanDays: number = 30
) {
  const supabase = await createClient()
  
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

  const { data, error: deleteError } = await supabase
    .from('feed_items')
    .delete()
    .eq('user_id', userId)
    .lt('published_at', cutoffDate.toISOString())

  if (deleteError) {
    console.error('[FeedSync] Error cleaning up old items:', deleteError)
    throw deleteError
  }

  return data
}
