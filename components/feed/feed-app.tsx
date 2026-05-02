'use client'

import { useEffect, useState } from 'react'
import { useFeedStore } from '@/lib/store'
import { useServiceWorker } from '@/hooks/use-service-worker'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { FeedList } from './feed-list'
import { SettingsPanel } from './settings-panel'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { WifiOff, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FeedApp() {
  const { initialize, isLoading, addSource } = useFeedStore()
  const { isOnline, isRegistered } = useServiceWorker()
  const { session, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [loadingUserData, setLoadingUserData] = useState(true)
  
  useEffect(() => {
    setMounted(true)
    initialize()
    
    // Load user's sources from Supabase
    const loadUserSources = async () => {
      if (!session?.userId) return

      try {
        const { data, error } = await supabase
          .from('feed_sources')
          .select('*')
          .eq('user_id', session.userId)

        if (error) {
          console.error('[v0] Failed to load user sources:', error)
          return
        }

        // Add each source to the store
        if (data) {
          for (const source of data) {
            addSource({
              id: source.id,
              type: source.type as any,
              url: source.url || '',
              name: source.name,
              refreshInterval: source.refresh_interval,
              credentials: {},
            })
          }
        }
      } catch (err) {
        console.error('[v0] Error loading user sources:', err)
      } finally {
        setLoadingUserData(false)
      }
    }

    loadUserSources()
    
    // Listen for background sync events from service worker
    const handleSyncFeeds = () => {
      initialize()
    }
    
    window.addEventListener('sync-feeds', handleSyncFeeds)
    
    return () => {
      window.removeEventListener('sync-feeds', handleSyncFeeds)
    }
  }, [initialize, addSource, session?.userId])
  
  if (!mounted || loadingUserData) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    )
  }
  
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar - desktop */}
      <div className="hidden lg:flex h-full">
        <Sidebar />
      </div>
      
      {/* Sidebar - mobile */}
      <div className={cn(
        'fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <Sidebar />
      </div>
      
      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <Header 
          showMenuButton 
          onMenuClick={() => setSidebarOpen(!sidebarOpen)} 
        />
        
        {isLoading && !mounted ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner className="h-8 w-8 text-primary" />
          </div>
        ) : (
          <FeedList />
        )}
      </main>
      
      {/* Settings panel */}
      <SettingsPanel />
      
      {/* Offline indicator */}
      {!isOnline && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Badge variant="secondary" className="flex items-center gap-2 px-4 py-2 bg-amber-500/90 text-amber-50">
            <WifiOff className="h-4 w-4" />
            Sin conexión - Mostrando contenido en caché
          </Badge>
        </div>
      )}
      
      {/* Logout button - fixed top right */}
      <div className="fixed top-4 right-4 z-50 lg:hidden">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={logout}
          title="Cerrar sesión"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
      
      {/* PWA status for debugging - hidden in production */}
      {isRegistered && process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 z-50">
          <Badge variant="outline" className="text-xs opacity-50">
            PWA Activo
          </Badge>
        </div>
      )}
    </div>
  )
}
