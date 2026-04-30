'use client'

import { useFeedStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Bell, 
  Menu, 
  Moon, 
  Sun, 
  Monitor,
  Settings,
  Check
} from 'lucide-react'

interface HeaderProps {
  onMenuClick?: () => void
  showMenuButton?: boolean
}

export function Header({ onMenuClick, showMenuButton = false }: HeaderProps) {
  const { 
    settings, 
    notifications,
    updateSettings, 
    setSettingsOpen,
    markAllNotificationsRead
  } = useFeedStore()
  
  const unreadCount = notifications.filter(n => !n.read).length
  
  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(settings.theme)
    const nextTheme = themes[(currentIndex + 1) % themes.length]
    updateSettings({ theme: nextTheme })
  }
  
  const themeIcon = {
    light: <Sun className="h-4 w-4" />,
    dark: <Moon className="h-4 w-4" />,
    system: <Monitor className="h-4 w-4" />
  }
  
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background lg:hidden">
      <div className="flex items-center gap-3">
        {showMenuButton && (
          <Button variant="ghost" size="sm" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <h1 className="font-semibold text-foreground">FeedReader</h1>
      </div>
      
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={cycleTheme}>
          {themeIcon[settings.theme]}
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="font-semibold text-sm">Notificaciones</span>
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-auto py-1 px-2 text-xs"
                  onClick={markAllNotificationsRead}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Marcar todo como leído
                </Button>
              )}
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No hay notificaciones
              </div>
            ) : (
              notifications.slice(0, 5).map(notification => (
                <DropdownMenuItem key={notification.id} className="flex flex-col items-start p-3">
                  <span className="font-medium text-sm">{notification.title}</span>
                  <span className="text-xs text-muted-foreground">{notification.message}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
