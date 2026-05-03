/**
 * Centralized logging utility for consistent error and info logging
 * All logs use the [v0] prefix for easy identification in console
 */

export type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  module: string
  message: string
  details?: unknown
  error?: Error
}

class Logger {
  private logs: LogEntry[] = []
  private maxLogs = 1000

  private formatTimestamp(): string {
    return new Date().toISOString()
  }

  private storeLog(entry: LogEntry) {
    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }
  }

  info(module: string, message: string, details?: unknown) {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level: 'info',
      module,
      message,
      details,
    }
    this.storeLog(entry)
    console.log(`[v0] ${module}: ${message}`, details)
  }

  warn(module: string, message: string, details?: unknown, error?: Error) {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level: 'warn',
      module,
      message,
      details,
      error,
    }
    this.storeLog(entry)
    console.log(`[v0] WARNING ${module}: ${message}`, details, error)
  }

  error(module: string, message: string, error: Error | unknown, details?: unknown) {
    const errorObj = error instanceof Error ? error : new Error(String(error))
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level: 'error',
      module,
      message,
      details,
      error: errorObj,
    }
    this.storeLog(entry)
    console.log(
      `[v0] ERROR ${module}: ${message}`,
      errorObj.message,
      errorObj.stack,
      details,
      error
    )
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
}

// Export singleton instance
export const logger = new Logger()
