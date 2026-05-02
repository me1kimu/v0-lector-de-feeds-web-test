'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Fingerprint, AlertCircle, Rss, CheckCircle2, Eye, EyeOff, Shield } from 'lucide-react'

type Step = 'register' | 'verify-email' | 'add-passkey'

export default function RegisterPage() {
  const router = useRouter()
  const {
    signUpWithEmail,
    registerWithPasskey,
    isLoading,
    error,
    clearError,
    passkeySupported,
    platformAuthAvailable,
  } = useAuth()

  const [step, setStep] = useState<Step>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')

    if (password.length < 8) {
      setPasswordError('La contrasena debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirmPassword) {
      setPasswordError('Las contrasenas no coinciden')
      return
    }

    try {
      clearError()
      const result = await signUpWithEmail(email, password, displayName)
      if (result?.requiresEmailVerification) {
        setStep('verify-email')
      } else {
        // Session active — offer passkey enrollment
        if (passkeySupported) {
          setStep('add-passkey')
        } else {
          router.push('/')
        }
      }
    } catch {
      // Error handled by hook
    }
  }

  const handleAddPasskey = async () => {
    try {
      clearError()
      await registerWithPasskey(email, displayName)
      router.push('/')
    } catch {
      // Error handled by hook — user can still skip
    }
  }

  // Step: email verification sent
  if (step === 'verify-email') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Revisa tu email</CardTitle>
            <CardDescription>
              Te enviamos un enlace de confirmacion a <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Haz clic en el enlace del email para activar tu cuenta y luego inicia sesion.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/auth/login">Ir a iniciar sesion</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Step: offer passkey after successful registration
  if (step === 'add-passkey') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Fingerprint className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Agregar Passkey</CardTitle>
            <CardDescription>
              Cuenta creada. Agrega una passkey para iniciar sesion mas rapido la proxima vez.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4 text-primary" />
                Ventajas de usar Passkey
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 pl-6 list-disc">
                <li>Sin contrasenas que recordar</li>
                <li>Usa Face ID, Touch ID o Windows Hello</li>
                <li>Protegido contra phishing</li>
              </ul>
            </div>

            <Button
              onClick={handleAddPasskey}
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <Spinner className="mr-2" />
              ) : (
                <Fingerprint className="mr-2 h-5 w-5" />
              )}
              {platformAuthAvailable
                ? 'Agregar Face ID / Touch ID'
                : 'Agregar Passkey'}
            </Button>
          </CardContent>
          <CardFooter>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => router.push('/')}
              disabled={isLoading}
            >
              Ahora no, continuar sin passkey
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Step: main registration form
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Rss className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Crear cuenta</CardTitle>
          <CardDescription>
            Registrate para guardar tus fuentes en la nube
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {passwordError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}

            <Field>
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                autoComplete="email"
              />
            </Field>

            <Field>
              <FieldLabel>Nombre para mostrar</FieldLabel>
              <Input
                type="text"
                placeholder="Tu nombre"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading}
                autoComplete="name"
              />
              <FieldDescription>Opcional. Se mostrara en tu perfil.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Contrasena</FieldLabel>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            <Field>
              <FieldLabel>Confirmar contrasena</FieldLabel>
              <div className="relative">
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repite tu contrasena"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            <Button
              type="submit"
              disabled={isLoading || !email || !password || !confirmPassword}
              className="w-full"
              size="lg"
            >
              {isLoading ? <Spinner className="mr-2" /> : null}
              Crear cuenta
            </Button>
          </form>
        </CardContent>

        <CardFooter>
          <p className="text-sm text-muted-foreground text-center w-full">
            Ya tienes cuenta?{' '}
            <Link href="/auth/login" className="text-primary hover:underline font-medium">
              Inicia sesion
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
