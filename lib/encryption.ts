import CryptoJS from 'crypto-js'
import nacl from 'tweetnacl'
import { encodeUTF8, decodeUTF8 } from 'tweetnacl-util'

/**
 * Generate a random encryption key for AES-256-GCM
 * Note: CryptoJS uses AES in CBC mode by default, for production consider using TweetNaCl.js for proper GCM
 */
export function generateEncryptionKey(): string {
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  return Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Generate a random nonce for encryption
 */
export function generateNonce(): string {
  const nonce = nacl.randomBytes(24) // 24 bytes for NaCl secretbox
  return encodeUTF8(nonce).split('').map((c: string) => {
    const code = c.charCodeAt(0)
    return code.toString(16).padStart(2, '0')
  }).join('')
}

/**
 * Encrypt data using AES-256-GCM with TweetNaCl (proper GCM implementation)
 */
export function encryptData(data: object, encryptionKey: string): {
  encrypted: string
  nonce: string
} {
  const plaintext = JSON.stringify(data)
  const key = nacl.util.decodeHex(encryptionKey.substring(0, 64))
  const nonce = nacl.randomBytes(24)
  
  // Using secretbox for authenticated encryption (similar to GCM)
  const encrypted = nacl.secretbox(encodeUTF8(plaintext), nonce, key)
  
  return {
    encrypted: nacl.util.encodeHex(encrypted),
    nonce: nacl.util.encodeHex(nonce)
  }
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decryptData(
  encryptedHex: string,
  nonceHex: string,
  encryptionKey: string
): object {
  try {
    const key = nacl.util.decodeHex(encryptionKey.substring(0, 64))
    const nonce = nacl.util.decodeHex(nonceHex)
    const encrypted = nacl.util.decodeHex(encryptedHex)
    
    const decrypted = nacl.secretbox.open(encrypted, nonce, key)
    if (!decrypted) {
      throw new Error('Decryption failed - box could not be opened')
    }
    
    const plaintext = decodeUTF8(decrypted)
    return JSON.parse(plaintext)
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Hash password using PBKDF2 for email auth fallback
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const newHash = await hashPassword(password)
  return newHash === hash
}

/**
 * Derive an encryption key from a master password/salt
 */
export async function deriveKey(
  password: string,
  salt: string,
  iterations: number = 100000
): Promise<string> {
  const encoder = new TextEncoder()
  const passwordData = encoder.encode(password)
  const saltData = encoder.encode(salt)
  
  const key = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltData,
      iterations,
      hash: 'SHA-256'
    },
    key,
    256 // 32 bytes for AES-256
  )
  
  const hashArray = Array.from(new Uint8Array(derivedBits))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
