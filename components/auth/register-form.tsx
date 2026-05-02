'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startRegistration } from '@simplewebauthn/browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Fingerprint, Mail, AlertTriangle, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import crypto from 'crypto'

export function RegisterForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [authMethod, setAuthMethod] = useState<'passkey' | 'email'>('passkey')
  const [registrationStep, setRegistrationStep] = useState<'info' | 'passkey' | 'complete'>('info')
  const [userId, setUserId] = useState('')
  const [passwordStrength, setPasswordStrength] = useState(0)

  const checkPasswordStrength = (pwd: string) => {
    let strength = 0
    if (pwd.length >= 8) strength++
    if (pwd.length >= 12) strength++
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++
    if (/[0-9]/.test(pwd)) strength++
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++
    setPasswordStrength(strength)
  }

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !displayName) {
      setError('Por favor completa todos los campos')
      return
    }

    if (authMethod === 'email') {
      if (!password || !confirmPassword) {
        setError('Por favor completa todos los campos')
        return
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden')
        return
      }
      if (password.length < 8) {
        setError('La contraseña debe tener al menos 8 caracteres')
        return
      }
    }

    setIsLoading(true)

    try {
      if (authMethod === 'passkey') {
        setRegistrationStep('passkey')
        const newUserId = crypto.randomUUID()
        setUserId(newUserId)
      } else {
        // Email signup
        const res = await fetch('/api/auth/email/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, displayName })
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to signup')
        }

        const { session } = await res.json()
        localStorage.setItem('session_token', session.token)
        localStorage.setItem('session_expires', session.expiresAt)

        router.push('/')
        router.refresh()
      }
    } catch (err) {
      console.error('[v0] Signup error:', err)
      setError(err instanceof Error ? err.message : 'Failed to signup')
      setIsLoading(false)
    }
  }

  const handlePasskeyRegistration = async () => {
    if (!userId) return

    setIsLoading(true)
    setError('')

    try {
      // Start passkey registration
      const startRes = await fetch('/api/auth/passkey/register-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email,
          displayName
        })
      })

      if (!startRes.ok) {
        const data = await startRes.json()
        throw new Error(data.error || 'Failed to start registration')
      }

      const { options, challenge } = await startRes.json()

      // Perform WebAuthn registration
      const credential = await startRegistration(options)

      // Complete registration
      const completeRes = await fetch('/api/auth/passkey/register-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          credential,
          challenge,
          deviceName: 'Dispositivo de registro'
        })
      })

      if (!completeRes.ok) {
        const data = await completeRes.json()
        throw new Error(data.error || 'Failed to complete registration')
      }

      const { session } = await completeRes.json()

      // Store session
      localStorage.setItem('session_token', session.token)
      localStorage.setItem('session_expires', session.expiresAt)

      setRegistrationStep('complete')
      setTimeout(() => {
        router.push('/')
        router.refresh()
      }, 2000)
    } catch (err) {
      console.error('[v0] Passkey registration error:', err)
      setError(err instanceof Error ? err.message : 'Failed to register passkey')
      setRegistrationStep('info')
      setIsLoading(false)
    }
  }

  if (registrationStep === 'passkey') {
    return (
      <div className="w-full max-w-md">
        <Card className="p-8">
          <div className="text-center mb-8">
            <Fingerprint className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Registra tu Passkey</h2>
            <p className="text-sm text-muted-foreground">
              Usa tu huella digital, reconocimiento facial o PIN para asegurar tu cuenta
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handlePasskeyRegistration}
            className="w-full mb-4"
            disabled={isLoading}
            size="lg"
          >
            {isLoading && <Spinner className="h-4 w-4 mr-2" />}
            Registrar Passkey
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setRegistrationStep('info')
              setUserId('')
            }}
            disabled={isLoading}
          >
            Atrás
          </Button>
        </Card>
      </div>
    )
  }

  if (registrationStep === 'complete') {
    return (
      <div className="w-full max-w-md">
        <Card className="p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">¡Registro completado!</h2>
          <p className="text-muted-foreground mb-6">
            Tu cuenta ha sido creada exitosamente. Redirigiendo...
          </p>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse mx-auto" />
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <Card className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Crear cuenta</h1>
          <p className="text-sm text-muted-foreground">
            Únete a FeedReader de forma segura sin contraseñas
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

        <form onSubmit={handleInitialSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-foreground mb-2">
              Nombre de usuario
            </label>
            <Input
              id="displayName"
              type="text"
              placeholder="Tu nombre"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

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
            <>
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
                    onChange={(e) => {
                      setPassword(e.target.value)
                      checkPasswordStrength(e.target.value)
                    }}
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
                {password && (
                  <div className="mt-2 flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'h-1 flex-1 rounded-full',
                          i < passwordStrength ? 'bg-green-500' : 'bg-muted'
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Spinner className="h-4 w-4 mr-2" />}
            {authMethod === 'passkey' ? 'Siguiente' : 'Crear cuenta'}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <a href="/auth?mode=login" className="text-primary font-medium hover:underline">
              Inicia sesión aquí
            </a>
          </p>
        </div>
      </Card>
    </div>
  )
}
