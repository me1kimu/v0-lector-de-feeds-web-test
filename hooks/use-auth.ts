import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { SessionPayload } from '@/lib/session'

export function useAuth() {
  const [session, setSession] = useState<SessionPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/session', { 
          method: 'GET',
          credentials: 'include'
        })
        
        if (response.ok) {
          const data = await response.json()
          setSession(data.session)
        } else {
          setSession(null)
        }
      } catch (err) {
        console.error('[v0] Session check failed:', err)
        setSession(null)
      } finally {
        setLoading(false)
      }
    }

    checkSession()
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include'
      })
      setSession(null)
      router.push('/auth')
    } catch (err) {
      setError('Error al cerrar sesión')
      console.error('[v0] Logout failed:', err)
    }
  }, [router])

  return {
    session,
    loading,
    error,
    isAuthenticated: !!session,
    logout
  }
}
