'use client'

import { useCallback, useEffect, useState } from 'react'

interface LocalAuthState {
  user: null
  session: null
  isLoading: boolean
  error: string | null
  passkeySupported: false
  platformAuthAvailable: false
}

const LOCAL_AUTH_STATE: LocalAuthState = {
  user: null,
  session: null,
  isLoading: false,
  error: null,
  passkeySupported: false,
  platformAuthAvailable: false,
}

export function useAuth() {
  const [state, setState] = useState<LocalAuthState>(LOCAL_AUTH_STATE)

  useEffect(() => {
    setState(LOCAL_AUTH_STATE)
  }, [])

  const registerWithPasskey = useCallback(async (_email: string, _displayName?: string) => {
    throw new Error('La aplicación ahora funciona en modo local y no usa cuentas online.')
  }, [])

  const signInWithPasskey = useCallback(async (_email?: string) => {
    throw new Error('La aplicación ahora funciona en modo local y no usa cuentas online.')
  }, [])

  const signUpWithEmail = useCallback(async (_email: string, _password: string, _displayName?: string) => {
    throw new Error('La aplicación ahora funciona en modo local y no usa cuentas online.')
  }, [])

  const signInWithEmail = useCallback(async (_email: string, _password: string) => {
    throw new Error('La aplicación ahora funciona en modo local y no usa cuentas online.')
  }, [])

  const signOut = useCallback(async () => {
    setState(LOCAL_AUTH_STATE)
  }, [])

  const clearError = useCallback(() => {
    setState(LOCAL_AUTH_STATE)
  }, [])

  return {
    ...state,
    signUpWithEmail,
    signInWithEmail,
    signOut,
    registerWithPasskey,
    signInWithPasskey,
    clearError,
  }
}
