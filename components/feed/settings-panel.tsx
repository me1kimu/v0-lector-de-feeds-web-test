'use client'

import { useState } from 'react'
import { useFeedStore } from '@/lib/store'
import type { FeedSource, SourceType, SourceCredentials } from '@/lib/types'
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { 
  FieldGroup, 
  Field, 
  FieldLabel, 
  FieldDescription 
} from '@/components/ui/field'
import { 
  Plus, 
  Trash2, 
  Rss, 
  AtSign, 
  CloudSun,
  Sun,
  Moon,
  Monitor,
  Image,
  Bell,
  Layers,
  Settings,
  Eye,
  EyeOff,
  Twitter,
  Camera,
  Pencil,
  Check,
  X,
  RefreshCw,
  Play
} from 'lucide-react'

const sourceTypeOptions: { value: SourceType; label: string; icon: React.ReactNode; description?: string }[] = [
  { value: 'rss', label: 'RSS Feed', icon: <Rss className="h-4 w-4" /> },
  { value: 'mastodon', label: 'Mastodon', icon: <AtSign className="h-4 w-4" /> },
  { value: 'bluesky', label: 'Bluesky', icon: <CloudSun className="h-4 w-4" /> },
  { value: 'youtube', label: 'YouTube', icon: <Play className="h-4 w-4" />, description: 'Canal o usuario' },
  { value: 'twitter', label: 'Twitter/X', icon: <Twitter className="h-4 w-4" />, description: 'Solo perfiles públicos' },
  { value: 'instagram', label: 'Instagram', icon: <Camera className="h-4 w-4" />, description: 'Solo perfiles públicos' },
]

interface AddSourceFormProps {
  onAdd: (source: FeedSource) => void
  onCancel: () => void
}

