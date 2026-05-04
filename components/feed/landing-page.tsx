'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Rss, Bell, Sparkles, Smartphone, Shield, Cloud } from 'lucide-react'
import Link from 'next/link'

export function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <header className="px-4 lg:px-6 h-14 flex items-center border-b">
        <Link className="flex items-center justify-center gap-2 font-bold text-xl" href="/">
          <Rss className="h-6 w-6 text-primary" />
          <span>V0 Feeds</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Link href="/auth/login">
            <Button variant="ghost" size="sm">Iniciar sesión</Button>
          </Link>
          <Link href="/auth/register">
            <Button size="sm">Registrarse</Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 flex flex-col items-center text-center px-4">
          <div className="container space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
              Tu mundo en un solo lugar
            </h1>
            <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
              Sigue tus feeds favoritos de RSS, Mastodon, Bluesky y más. 
              Sincronizado en todos tus dispositivos con la potencia de la IA.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/auth/register">
                <Button size="lg" className="px-8 text-lg h-12">Empezar ahora</Button>
              </Link>
              <Link href="/auth/login">
                <Button size="lg" variant="outline" className="px-8 text-lg h-12">Explorar</Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/50">
          <div className="container px-4 md:px-6 mx-auto">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-center mb-12">
              Todo lo que necesitas para estar informado
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard 
                icon={<Cloud className="h-10 w-10 text-primary" />}
                title="Sincronización en la nube"
                description="Tus fuentes y artículos se guardan de forma segura en nuestros servidores, siempre disponibles."
              />
              <FeatureCard 
                icon={<Sparkles className="h-10 w-10 text-primary" />}
                title="IA Inteligente"
                description="Chatea con tus noticias, resume artículos y obtén información relevante con nuestro asistente integrado."
              />
              <FeatureCard 
                icon={<Smartphone className="h-10 w-10 text-primary" />}
                title="Experiencia PWA"
                description="Instálalo en tu móvil como una aplicación nativa y disfruta de una lectura fluida en cualquier lugar."
              />
              <FeatureCard 
                icon={<Bell className="h-10 w-10 text-primary" />}
                title="Notificaciones en tiempo real"
                description="Recibe alertas inmediatas cuando haya nuevo contenido en tus fuentes favoritas."
              />
              <FeatureCard 
                icon={<Shield className="h-10 w-10 text-primary" />}
                title="Seguridad de vanguardia"
                description="Protege tu cuenta con Passkeys para un acceso sin contraseñas, rápido y ultra seguro."
              />
              <FeatureCard 
                icon={<Rss className="h-10 w-10 text-primary" />}
                title="Multi-fuente"
                description="Soporte para RSS tradicional y redes sociales modernas como Mastodon y Bluesky."
              />
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="w-full py-12 md:py-24 lg:py-32 flex flex-col items-center text-center px-4">
          <div className="container space-y-4">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              ¿Listo para cambiar tu forma de leer?
            </h2>
            <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl">
              Únete a nuestra comunidad hoy mismo y toma el control de tu información.
            </p>
            <div className="pt-4">
              <Link href="/auth/register">
                <Button size="lg" className="px-12 h-12">Crear mi cuenta gratuita</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full py-6 border-t px-4 md:px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-xs text-muted-foreground">
          © 2024 V0 Feeds. Todos los derechos reservados.
        </p>
        <nav className="flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" href="#">Términos de servicio</Link>
          <Link className="text-xs hover:underline underline-offset-4" href="#">Privacidad</Link>
        </nav>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <Card className="border-none bg-background shadow-sm hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="mb-4">{icon}</div>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardContent>
    </Card>
  )
}
