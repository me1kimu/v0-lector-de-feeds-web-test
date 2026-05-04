'use client'

import { create } from 'zustand'
import type { FeedSource, FeedItem, UserSettings, Notification, SourceType } from './types'
import { logger } from './logger'

interface AuthUser {
  id: string
  email: string
  displayName?: string
}

interface FeedStore {
  // State
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
  
  // Auth state
  user: AuthUser | null
  isAuthenticated: boolean
  
  // Actions
  initialize: () => Promise<void>
  
  // Auth
  setUser: (user: AuthUser | null) => void
  
  // Sources
  loadSources: () => Promise<void>
  addSource: (source: FeedSource) => Promise<void>
  updateSource: (id: string, updates: Partial<FeedSource>) => Promise<void>
  deleteSource: (id: string) => Promise<void>
  deleteAllSources: () => Promise<void>
  
  // Items
  loadItems: (options?: { sourceId?: string; sourceType?: string; limit?: number }) => Promise<void>
  setActiveFilter: (filter: SourceType | 'all') => void
  setActiveSourceId: (id: string | null) => void
  
  // Settings
  loadSettings: () => Promise<void>
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>
  setSettingsOpen: (open: boolean) => void
  setNotificationsOpen: (open: boolean) => void
  
  // Notifications
  loadNotifications: () => Promise<void>
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
  markAllNotificationsRead: () => Promise<void>
  clearNotification: (id: string) => Promise<void>
  
  // Refresh
  refreshSource: (sourceId: string) => Promise<void>
  refreshAllSources: () => Promise<void>
  refreshWithContext: () => Promise<void>
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
  itemsLoading: false,
  activeFilter: 'all',
  activeSourceId: null,
  settingsOpen: false,
  notificationsOpen: false,
  user: null,
  isAuthenticated: false,
  
  initialize: async () => {
    const { isAuthenticated } = get()
    if (!isAuthenticated) return

    set({ isLoading: true })
    try {
      // Load essential UI data first
      await Promise.all([
        get().loadSources(),
        get().loadSettings(),
        get().loadNotifications()
      ])
      
      // Clear main loading state so UI appears
      set({ isLoading: false })
      
      // Load items in the background
      await get().loadItems({ limit: 100 })
    } catch (error) {
      logger.error('Store', 'Error during initialization', error)
      set({ isLoading: false })
    }
  },
  
  setUser: (user) => {
    const wasAuthenticated = get().isAuthenticated
    set({ user, isAuthenticated: !!user })
    
    if (user && !wasAuthenticated) {
      get().initialize()
    } else if (!user) {
      set({ sources: [], items: [], notifications: [] })
    }
  },
  
  loadSources: async () => {
    const { isAuthenticated } = get()
    if (!isAuthenticated) return

    try {
      const res = await fetch('/api/user/sources')
      if (res.ok) {
        const { sources: cloudSources } = await res.json()
        const sources: FeedSource[] = (cloudSources || []).map((cs: any) => ({
          id: cs.id,
          type: cs.type as SourceType,
          name: cs.name,
          url: cs.url,
          refreshInterval: cs.refresh_interval,
          enabled: cs.enabled,
          lastFetched: cs.last_fetched_at ? new Date(cs.last_fetched_at).getTime() : undefined,
        }))
        set({ sources })
      }
    } catch (error) {
      logger.error('Store', 'Error loading sources', error)
    }
  },
  
