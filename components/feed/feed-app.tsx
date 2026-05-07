'use client'

import { useEffect, useState } from 'react'
import { useFeedStore } from '@/lib/store'
import { useServiceWorker } from '@/hooks/use-service-worker'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { FeedList } from './feed-list'
import { SettingsPanel } from './settings-panel'
import { NotificationsPanel } from './notifications-panel'
import { FeedChatbot } from './feed-chatbot'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { WifiOff } from 'lucide-react'

export function FeedApp() {
  const { initialize, isLoading, refreshAllSources, notificationsOpen, setNotificationsOpen, refreshProgress } = useFeedStore()
  const { isOnline, isRegistered } = useServiceWorker()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
    void initialize()
    
    // Listen for background sync events from service worker
    const handleSyncFeeds = () => {
      refreshAllSources()
    }
    
    window.addEventListener('sync-feeds', handleSyncFeeds)
    
    return () => {
      window.removeEventListener('sync-feeds', handleSyncFeeds)
    }
  }, [initialize, refreshAllSources])

  // Show spinner while mounting and hydrating local state
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
        <Sidebar onOpenChat={() => setChatOpen(true)} />
      </div>
      
      {/* Sidebar - mobile */}
      <div className={cn(
        'fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <Sidebar onOpenChat={() => { setChatOpen(true); setSidebarOpen(false); }} />
      </div>
      
      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <Header 
          showMenuButton={true}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)} 
        />
        
        {isLoading && refreshProgress ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
            <div className="w-full max-w-md">
              <div className="mb-2 text-sm text-muted-foreground text-center">
                Actualizando fuentes ({refreshProgress.completed}/{refreshProgress.total})
              </div>
              <Progress 
                value={(refreshProgress.completed / refreshProgress.total) * 100} 
                className="h-2"
              />
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner className="h-8 w-8 text-primary" />
          </div>
        ) : (
          <FeedList />
        )}
      </main>
      
      {/* Settings panel */}
      <SettingsPanel />
      
      {/* Notifications panel */}
      <NotificationsPanel open={notificationsOpen} onOpenChange={setNotificationsOpen} />
      
      {/* AI Chatbot */}
      <FeedChatbot open={chatOpen} onOpenChange={setChatOpen} />
      
      {/* Offline indicator */}
      {!isOnline && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Badge variant="secondary" className="flex items-center gap-2 px-4 py-2 bg-amber-500/90 text-amber-50">
            <WifiOff className="h-4 w-4" />
            Sin conexión - Usando datos sincronizados
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
