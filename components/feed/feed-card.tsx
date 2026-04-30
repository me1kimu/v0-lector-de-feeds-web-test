'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { FeedItem } from '@/lib/types'
import { useFeedStore } from '@/lib/store'
import { 
  Heart, 
  Repeat2, 
  MessageCircle, 
  ExternalLink,
  Rss,
  AtSign,
  CloudSun,
  MoreHorizontal,
  ImageOff,
  Twitter,
  Camera
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const sourceIcons = {
  rss: <Rss className="h-3 w-3" />,
  mastodon: <AtSign className="h-3 w-3" />,
  bluesky: <CloudSun className="h-3 w-3" />,
  pixelfed: <Rss className="h-3 w-3" />,
  instagram: <Camera className="h-3 w-3" />,
  twitter: <Twitter className="h-3 w-3" />,
  inkbunny: <Rss className="h-3 w-3" />,
  finance: <Rss className="h-3 w-3" />
}

const sourceColors = {
  rss: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  mastodon: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  bluesky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  pixelfed: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  instagram: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400',
  twitter: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  inkbunny: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  finance: 'bg-green-500/10 text-green-600 dark:text-green-400'
}

interface FeedCardProps {
  item: FeedItem
  compact?: boolean
}

export function FeedCard({ item, compact = false }: FeedCardProps) {
  const { settings, sources } = useFeedStore()
  const [imageError, setImageError] = useState<Record<string, boolean>>({})
  const [liked, setLiked] = useState(item.interactions?.liked ?? false)
  const [reposted, setReposted] = useState(item.interactions?.reposted ?? false)
  
  const source = sources.find(s => s.id === item.sourceId)
  const showMedia = settings.showExternalMedia && item.media && item.media.length > 0
  
  const handleLike = async () => {
    if (!source?.credentials) return
    
    setLiked(!liked)
    
    try {
      await fetch(`/api/feeds/${item.sourceType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          action: liked ? 'unfavourite' : 'favourite',
          statusId: (item.raw as Record<string, string>)?.id,
          postUri: (item.raw as Record<string, string>)?.uri,
          postCid: (item.raw as Record<string, string>)?.cid
        })
      })
    } catch (error) {
      console.error('Failed to like:', error)
      setLiked(liked) // Revert on error
    }
  }
  
  const handleRepost = async () => {
    if (!source?.credentials) return
    
    setReposted(!reposted)
    
    try {
      await fetch(`/api/feeds/${item.sourceType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          action: reposted ? 'unreblog' : 'reblog',
          statusId: (item.raw as Record<string, string>)?.id,
          postUri: (item.raw as Record<string, string>)?.uri,
          postCid: (item.raw as Record<string, string>)?.cid
        })
      })
    } catch (error) {
      console.error('Failed to repost:', error)
      setReposted(reposted) // Revert on error
    }
  }
  
  const timeAgo = formatDistanceToNow(new Date(item.publishedAt), { 
    addSuffix: true,
    locale: es 
  })
  
  return (
    <Card className={cn(
      'transition-colors hover:bg-accent/30',
      compact && 'border-0 rounded-none border-b'
    )}>
      <CardContent className={cn('p-4', compact && 'py-3')}>
        {/* Header */}
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={item.author.avatar} alt={item.author.name} />
            <AvatarFallback>
              {item.author.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <a 
                href={item.author.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-semibold text-foreground hover:underline truncate"
              >
                {item.author.name}
              </a>
              {item.author.handle && (
                <span className="text-muted-foreground text-sm truncate">
                  {item.author.handle}
                </span>
              )}
              <span className="text-muted-foreground text-sm">·</span>
              <span className="text-muted-foreground text-sm shrink-0">{timeAgo}</span>
            </div>
            
            <div className="flex items-center gap-2 mt-0.5">
              <Badge 
                variant="secondary" 
                className={cn('text-xs px-1.5 py-0 h-5', sourceColors[item.sourceType])}
              >
                {sourceIcons[item.sourceType]}
                <span className="ml-1">{item.sourceName}</span>
              </Badge>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {item.url && (
                <DropdownMenuItem asChild>
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir original
                  </a>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Title (for RSS) */}
        {item.title && (
          <h3 className="font-semibold mt-3 text-foreground">
            {item.url ? (
              <a 
                href={item.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {item.title}
              </a>
            ) : (
              item.title
            )}
          </h3>
        )}
        
        {/* Content */}
        <div 
          className={cn(
            'mt-2 text-foreground leading-relaxed',
            compact && 'line-clamp-3'
          )}
        >
          {item.contentHtml ? (
            <div 
              dangerouslySetInnerHTML={{ __html: item.contentHtml }} 
              className="prose prose-sm dark:prose-invert max-w-none prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-p:text-foreground prose-p:m-0 prose-span:text-foreground prose-div:text-foreground [&_*]:text-foreground"
            />
          ) : (
            <p className="whitespace-pre-wrap">{item.content}</p>
          )}
        </div>
        
        {/* Media */}
        {showMedia && (
          <div className={cn(
            'mt-3 grid gap-2',
            item.media!.length === 1 && 'grid-cols-1',
            item.media!.length === 2 && 'grid-cols-2',
            item.media!.length >= 3 && 'grid-cols-2'
          )}>
            {item.media!.slice(0, 4).map((media, idx) => (
              <div 
                key={idx}
                className={cn(
                  'relative rounded-lg overflow-hidden bg-muted',
                  item.media!.length === 1 ? 'aspect-video' : 'aspect-square',
                  item.media!.length === 3 && idx === 0 && 'row-span-2 aspect-auto'
                )}
              >
                {imageError[media.url] ? (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <ImageOff className="h-8 w-8" />
                  </div>
                ) : media.type === 'video' ? (
                  <video 
                    src={media.url}
                    poster={media.previewUrl}
                    controls
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={media.previewUrl || media.url}
                    alt={media.alt || ''}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    onError={() => setImageError(prev => ({ ...prev, [media.url]: true }))}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Disabled media indicator */}
        {!settings.showExternalMedia && item.media && item.media.length > 0 && (
          <div className="mt-3 p-3 rounded-lg bg-muted/50 text-muted-foreground text-sm flex items-center gap-2">
            <ImageOff className="h-4 w-4" />
            <span>{item.media.length} archivo(s) multimedia oculto(s)</span>
          </div>
        )}
        
        {/* Interactions */}
        {item.interactions && (
          <div className="flex items-center gap-4 mt-4 -ml-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                'h-8 px-2 text-muted-foreground hover:text-primary',
                liked && 'text-red-500 hover:text-red-600'
              )}
              onClick={handleLike}
            >
              <Heart className={cn('h-4 w-4 mr-1', liked && 'fill-current')} />
              <span className="text-sm">{(item.interactions.likes ?? 0) + (liked && !item.interactions.liked ? 1 : 0)}</span>
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                'h-8 px-2 text-muted-foreground hover:text-green-500',
                reposted && 'text-green-500 hover:text-green-600'
              )}
              onClick={handleRepost}
            >
              <Repeat2 className="h-4 w-4 mr-1" />
              <span className="text-sm">{(item.interactions.reposts ?? 0) + (reposted && !item.interactions.reposted ? 1 : 0)}</span>
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-2 text-muted-foreground hover:text-primary"
              asChild
            >
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4 mr-1" />
                <span className="text-sm">{item.interactions.replies ?? 0}</span>
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
