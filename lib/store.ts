'use client'

import { create } from 'zustand'
import type { FeedSource, FeedItem, UserSettings, Notification, SourceType } from './types'
import * as db from './db'

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
  activeFilter: SourceType | 'all'
  activeSourceId: string | null
  settingsOpen: boolean
  
  // Auth state
  user: AuthUser | null
  isAuthenticated: boolean
  
  // Actions
  initialize: () => Promise<void>
  
  // Auth
  setUser: (user: AuthUser | null) => void
  syncWithCloud: () => Promise<void>
  
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
  user: null,
  isAuthenticated: false,
  
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
  
  setUser: (user) => {
    set({ user, isAuthenticated: !!user })
    if (user) {
      // Sync with cloud when user logs in
      get().syncWithCloud()
    }
  },
  
  syncWithCloud: async () => {
    const { user } = get()
    if (!user) return
    
    try {
      // Fetch sources from cloud
      const sourcesRes = await fetch('/api/user/sources')
      if (sourcesRes.ok) {
        const { sources: cloudSources } = await sourcesRes.json()
        
        // Merge cloud sources with local (cloud takes precedence)
        for (const cloudSource of cloudSources || []) {
          const localSource: FeedSource = {
            id: cloudSource.id,
            type: cloudSource.source_type as SourceType,
            name: cloudSource.name,
            url: cloudSource.url,
            credentials: cloudSource.encrypted_credentials 
              ? JSON.parse(cloudSource.encrypted_credentials) 
              : undefined,
            refreshInterval: cloudSource.refresh_interval,
            enabled: cloudSource.enabled,
            lastFetched: cloudSource.last_fetched_at 
              ? new Date(cloudSource.last_fetched_at).getTime() 
              : undefined,
          }
          await db.addSource(localSource)
        }
      }
      
      // Fetch settings from cloud
      const settingsRes = await fetch('/api/user/settings')
      if (settingsRes.ok) {
        const { settings: cloudSettings } = await settingsRes.json()
        if (cloudSettings) {
          await db.updateSettings({
            theme: cloudSettings.theme,
            showExternalMedia: cloudSettings.show_media,
            notificationsEnabled: cloudSettings.notifications_enabled,
          })
        }
      }
      
      // Reload local state
      await get().loadSources()
      await get().loadSettings()
      
    } catch (error) {
      console.error('Cloud sync error:', error)
    }
  },
  
  loadSources: async () => {
    const sources = await db.getSources()
    set({ sources })
  },
  
  addSource: async (source) => {
    await db.addSource(source)
    
    // Sync to cloud if authenticated
    const { user } = get()
    if (user) {
      try {
        await fetch('/api/user/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_type: source.type,
            name: source.name,
            url: source.url,
            encrypted_credentials: source.credentials 
              ? JSON.stringify(source.credentials) 
              : null,
            refresh_interval: source.refreshInterval,
            enabled: source.enabled,
          }),
        })
      } catch (error) {
        console.error('Cloud sync error:', error)
      }
    }
    
    await get().loadSources()
  },
  
  updateSource: async (id, updates) => {
    await db.updateSource(id, updates)
    
    // Sync to cloud if authenticated
    const { user } = get()
    if (user) {
      try {
        await fetch('/api/user/sources', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            source_type: updates.type,
            name: updates.name,
            url: updates.url,
            encrypted_credentials: updates.credentials 
              ? JSON.stringify(updates.credentials) 
              : undefined,
            refresh_interval: updates.refreshInterval,
            enabled: updates.enabled,
            last_fetched_at: updates.lastFetched 
              ? new Date(updates.lastFetched).toISOString() 
              : undefined,
          }),
        })
      } catch (error) {
        console.error('Cloud sync error:', error)
      }
    }
    
    await get().loadSources()
  },
  
  deleteSource: async (id) => {
    await db.deleteSource(id)
    
    // Sync to cloud if authenticated
    const { user } = get()
    if (user) {
      try {
        await fetch(`/api/user/sources?id=${id}`, {
          method: 'DELETE',
        })
      } catch (error) {
        console.error('Cloud sync error:', error)
      }
    }
    
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
    
    // Sync to cloud if authenticated
    const { user } = get()
    if (user) {
      try {
        await fetch('/api/user/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            theme: newSettings.theme,
            show_media: newSettings.showExternalMedia,
            notifications_enabled: newSettings.notificationsEnabled,
          }),
        })
      } catch (error) {
        console.error('Cloud sync error:', error)
      }
    }
    
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
        title: 'Error de actualizacion',
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
