'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Palette, Database, Rss } from 'lucide-react'

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Sin registro requerido</CardTitle>
          <CardDescription>
            FeedReader ahora funciona como una app local, sin cuentas ni correo electrónico.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-foreground" />
            Los datos se almacenan en IndexedDB.
          </div>
          <div className="flex items-center gap-2">
            <Rss className="h-4 w-4 text-foreground" />
            Las fuentes se sincronizan directamente desde tus feeds.
          </div>
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-foreground" />
            Puedes cambiar la paleta visual desde Ajustes.
          </div>
          <Badge variant="secondary">No hay cuenta online</Badge>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/">Abrir la aplicación</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}