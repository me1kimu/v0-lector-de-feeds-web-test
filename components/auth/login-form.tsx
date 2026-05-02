'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startAuthentication } from '@simplewebauthn/browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Fingerprint, Mail, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [authMethod, setAuthMethod] = useState<'passkey' | 'email'>('passkey')

  const handlePasskeyLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setError('Por favor ingresa tu correo electrónico')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Start passkey authentication
      const startRes = await fetch('/api/auth/passkey/authenticate-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      if (!startRes.ok) {
        const data = await startRes.json()
        throw new Error(data.error || 'Failed to start authentication')
      }

      const { options, challenge, userId } = await startRes.json()

      // Perform WebAuthn authentication
      const credential = await startAuthentication(options)

      // Complete authentication
      const completeRes = await fetch('/api/auth/passkey/authenticate-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          credential,
          challenge
        })
      })

      if (!completeRes.ok) {
        const data = await completeRes.json()
        throw new Error(data.error || 'Authentication failed')
      }

      const { session } = await completeRes.json()

      // Store session token
      localStorage.setItem('session_token', session.token)
      localStorage.setItem('session_expires', session.expiresAt)

      router.push('/')
      router.refresh()
    } catch (err) {
      console.error('[v0] Passkey login error:', err)
      setError(err instanceof Error ? err.message : 'Failed to login with passkey')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Por favor completa todos los campos')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/email/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to login')
      }

      const { session } = await res.json()

      // Store session token
      localStorage.setItem('session_token', session.token)
      localStorage.setItem('session_expires', session.expiresAt)

      router.push('/')
      router.refresh()
    } catch (err) {
      console.error('[v0] Email login error:', err)
      setError(err instanceof Error ? err.message : 'Failed to login')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = authMethod === 'passkey' ? handlePasskeyLogin : handleEmailLogin

  return (
    <div className="w-full max-w-md">
      <Card className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Inicia sesión</h1>
          <p className="text-sm text-muted-foreground">
            Accede a tu cuenta de FeedReader de forma segura
          </p>
        </div>

        {/* Auth method tabs */}
        <div className="flex gap-2 mb-6 bg-muted p-1 rounded-lg">
          <button
            onClick={() => {
              setAuthMethod('passkey')
              setError('')
            }}
            className={cn(
              'flex-1 py-2 px-3 rounded text-sm font-medium transition-colors',
              authMethod === 'passkey'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Fingerprint className="h-4 w-4 inline mr-2" />
            Passkey
          </button>
          <button
            onClick={() => {
              setAuthMethod('email')
              setError('')
            }}
            className={cn(
              'flex-1 py-2 px-3 rounded text-sm font-medium transition-colors',
              authMethod === 'email'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Mail className="h-4 w-4 inline mr-2" />
            Correo
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
              Correo electrónico
            </label>
            <Input
              id="email"
              type="email"
              placeholder="tu@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          {authMethod === 'email' && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Spinner className="h-4 w-4 mr-2" />}
            {authMethod === 'passkey' ? 'Usar Passkey' : 'Iniciar sesión'}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            ¿No tienes cuenta?{' '}
            <a href="/auth?mode=register" className="text-primary font-medium hover:underline">
              Regístrate aquí
            </a>
          </p>
        </div>
      </Card>
    </div>
  )
}
