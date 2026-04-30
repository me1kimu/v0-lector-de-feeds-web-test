'use client'

import { useEffect, useState } from 'react'
import { useFeedStore } from '@/lib/store'
import { useServiceWorker } from '@/hooks/use-service-worker'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { FeedList } from './feed-list'
import { SettingsPanel } from './settings-panel'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { WifiOff } from 'lucide-react'

export function FeedApp() {
  const { initialize, isLoading, refreshAllSources } = useFeedStore()
  const { isOnline, isRegistered } = useServiceWorker()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
    initialize()
    
    // Listen for background sync events from service worker
    const handleSyncFeeds = () => {
      refreshAllSources()
    }
    
    window.addEventListener('sync-feeds', handleSyncFeeds)
    
    return () => {
      window.removeEventListener('sync-feeds', handleSyncFeeds)
    }
  }, [initialize, refreshAllSources])
  
  if (!mounted) {
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
