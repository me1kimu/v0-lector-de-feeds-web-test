'use client'

import { create } from 'zustand'
import type { FeedSource, FeedItem, UserSettings, Notification, SourceType } from './types'
import * as db from './db'

interface FeedStore {
  // State
  sources: FeedSource[]
  items: FeedItem[]
  settings: UserSettings
  notifications: Notification[]
  isLoading: boolean
  activeFilter: SourceType | 'all'
  activeSourceId: string | null
  settingsOpen: boolean
  
  // Actions
  initialize: () => Promise<void>
  
  // Sources
  loadSources: () => Promise<void>
  addSource: (source: FeedSource) => Promise<void>
  updateSource: (id: string, updates: Partial<FeedSource>) => Promise<void>
  deleteSource: (id: string) => Promise<void>
  
  // Items
  loadItems: (options?: { sourceId?: string; sourceType?: string; limit?: number }) => Promise<void>
  addItems: (items: FeedItem[]) => Promise<void>
  setActiveFilter: (filter: SourceType | 'all') => void
  setActiveSourceId: (id: string | null) => void
  
  // Settings
  loadSettings: () => Promise<void>
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>
  setSettingsOpen: (open: boolean) => void
  
  // Notifications
  loadNotifications: () => Promise<void>
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
  markAllNotificationsRead: () => Promise<void>
  
  // Refresh
  refreshSource: (sourceId: string) => Promise<void>
  refreshAllSources: () => Promise<void>
}

export const useFeedStore = create<FeedStore>((set, get) => ({
  sources: [],
  items: [],
  settings: {
    theme: 'system',
    showExternalMedia: true,
    compactMode: false,
    notificationsEnabled: true,
    defaultRefreshInterval: 15
  },
  notifications: [],
  isLoading: false,
  activeFilter: 'all',
  activeSourceId: null,
  settingsOpen: false,
  
  initialize: async () => {
    set({ isLoading: true })
    await Promise.all([
      get().loadSources(),
      get().loadSettings(),
      get().loadNotifications()
    ])
    await get().loadItems({ limit: 100 })
    set({ isLoading: false })
  },
  
  loadSources: async () => {
    const sources = await db.getSources()
    set({ sources })
  },
  
  addSource: async (source) => {
    await db.addSource(source)
    await get().loadSources()
  },
  
  updateSource: async (id, updates) => {
    await db.updateSource(id, updates)
    await get().loadSources()
  },
  
  deleteSource: async (id) => {
    await db.deleteSource(id)
    await get().loadSources()
    await get().loadItems({ limit: 100 })
  },
  
  loadItems: async (options) => {
    const { activeFilter, activeSourceId } = get()
    const queryOptions = {
      ...options,
      sourceId: activeSourceId ?? options?.sourceId,
      sourceType: activeSourceId ? undefined : (activeFilter !== 'all' ? activeFilter : options?.sourceType)
    }
    const items = await db.getItems(queryOptions)
    set({ items })
  },
  
  addItems: async (items) => {
    await db.addItems(items)
    await get().loadItems({ limit: 100 })
  },
  
  setActiveFilter: (filter) => {
    set({ activeFilter: filter, activeSourceId: null })
    get().loadItems({ limit: 100 })
  },
  
  setActiveSourceId: (id) => {
    set({ activeSourceId: id, activeFilter: 'all' })
    get().loadItems({ limit: 100 })
  },
  
  loadSettings: async () => {
    const settings = await db.getSettings()
    set({ settings })
    
    // Apply theme
    if (typeof window !== 'undefined') {
      const root = document.documentElement
      if (settings.theme === 'dark') {
        root.classList.add('dark')
      } else if (settings.theme === 'light') {
        root.classList.remove('dark')
      } else {
        // System preference
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          root.classList.add('dark')
        } else {
          root.classList.remove('dark')
        }
      }
    }
  },
  
  updateSettings: async (newSettings) => {
    await db.updateSettings(newSettings)
    await get().loadSettings()
  },
  
  setSettingsOpen: (open) => {
    set({ settingsOpen: open })
  },
  
  loadNotifications: async () => {
    const notifications = await db.getNotifications()
    set({ notifications })
  },
  
  addNotification: async (notification) => {
    const fullNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      read: false
    }
    await db.addNotification(fullNotification)
    await get().loadNotifications()
    
    // Show browser notification if enabled
    const { settings } = get()
    if (settings.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, { body: notification.message })
    }
  },
  
  markNotificationRead: async (id) => {
    await db.markNotificationRead(id)
    await get().loadNotifications()
  },
  
  markAllNotificationsRead: async () => {
    await db.markAllNotificationsRead()
    await get().loadNotifications()
  },
  
  refreshSource: async (sourceId) => {
    const source = get().sources.find(s => s.id === sourceId)
    if (!source || !source.enabled) return
    
    try {
      const response = await fetch(`/api/feeds/${source.type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source })
      })
      
      if (!response.ok) throw new Error('Failed to fetch feed')
      
      const { items } = await response.json()
      await get().addItems(items)
      await get().updateSource(sourceId, { lastFetched: Date.now() })
    } catch (error) {
      console.error(`Failed to refresh ${source.name}:`, error)
      await get().addNotification({
        type: 'error',
        title: 'Error de actualización',
        message: `No se pudo actualizar ${source.name}`,
        sourceId
      })
    }
  },
  
  refreshAllSources: async () => {
    set({ isLoading: true })
    const sources = get().sources.filter(s => s.enabled)
    await Promise.allSettled(sources.map(s => get().refreshSource(s.id)))
    set({ isLoading: false })
  }
}))
