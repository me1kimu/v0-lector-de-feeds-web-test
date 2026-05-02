import type { AuthenticatorTransport } from '@simplewebauthn/browser'

export interface PasskeyCredential {
  id: string
  userId: string
  credentialId: string
  credentialPublicKey: string
  counter: number
  transports: AuthenticatorTransport[]
  deviceName?: string
  createdAt: string
  lastUsedAt?: string
}

export interface EmailAuthCredential {
  id: string
  userId: string
  email: string
  passwordHash: string
  verified: boolean
  createdAt: string
}

export interface EncryptedCredential {
  id: string
  userId: string
  sourceId: string
  type: 'rss' | 'mastodon' | 'bluesky' | 'twitter' | 'instagram'
  encryptedData: string // AES-256-GCM encrypted JSON
  encryptionNonce: string
  algorithm: 'AES-256-GCM'
  createdAt: string
  updatedAt: string
}

export interface FeedSource {
  id: string
  userId: string
  type: 'rss' | 'mastodon' | 'bluesky' | 'twitter' | 'instagram'
  name: string
  url?: string
  handle?: string
  refreshInterval: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  email?: string
  createdAt: string
  updatedAt: string
}

export interface AuthSession {
  userId: string
  email?: string
  method: 'passkey' | 'email'
  expiresAt: number
  createdAt: number
}

export interface PasskeyRegistrationRequest {
  challenge: string
  userId: string
  userName: string
  displayName: string
}

export interface PasskeyRegistrationResponse {
  credentialId: string
  credentialPublicKey: string
  counter: number
  transports: AuthenticatorTransport[]
}

export interface PasskeyAuthenticationRequest {
  challenge: string
  allowCredentials: Array<{
    id: string
    type: 'public-key'
    transports: AuthenticatorTransport[]
  }>
}

export interface PasskeyAuthenticationResponse {
  id: string
  rawId: string
  response: {
    clientDataJSON: string
    authenticatorData: string
    signature: string
  }
}
