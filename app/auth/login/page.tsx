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
import { Fingerprint, Mail, AlertCircle, Rss } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { 
    signInWithPasskey, 
    isLoading, 
    error, 
    clearError,
    passkeySupported,
    platformAuthAvailable,
  } = useAuth()
  
  const [email, setEmail] = useState('')
  const [mode, setMode] = useState<'passkey' | 'email'>('passkey')

  const handlePasskeySignIn = async () => {
    try {
      clearError()
      await signInWithPasskey(email || undefined)
      router.push('/')
    } catch {
      // Error is handled by the hook
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
        
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!passkeySupported && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Tu navegador no soporta passkeys. Por favor usa un navegador moderno.
              </AlertDescription>
            </Alert>
          )}

          {mode === 'passkey' && passkeySupported && (
            <div className="space-y-4">
              <Field>
                <FieldLabel>Email (opcional)</FieldLabel>
                <Input
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
                <FieldDescription>
                  Deja vacio para usar cualquier passkey registrada
                </FieldDescription>
              </Field>

              <Button
                onClick={handlePasskeySignIn}
                disabled={isLoading || !passkeySupported}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <Spinner className="mr-2" />
                ) : (
                  <Fingerprint className="mr-2 h-5 w-5" />
                )}
                {platformAuthAvailable 
                  ? 'Iniciar con Face ID / Touch ID' 
                  : 'Iniciar con Passkey'}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    O
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => setMode('email')}
                disabled={isLoading}
                className="w-full"
              >
                <Mail className="mr-2 h-4 w-4" />
                Usar email y contrasena
              </Button>
            </div>
          )}

          {mode === 'email' && (
            <div className="space-y-4">
              <Field>
                <FieldLabel>Email</FieldLabel>
                <Input
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </Field>

              <Field>
                <FieldLabel>Contrasena</FieldLabel>
                <Input
                  type="password"
                  placeholder="********"
                  disabled={isLoading}
                />
              </Field>

              <Button
                type="submit"
                disabled={isLoading || !email}
                className="w-full"
              >
                {isLoading && <Spinner className="mr-2" />}
                Iniciar sesion
              </Button>

              {passkeySupported && (
                <Button
                  variant="ghost"
                  onClick={() => setMode('passkey')}
                  disabled={isLoading}
                  className="w-full"
                >
                  <Fingerprint className="mr-2 h-4 w-4" />
                  Usar Passkey
                </Button>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground text-center">
            No tienes cuenta?{' '}
            <Link href="/auth/register" className="text-primary hover:underline">
              Registrate
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
