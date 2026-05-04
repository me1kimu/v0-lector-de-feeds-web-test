'use client'

import { useState, useRef } from 'react'
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
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Progress } from '@/components/ui/progress'
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
    
    const generateId = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
    
    const source: FeedSource = {
      id: generateId(),
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
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { loadSources, syncWithCloud } = useFeedStore()
  const [importProgress, setImportProgress] = useState<number | null>(null)
  const [importStatusText, setImportStatusText] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewItems, setPreviewItems] = useState<Array<{ title?: string; url?: string }>>([])
  const isImportingPreview = importProgress !== null
  const toastState = useToast()
  
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
              <div className="flex gap-2">
                <Button onClick={() => setShowAddForm(true)} className="flex-1">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar fuente
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".opml,application/xml,text/xml"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    try {
                      const text = await f.text()
                      setImportStatusText('Analizando OPML...')

                      // Parse OPML in client using DOMParser to extract outlines
                      const parser = new DOMParser()
                      const doc = parser.parseFromString(text, 'application/xml')
                      const outlines: Array<{ title?: string; url?: string }> = []

                      function walk(node: Element) {
                        if (node.tagName && node.tagName.toLowerCase() === 'outline') {
                          const xmlUrl =
                            node.getAttribute('xmlUrl') || node.getAttribute('xmlurl') || node.getAttribute('url') || undefined
                          const title = node.getAttribute('title') || node.getAttribute('text') || undefined
                          if (xmlUrl) outlines.push({ title: title || undefined, url: xmlUrl })
                        }
                        node.childNodes.forEach((child) => {
                          if ((child as Element).tagName) walk(child as Element)
                        })
                      }

                      const body = doc.querySelector('body') || doc
                      if (body) walk(body as Element)

                      const total = outlines.length
                      if (total === 0) {
                        toastState.toast({ title: 'Import OPML', description: 'No se encontraron entradas OPML' })
                        setImportStatusText(null)
                        return
                      }

                      // Store preview and open dialog
                      setPreviewItems(outlines)
                      setPreviewOpen(true)

                    } catch (err) {
                      console.error('Import OPML parse failed', err)
                      toastState.toast({ title: 'Import OPML', description: 'Error analizando OPML', variant: 'destructive' })
                    } finally {
                      // clear input
                      ;(e.target as HTMLInputElement).value = ''
                      setImportStatusText(null)
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef?.current?.click()}
                >
                  Importar OPML
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/user/sources/export-opml')
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({ error: 'Export failed' }))
                        toastState.toast({ title: 'Export OPML', description: err.error || 'Export failed', variant: 'destructive' })
                        return
                      }
                      const blob = await res.blob()
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'feeds.opml'
                      document.body.appendChild(a)
                      a.click()
                      a.remove()
                      URL.revokeObjectURL(url)
                    } catch (err) {
                      console.error('Export OPML failed', err)
                      toastState.toast({ title: 'Export OPML', description: 'Error exportando OPML', variant: 'destructive' })
                    }
                  }}
                >
                  Exportar OPML
                </Button>
              </div>
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

            {/* Preview Dialog for OPML import */}
            <Dialog
              open={previewOpen}
              onOpenChange={(nextOpen) => {
                if (!isImportingPreview) {
                  setPreviewOpen(nextOpen)
                }
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Vista previa de importación</DialogTitle>
                  <DialogDescription>Revisa las entradas detectadas antes de confirmar la importación.</DialogDescription>
                </DialogHeader>

                <div className="max-h-60 overflow-auto mt-2">
                  {previewItems.slice(0, 200).map((it, idx) => (
                    <div key={idx} className="py-1 border-b last:border-b-0 text-sm">
                      <div className="font-medium">{it.title || it.url}</div>
                      <div className="text-xs text-muted-foreground truncate">{it.url}</div>
                    </div>
                  ))}
                  {previewItems.length > 200 && (
                    <div className="text-xs text-muted-foreground py-2">Mostrando 200 de {previewItems.length} entradas</div>
                  )}
                </div>

                <DialogFooter>
                  {isImportingPreview ? (
                    <div className="w-full">
                      <div className="text-sm mb-2">{importStatusText}</div>
                      <Progress value={importProgress ?? 0} />
                    </div>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancelar</Button>
                      <Button onClick={async () => {
                    // Start batch import
                    setImportProgress(0)
                    setImportStatusText('Iniciando importación...')
                    const batchSize = 20
                    let processed = 0
                    let totalInserted = 0
                    let totalSkipped = 0
                    const total = previewItems.length

                    for (let i = 0; i < previewItems.length; i += batchSize) {
                      const batch = previewItems.slice(i, i + batchSize)
                      setImportStatusText(`Importando ${Math.min(i + batchSize, total)} de ${total}...`)
                      try {
                        const res = await fetch('/api/user/sources/import-opml/batch', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ items: batch })
                        })
                        if (res.ok) {
                          const data = await res.json().catch(() => ({ inserted: 0, skipped: 0 }))
                          totalInserted += data.inserted || 0
                          totalSkipped += data.skipped || 0
                        } else {
                          const err = await res.json().catch(() => ({ error: 'Batch failed' }))
                          console.error('Batch import error', err)
                        }
                      } catch (err) {
                        console.error('Batch request failed', err)
                      }

                      processed += batch.length
                      setImportProgress(Math.round((processed / total) * 100))
                    }

                    setImportStatusText(`Finalizado. Insertadas: ${totalInserted}. Omitidas: ${totalSkipped}`)
                    toastState.toast({ title: 'Import OPML', description: `Insertadas: ${totalInserted}. Omitidas: ${totalSkipped}` })
                    await syncWithCloud()
                    setTimeout(() => {
                      setImportProgress(null)
                      setImportStatusText(null)
                      setPreviewOpen(false)
                      setPreviewItems([])
                    }, 2000)
                      }}>Importar</Button>
                    </>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
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
              
              <Field className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <FieldLabel className="mb-0">Modo compacto</FieldLabel>
                  <FieldDescription>
                    Muestra más publicaciones con menos espacio
                  </FieldDescription>
                </div>
                <Switch 
                  checked={settings.compactMode}
                  onCheckedChange={(compactMode) => updateSettings({ compactMode })}
                  className="flex-shrink-0"
                />
              </Field>
              
              <Field className="flex items-center justify-between gap-4">
                <div className="flex-1">
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
                  className="flex-shrink-0"
                />
              </Field>
            </FieldGroup>
          </TabsContent>
          
          {/* Notifications Tab */}
          <TabsContent value="notifications" className="mt-4 space-y-6">
            <FieldGroup>
              <Field className="flex items-center justify-between gap-4">
                <div className="flex-1">
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
                  className="flex-shrink-0"
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
