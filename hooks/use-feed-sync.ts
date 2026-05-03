import { useEffect, useState, useCallback } from 'react'
import { useFeedStore } from './store'

/**
 * Hook for managing feed synchronization with polling and background sync
 */
export function useFeedSync() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null)
  const [syncErrors, setSyncErrors] = useState<Array<{ source: string; error: string }>>([])
  
  const { sources, refreshAllSources, settings } = useFeedStore()

  // Refresh all enabled sources
  const syncNow = useCallback(async () => {
    if (isSyncing) return
    
    setIsSyncing(true)
    setSyncErrors([])
    
    try {
      console.log('[FeedSync] Starting manual sync...')
      await refreshAllSources()
      setLastSyncTime(Date.now())
      console.log('[FeedSync] Manual sync completed')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[FeedSync] Manual sync failed:', message)
      setSyncErrors([{ source: 'all', error: message }])
    } finally {
      setIsSyncing(false)
    }
  }, [refreshAllSources, isSyncing])

  // Setup automatic sync based on refresh interval
  useEffect(() => {
    // Get default refresh interval from settings
    const intervalMs = (settings.defaultRefreshInterval ?? 15) * 60 * 1000
    
    if (intervalMs <= 0) {
      console.log('[FeedSync] Auto-sync disabled')
      return
    }

    console.log(`[FeedSync] Setting up auto-sync every ${intervalMs / 60000} minutes`)

    // Initial sync
    syncNow()

    // Setup interval
    const interval = setInterval(() => {
      syncNow()
    }, intervalMs)

    // Setup background sync (if supported)
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.sync) {
          registration.sync.register('feed-sync').catch((err) => {
            console.warn('[FeedSync] Background sync registration failed:', err)
          })
        }
      })
    }

    return () => {
      clearInterval(interval)
    }
  }, [settings.defaultRefreshInterval, syncNow])

  return {
    isSyncing,
    lastSyncTime,
    syncErrors,
    syncNow,
  }
}

/**
 * Hook for listening to sync status changes
 */
export function useSyncStatus(sourceId?: string) {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle')
  const [lastSync, setLastSync] = useState<number | null>(null)
  
  const { sources } = useFeedStore()
  
  const targetSource = sourceId 
    ? sources.find(s => s.id === sourceId)
    : null

  useEffect(() => {
    if (!targetSource) return
    
    if (targetSource.lastFetched) {
      setLastSync(targetSource.lastFetched)
      setSyncStatus('idle')
    }
  }, [targetSource])

  const timeSinceLastSync = lastSync 
    ? Math.round((Date.now() - lastSync) / 1000)
    : null

  return {
    syncStatus,
    lastSync,
    timeSinceLastSync,
  }
}