function AddSourceForm({ onAdd, onCancel }: AddSourceFormProps) {
  const [type, setType] = useState<SourceType>('rss')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [refreshInterval, setRefreshInterval] = useState(15)
  const [credentials, setCredentials] = useState<SourceCredentials>({})
  const [showCredentials, setShowCredentials] = useState(false)
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const source: FeedSource = {
      id: crypto.randomUUID(),
      type,
      name: name || `${type} Feed`,
      url: type === 'mastodon' ? credentials.instance || url : url,
      enabled: true,
      refreshInterval,
      credentials: Object.keys(credentials).length > 0 ? credentials : undefined
    }
    
    onAdd(source)
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FieldGroup>
        <Field>
          <FieldLabel>Tipo de fuente</FieldLabel>
          <Select value={type} onValueChange={(v) => setType(v as SourceType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sourceTypeOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">
                    {opt.icon}
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        
        <Field>
          <FieldLabel>Nombre</FieldLabel>
          <Input 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            placeholder="Mi feed favorito"
          />
        </Field>
        
        {type === 'rss' && (
          <Field>
            <FieldLabel>URL del Feed RSS</FieldLabel>
            <Input 
              value={url} 
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
              required
            />
          </Field>
        )}
        
        {type === 'mastodon' && (
          <>
            <Field>
              <FieldLabel>Instancia de Mastodon</FieldLabel>
              <Input 
                value={credentials.instance || ''} 
                onChange={(e) => setCredentials({ ...credentials, instance: e.target.value })}
                placeholder="https://mastodon.social"
                required
              />
              <FieldDescription>La URL de tu servidor Mastodon</FieldDescription>
            </Field>
            
            <Field>
              <FieldLabel>Tipo de timeline</FieldLabel>
              <Select
                value={credentials.timelineType || 'local'}
                onValueChange={(value) => setCredentials({ ...credentials, timelineType: value as 'home' | 'local' | 'public' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local (solo esta instancia)</SelectItem>
                  <SelectItem value="public">Publica (federada)</SelectItem>
                  <SelectItem value="home">Inicio (requiere token)</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                Local muestra solo publicaciones de esta instancia, sin contenido federado
              </FieldDescription>
            </Field>
            
            <Field>
              <FieldLabel>Token de acceso (opcional)</FieldLabel>
              <div className="flex gap-2">
                <Input 
                  type={showCredentials ? 'text' : 'password'}
                  value={credentials.accessToken || ''} 
                  onChange={(e) => setCredentials({ ...credentials, accessToken: e.target.value })}
                  placeholder="Tu token de acceso"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={() => setShowCredentials(!showCredentials)}
                >
                  {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <FieldDescription>
                Solo necesario para timeline de Inicio o para dar likes/compartir
              </FieldDescription>
            </Field>
          </>
        )}
        
        {type === 'bluesky' && (
          <>
            <Field>
              <FieldLabel>Handle de Bluesky</FieldLabel>
              <Input 
                value={credentials.handle || ''} 
                onChange={(e) => setCredentials({ ...credentials, handle: e.target.value })}
                placeholder="usuario.bsky.social"
              />
              <FieldDescription>Tu identificador de Bluesky (sin @)</FieldDescription>
            </Field>
            
            <Field>
              <FieldLabel>App Password</FieldLabel>
              <div className="flex gap-2">
                <Input 
                  type={showCredentials ? 'text' : 'password'}
                  value={credentials.appPassword || ''} 
                  onChange={(e) => setCredentials({ ...credentials, appPassword: e.target.value })}
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={() => setShowCredentials(!showCredentials)}
                >
                  {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <FieldDescription>
                Crea una App Password en Settings → Privacy and Security → App passwords
              </FieldDescription>
            </Field>
          </>
        )}

        {type === 'youtube' && (
          <>
            <Field>
              <FieldLabel>Canal de YouTube</FieldLabel>
              <Input 
                value={url} 
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/@username o UC..."
                required
              />
              <FieldDescription>
                Puedes usar: @username, URL del canal, o ID del canal (UC...)
              </FieldDescription>
            </Field>
          </>
        )}
        
        {type === 'twitter' && (
          <Field>
            <FieldLabel>Nombre de usuario de Twitter/X</FieldLabel>
            <Input 
              value={credentials.handle || ''} 
              onChange={(e) => setCredentials({ ...credentials, handle: e.target.value })}
              placeholder="elonmusk"
              required
            />
            <FieldDescription>
              Solo funcionan perfiles públicos. Se usa Nitter como proxy.
            </FieldDescription>
          </Field>
        )}
        
        {type === 'instagram' && (
          <Field>
            <FieldLabel>Nombre de usuario de Instagram</FieldLabel>
            <Input 
              value={credentials.handle || ''} 
              onChange={(e) => setCredentials({ ...credentials, handle: e.target.value })}
              placeholder="instagram"
              required
            />
            <FieldDescription>
              Solo funcionan perfiles públicos. Se usa RSS Bridge como proxy.
            </FieldDescription>
          </Field>
        )}
        
        <Field>
          <FieldLabel>Intervalo de actualización</FieldLabel>
          <div className="flex items-center gap-4">
            <Slider 
              value={[refreshInterval]} 
              onValueChange={([v]) => setRefreshInterval(v)}
              min={1}
              max={60}
              step={1}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground w-16">{refreshInterval} min</span>
          </div>
        </Field>
      </FieldGroup>
      
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          Agregar fuente
        </Button>
      </div>
    </form>
  )
}

interface SourceItemProps {
  source: FeedSource
  onUpdate: (id: string, updates: Partial<FeedSource>) => void
  onDelete: (id: string) => void
}

function SourceItem({ source, onUpdate, onDelete }: SourceItemProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(source.name)
  const [url, setUrl] = useState(source.url || '')
  const [refreshInterval, setRefreshInterval] = useState(source.refreshInterval)
  const [credentials, setCredentials] = useState<SourceCredentials>(source.credentials || {})
  const [showCredentials, setShowCredentials] = useState(false)

  const icon: Record<SourceType, React.ReactNode> = {
    rss: <Rss className="h-4 w-4" />,
    mastodon: <AtSign className="h-4 w-4" />,
    bluesky: <CloudSun className="h-4 w-4" />,
    youtube: <Play className="h-4 w-4" />,
    pixelfed: <Layers className="h-4 w-4" />,
    instagram: <Camera className="h-4 w-4" />,
    twitter: <Twitter className="h-4 w-4" />,
    inkbunny: <Layers className="h-4 w-4" />,
    finance: <Layers className="h-4 w-4" />
  }

  const subtitle = source.type === 'mastodon'
    ? source.credentials?.instance
    : (source.type === 'twitter' || source.type === 'instagram')
      ? source.credentials?.handle ? `@${source.credentials.handle}` : source.url
      : (source.type === 'bluesky' || source.type === 'youtube')
        ? source.credentials?.handle || source.url
        : source.url

  const handleSave = () => {
    onUpdate(source.id, {
      name,
      url: source.type === 'mastodon' ? credentials.instance || url : url,
      refreshInterval,
      credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
    })
    setEditing(false)
  }

  const handleCancel = () => {
    setName(source.name)
    setUrl(source.url || '')
    setRefreshInterval(source.refreshInterval)
    setCredentials(source.credentials || {})
    setEditing(false)
  }

  return (
    <Card className="overflow-hidden">
      {/* Header row */}
      <CardHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary flex-shrink-0">
            {icon[source.type]}
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{source.name}</CardTitle>
            {subtitle && (
              <CardDescription className="text-xs truncate">{subtitle}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Switch
              checked={source.enabled}
              onCheckedChange={(enabled) => onUpdate(source.id, { enabled })}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => editing ? handleCancel() : setEditing(true)}
            >
              {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Edit form */}
      {editing && (
        <CardContent className="p-4 pt-0 border-t border-border">
          <FieldGroup className="mt-4">
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>

            {source.type === 'rss' && (
              <Field>
                <FieldLabel>URL del Feed</FieldLabel>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/feed.xml"
                />
              </Field>
            )}

            {source.type === 'mastodon' && (
              <>
                <Field>
                  <FieldLabel>Instancia</FieldLabel>
                  <Input
                    value={credentials.instance || ''}
                    onChange={(e) => setCredentials({ ...credentials, instance: e.target.value })}
                    placeholder="https://mastodon.social"
                  />
                </Field>
                <Field>
                  <FieldLabel>Tipo de timeline</FieldLabel>
                  <Select
                    value={credentials.timelineType || 'public'}
                    onValueChange={(value) => setCredentials({ ...credentials, timelineType: value as 'home' | 'local' | 'public' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local (solo esta instancia)</SelectItem>
                      <SelectItem value="public">Publica (federada)</SelectItem>
                      <SelectItem value="home">Inicio (requiere token)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Local muestra solo publicaciones de esta instancia
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Token de acceso (opcional)</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      type={showCredentials ? 'text' : 'password'}
                      value={credentials.accessToken || ''}
                      onChange={(e) => setCredentials({ ...credentials, accessToken: e.target.value })}
                      placeholder="Tu token de acceso"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => setShowCredentials(!showCredentials)}>
                      {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <FieldDescription>
                    Solo necesario para timeline de Inicio o interacciones
                  </FieldDescription>
                </Field>
              </>
            )}

            {source.type === 'bluesky' && (
              <>
                <Field>
                  <FieldLabel>Handle</FieldLabel>
                  <Input
                    value={credentials.handle || ''}
                    onChange={(e) => setCredentials({ ...credentials, handle: e.target.value })}
                    placeholder="usuario.bsky.social"
                  />
                </Field>
                <Field>
                  <FieldLabel>App Password</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      type={showCredentials ? 'text' : 'password'}
                      value={credentials.appPassword || ''}
                      onChange={(e) => setCredentials({ ...credentials, appPassword: e.target.value })}
                      placeholder="xxxx-xxxx-xxxx-xxxx"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => setShowCredentials(!showCredentials)}>
                      {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </Field>
              </>
            )}

            {(source.type === 'twitter' || source.type === 'instagram') && (
              <Field>
                <FieldLabel>Nombre de usuario</FieldLabel>
                <Input
                  value={credentials.handle || ''}
                  onChange={(e) => setCredentials({ ...credentials, handle: e.target.value })}
                  placeholder={source.type === 'twitter' ? 'elonmusk' : 'instagram'}
                />
              </Field>
            )}

            {source.type === 'youtube' && (
              <Field>
                <FieldLabel>Canal de YouTube</FieldLabel>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://youtube.com/@username o UC..."
                />
                <FieldDescription>
                  Puedes usar: @username, URL del canal, o ID del canal (UC...)
                </FieldDescription>
              </Field>
            )}

            <Field>
              <FieldLabel>Intervalo de actualización</FieldLabel>
              <div className="flex items-center gap-4">
                <Slider
                  value={[refreshInterval]}
                  onValueChange={([v]) => setRefreshInterval(v)}
                  min={1}
                  max={60}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-16">{refreshInterval} min</span>
              </div>
            </Field>

            {source.lastFetched && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                Actualizado: {new Date(source.lastFetched).toLocaleString('es')}
              </p>
            )}

            <div className="flex items-center justify-between pt-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar fuente?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se eliminará &quot;{source.name}&quot; y todas sus publicaciones almacenadas. Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(source.id)}>
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSave}>
                  <Check className="h-4 w-4 mr-2" />
                  Guardar
                </Button>
              </div>
            </div>
          </FieldGroup>
        </CardContent>
      )}
    </Card>
  )
}

export function SettingsPanel() {
  const { 
    settingsOpen, 
    setSettingsOpen, 
    settings, 
    updateSettings,
    sources,
    addSource,
    updateSource,
    deleteSource
  } = useFeedStore()
  
  const [showAddForm, setShowAddForm] = useState(false)
  
  const handleAddSource = async (source: FeedSource) => {
    await addSource(source)
    setShowAddForm(false)
  }
  
  return (
    <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración
          </SheetTitle>
          <SheetDescription>
            Administra tus fuentes y preferencias
          </SheetDescription>
        </SheetHeader>
        
        <Tabs defaultValue="sources" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sources">Fuentes</TabsTrigger>
            <TabsTrigger value="appearance">Apariencia</TabsTrigger>
            <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
          </TabsList>
          
          {/* Sources Tab */}
          <TabsContent value="sources" className="mt-4 space-y-4">
            {showAddForm ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Nueva fuente</CardTitle>
                </CardHeader>
                <CardContent>
                  <AddSourceForm 
                    onAdd={handleAddSource} 
                    onCancel={() => setShowAddForm(false)} 
                  />
                </CardContent>
              </Card>
            ) : (
              <Button onClick={() => setShowAddForm(true)} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Agregar fuente
              </Button>
            )}
            
            <div className="space-y-3">
              {sources.map(source => (
                <SourceItem 
                  key={source.id}
                  source={source}
                  onUpdate={updateSource}
                  onDelete={deleteSource}
                />
              ))}
            </div>
            
            {sources.length === 0 && !showAddForm && (
              <div className="text-center py-8 text-muted-foreground">
                <Rss className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay fuentes configuradas</p>
                <p className="text-sm">Agrega tu primera fuente para comenzar</p>
              </div>
            )}
          </TabsContent>
          
          {/* Appearance Tab */}
          <TabsContent value="appearance" className="mt-4 space-y-6">
            <FieldGroup>
              <Field>
                <FieldLabel>Tema</FieldLabel>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'light', label: 'Claro', icon: <Sun className="h-4 w-4" /> },
                    { value: 'dark', label: 'Oscuro', icon: <Moon className="h-4 w-4" /> },
                    { value: 'system', label: 'Sistema', icon: <Monitor className="h-4 w-4" /> },
                  ].map(({ value, label, icon }) => (
                    <Button
                      key={value}
                      variant={settings.theme === value ? 'default' : 'outline'}
                      className="flex-col h-auto py-3"
                      onClick={() => updateSettings({ theme: value as 'light' | 'dark' | 'system' })}
                    >
                      {icon}
                      <span className="text-xs mt-1">{label}</span>
                    </Button>
                  ))}
                </div>
              </Field>
              
              <Field className="flex items-center justify-between">
                <div>
                  <FieldLabel className="mb-0">Modo compacto</FieldLabel>
                  <FieldDescription>
                    Muestra más publicaciones con menos espacio
                  </FieldDescription>
                </div>
                <Switch 
                  checked={settings.compactMode}
                  onCheckedChange={(compactMode) => updateSettings({ compactMode })}
                />
              </Field>
              
              <Field className="flex items-center justify-between">
                <div>
                  <FieldLabel className="mb-0 flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Mostrar multimedia
                  </FieldLabel>
                  <FieldDescription>
                    Carga imágenes y videos en el feed
                  </FieldDescription>
                </div>
                <Switch 
                  checked={settings.showExternalMedia}
                  onCheckedChange={(showExternalMedia) => updateSettings({ showExternalMedia })}
                />
              </Field>
            </FieldGroup>
          </TabsContent>
          
          {/* Notifications Tab */}
          <TabsContent value="notifications" className="mt-4 space-y-6">
            <FieldGroup>
              <Field className="flex items-center justify-between">
                <div>
                  <FieldLabel className="mb-0 flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Notificaciones
                  </FieldLabel>
                  <FieldDescription>
                    Recibe alertas de nuevo contenido
                  </FieldDescription>
                </div>
                <Switch 
                  checked={settings.notificationsEnabled}
                  onCheckedChange={(notificationsEnabled) => updateSettings({ notificationsEnabled })}
                />
              </Field>
              
              <Field>
                <FieldLabel>Intervalo por defecto</FieldLabel>
                <div className="flex items-center gap-4">
                  <Slider 
                    value={[settings.defaultRefreshInterval]} 
                    onValueChange={([v]) => updateSettings({ defaultRefreshInterval: v })}
                    min={1}
                    max={60}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-16">
                    {settings.defaultRefreshInterval} min
                  </span>
                </div>
                <FieldDescription>
                  Usado para nuevas fuentes
                </FieldDescription>
              </Field>
            </FieldGroup>
            
            {settings.notificationsEnabled && typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
              <Card className="border-amber-500/50 bg-amber-500/10">
                <CardContent className="p-4">
                  <p className="text-sm mb-3">
                    Para recibir notificaciones push, necesitas permitir las notificaciones del navegador.
                  </p>
                  <Button 
                    size="sm"
                    onClick={() => Notification.requestPermission()}
                  >
                    Permitir notificaciones
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
