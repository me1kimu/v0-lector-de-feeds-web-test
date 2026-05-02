import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySession } from '@/lib/session'

const protectedPaths = ['/', '/feed', '/settings']
const authPaths = ['/auth']

export async function middleware(request: NextRequest) {
  const session = await verifySession()
  const { pathname } = request.nextUrl

  // Check if path is protected
  const isProtected = protectedPaths.some(path => 
    pathname === path || pathname.startsWith(path + '/')
  )

  // Check if path is auth page
  const isAuthPath = authPaths.some(path => 
    pathname === path || pathname.startsWith(path + '/')
  )

  // Redirect to auth if accessing protected route without session
  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  // Redirect to home if accessing auth pages with session
  if (isAuthPath && session) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js).*)'],
}
