import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-key-change-in-production'
)

export interface SessionPayload {
  userId: string
  email: string
  iat?: number
  exp?: number
}

const SESSION_COOKIE = 'feedreader_session'
const CHALLENGE_COOKIE = 'webauthn_challenge'

export async function createSession(payload: Omit<SessionPayload, 'iat' | 'exp'>) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  })

  return token
}

export async function verifySession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (!token) return null

  try {
    const verified = await jwtVerify(token, secret)
    return verified.payload as SessionPayload
  } catch {
    return null
  }
}

export async function destroySession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function setChallenge(challenge: string) {
  const cookieStore = await cookies()
  cookieStore.set(CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60, // 10 minutes
    path: '/',
  })
}

export async function getChallenge(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(CHALLENGE_COOKIE)?.value || null
}

export async function clearChallenge() {
  const cookieStore = await cookies()
  cookieStore.delete(CHALLENGE_COOKIE)
}
