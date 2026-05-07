'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Rss, LaptopMinimal } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Rss className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Modo local activado</CardTitle>
          <CardDescription>
            La aplicación ya no usa cuentas online, así que no necesitas iniciar sesión.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Las fuentes, los artículos y la configuración se guardan en tu dispositivo.</p>
          <p className="flex items-center gap-2 text-foreground">
            <LaptopMinimal className="h-4 w-4" />
            Todo funciona sin conectar Supabase.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/">Volver al lector</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}