import { verifySession, destroySession } from '@/lib/session'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await verifySession()

    if (!session) {
      return NextResponse.json(
        { error: 'No session found' },
        { status: 401 }
      )
    }

    return NextResponse.json({ session }, { status: 200 })
  } catch (error) {
    console.error('[v0] Session verification failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
