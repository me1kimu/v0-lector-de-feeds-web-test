/**
 * Client-side encryption utilities for securing user credentials
 * Uses Web Crypto API for AES-GCM encryption
 */

// Generate a random encryption key
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

async function derivePasswordHash(password: string, salt: BufferSource): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 120000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  )
}

// Hash a password with PBKDF2 and a random salt
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hashBuffer = await derivePasswordHash(password, salt)

  return `${bufferToBase64(salt)}:${bufferToBase64(hashBuffer)}`
}

// Verify a password against a stored salt:hash string
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltBase64, hashBase64] = storedHash.split(':')

  if (!saltBase64 || !hashBase64) {
    return false
  }

  const salt = new Uint8Array(base64ToBuffer(saltBase64))
  const expectedHash = base64ToBuffer(hashBase64)
  const actualHash = await derivePasswordHash(password, salt)

  if (actualHash.byteLength !== expectedHash.byteLength) {
    return false
  }

  const actualBytes = new Uint8Array(actualHash)
  const expectedBytes = new Uint8Array(expectedHash)
  let mismatch = 0

  for (let index = 0; index < actualBytes.length; index++) {
    mismatch |= actualBytes[index] ^ expectedBytes[index]
  }

  return mismatch === 0
}

// Export key to base64 for storage
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key)
  return bufferToBase64(exported)
}

// Import key from base64
export async function importKey(keyData: string): Promise<CryptoKey> {
  const keyBuffer = base64ToBuffer(keyData)
  return crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

// Derive a key from a passkey credential (for key wrapping)
export async function deriveKeyFromCredential(
  credentialId: ArrayBuffer,
  salt: BufferSource
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    credentialId,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

// Encrypt data with AES-GCM
export async function encrypt(
  data: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  )

  return {
    ciphertext: bufferToBase64(encrypted),
    iv: bufferToBase64(iv),
  }
}

// Decrypt data with AES-GCM
export async function decrypt(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const decoder = new TextDecoder()
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBuffer(iv) },
    key,
    base64ToBuffer(ciphertext)
  )

  return decoder.decode(decrypted)
}

// Wrap (encrypt) the user's encryption key with a derived key
export async function wrapKey(
  keyToWrap: CryptoKey,
  wrappingKey: CryptoKey
): Promise<{ wrappedKey: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  const wrapped = await crypto.subtle.wrapKey(
    'raw',
    keyToWrap,
    wrappingKey,
    { name: 'AES-GCM', iv }
  )

  return {
    wrappedKey: bufferToBase64(wrapped),
    iv: bufferToBase64(iv),
  }
}

// Unwrap (decrypt) the user's encryption key
export async function unwrapKey(
  wrappedKey: string,
  iv: string,
  unwrappingKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    base64ToBuffer(wrappedKey),
    unwrappingKey,
    { name: 'AES-GCM', iv: base64ToBuffer(iv) },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

// Helper: ArrayBuffer to base64
export function bufferToBase64(buffer: ArrayBuffer | ArrayBufferView): string {
  const bytes = buffer instanceof ArrayBuffer 
    ? new Uint8Array(buffer) 
    : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Helper: base64 to ArrayBuffer
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

// Helper: base64url encode (for WebAuthn)
export function base64urlEncode(buffer: ArrayBuffer): string {
  return bufferToBase64(buffer)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// Helper: base64url decode (for WebAuthn)
export function base64urlDecode(base64url: string): ArrayBuffer {
  const base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const padLen = (4 - (base64.length % 4)) % 4
  const padded = base64 + '='.repeat(padLen)
  return base64ToBuffer(padded)
}

// Generate a random salt
export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return bufferToBase64(salt)
}
