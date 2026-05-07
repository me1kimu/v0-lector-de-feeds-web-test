'use client'

import { create } from 'zustand'
import type { FeedSource, FeedItem, UserSettings, Notification, SourceType } from './types'
import { logger } from './logger'
import { applyThemeSettings, DEFAULT_PALETTE } from './theme'
import {
  clearNotifications,
  clearItems,
  clearSources,
  deleteNotification,
  deleteSource as deleteSourceRecord,
  deleteItemsBySource,
  getAllItems,
  getAllSources,
  getNotifications,
  getSettings,
  putNotification,
  putSource,
  setSettings,
} from './local-db'
import { cleanupLocalItems, syncItemsLocally } from './local-feed-sync'

interface AuthUser {
  id: string
  email: string
  displayName?: string
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  palette: DEFAULT_PALETTE,
  showExternalMedia: true,
  compactMode: false,
  notificationsEnabled: true,
  defaultRefreshInterval: 15,
}

interface FeedStore {
  sources: FeedSource[]
  items: FeedItem[]
  settings: UserSettings
  notifications: Notification[]
  isLoading: boolean
  itemsLoading: boolean
  activeFilter: SourceType | 'all'
  activeSourceId: string | null
  settingsOpen: boolean
  notificationsOpen: boolean
  user: AuthUser | null
  isAuthenticated: boolean

  initialize: () => Promise<void>
  setUser: (user: AuthUser | null) => void

  loadSources: () => Promise<void>
  addSource: (source: FeedSource) => Promise<void>
  updateSource: (id: string, updates: Partial<FeedSource>) => Promise<void>
  deleteSource: (id: string) => Promise<void>
  deleteAllSources: () => Promise<void>

  loadItems: (options?: { sourceId?: string; sourceType?: string; limit?: number }) => Promise<void>
  setActiveFilter: (filter: SourceType | 'all') => void
  setActiveSourceId: (id: string | null) => void

  loadSettings: () => Promise<void>
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>
  setSettingsOpen: (open: boolean) => void
  setNotificationsOpen: (open: boolean) => void

  loadNotifications: () => Promise<void>
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
  markAllNotificationsRead: () => Promise<void>
  clearNotification: (id: string) => Promise<void>

  refreshSource: (sourceId: string) => Promise<void>
  refreshAllSources: () => Promise<void>
  refreshWithContext: () => Promise<void>
  refreshProgress: { completed: number; total: number } | null
}

function mergeSettings(settings: Partial<UserSettings> | null | undefined): UserSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    palette: settings?.palette || DEFAULT_PALETTE,
  }
}

async function fetchSourceItems(source: FeedSource): Promise<FeedItem[]> {
  const routeMap: Record<string, string> = {
    rss: '/api/feeds/rss',
    mastodon: '/api/feeds/mastodon',
    bluesky: '/api/feeds/bluesky',
    twitter: '/api/feeds/twitter',
    instagram: '/api/feeds/instagram',
    youtube: '/api/feeds/youtube',
  }

  const route = routeMap[source.type]
  if (!route) {
    throw new Error(`No local feed route configured for ${source.type}`)
  }

  const response = await fetch(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  })

  if (!response.ok) {
    const errData = await response.json().catch(() => null)
    throw new Error(errData?.error || `HTTP ${response.status}`)
  }

  const data = await response.json()
  return (data.items || []) as FeedItem[]
}

