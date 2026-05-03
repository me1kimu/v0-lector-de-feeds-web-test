/**
 * Centralized logging utility for consistent error and info logging
 * All logs are sent to Vercel for monitoring and debugging
 * 
 * Usage:
 *   logger.info('Module', 'Message', { key: 'value' })
 *   logger.warn('Module', 'Message', { key: 'value' }, error)
 *   logger.error('Module', 'Message', error, { key: 'value' })
 */

export type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  module: string
  message: string
  details?: unknown
  error?: {
    name: string
    message: string
    stack?: string
  }
  userAgent?: string
  url?: string
}

class Logger {
  private logs: LogEntry[] = []
  private maxLogs = 1000
  private environment: 'browser' | 'server' = typeof window === 'undefined' ? 'server' : 'browser'

  private formatTimestamp(): string {
    return new Date().toISOString()
  }

  private getEnvironmentInfo() {
    if (typeof window !== 'undefined') {
      return {
        userAgent: navigator.userAgent,
        url: window.location.href,
      }
    }
    return {}
  }

  private storeLog(entry: LogEntry) {
    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }
  }

  private formatError(error: unknown) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }
    return {
      name: 'UnknownError',
      message: String(error),
    }
  }

  /**
   * Log informational message
   */
  info(module: string, message: string, details?: unknown) {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level: 'info',
      module,
      message,
      details,
      ...this.getEnvironmentInfo(),
    }
    this.storeLog(entry)
    console.log(`[v0] ${module}: ${message}`, details)
  }

  /**
   * Log warning message
   */
  warn(module: string, message: string, details?: unknown, error?: Error) {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level: 'warn',
      module,
      message,
      details,
      error: error ? this.formatError(error) : undefined,
      ...this.getEnvironmentInfo(),
    }
    this.storeLog(entry)
    console.warn(`[v0] WARNING ${module}: ${message}`, details, error)
  }

  /**
   * Log error message - sent to Vercel monitoring
   */
  error(module: string, message: string, error: Error | unknown, details?: unknown) {
    const errorObj = error instanceof Error ? error : new Error(String(error))
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level: 'error',
      module,
      message,
      details,
      error: this.formatError(errorObj),
      ...this.getEnvironmentInfo(),
    }
    this.storeLog(entry)
    
    // Log to console with full error info
    console.error(`[v0] ERROR ${module}: ${message}`, {
      message: errorObj.message,
      stack: errorObj.stack,
      details,
    })

    // Send error to Vercel for monitoring
    this.sendToVercel(entry)
  }

  /**
   * Send error entry to Vercel monitoring/logging
   */
  private sendToVercel(entry: LogEntry) {
    if (entry.level !== 'error') return

    try {
      // Capture error metadata for Vercel
      const errorData = {
        timestamp: entry.timestamp,
        module: entry.module,
        message: entry.message,
        error: entry.error,
        details: entry.details,
        environment: this.environment,
        userAgent: entry.userAgent,
        url: entry.url,
      }

      // Log to stderr for Vercel to capture (server-side)
      if (typeof window === 'undefined') {
        console.error('[VERCEL_ERROR]', JSON.stringify(errorData))
      } else {
        // Client-side: send to server endpoint for logging
        navigator.sendBeacon?.('/api/logs', JSON.stringify({
          type: 'error',
          ...errorData,
        }))
      }
    } catch (sendError) {
      // Fail silently to avoid infinite loops
      console.log('[v0] Failed to send error to Vercel:', sendError)
    }
  }

  /**
   * Capture unhandled global errors
   */
  captureGlobalErrors() {
    if (typeof window === 'undefined') return

    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.error('GlobalError', 'Uncaught error', event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      })
    })

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error('PromiseRejection', 'Unhandled promise rejection', event.reason)
    })
  }

  getLogs(filter?: { module?: string; level?: LogLevel; since?: number }): LogEntry[] {
    let filtered = [...this.logs]

    if (filter?.module) {
      filtered = filtered.filter((log) => log.module === filter.module)
    }

    if (filter?.level) {
      filtered = filtered.filter((log) => log.level === filter.level)
    }

    if (filter?.since) {
      filtered = filtered.filter((log) => new Date(log.timestamp).getTime() >= filter.since!)
    }

    return filtered
  }

  clearLogs() {
    this.logs = []
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  /**
   * Get summary of recent errors
   */
  getErrorSummary(minutes: number = 5): Array<{ module: string; message: string; count: number }> {
    const since = Date.now() - minutes * 60 * 1000
    const errors = this.getLogs({ level: 'error', since })

    const summary: Record<string, { message: string; count: number }> = {}
    errors.forEach((log) => {
      const key = `${log.module}:${log.message}`
      if (!summary[key]) {
        summary[key] = { message: log.message, count: 0 }
      }
      summary[key].count++
    })

    return Object.entries(summary).map(([key, value]) => ({
      module: key.split(':')[0],
      message: value.message,
      count: value.count,
    }))
  }
}

// Export singleton instance
export const logger = new Logger()

// Initialize global error capture on module load
if (typeof window !== 'undefined') {
  logger.captureGlobalErrors()
}
