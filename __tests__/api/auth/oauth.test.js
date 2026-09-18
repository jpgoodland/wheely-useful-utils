process.env.JWT_SECRET = 'test-secret-for-jest-32-chars-long!!'
process.env.OAUTH_GOOGLE_CLIENT_ID = 'google-test-cid'
process.env.OAUTH_GOOGLE_CLIENT_SECRET = 'google-test-cs'
process.env.OAUTH_MICROSOFT_CLIENT_ID = 'ms-test-cid'
process.env.OAUTH_MICROSOFT_CLIENT_SECRET = 'ms-test-cs'
process.env.OAUTH_GITHUB_CLIENT_ID = 'gh-test-cid'
process.env.OAUTH_GITHUB_CLIENT_SECRET = 'gh-test-cs'

import { GET } from '@/app/api/auth/oauth/[provider]/route'

describe('GET /api/auth/oauth/[provider]', () => {
  it('returns 400 for unsupported provider', async () => {
    const req = new Request('http://localhost/api/auth/oauth/discord', { method: 'GET' })
    const res = await GET(req, { params: Promise.resolve({ provider: 'discord' }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/unsupported/i)
  })

  it.each(['google', 'microsoft', 'github'])(
    'redirects to %s authorization URL',
    async (provider) => {
      const req = new Request(`http://localhost/api/auth/oauth/${provider}`, {
        method: 'GET',
        headers: { host: 'localhost:3000' },
      })
      const res = await GET(req, { params: Promise.resolve({ provider }) })

      expect(res.status).toBe(307) // NextResponse.redirect
      const location = res.headers.get('location')
      expect(location).toBeTruthy()

      const expectedHosts = {
        google: 'accounts.google.com',
        microsoft: 'login.microsoftonline.com',
        github: 'github.com',
      }
      expect(location).toContain(expectedHosts[provider])
    }
  )

  it('sets oauth_state cookie', async () => {
    const req = new Request('http://localhost/api/auth/oauth/google', {
      method: 'GET',
      headers: { host: 'localhost:3000' },
    })
    const res = await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toMatch(/oauth_state/)
  })

  it('includes state param in redirect URL', async () => {
    const req = new Request('http://localhost/api/auth/oauth/github', {
      method: 'GET',
      headers: { host: 'localhost:3000' },
    })
    const res = await GET(req, { params: Promise.resolve({ provider: 'github' }) })

    const location = res.headers.get('location')
    const url = new URL(location)
    expect(url.searchParams.get('state')).toBeTruthy()
  })

  it('includes correct redirect_uri in authorization URL', async () => {
    const req = new Request('http://localhost/api/auth/oauth/google', {
      method: 'GET',
      headers: { host: 'localhost:3000' },
    })
    const res = await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    const location = res.headers.get('location')
    const url = new URL(location)
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/auth/callback/google'
    )
  })

  it('uses x-forwarded-proto to construct HTTPS redirect_uri in proxy environment', async () => {
    const req = new Request('http://localhost:3000/api/auth/oauth/google', {
      method: 'GET',
      headers: {
        host: 'wheel-app.example.com',
        'x-forwarded-proto': 'https',
      },
    })
    const res = await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    const location = res.headers.get('location')
    const url = new URL(location)
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://wheel-app.example.com/api/auth/callback/google'
    )
  })

  it('redirects to mock sandbox when mock is enabled', async () => {
    process.env.OAUTH_MOCK = 'true'
    const req = new Request('http://localhost/api/auth/oauth/google', {
      method: 'GET',
      headers: { host: 'localhost:3000' },
    })
    const res = await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    expect(res.status).toBe(307)
    const location = res.headers.get('location')
    expect(location).toContain('/auth/mock')
    const url = new URL(location)
    expect(url.searchParams.get('provider')).toBe('google')
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/callback/google')
    delete process.env.OAUTH_MOCK
  })
})
