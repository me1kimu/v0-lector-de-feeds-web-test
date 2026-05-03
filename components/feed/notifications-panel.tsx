'use client'

import { useFeedStore } from '@/lib/store'
import { Notification, Source } from '@/lib/types'
import { Bell, AlertCircle, Info, CheckCircle, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

interface NotificationsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationsPanel({ open, onOpenChange }: NotificationsPanelProps) {
  const {
    notifications,
    markAllNotificationsRead,
    markNotificationRead,
    clearNotification,
  } = useFeedStore()

  const unreadCount = notifications.filter(n => !n.read).length
  const unreadNotifications = notifications.filter(n => !n.read)
  const readNotifications = notifications.filter(n => n.read)

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const NotificationItem = ({ notification }: { notification: Notification }) => (
    <div
      className={`flex gap-3 p-4 border-l-4 transition-colors ${
        !notification.read
          ? 'bg-sidebar-accent/50 border-l-primary'
          : 'bg-background border-l-muted'
      } hover:bg-sidebar-accent/30`}
    >
      <div className="flex-shrink-0 mt-0.5">
        {getNotificationIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="font-medium text-sm text-foreground">
              {notification.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {notification.message}
            </p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {!notification.read && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markNotificationRead(notification.id)}
                className="h-6 w-6 p-0"
              >
                <CheckCircle className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearNotification(notification.id)}
              className="h-6 w-6 p-0"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-96 flex flex-col">
        <SheetHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <SheetTitle>Notificaciones</SheetTitle>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </SheetHeader>

        {/* Actions */}
        {unreadCount > 0 && (
          <div className="px-4 py-2 border-b border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={markAllNotificationsRead}
              className="w-full text-xs"
            >
              Marcar todo como leído
            </Button>
          </div>
        )}

        {/* Notifications list */}
        <ScrollArea className="flex-1 -mx-6">
          <div className="px-6">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No hay notificaciones
                </p>
              </div>
            ) : (
              <>
                {/* Unread notifications */}
                {unreadNotifications.length > 0 && (
                  <div>
                    <div className="sticky top-0 bg-sidebar py-2 mb-2">
                      <p className="text-xs font-semibold text-muted-foreground">
                        NUEVAS ({unreadNotifications.length})
                      </p>
                    </div>
                    <div className="space-y-1">
                      {unreadNotifications.map(notification => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Read notifications */}
                {readNotifications.length > 0 && (
                  <div className={unreadNotifications.length > 0 ? 'mt-4' : ''}>
                    <div className="sticky top-0 bg-sidebar py-2 mb-2">
                      <p className="text-xs font-semibold text-muted-foreground">
                        ANTERIORES ({readNotifications.length})
                      </p>
                    </div>
                    <div className="space-y-1">
                      {readNotifications.map(notification => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
