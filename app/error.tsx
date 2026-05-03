'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logger'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to Vercel
    logger.error('ErrorBoundary', 'Unhandled application error', error, {
      digest: error.digest,
      message: error.message,
    })
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
          <h2 className="text-lg font-semibold text-destructive">
            Algo salió mal
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error.message || 'Ha ocurrido un error inesperado'}
          </p>
          {process.env.NODE_ENV === 'development' && error.digest && (
            <p className="mt-2 text-xs font-mono text-muted-foreground">
              Digest: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    </div>
  )
}
