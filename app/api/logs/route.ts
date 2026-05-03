import { NextRequest, NextResponse } from 'next/server'

interface LogData {
  type: 'error' | 'warn' | 'info'
  timestamp: string
  module: string
  message: string
  error?: {
    name: string
    message: string
    stack?: string
  }
  details?: unknown
  environment?: 'browser' | 'server'
  userAgent?: string
  url?: string
}

/**
 * POST /api/logs
 * Receives error logs from client and stores them for monitoring
 * Integrates with Vercel's logging system
 */
export async function POST(req: NextRequest) {
  try {
    const logData: LogData = await req.json()

    // Validate log data
    if (!logData.module || !logData.message) {
      return NextResponse.json(
        { error: 'Missing required fields: module, message' },
        { status: 400 }
      )
    }

    // Log to stderr for Vercel to capture
    const logEntry = {
      timestamp: logData.timestamp,
      type: logData.type,
      module: logData.module,
      message: logData.message,
      error: logData.error,
      details: logData.details,
      environment: logData.environment,
      userAgent: logData.userAgent,
      url: logData.url,
    }

    // Send to Vercel logging (via stderr)
    if (logData.type === 'error') {
      console.error('[CLIENT_ERROR]', JSON.stringify(logEntry))
    } else if (logData.type === 'warn') {
      console.warn('[CLIENT_WARN]', JSON.stringify(logEntry))
    } else {
      console.log('[CLIENT_LOG]', JSON.stringify(logEntry))
    }

    return NextResponse.json(
      { success: true, received: true },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[API_ERROR] /api/logs POST failed:', message, error)

    return NextResponse.json(
      { error: 'Failed to process log', details: message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/logs/health
 * Health check endpoint to verify logging is working
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Logging API is operational',
  })
}
