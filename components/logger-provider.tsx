'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logger'

/**
 * LoggerProvider - Initializes global error capture and logging
 * Should be included in root layout to capture all errors
 */
export function LoggerProvider() {
  useEffect(() => {
    // Initialize global error capture
    logger.info('Logger', 'Logging system initialized')

    // Monitor performance
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if ((entry as any).duration > 3000) {
          logger.warn('Performance', `Slow operation detected: ${entry.name}`, {
            duration: (entry as any).duration,
            startTime: entry.startTime,
          })
        }
      }
    })

    try {
      observer.observe({ entryTypes: ['measure', 'navigation'] })
    } catch (e) {
      // Performance observer not supported
      logger.info('Logger', 'Performance observation not available')
    }

    // Health check with logging API
    const checkLoggingHealth = async () => {
      try {
        const response = await fetch('/api/logs/health')
        if (!response.ok) {
          logger.warn('Logger', 'Health check failed', { status: response.status })
        }
      } catch (error) {
        logger.warn('Logger', 'Health check request failed', {}, error as Error)
      }
    }

    // Check logging health on mount and periodically
    checkLoggingHealth()
    const interval = setInterval(checkLoggingHealth, 5 * 60 * 1000) // Every 5 minutes

    return () => {
      clearInterval(interval)
      observer.disconnect()
    }
  }, [])

  return null
}
