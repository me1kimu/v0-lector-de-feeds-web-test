import * as React from 'react'
import type { SourceType, FeedSource } from '@/lib/types'
import {
  Rss,
  AtSign,
  CloudSun,
  Layers,
  Twitter,
  Camera,
  Play
} from 'lucide-react'

export const sourceTypeIcons: Record<SourceType, React.ReactNode> = {
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

export const sourceTypeLabels: Record<SourceType, string> = {
  rss: 'RSS',
  mastodon: 'Mastodon',
  bluesky: 'Bluesky',
  youtube: 'YouTube',
  pixelfed: 'Pixelfed',
  instagram: 'Instagram',
  twitter: 'Twitter',
  inkbunny: 'Inkbunny',
  finance: 'Finanzas'
}

export const sourceTypeOptions: { value: SourceType; label: string; icon: React.ReactNode; description?: string }[] = [
  { value: 'rss', label: 'RSS Feed', icon: <Rss className="h-4 w-4" /> },
  { value: 'mastodon', label: 'Mastodon', icon: <AtSign className="h-4 w-4" /> },
  { value: 'bluesky', label: 'Bluesky', icon: <CloudSun className="h-4 w-4" /> },
  { value: 'youtube', label: 'YouTube', icon: <Play className="h-4 w-4" />, description: 'Canal o usuario' },
  { value: 'twitter', label: 'Twitter/X', icon: <Twitter className="h-4 w-4" />, description: 'Solo perfiles públicos' },
  { value: 'instagram', label: 'Instagram', icon: <Camera className="h-4 w-4" />, description: 'Solo perfiles públicos' },
]

export function getSourceSubtitle(source: FeedSource): string {
  if (source.type === 'mastodon') {
    return source.credentials?.instance || ''
  }
  if (source.type === 'twitter' || source.type === 'instagram') {
    return source.credentials?.handle ? `@${source.credentials.handle}` : (source.url || '')
  }
  if (source.type === 'bluesky' || source.type === 'youtube') {
    return source.credentials?.handle || source.url || ''
  }
  return source.url || ''
}
