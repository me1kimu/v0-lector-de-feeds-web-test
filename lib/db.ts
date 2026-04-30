import Dexie, { type EntityTable } from 'dexie'
import type { FeedSource, FeedItem, UserSettings, Notification } from './types'

const db = new Dexie('FeedReaderDB') as Dexie & {
  sources: EntityTable<FeedSource, 'id'>
  items: EntityTable<FeedItem, 'id'>
  settings: EntityTable<UserSettings & { id: string }, 'id'>
  notifications: EntityTable<Notification, 'id'>
}

db.version(1).stores({
  sources: 'id, type, name, enabled',
  items: 'id, sourceId, sourceType, publishedAt, [sourceId+publishedAt]',
  settings: 'id',
  notifications: 'id, type, timestamp, read'
})

export { db }

export async function getSources(): Promise<FeedSource[]> {
  return db.sources.toArray()
}

export async function getSource(id: string): Promise<FeedSource | undefined> {
  return db.sources.get(id)
}

export async function addSource(source: FeedSource): Promise<string> {
  return db.sources.add(source)
}

export async function updateSource(id: string, updates: Partial<FeedSource>): Promise<number> {
  return db.sources.update(id, updates)
}

export async function deleteSource(id: string): Promise<void> {
  await db.sources.delete(id)
  await db.items.where('sourceId').equals(id).delete()
}

export async function getItems(options?: {
  sourceId?: string
  sourceType?: string
  limit?: number
  offset?: number
}): Promise<FeedItem[]> {
  let query = db.items.orderBy('publishedAt').reverse()
  
  if (options?.sourceId) {
    query = db.items.where('sourceId').equals(options.sourceId).reverse()
  } else if (options?.sourceType) {
    query = db.items.where('sourceType').equals(options.sourceType).reverse()
  }
  
  if (options?.offset) {
    query = query.offset(options.offset)
  }
  
  if (options?.limit) {
    query = query.limit(options.limit)
  }
  
  return query.toArray()
}

export async function addItems(items: FeedItem[]): Promise<void> {
  await db.items.bulkPut(items)
}

export async function clearOldItems(olderThan: number): Promise<number> {
  return db.items.where('publishedAt').below(olderThan).delete()
}

export async function getSettings(): Promise<UserSettings> {
  const settings = await db.settings.get('user')
  return settings ?? {
    theme: 'system',
    showExternalMedia: true,
    compactMode: false,
    notificationsEnabled: true,
    defaultRefreshInterval: 15
  }
}

export async function updateSettings(settings: Partial<UserSettings>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...settings, id: 'user' })
}

export async function getNotifications(unreadOnly = false): Promise<Notification[]> {
  let query = db.notifications.orderBy('timestamp').reverse()
  if (unreadOnly) {
    query = db.notifications.where('read').equals(0).reverse()
  }
  return query.limit(50).toArray()
}

export async function addNotification(notification: Notification): Promise<void> {
  await db.notifications.add(notification)
}

export async function markNotificationRead(id: string): Promise<void> {
  await db.notifications.update(id, { read: true })
}

export async function markAllNotificationsRead(): Promise<void> {
  await db.notifications.toCollection().modify({ read: true })
}
