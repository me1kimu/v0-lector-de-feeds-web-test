import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  try {
    // Log incoming requests for monitoring
    const pathname = request.nextUrl.pathname
    const method = request.method
    
    // Skip logging for static assets
    if (!pathname.includes('_next') && !pathname.includes('favicon')) {
      console.log(`[v0] Middleware: ${method} ${pathname}`)
    }

    // Update session and return response
    const response = await updateSession(request)
    
    // Log response status
    console.log(`[v0] Middleware: Response ${response.status} for ${method} ${pathname}`)
    
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const stack = error instanceof Error ? error.stack : ''
    
    console.error('[v0] Middleware Error:', message, stack, error)
    
    // Return error response
    return NextResponse.json(
      { error: 'Middleware error', message },
      { status: 500 }
    )
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
