import {
  SUPPORTED_PROVIDERS,
  getProviderConfig,
  getClientCredentials,
  getAuthUrl,
  getBaseUrl,
  exchangeCode,
  fetchUserProfile,
} from '@/lib/oauth'

describe('lib/oauth', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      OAUTH_GOOGLE_CLIENT_ID: 'google-cid',
      OAUTH_GOOGLE_CLIENT_SECRET: 'google-cs',
      OAUTH_MICROSOFT_CLIENT_ID: 'ms-cid',
      OAUTH_MICROSOFT_CLIENT_SECRET: 'ms-cs',
      OAUTH_GITHUB_CLIENT_ID: 'gh-cid',
      OAUTH_GITHUB_CLIENT_SECRET: 'gh-cs',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // ── SUPPORTED_PROVIDERS ────────────────────────────────────────────────────

  it('exports the three supported providers', () => {
    expect(SUPPORTED_PROVIDERS).toEqual(
      expect.arrayContaining(['google', 'microsoft', 'github'])
    )
    expect(SUPPORTED_PROVIDERS).toHaveLength(3)
  })

  // ── getProviderConfig ──────────────────────────────────────────────────────

  it('returns config for valid providers', () => {
    for (const p of SUPPORTED_PROVIDERS) {
      const cfg = getProviderConfig(p)
      expect(cfg).toBeDefined()
      expect(cfg.authorizeUrl).toBeDefined()
      expect(cfg.tokenUrl).toBeDefined()
      expect(cfg.userinfoUrl).toBeDefined()
    }
  })

  it('returns null for unsupported provider', () => {
    expect(getProviderConfig('discord')).toBeNull()
  })

  // ── getClientCredentials ───────────────────────────────────────────────────

  it('reads client credentials from env vars', () => {
    const { clientId, clientSecret } = getClientCredentials('google')
    expect(clientId).toBe('google-cid')
    expect(clientSecret).toBe('google-cs')
  })

  it('throws for unsupported provider', () => {
    expect(() => getClientCredentials('discord')).toThrow(/unsupported/i)
  })

  // ── getAuthUrl ─────────────────────────────────────────────────────────────

  it.each(['google', 'microsoft', 'github'])(
    'builds a valid auth URL for %s',
    (provider) => {
      const url = getAuthUrl(provider, 'test-state', 'http://localhost/callback')
      const parsed = new URL(url)

      // Has required params
      expect(parsed.searchParams.get('client_id')).toBeTruthy()
      expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost/callback')
      expect(parsed.searchParams.get('response_type')).toBe('code')
      expect(parsed.searchParams.get('state')).toBe('test-state')
      expect(parsed.searchParams.get('scope')).toBeTruthy()
    }
  )

  it('includes prompt=consent for Google', () => {
    const url = getAuthUrl('google', 's', 'http://x')
    expect(new URL(url).searchParams.get('prompt')).toBe('consent')
  })

  it('throws for unsupported provider', () => {
    expect(() => getAuthUrl('discord', 's', 'http://x')).toThrow(/unsupported/i)
  })

  // ── exchangeCode ───────────────────────────────────────────────────────────

  it('sends correct POST body and returns access_token', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'tok123' }),
    })
    global.fetch = mockFetch

    const token = await exchangeCode('google', 'authcode', 'http://localhost/cb')
    expect(token).toBe('tok123')

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('googleapis.com')
    expect(opts.method).toBe('POST')
    const body = new URLSearchParams(opts.body)
    expect(body.get('code')).toBe('authcode')
    expect(body.get('grant_type')).toBe('authorization_code')
  })

  it('throws on non-OK response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('bad request'),
    })

    await expect(exchangeCode('google', 'bad', 'http://x')).rejects.toThrow(/token exchange failed/i)
  })

  it('sets Accept: application/json for GitHub', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'tok' }),
    })

    await exchangeCode('github', 'code', 'http://x')
    const headers = global.fetch.mock.calls[0][1].headers
    expect(headers['Accept']).toBe('application/json')
  })

  // ── fetchUserProfile ───────────────────────────────────────────────────────

  describe('fetchUserProfile', () => {
    it('returns email and name for Google', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ email: 'a@google.com', name: 'Alice' }),
      })

      const profile = await fetchUserProfile('google', 'tok')
      expect(profile.email).toBe('a@google.com')
      expect(profile.name).toBe('Alice')
    })

    it('returns email and displayName for Microsoft', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ mail: 'b@ms.com', displayName: 'Bob' }),
      })

      const profile = await fetchUserProfile('microsoft', 'tok')
      expect(profile.email).toBe('b@ms.com')
      expect(profile.name).toBe('Bob')
    })

    it('falls back to userPrincipalName for Microsoft when mail is null', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ mail: null, userPrincipalName: 'b@ms.com', displayName: 'Bob' }),
      })

      const profile = await fetchUserProfile('microsoft', 'tok')
      expect(profile.email).toBe('b@ms.com')
    })

    it('returns email from /user for GitHub', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ email: 'c@gh.com', name: 'Charlie', login: 'charlie' }),
      })

      const profile = await fetchUserProfile('github', 'tok')
      expect(profile.email).toBe('c@gh.com')
      expect(profile.name).toBe('Charlie')
    })

    it('fetches email from /user/emails for GitHub when primary is null', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ email: null, name: 'Charlie', login: 'charlie' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            { email: 'c@gh.com', primary: true, verified: true },
          ]),
        })

      const profile = await fetchUserProfile('github', 'tok')
      expect(profile.email).toBe('c@gh.com')
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('uses login as name fallback for GitHub', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ email: 'x@gh.com', name: null, login: 'ghuser' }),
      })

      const profile = await fetchUserProfile('github', 'tok')
      expect(profile.name).toBe('ghuser')
    })

    it('throws on non-OK response', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 })
      await expect(fetchUserProfile('google', 'bad')).rejects.toThrow(/userinfo fetch failed/i)
    })
  })

  // ── getBaseUrl ─────────────────────────────────────────────────────────────

  describe('getBaseUrl', () => {
    it('uses x-forwarded-proto and host from request headers', () => {
      const req = new Request('http://localhost:3000/api/auth/oauth/google', {
        headers: {
          'x-forwarded-proto': 'https',
          host: 'wheel-app.example.com',
        },
      })
      expect(getBaseUrl(req)).toBe('https://wheel-app.example.com')
    })

    it('prefers x-forwarded-host when present', () => {
      const req = new Request('http://localhost:3000/api/auth/oauth/google', {
        headers: {
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'wheel-app.example.com',
          host: 'internal-alb.aws.local',
        },
      })
      expect(getBaseUrl(req)).toBe('https://wheel-app.example.com')
    })

    it('defaults to https in production when x-forwarded-proto is absent', () => {
      process.env.NODE_ENV = 'production'
      const req = new Request('http://localhost:3000/api/auth/oauth/google', {
        headers: { host: 'wheel-app.example.com' },
      })
      expect(getBaseUrl(req)).toBe('https://wheel-app.example.com')
    })

    it('defaults to https when FORCE_HTTPS is true', () => {
      process.env.FORCE_HTTPS = 'true'
      const req = new Request('http://localhost:3000/api/auth/oauth/google', {
        headers: { host: 'wheel-app.example.com' },
      })
      expect(getBaseUrl(req)).toBe('https://wheel-app.example.com')
    })

    it('falls back to APP_DOMAIN when host header is missing', () => {
      process.env.APP_DOMAIN = 'wheel-app.example.com'
      expect(getBaseUrl({})).toBe('http://wheel-app.example.com')
    })

    it('defaults to http://localhost:3000 when no headers or env vars exist', () => {
      expect(getBaseUrl({})).toBe('http://localhost:3000')
    })
  })
})
