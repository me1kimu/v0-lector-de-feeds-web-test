'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'
import { 
  isWebAuthnSupported, 
  isPlatformAuthenticatorAvailable,
  createPasskey,
  authenticateWithPasskey,
} from '@/lib/webauthn'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  error: string | null
  passkeySupported: boolean
  platformAuthAvailable: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    error: null,
    passkeySupported: false,
    platformAuthAvailable: false,
  })

  const supabase = createClient()

  // Check WebAuthn support on mount
  useEffect(() => {
    const checkSupport = async () => {
      const passkeySupported = isWebAuthnSupported()
      const platformAuthAvailable = await isPlatformAuthenticatorAvailable()
      setState(prev => ({
        ...prev,
        passkeySupported,
        platformAuthAvailable,
      }))
    }
    checkSupport()
  }, [])

  // Initialize auth state
  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        
        setState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
          isLoading: false,
        }))
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to get session',
          isLoading: false,
        }))
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
          isLoading: false,
        }))
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  // Register with passkey
  const registerWithPasskey = useCallback(async (email: string, displayName?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Get registration options from server
      const optionsRes = await fetch('/api/auth/passkey/register/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName }),
      })

      if (!optionsRes.ok) {
        const error = await optionsRes.json()
        throw new Error(error.error || 'Failed to get registration options')
      }

      const options = await optionsRes.json()

      // Create passkey credential
      const credential = await createPasskey(options)

      // Verify with server
      const verifyRes = await fetch('/api/auth/passkey/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential,
          email,
          displayName,
          challenge: options.challenge,
        }),
      })

      if (!verifyRes.ok) {
        const error = await verifyRes.json()
        throw new Error(error.error || 'Failed to verify registration')
      }

      const result = await verifyRes.json()

      // Refresh session
      await supabase.auth.refreshSession()

      setState(prev => ({ ...prev, isLoading: false }))

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed'
      setState(prev => ({ ...prev, error: message, isLoading: false }))
      throw error
    }
  }, [supabase.auth])

  // Sign in with passkey
  const signInWithPasskey = useCallback(async (email?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Get authentication options from server
      const optionsRes = await fetch('/api/auth/passkey/authenticate/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!optionsRes.ok) {
        const error = await optionsRes.json()
        throw new Error(error.error || 'Failed to get authentication options')
      }

      const options = await optionsRes.json()

      // Authenticate with passkey
      const credential = await authenticateWithPasskey(options)

      // Verify with server
      const verifyRes = await fetch('/api/auth/passkey/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential,
          challenge: options.challenge,
        }),
      })

      if (!verifyRes.ok) {
        const error = await verifyRes.json()
        throw new Error(error.error || 'Failed to verify authentication')
      }

      const result = await verifyRes.json()

      // Refresh session
      await supabase.auth.refreshSession()

      setState(prev => ({ ...prev, isLoading: false }))

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed'
      setState(prev => ({ ...prev, error: message, isLoading: false }))
      throw error
    }
  }, [supabase.auth])

  // Sign out
  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      setState(prev => ({
        ...prev,
        user: null,
        session: null,
        isLoading: false,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed'
      setState(prev => ({ ...prev, error: message, isLoading: false }))
      throw error
    }
  }, [supabase.auth])

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  return {
    ...state,
    registerWithPasskey,
    signInWithPasskey,
    signOut,
    clearError,
  }
}
