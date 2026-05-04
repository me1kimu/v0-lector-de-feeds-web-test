'use client'

import { useEffect, useState } from 'react'
import { logger } from '@/lib/logger'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Info, AlertTriangle } from 'lucide-react'

/**
 * LogMonitor - Displays real-time logging information for debugging
 */
export function LogMonitor() {
  const [errors, setErrors] = useState<Array<{ module: string; message: string; count: number }>>([])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    // Update error summary every second when open
    const interval = setInterval(() => {
      const summary = logger.getErrorSummary(5) // Last 5 minutes
      setErrors(summary)
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen])

  const errorCount = errors.reduce((sum, e) => sum + e.count, 0)

  if (errorCount === 0) return null

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="fixed bottom-4 right-4 gap-2 text-destructive"
          title={`${errorCount} error(s) en los últimos 5 minutos`}
        >
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs">{errorCount}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Monitor de Errores
          </DialogTitle>
          <DialogDescription>
            Resumen de errores recientes capturados por el sistema de logging.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto space-y-2">
          {errors.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              Sin errores en los últimos 5 minutos
            </div>
          ) : (
            errors.map((error, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {error.module}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {error.message}
                  </p>
                </div>
                <Badge variant="destructive" className="flex-shrink-0">
                  {error.count}
                </Badge>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2 pt-4 border-t">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              logger.clearLogs()
              setErrors([])
            }}
          >
            Limpiar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const json = logger.exportLogs()
              const blob = new Blob([json], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `logs-${new Date().toISOString()}.json`
              a.click()
            }}
          >
            Exportar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
