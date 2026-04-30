'use client'

import { useEffect } from 'react'
import { useFeedStore } from '@/lib/store'
import { FeedCard } from './feed-card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle, EmptyHeader } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { Rss, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'


export function FeedList() {
  const { 
    items, 
    sources,
    isLoading, 
    settings,
    activeFilter,
    activeSourceId,
    refreshAllSources,
    setSettingsOpen
  } = useFeedStore()
  
  // Set up auto-refresh based on source intervals
  useEffect(() => {
    const intervals: NodeJS.Timeout[] = []
    
    sources.forEach(source => {
      if (source.enabled && source.refreshInterval > 0) {
        const interval = setInterval(() => {
          useFeedStore.getState().refreshSource(source.id)
        }, source.refreshInterval * 60 * 1000)
        intervals.push(interval)
      }
    })
    
    return () => {
      intervals.forEach(clearInterval)
    }
  }, [sources])
  
  const activeSource = activeSourceId 
    ? sources.find(s => s.id === activeSourceId) 
    : null
  
  const title = activeSource 
    ? activeSource.name 
    : activeFilter === 'all' 
      ? 'Todos los feeds' 
      : activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)
  
  if (sources.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Rss className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>Bienvenido a FeedReader</EmptyTitle>
            <EmptyDescription>
              Comienza agregando fuentes RSS, Mastodon o Bluesky para ver tu feed unificado.
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => setSettingsOpen(true)}>
            Agregar primera fuente
          </Button>
        </Empty>
      </div>
    )
  }
  
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {items.length} elemento{items.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refreshAllSources}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </header>
      
      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && items.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="h-8 w-8 text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Rss className="h-6 w-6" />
                </EmptyMedia>
                <EmptyTitle>No hay contenido</EmptyTitle>
                <EmptyDescription>
                  No hay publicaciones para mostrar. Intenta actualizar tus fuentes.
                </EmptyDescription>
              </EmptyHeader>
              <Button variant="outline" onClick={refreshAllSources}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar ahora
              </Button>
            </Empty>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map(item => (
              <FeedCard 
                key={item.id} 
                item={item} 
                compact={settings.compactMode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
