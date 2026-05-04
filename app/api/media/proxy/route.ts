import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_HOST_PATTERNS = [
  /(^|\.)cdninstagram\.com$/i,
  /(^|\.)fbcdn\.net$/i,
]

function isAllowedMediaUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl)

    if (parsed.protocol !== 'https:') {
      return null
    }

    const isAllowedHost = ALLOWED_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname))
    if (!isAllowedHost) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('url')

  if (!target) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  const parsedUrl = isAllowedMediaUrl(target)
  if (!parsedUrl) {
    return NextResponse.json({ error: 'URL is not allowed' }, { status: 403 })
  }

  const upstreamHeaders = new Headers()
  upstreamHeaders.set('User-Agent', 'FeedReader/1.0 (+https://localhost)')
  upstreamHeaders.set('Accept', '*/*')
  upstreamHeaders.set('Referer', 'https://www.instagram.com/')
  upstreamHeaders.set('Origin', 'https://www.instagram.com')

  const range = request.headers.get('range')
  if (range) {
    upstreamHeaders.set('Range', range)
  }

  const upstreamResponse = await fetch(parsedUrl.toString(), {
    headers: upstreamHeaders,
    redirect: 'follow',
  })

  if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
    return NextResponse.json(
      { error: `Upstream media request failed with status ${upstreamResponse.status}` },
      { status: upstreamResponse.status }
    )
  }

  const responseHeaders = new Headers()
  const passthroughHeaders = [
    'content-type',
    'content-length',
    'accept-ranges',
    'content-range',
    'etag',
    'last-modified',
  ]

  for (const headerName of passthroughHeaders) {
    const value = upstreamResponse.headers.get(headerName)
    if (value) {
      responseHeaders.set(headerName, value)
    }
  }

  responseHeaders.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600')
  responseHeaders.set('X-Content-Type-Options', 'nosniff')

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  })
}
