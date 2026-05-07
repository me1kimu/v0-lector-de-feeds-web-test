import type { FeedItem, FeedSource, Notification, UserSettings } from './types'

const DB_NAME = 'feedreader-local'
const DB_VERSION = 1
const SOURCES_STORE = 'sources'
const ITEMS_STORE = 'items'
const SETTINGS_STORE = 'settings'
const NOTIFICATIONS_STORE = 'notifications'

type StoredSetting = {
  key: string
  value: UserSettings
}

let dbPromise: Promise<IDBDatabase> | null = null

function getDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this environment'))
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result

        if (!db.objectStoreNames.contains(SOURCES_STORE)) {
          db.createObjectStore(SOURCES_STORE, { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains(ITEMS_STORE)) {
          const itemsStore = db.createObjectStore(ITEMS_STORE, { keyPath: 'id' })
          itemsStore.createIndex('sourceId', 'sourceId', { unique: false })
          itemsStore.createIndex('sourceType', 'sourceType', { unique: false })
          itemsStore.createIndex('publishedAt', 'publishedAt', { unique: false })
        }

        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' })
        }

        if (!db.objectStoreNames.contains(NOTIFICATIONS_STORE)) {
          db.createObjectStore(NOTIFICATIONS_STORE, { keyPath: 'id' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'))
    })
  }

  return dbPromise
}

async function withTransaction<T>(storeName: string, mode: IDBTransactionMode, work: (store: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const db = await getDatabase()

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    let result: T

    transaction.oncomplete = () => resolve(result)
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'))

    Promise.resolve(work(store)).then(
      (value) => {
        result = value
      },
      (error) => {
        transaction.abort()
        reject(error)
      },
    )
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'))
  })
}

export async function getAllSources(): Promise<FeedSource[]> {
  return withTransaction(SOURCES_STORE, 'readonly', async (store) => {
    const values = await requestToPromise(store.getAll())
    return values as FeedSource[]
  })
}

export async function putSource(source: FeedSource): Promise<void> {
  await withTransaction(SOURCES_STORE, 'readwrite', (store) => requestToPromise(store.put(source)).then(() => undefined))
}

export async function deleteSource(sourceId: string): Promise<void> {
  await withTransaction(SOURCES_STORE, 'readwrite', (store) => requestToPromise(store.delete(sourceId)).then(() => undefined))
}

export async function clearSources(): Promise<void> {
  await withTransaction(SOURCES_STORE, 'readwrite', (store) => requestToPromise(store.clear()).then(() => undefined))
}

export async function getAllItems(): Promise<FeedItem[]> {
  return withTransaction(ITEMS_STORE, 'readonly', async (store) => {
    const values = await requestToPromise(store.getAll())
    return values as FeedItem[]
  })
}

export async function putItems(items: FeedItem[]): Promise<void> {
  await withTransaction(ITEMS_STORE, 'readwrite', async (store) => {
    for (const item of items) {
      await requestToPromise(store.put(item))
    }
    return undefined
  })
}

export async function deleteItem(itemId: string): Promise<void> {
  await withTransaction(ITEMS_STORE, 'readwrite', (store) => requestToPromise(store.delete(itemId)).then(() => undefined))
}

export async function deleteItemsBySource(sourceId: string): Promise<void> {
  await withTransaction(ITEMS_STORE, 'readwrite', async (store) => {
    const index = store.index('sourceId')
    const matching = await requestToPromise(index.getAll(sourceId))
    for (const item of matching as FeedItem[]) {
      await requestToPromise(store.delete(item.id))
    }
    return undefined
  })
}

export async function clearItems(): Promise<void> {
  await withTransaction(ITEMS_STORE, 'readwrite', (store) => requestToPromise(store.clear()).then(() => undefined))
}

export async function getSettings(): Promise<UserSettings | null> {
  return withTransaction(SETTINGS_STORE, 'readonly', async (store) => {
    const record = (await requestToPromise(store.get('app-settings'))) as StoredSetting | undefined
    return record?.value ?? null
  })
}

export async function setSettings(settings: UserSettings): Promise<void> {
  await withTransaction(SETTINGS_STORE, 'readwrite', (store) => requestToPromise(store.put({ key: 'app-settings', value: settings } satisfies StoredSetting)).then(() => undefined))
}

export async function getNotifications(): Promise<Notification[]> {
  return withTransaction(NOTIFICATIONS_STORE, 'readonly', async (store) => {
    const values = await requestToPromise(store.getAll())
    return values as Notification[]
  })
}

export async function putNotification(notification: Notification): Promise<void> {
  await withTransaction(NOTIFICATIONS_STORE, 'readwrite', (store) => requestToPromise(store.put(notification)).then(() => undefined))
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await withTransaction(NOTIFICATIONS_STORE, 'readwrite', (store) => requestToPromise(store.delete(notificationId)).then(() => undefined))
}

export async function clearNotifications(): Promise<void> {
  await withTransaction(NOTIFICATIONS_STORE, 'readwrite', (store) => requestToPromise(store.clear()).then(() => undefined))
}
