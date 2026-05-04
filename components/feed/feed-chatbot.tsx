'use client'

// AI Chat component for feed summarization
import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useFeedStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  X,
  Loader2,
  Zap
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface FeedChatbotProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedChatbot({ open, onOpenChange }: FeedChatbotProps) {
  const { items } = useFeedStore()
  const [input, setInput] = useState('')
  const [model, setModel] = useState<'openrouter' | 'ollama' | 'gemini'>('openrouter')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [ollamaAvailable, setOllamaAvailable] = useState(false)
  
  // Check if Ollama is available
  useEffect(() => {
    const checkOllama = async () => {
      try {
        const response = await fetch('http://localhost:11434/api/tags', {
          method: 'GET',
        })
        setOllamaAvailable(response.ok)
      } catch {
        setOllamaAvailable(false)
      }
    }
    
    if (open) {
      checkOllama()
    }
  }, [open])
  
  // Get latest feed items to provide context
  const latestItems = items
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, 20)
    .map(item => ({
      title: item.title || '',
      author: item.author || 'Desconocido',
      source: item.sourceType,
      content: item.content || '',
      publishedAt: new Date(item.publishedAt).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    }))
  
  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ 
      api: '/api/chat',
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          messages,
          feedItems: latestItems,
          useOllama: model === 'ollama'
        }
      })
    }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput('')
  }
  
  const handleSummarize = () => {
    if (isLoading) return
    sendMessage({ text: 'Resume las ultimas publicaciones de mi feed. Destaca los temas principales y cualquier noticia importante.' })
  }

  const handleClearChat = () => {
    setMessages([])
  }
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-lg p-0 flex flex-col"
      >
        <SheetHeader className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <SheetTitle className="text-left">Asistente de Feed</SheetTitle>
            </div>
            {messages.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearChat}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Model selector */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Modelo:</span>
            <Select 
              value={model}
              onValueChange={(value) => setModel(value as 'openrouter' | 'ollama' | 'gemini')}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openrouter">
                  <span className="flex items-center gap-2">
                    ✨ Gemma 4 (OpenRouter - Gratis)
                  </span>
                </SelectItem>
                <SelectItem 
                  value="ollama" 
                  disabled={!ollamaAvailable}
                >
                  <span className="flex items-center gap-2">
                    {ollamaAvailable ? (
                      <>
                        <Zap className="h-4 w-4" />
                        Qwen (Local)
                      </>
                    ) : (
                      'Qwen (Local) - No disponible'
                    )}
                  </span>
                </SelectItem>
                <SelectItem value="gemini">
                  <span className="flex items-center gap-2">
                    ✨ Gemini Flash (Cloud)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {model === 'openrouter' && (
            <p className="text-xs text-muted-foreground mt-2">
              Usando Gemma 4 de OpenRouter (modelo gratuito)
            </p>
          )}
          {model === 'ollama' && ollamaAvailable && (
            <p className="text-xs text-muted-foreground mt-2">
              Usando modelo qwen:0.5b local en http://localhost:11434
            </p>
          )}
          {!ollamaAvailable && model !== 'openrouter' && (
            <p className="text-xs text-muted-foreground mt-2">
              💡 Instala Ollama y descarga qwen:0.5b para usar modelos locales
            </p>
          )}
        </SheetHeader>
        
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                Asistente de Feed con IA
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                Puedo resumir tus publicaciones, encontrar temas comunes y responder preguntas sobre tu feed.
              </p>
              
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Button 
                  onClick={handleSummarize}
                  disabled={isLoading || latestItems.length === 0}
                  className="w-full"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Resumir ultimas publicaciones
                </Button>
                {latestItems.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Agrega fuentes para empezar
                  </p>
                )}
              </div>
              
              <div className="mt-8 text-xs text-muted-foreground">
                <p className="mb-2">Ejemplos de preguntas:</p>
                <ul className="space-y-1">
                  <li>&quot;¿Cuales son las noticias mas importantes?&quot;</li>
                  <li>&quot;Resume los posts de Mastodon&quot;</li>
                  <li>&quot;¿Hay alguna tendencia comun?&quot;</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div 
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'flex-row-reverse' : ''
                  )}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className={cn(
                      message.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    )}>
                      {message.role === 'user' 
                        ? <User className="h-4 w-4" /> 
                        : <Bot className="h-4 w-4" />
                      }
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className={cn(
                    'rounded-2xl px-4 py-2 max-w-[85%]',
                    message.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-foreground'
                  )}>
                    {message.parts.map((part, index) => {
                      if (part.type === 'text') {
                        return (
                          <div 
                            key={index} 
                            className="text-sm whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none prose-p:m-0 prose-p:leading-relaxed"
                          >
                            {part.text}
                          </div>
                        )
                      }
                      return null
                    })}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-muted">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="rounded-2xl px-4 py-3 bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
        
        <form onSubmit={handleSubmit} className="p-4 border-t border-border">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
