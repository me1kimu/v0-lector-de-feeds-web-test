'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Fingerprint, AlertCircle, Rss, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const {
    signInWithEmail,
    signInWithPasskey,
    isLoading,
    error,
    clearError,
    passkeySupported,
    platformAuthAvailable,
  } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    try {
      clearError()
      await signInWithEmail(email, password)
      router.push('/')
    } catch {
      // Error handled by hook
    }
  }

  const handlePasskeySignIn = async () => {
    try {
      clearError()
      await signInWithPasskey(email || undefined)
      router.push('/')
    } catch {
      // Error handled by hook
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Rss className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Iniciar sesion</CardTitle>
          <CardDescription>
            Accede a tu cuenta de FeedReader
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
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
              <FieldLabel>Contrasena</FieldLabel>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  autoComplete="current-password"
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

            <Button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full"
              size="lg"
            >
              {isLoading ? <Spinner className="mr-2" /> : null}
              Iniciar sesion
            </Button>
          </form>

          {passkeySupported && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">O</span>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={handlePasskeySignIn}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <Spinner className="mr-2" />
                ) : (
                  <Fingerprint className="mr-2 h-4 w-4" />
                )}
                {platformAuthAvailable
                  ? 'Iniciar con Face ID / Touch ID'
                  : 'Iniciar con Passkey'}
              </Button>
            </>
          )}
        </CardContent>

        <CardFooter>
          <p className="text-sm text-muted-foreground text-center w-full">
            No tienes cuenta?{' '}
            <Link href="/auth/register" className="text-primary hover:underline font-medium">
              Registrate
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
