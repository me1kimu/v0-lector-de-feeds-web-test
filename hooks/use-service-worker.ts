'use client'

import { useEffect, useState } from 'react'

interface ServiceWorkerState {
  isSupported: boolean
  isRegistered: boolean
  registration: ServiceWorkerRegistration | null
  isOnline: boolean
}

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    registration: null,
    isOnline: true
  })
  
  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator
    
    setState(prev => ({
      ...prev,
      isSupported,
      isOnline: navigator.onLine
    }))
    
    if (!isSupported) return
    
    // Register service worker
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        setState(prev => ({
          ...prev,
          isRegistered: true,
          registration
        }))
        
        // Check for updates periodically
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000) // Every hour
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error)
      })
    
    // Listen for online/offline events
    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }))
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }))
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'SYNC_FEEDS') {
        // Trigger feed refresh in the app
        window.dispatchEvent(new CustomEvent('sync-feeds'))
      }
    })
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
  
  const requestBackgroundSync = async () => {
    if (!state.registration) return false
    
    try {
      await state.registration.sync.register('sync-feeds')
      return true
    } catch {
      return false
    }
  }
  
  const requestPeriodicSync = async (intervalMinutes: number) => {
    if (!state.registration) return false
    
    try {
      const status = await navigator.permissions.query({
        name: 'periodic-background-sync' as PermissionName
      })
      
      if (status.state === 'granted') {
        await (state.registration as ServiceWorkerRegistration & {
          periodicSync: { register: (tag: string, options: { minInterval: number }) => Promise<void> }
        }).periodicSync.register('refresh-feeds', {
          minInterval: intervalMinutes * 60 * 1000
        })
        return true
      }
    } catch {
      // Periodic sync not supported
    }
    
    return false
  }
  
  return {
    ...state,
    requestBackgroundSync,
    requestPeriodicSync
  }
}
