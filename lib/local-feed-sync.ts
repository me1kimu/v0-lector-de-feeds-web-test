import type { FeedItem, FeedSource, SourceType } from './types'
import { deleteItem, getAllItems, putItems } from './local-db'

export interface LocalSyncResult {
  success: boolean
  itemsFetched: number
  itemsAdded: number
  itemsUpdated: number
  itemsSkipped: number
  errors: Array<{ message: string; code: string }>
}

function stableHash(input: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}

export function computeItemHash(item: FeedItem): string {
  return stableHash(JSON.stringify({
    title: item.title,
    content: item.content,
    contentHtml: item.contentHtml,
    fullContent: item.fullContent,
  }))
}

export function generateExternalId(item: FeedItem): string {
  if (item.id) return item.id
  if (item.url) return item.url
  return stableHash(`${item.sourceId}:${item.title || ''}:${item.publishedAt || 0}`)
}

export async function syncItemsLocally(
  items: FeedItem[],
  source: FeedSource,
  options?: { updateExisting?: boolean },
): Promise<LocalSyncResult> {
  const existingItems = await getAllItems()
  const existingMap = new Map(
    existingItems
      .filter((item) => item.sourceId === source.id)
      .map((item) => [item.id, item]),
  )

  const nextItems: FeedItem[] = []
  let itemsAdded = 0
  let itemsUpdated = 0
  let itemsSkipped = 0

  for (const item of items) {
    const id = generateExternalId(item)
    const syncHash = computeItemHash(item)
    const existing = existingMap.get(id)

    if (existing) {
      if (existing.raw && (existing.raw as { syncHash?: string }).syncHash === syncHash && !options?.updateExisting) {
        itemsSkipped += 1
        continue
      }

      itemsUpdated += 1
      nextItems.push({
        ...existing,
        ...item,
        id,
        sourceId: source.id,
        sourceType: (item.sourceType || source.type) as SourceType,
        sourceName: item.sourceName || source.name,
        raw: {
          ...(item.raw || {}),
          syncHash,
        },
      })
      continue
    }

    itemsAdded += 1
    nextItems.push({
      ...item,
      id,
      sourceId: source.id,
      sourceType: (item.sourceType || source.type) as SourceType,
      sourceName: item.sourceName || source.name,
      raw: {
        ...(item.raw || {}),
        syncHash,
      },
    })
  }

  if (nextItems.length > 0) {
    await putItems(nextItems)
  }

  return {
    success: true,
    itemsFetched: items.length,
    itemsAdded,
    itemsUpdated,
    itemsSkipped,
    errors: [],
  }
}

export async function cleanupLocalItems(olderThanDays = 30): Promise<void> {
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
  const allItems = await getAllItems()
  const staleItems = allItems.filter((item) => item.publishedAt < cutoff)

  if (staleItems.length === 0) return

  for (const item of staleItems) {
    await deleteItem(item.id)
  }
}