  addSource: async (source) => {
    const { isAuthenticated } = get()
    if (!isAuthenticated) return

    try {
      const res = await fetch('/api/user/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: source.type,
          name: source.name,
          url: source.url,
          encrypted_credentials: source.credentials ? JSON.stringify(source.credentials) : null,
          refresh_interval: source.refreshInterval,
          enabled: source.enabled,
        }),
      })
      
      if (res.ok) {
        await get().loadSources()
      }
    } catch (error) {
      logger.error('Store', 'Error adding source', error)
    }
  },
  
  updateSource: async (id, updates) => {
    const { isAuthenticated } = get()
    if (!isAuthenticated) return

    try {
      const res = await fetch('/api/user/sources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          source_type: updates.type,
          name: updates.name,
          url: updates.url,
          refresh_interval: updates.refreshInterval,
          enabled: updates.enabled,
        }),
      })
      
      if (res.ok) {
        await get().loadSources()
      }
    } catch (error) {
      logger.error('Store', 'Error updating source', error)
    }
  },
  
  deleteSource: async (id) => {
    const { isAuthenticated } = get()
    if (!isAuthenticated) return

    try {
      const res = await fetch(`/api/user/sources?id=${id}`, {
        method: 'DELETE',
      })
      
      if (res.ok) {
        await get().loadSources()
        await get().loadItems({ limit: 100 })
      }
    } catch (error) {
      logger.error('Store', 'Error deleting source', error)
    }
  },
  
  deleteAllSources: async () => {
    const { isAuthenticated } = get()
    if (!isAuthenticated) return

    try {
      const res = await fetch('/api/user/sources?deleteAll=true', {
        method: 'DELETE',
      })
      
      if (res.ok) {
        set({ sources: [], items: [] })
      }
    } catch (error) {
      logger.error('Store', 'Error deleting all sources', error)
    }
  },
  
  loadItems: async (options) => {
    const { isAuthenticated, activeFilter, activeSourceId } = get()
    if (!isAuthenticated) return

    set({ itemsLoading: true })
    try {
      const params = new URLSearchParams()
      if (activeSourceId) params.append('sourceId', activeSourceId)
      if (activeFilter !== 'all') params.append('sourceType', activeFilter)
      if (options?.limit) params.append('limit', options.limit.toString())

      const res = await fetch(`/api/user/items?${params.toString()}`)
      if (res.ok) {
        const { items: cloudItems } = await res.json()
        const items: FeedItem[] = (cloudItems || []).map((ci: any) => ({
          id: ci.external_id || ci.id,
          sourceId: ci.source_id,
          sourceType: ci.source_type,
          sourceName: ci.source_name,
          title: ci.title,
          content: ci.content,
          contentHtml: ci.content_html,
          url: ci.item_url,
          author: {
            name: ci.author_name,
            url: ci.author_url,
          },
          publishedAt: new Date(ci.published_at).getTime(),
          media: (ci.media_urls || []).map((url: string) => ({ url, type: 'image' })),
          raw: {}
        }))
        set({ items })
      }
    } catch (error) {
      logger.error('Store', 'Error loading items', error)
    } finally {
      set({ itemsLoading: false })
    }
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
    const { isAuthenticated } = get()
    if (!isAuthenticated) return

    try {
      const res = await fetch('/api/user/settings')
      if (res.ok) {
        const { settings: cloudSettings } = await res.json()
        if (cloudSettings) {
          const settings: UserSettings = {
            theme: cloudSettings.theme || 'system',
            showExternalMedia: cloudSettings.show_media ?? true,
            compactMode: false,
            notificationsEnabled: cloudSettings.notifications_enabled ?? true,
            defaultRefreshInterval: 15
          }
          set({ settings })
          
          // Apply theme
          if (typeof window !== 'undefined') {
            const root = document.documentElement
            if (settings.theme === 'dark') {
              root.classList.add('dark')
            } else if (settings.theme === 'light') {
              root.classList.remove('dark')
            } else {
              if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                root.classList.add('dark')
              } else {
                root.classList.remove('dark')
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error('Store', 'Error loading settings', error)
    }
  },
  
  updateSettings: async (newSettings) => {
    const { isAuthenticated } = get()
    if (!isAuthenticated) return

    try {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: newSettings.theme,
          show_media: newSettings.showExternalMedia,
          notifications_enabled: newSettings.notificationsEnabled,
        }),
      })
      
      if (res.ok) {
        await get().loadSettings()
      }
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
    // Current implementation doesn't have a notifications API, 
    // we might want to add one or keep it in-memory for now
    // For now, let's just use local state
  },
  
  addNotification: async (notification) => {
    const fullNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      read: false
    }
    set(state => ({
      notifications: [fullNotification, ...state.notifications].slice(0, 50)
    }))
    
    // Show browser notification if enabled
    const { settings } = get()
    if (settings.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, { body: notification.message })
    }
  },
  
  markNotificationRead: async (id) => {
    set(state => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
    }))
  },
  
  markAllNotificationsRead: async () => {
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, read: true }))
    }))
  },
  
  clearNotification: async (id) => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }))
  },
  
  refreshSource: async (sourceId) => {
    const { isAuthenticated, sources } = get()
    if (!isAuthenticated) return

    const source = sources.find(s => s.id === sourceId)
    if (!source || !source.enabled) return
    
    try {
      const response = await fetch(`/api/feeds/${source.type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      const items = data.items || []
      
      if (items.length > 0) {
        // Sync items to cloud
        await fetch('/api/feeds/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source,
            items,
            updateExisting: true
          })
        })
        
        await get().loadItems({ limit: 100 })
      }
      
      // Update last fetched timestamp
      await fetch('/api/user/sources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sourceId,
          last_fetched_at: new Date().toISOString()
        })
      })
      
      await get().loadSources()
    } catch (error) {
      logger.error('Store', `Error refreshing ${source?.type} feed`, error)
    }
  },
  
  refreshAllSources: async () => {
    const { isAuthenticated, sources } = get()
    if (!isAuthenticated) return

    set({ isLoading: true })
    const activeSources = sources.filter(s => s.enabled)
    await Promise.allSettled(activeSources.map(s => get().refreshSource(s.id)))
    set({ isLoading: false })
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
    } else {
      await get().refreshAllSources()
    }
  },
}))