export const useFeedStore = create<FeedStore>((set, get) => ({
  sources: [],
  items: [],
  settings: DEFAULT_SETTINGS,
  notifications: [],
  isLoading: false,
  itemsLoading: false,
  activeFilter: 'all',
  activeSourceId: null,
  settingsOpen: false,
  notificationsOpen: false,
  user: {
    id: 'local-device',
    email: 'local@device',
    displayName: 'Modo local',
  },
  isAuthenticated: true,
  refreshProgress: null,

  initialize: async () => {
    set({ isLoading: true })

    try {
      await Promise.all([
        get().loadSources(),
        get().loadSettings(),
        get().loadNotifications(),
      ])

      await get().loadItems({ limit: 100 })
    } catch (error) {
      logger.error('Store', 'Error during initialization', error)
    } finally {
      set({ isLoading: false })
    }
  },

  setUser: (user) => {
    set({
      user: user || { id: 'local-device', email: 'local@device', displayName: 'Modo local' },
      isAuthenticated: true,
    })
  },

  loadSources: async () => {
    try {
      const sources = await getAllSources()
      set({ sources: sources.sort((left, right) => left.name.localeCompare(right.name)) })
    } catch (error) {
      logger.error('Store', 'Error loading sources', error)
    }
  },

  addSource: async (source) => {
    try {
      await putSource(source)
      await get().loadSources()
    } catch (error) {
      logger.error('Store', 'Error adding source', error)
    }
  },

  updateSource: async (id, updates) => {
    try {
      const source = get().sources.find((entry) => entry.id === id)
      if (!source) return

      await putSource({
        ...source,
        ...updates,
      })

      await get().loadSources()
    } catch (error) {
      logger.error('Store', 'Error updating source', error)
    }
  },

  deleteSource: async (id) => {
    try {
      await deleteSourceRecord(id)
      await deleteItemsBySource(id)
      await get().loadSources()
      await get().loadItems({ limit: 100 })
    } catch (error) {
      logger.error('Store', 'Error deleting source', error)
    }
  },

  deleteAllSources: async () => {
    try {
      await clearSources()
      await clearItems()
      await clearNotifications()
      set({ sources: [], items: [], notifications: [] })
    } catch (error) {
      logger.error('Store', 'Error deleting all sources', error)
    }
  },

  loadItems: async (options) => {
    set({ itemsLoading: true })

    try {
      const allItems = await getAllItems()
      const { activeFilter, activeSourceId } = get()
      const sourceId = options?.sourceId ?? activeSourceId
      const sourceType = options?.sourceType ?? (activeFilter === 'all' ? undefined : activeFilter)

      const filteredItems = allItems
        .filter((item) => !sourceId || item.sourceId === sourceId)
        .filter((item) => !sourceType || item.sourceType === sourceType)
        .sort((left, right) => right.publishedAt - left.publishedAt)

      set({ items: typeof options?.limit === 'number' ? filteredItems.slice(0, options.limit) : filteredItems })
    } catch (error) {
      logger.error('Store', 'Error loading items', error)
    } finally {
      set({ itemsLoading: false })
    }
  },

  setActiveFilter: (filter) => {
    set({ activeFilter: filter, activeSourceId: null })
    void get().loadItems({ limit: 100 })
  },

  setActiveSourceId: (id) => {
    set({ activeSourceId: id, activeFilter: 'all' })
    void get().loadItems({ limit: 100 })
  },

  loadSettings: async () => {
    try {
      const storedSettings = await getSettings()
      const settings = mergeSettings(storedSettings)
      set({ settings })
      applyThemeSettings(settings)

      if (!storedSettings) {
        await setSettings(settings)
      }
    } catch (error) {
      logger.error('Store', 'Error loading settings', error)
    }
  },

  updateSettings: async (newSettings) => {
    try {
      const settings = mergeSettings({
        ...get().settings,
        ...newSettings,
      })

      set({ settings })
      applyThemeSettings(settings)
      await setSettings(settings)
    } catch (error) {
      logger.error('Store', 'Error updating settings', error)
    }
  },

  setSettingsOpen: (open) => {
    set({ settingsOpen: open })
  },

  setNotificationsOpen: (open) => {
    set({ notificationsOpen: open })
  },

  loadNotifications: async () => {
    try {
      const notifications = await getNotifications()
      set({ notifications: notifications.sort((left, right) => right.timestamp - left.timestamp) })
    } catch (error) {
      logger.error('Store', 'Error loading notifications', error)
    }
  },

  addNotification: async (notification) => {
    const fullNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      read: false,
    }

    try {
      await putNotification(fullNotification)
      await get().loadNotifications()
    } catch (error) {
      logger.error('Store', 'Error adding notification', error)
    }

    const { settings } = get()
    if (settings.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, { body: notification.message })
    }
  },

  markNotificationRead: async (id) => {
    const notification = get().notifications.find((entry) => entry.id === id)
    if (!notification) return

    try {
      await putNotification({ ...notification, read: true })
      await get().loadNotifications()
    } catch (error) {
      logger.error('Store', 'Error marking notification read', error)
    }
  },

  markAllNotificationsRead: async () => {
    try {
      const notifications = get().notifications.map((notification) => ({ ...notification, read: true }))
      for (const notification of notifications) {
        await putNotification(notification)
      }
      set({ notifications })
    } catch (error) {
      logger.error('Store', 'Error marking notifications read', error)
    }
  },

  clearNotification: async (id) => {
    try {
      await deleteNotification(id)
      set((state) => ({ notifications: state.notifications.filter((notification) => notification.id !== id) }))
    } catch (error) {
      logger.error('Store', 'Error clearing notification', error)
    }
  },

  refreshSource: async (sourceId) => {
    const source = get().sources.find((entry) => entry.id === sourceId)
    if (!source || !source.enabled) return

    try {
      const items = await fetchSourceItems(source)
      if (items.length > 0) {
        await syncItemsLocally(items, source, { updateExisting: true })
        await cleanupLocalItems(30)
        await get().loadItems({ limit: 100 })
      }

      await putSource({
        ...source,
        lastFetched: Date.now(),
      })

      await get().loadSources()
    } catch (error) {
      logger.warn(
        'Store',
        `Error refreshing ${source?.type} feed: ${source?.name}`,
        undefined,
        error instanceof Error ? error : new Error(String(error)),
      )
    }
  },

  refreshAllSources: async () => {
    const activeSources = get().sources.filter((source) => source.enabled)
    set({ isLoading: true, refreshProgress: { completed: 0, total: activeSources.length } })

    try {
      const results = activeSources.map(async (source) => {
        await get().refreshSource(source.id)
        const { completed } = get().refreshProgress || { completed: 0 }
        set((state) => ({
          refreshProgress: state.refreshProgress
            ? { ...state.refreshProgress, completed: state.refreshProgress.completed + 1 }
            : null,
        }))
      })
      await Promise.allSettled(results)
    } finally {
      set({ isLoading: false, refreshProgress: null })
    }
  },

  refreshWithContext: async () => {
    const { activeSourceId } = get()

    if (activeSourceId) {
      set({ isLoading: true })
      try {
        await get().refreshSource(activeSourceId)
      } finally {
        set({ isLoading: false })
      }
      return
    }

    await get().refreshAllSources()
  },
}))
