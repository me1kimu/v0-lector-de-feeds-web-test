export type SourceType = 'rss' | 'mastodon' | 'bluesky' | 'pixelfed' | 'instagram' | 'twitter' | 'inkbunny' | 'finance'

export interface FeedSource {
  id: string
  type: SourceType
  name: string
  url: string
  icon?: string
  enabled: boolean
  refreshInterval: number // in minutes
  lastFetched?: number
  credentials?: SourceCredentials
}

export interface SourceCredentials {
  // Mastodon
  instance?: string
  accessToken?: string
  // Bluesky
  handle?: string
  appPassword?: string
  // Generic API
  apiKey?: string
  apiSecret?: string
}

export interface FeedItem {
  id: string
  sourceId: string
  sourceType: SourceType
  sourceName: string
  title?: string
  content: string
  contentHtml?: string
  author: {
    name: string
    handle?: string
    avatar?: string
    url?: string
  }
  url?: string
  publishedAt: number
  media?: MediaAttachment[]
  interactions?: {
    likes?: number
    reposts?: number
    replies?: number
    liked?: boolean
    reposted?: boolean
  }
  raw?: Record<string, unknown>
}

export interface MediaAttachment {
  type: 'image' | 'video' | 'audio' | 'gif'
  url: string
  previewUrl?: string
  alt?: string
  width?: number
  height?: number
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system'
  showExternalMedia: boolean
  compactMode: boolean
  notificationsEnabled: boolean
  defaultRefreshInterval: number
}

export interface Notification {
  id: string
  type: 'new_content' | 'error' | 'info'
  title: string
  message: string
  sourceId?: string
  timestamp: number
  read: boolean
}
