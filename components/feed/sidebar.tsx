'use client'

import { cn } from '@/lib/utils'
import { useFeedStore } from '@/lib/store'
import type { SourceType } from '@/lib/types'
import { 
  Rss, 
  AtSign, 
  CloudSun, 
  Settings, 
  Bell,
  RefreshCw,
  Plus,
  Layers,
  Twitter,
  Camera
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

const sourceTypeIcons: Record<SourceType, React.ReactNode> = {
  rss: <Rss className="h-4 w-4" />,
  mastodon: <AtSign className="h-4 w-4" />,
  bluesky: <CloudSun className="h-4 w-4" />,
  pixelfed: <Layers className="h-4 w-4" />,
  instagram: <Camera className="h-4 w-4" />,
  twitter: <Twitter className="h-4 w-4" />,
  inkbunny: <Layers className="h-4 w-4" />,
  finance: <Layers className="h-4 w-4" />
}

const sourceTypeLabels: Record<SourceType, string> = {
  rss: 'RSS',
  mastodon: 'Mastodon',
  bluesky: 'Bluesky',
  pixelfed: 'Pixelfed',
  instagram: 'Instagram',
  twitter: 'Twitter',
  inkbunny: 'Inkbunny',
  finance: 'Finanzas'
}

interface SidebarProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const { 
    sources, 
    activeFilter, 
    activeSourceId,
    notifications,
    isLoading,
    setActiveFilter, 
    setActiveSourceId,
    setSettingsOpen,
    refreshAllSources
  } = useFeedStore()
  
  const unreadCount = notifications.filter(n => !n.read).length
  
  // Group sources by type
  const sourcesByType = sources.reduce((acc, source) => {
    if (!acc[source.type]) acc[source.type] = []
    acc[source.type].push(source)
    return acc
  }, {} as Record<SourceType, typeof sources>)
  
  const activeTypes = Object.keys(sourcesByType) as SourceType[]
  
  return (
    <aside 
      className={cn(
        'flex flex-col border-r border-border bg-sidebar h-full transition-all duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
          <Rss className="h-4 w-4" />
        </div>
        {!collapsed && (
          <h1 className="font-semibold text-sidebar-foreground">FeedReader</h1>
        )}
      </div>
      
      {/* Actions */}
      <div className={cn('flex gap-2 p-3 border-b border-border', collapsed ? 'flex-col' : '')}>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refreshAllSources}
          disabled={isLoading}
          className={cn('flex-1', collapsed && 'w-full px-0')}
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin', !collapsed && 'mr-2')} />
          {!collapsed && 'Actualizar'}
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setSettingsOpen(true)}
          className={cn(collapsed && 'w-full px-0')}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="p-2">
          {/* All feeds */}
          <button
            onClick={() => setActiveFilter('all')}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors',
              activeFilter === 'all' && !activeSourceId
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
            )}
          >
            <Layers className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Todos los feeds</span>}
          </button>
          
          {/* Source types */}
          {activeTypes.map(type => (
            <div key={type} className="mt-4">
              <button
                onClick={() => setActiveFilter(type)}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors',
                  activeFilter === type && !activeSourceId
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                {sourceTypeIcons[type]}
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{sourceTypeLabels[type]}</span>
                    <Badge variant="secondary" className="text-xs">
                      {sourcesByType[type].length}
                    </Badge>
                  </>
                )}
              </button>
              
              {/* Individual sources */}
              {!collapsed && sourcesByType[type].map(source => (
                <button
                  key={source.id}
                  onClick={() => setActiveSourceId(source.id)}
                  className={cn(
                    'flex items-center gap-2 w-full pl-9 pr-3 py-1.5 rounded-lg text-sm transition-colors',
                    activeSourceId === source.id
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  <span className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    source.enabled ? 'bg-green-500' : 'bg-muted'
                  )} />
                  <span className="truncate">{source.name}</span>
                </button>
              ))}
            </div>
          ))}
          
          {sources.length === 0 && !collapsed && (
            <div className="px-3 py-8 text-center text-muted-foreground text-sm">
              <p>No hay fuentes configuradas</p>
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => setSettingsOpen(true)}
                className="mt-2"
              >
                Agregar fuente
              </Button>
            </div>
          )}
        </nav>
      </ScrollArea>
      
      {/* Footer */}
      <div className="border-t border-border p-2">
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <Bell className="h-4 w-4" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Notificaciones</span>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {unreadCount}
                </Badge>
              )}
            </>
          )}
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <Settings className="h-4 w-4" />
          {!collapsed && <span>Configuración</span>}
        </button>
      </div>
    </aside>
  )
}
