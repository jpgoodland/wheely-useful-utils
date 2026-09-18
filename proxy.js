import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rateLimit'

/**
 * Rate-limit tiers (requests / windowMs):
 *
 *  auth-mutate  – login & signup:  10 req / 60 s   (brute-force / credential stuffing)
 *  spin         – wheel spin:      30 req / 60 s   (noisy-neighbor / abuse)
 *  api-general  – all other API:  120 req / 60 s   (general DoS)
 *  global       – every request:  300 req / 60 s   (DDoS circuit-breaker)
 */
const TIERS = {
  'auth-mutate': { limit: 10,  windowMs: 60_000 },
  spin:          { limit: 30,  windowMs: 60_000 },
  'api-general': { limit: 120, windowMs: 60_000 },
  global:        { limit: 300, windowMs: 60_000 },
}


// HSTS: tell browsers to only ever use HTTPS for this origin for 1 year,
// including all subdomains, and allow preloading.
const HSTS_VALUE = 'max-age=31536000; includeSubDomains; preload'

/**
 * Derive a stable client identifier from the request.
 * x-forwarded-for is the standard header set by proxies/load-balancers.
 * Fall back to a static sentinel so the limiter still works in local dev
 * where no real IP is forwarded.
 */
function getClientIp(request) {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    // xff may be a comma-separated list; the leftmost is the originating client
    const raw = xff.split(',')[0].trim()
    return raw.replace(/[^\w.:-]/g, '').slice(0, 64) || 'local'
  }
  return 'local'
}

function rateLimitedResponse(resetMs) {
  const retryAfterSecs = Math.ceil((resetMs - Date.now()) / 1000)
  return new Response(
    JSON.stringify({ error: 'Too Many Requests' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.max(1, retryAfterSecs)),
        'X-RateLimit-Reset': String(resetMs),
      },
    }
  )
}

function getTier(pathname) {
  if (
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/signup' ||
    pathname === '/api/auth/forgot-password' ||
    pathname === '/api/auth/reset-password' ||
    pathname === '/api/auth/resend-verification' ||
    pathname === '/api/admin/invite/accept'
  ) return 'auth-mutate'

  if (pathname.match(/^\/api\/wheels\/[^/]+\/spin$/)) return 'spin'

  if (pathname.startsWith('/api/')) return 'api-general'

  return null // no per-route tier for non-API paths
}

export function proxy(request) {
  const { pathname } = request.nextUrl

  // ── Transit security ────────────────────────────────────────────────────────
  // Redirect plain HTTP to HTTPS only when explicitly enabled.
  // Set FORCE_HTTPS=true in production (ECS task definition).
  // Leave it unset for local Docker development.
  if (process.env.FORCE_HTTPS === 'true' && request.nextUrl.protocol === 'http:') {
    const httpsUrl = new URL(request.url)
    httpsUrl.protocol = 'https:'
    return NextResponse.redirect(httpsUrl, { status: 301 })
  }

  // C1: Block the mock OAuth sandbox outside of development
  if (
    process.env.NODE_ENV !== 'development' &&
    pathname.startsWith('/auth/mock')
  ) {
    return NextResponse.rewrite(new URL('/not-found', request.url), {
      status: 404,
    })
  }

  const ip = getClientIp(request)

  // 1. Global circuit-breaker — catches DDoS across all paths
  const global = checkRateLimit(`global:${ip}`, TIERS.global.limit, TIERS.global.windowMs)
  if (!global.allowed) return rateLimitedResponse(global.resetMs)

  // 2. Per-route tier — catches DoS / noisy-neighbor on specific endpoints
  const tier = getTier(pathname)
  if (tier) {
    const result = checkRateLimit(`${tier}:${ip}`, TIERS[tier].limit, TIERS[tier].windowMs)
    if (!result.allowed) return rateLimitedResponse(result.resetMs)
  }

  // Pass rate-limit info downstream as request headers so route handlers
  // can surface them to clients if desired.
  const response = NextResponse.next()

  // ── HSTS ────────────────────────────────────────────────────────────────────
  if (process.env.FORCE_HTTPS === 'true') {
    response.headers.set('Strict-Transport-Security', HSTS_VALUE)
  }

  if (tier) {
    const result = checkRateLimit(`${tier}:${ip}`, TIERS[tier].limit, TIERS[tier].windowMs)
    response.headers.set('X-RateLimit-Limit', String(TIERS[tier].limit))
    response.headers.set('X-RateLimit-Remaining', String(result.remaining))
  }

  return response
}

export const config = {
  // Run on all routes; static assets are excluded by Next.js automatically
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
