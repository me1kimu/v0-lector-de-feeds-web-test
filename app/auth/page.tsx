'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoginForm } from '@/components/auth/login-form'
import { RegisterForm } from '@/components/auth/register-form'
import { Card } from '@/components/ui/card'
import { Lock, UserPlus, LogIn } from 'lucide-react'

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Lock className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">FeedReader</h1>
          </div>
          <p className="text-muted-foreground">
            Acceso seguro sin contraseñas mediante claves de acceso
          </p>
        </div>

        {/* Auth Card */}
        <Card className="p-6 border border-border/50 shadow-lg">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'register')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" className="flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Iniciar sesión</span>
              </TabsTrigger>
              <TabsTrigger value="register" className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Registro</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <LoginForm />
            </TabsContent>

            <TabsContent value="register" className="space-y-4">
              <RegisterForm />
            </TabsContent>
          </Tabs>
        </Card>

        {/* Security Info */}
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 text-sm text-blue-600 dark:text-blue-400">
          <p className="font-semibold mb-2">🔒 Acceso sin contraseñas</p>
          <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
            Tu dispositivo genera automáticamente claves criptográficas seguras. Tus contraseñas nunca se almacenan en nuestros servidores.
          </p>
        </div>
      </div>
    </div>
  )
}
