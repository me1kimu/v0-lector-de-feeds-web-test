import { verifySession } from '@/lib/session'
import { supabase } from '@/lib/supabase'
import { encryptData } from '@/lib/encryption'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { sources, credentials } = await request.json()

    if (!sources || !Array.isArray(sources)) {
      return NextResponse.json(
        { error: 'Invalid data format' },
        { status: 400 }
      )
    }

    // Encrypt credentials before storing
    const encryptedCredentials: Record<string, string> = {}
    for (const [key, value] of Object.entries(credentials || {})) {
      if (typeof value === 'string') {
        encryptedCredentials[key] = await encryptData(value)
      }
    }

    // Insert sources with encrypted credentials
    const sourcesToInsert = sources.map((source: any) => ({
      user_id: session.userId,
      type: source.type,
      url: source.url,
      name: source.name,
      refresh_interval: source.refreshInterval || 3600,
      enabled: true,
      credentials_encrypted: encryptedCredentials[source.id] || null,
    }))

    const { error: insertError } = await supabase
      .from('feed_sources')
      .insert(sourcesToInsert)

    if (insertError) {
      console.error('[v0] Migration insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to migrate data' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Data migrated successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('[v0] Migration failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
