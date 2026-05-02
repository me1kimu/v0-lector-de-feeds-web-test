import { destroySession } from '@/lib/session'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    await destroySession()

    return NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('[v0] Logout failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
