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
import { Fingerprint, AlertCircle, Rss, CheckCircle2, Shield } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const { 
    registerWithPasskey, 
    isLoading, 
    error, 
    clearError,
    passkeySupported,
    platformAuthAvailable,
  } = useAuth()
  
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [success, setSuccess] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) return
    
    try {
      clearError()
      const result = await registerWithPasskey(email, displayName)
      
      if (result.requiresEmailVerification) {
        setSuccess(true)
      } else {
        router.push('/')
      }
    } catch {
      // Error is handled by the hook
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Registro exitoso</CardTitle>
            <CardDescription>
              Tu cuenta ha sido creada con passkey
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Revisa tu email para confirmar tu cuenta. Una vez confirmado, podras iniciar sesion con tu passkey.
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Rss className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Crear cuenta</CardTitle>
          <CardDescription>
            Registrate con passkey para mayor seguridad
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

            {!passkeySupported && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Tu navegador no soporta passkeys. Por favor usa un navegador moderno como Chrome, Safari o Edge.
                </AlertDescription>
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
              />
              <FieldDescription>
                Opcional. Se mostrara en tu perfil.
              </FieldDescription>
            </Field>

            <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4 text-primary" />
                Que es un Passkey?
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Sin contrasenas que recordar</li>
                <li>Usa Face ID, Touch ID o Windows Hello</li>
                <li>Mas seguro que contrasenas tradicionales</li>
                <li>Protegido contra phishing</li>
              </ul>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !email || !passkeySupported}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <Spinner className="mr-2" />
              ) : (
                <Fingerprint className="mr-2 h-5 w-5" />
              )}
              {platformAuthAvailable 
                ? 'Registrar con Face ID / Touch ID' 
                : 'Registrar con Passkey'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground text-center">
            Ya tienes cuenta?{' '}
            <Link href="/auth/login" className="text-primary hover:underline">
              Inicia sesion
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
