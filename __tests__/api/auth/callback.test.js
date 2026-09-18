process.env.JWT_SECRET = 'test-secret-for-jest-32-chars-long!!'
process.env.OAUTH_GOOGLE_CLIENT_ID = 'google-test-cid'
process.env.OAUTH_GOOGLE_CLIENT_SECRET = 'google-test-cs'

import { GET } from '@/app/api/auth/callback/[provider]/route'

// Mock DynamoDB
jest.mock('@/lib/dynamodb', () => ({
  docClient: { send: jest.fn() },
  TableNames: { Users: 'WheelApp_Users' },
}))

// Mock the OAuth helpers so we don't make real HTTP requests
jest.mock('@/lib/oauth', () => ({
  ...jest.requireActual('@/lib/oauth'),
  exchangeCode: jest.fn(),
  fetchUserProfile: jest.fn(),
}))

// Mock next/headers cookies()
const mockCookies = {
  get: jest.fn(),
}
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => Promise.resolve(mockCookies)),
}))

const { docClient } = require('@/lib/dynamodb')
const { exchangeCode, fetchUserProfile } = require('@/lib/oauth')

function makeCallbackRequest(provider, { code = 'test-code', state = 'valid-state', error: errorParam } = {}) {
  const params = new URLSearchParams()
  if (code) params.set('code', code)
  if (state) params.set('state', state)
  if (errorParam) params.set('error', errorParam)

  return new Request(`http://localhost/api/auth/callback/${provider}?${params}`, {
    method: 'GET',
    headers: { host: 'localhost:3000' },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  // Default: state cookie matches
  mockCookies.get.mockReturnValue({ value: 'valid-state' })
  // Default: mock OAuth helpers
  exchangeCode.mockResolvedValue('mock-access-token')
  fetchUserProfile.mockResolvedValue({ email: 'test@example.com', name: 'Test User' })
  // Default: no existing user
  docClient.send.mockResolvedValue({ Items: [] })
})

describe('GET /api/auth/callback/[provider]', () => {
  it('redirects to /login with error for unsupported provider', async () => {
    const req = makeCallbackRequest('discord')
    const res = await GET(req, { params: Promise.resolve({ provider: 'discord' }) })

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login?error=unsupported_provider')
  })

  it('redirects to /login when provider returns an error', async () => {
    const req = makeCallbackRequest('google', { error: 'access_denied' })
    const res = await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login?error=access_denied')
  })

  it('redirects to /login when code is missing', async () => {
    const req = makeCallbackRequest('google', { code: null })
    const res = await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login?error=missing_params')
  })

  it('rejects mismatched CSRF state', async () => {
    mockCookies.get.mockReturnValue({ value: 'different-state' })

    const req = makeCallbackRequest('google')
    const res = await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login?error=invalid_state')
  })

  it('rejects when oauth_state cookie is missing', async () => {
    mockCookies.get.mockReturnValue(undefined)

    const req = makeCallbackRequest('google')
    const res = await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login?error=invalid_state')
  })

  it('creates a new user when email does not exist', async () => {
    docClient.send.mockResolvedValue({ Items: [] })

    const req = makeCallbackRequest('google')
    const res = await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/dashboard')

    // Should have called send 4 times: 1 email query + 1 username check + 2 puts (primary + username pointer)
    expect(docClient.send).toHaveBeenCalledTimes(4)

    // Verify the primary put (index 2: after email query and username check)
    const putCall = docClient.send.mock.calls[2][0]
    const item = putCall.input.Item
    expect(item.email).toBe('test@example.com')
    expect(item.isVerified).toBe(true)
    expect(item.authProvider).toBe('google')
    expect(item.oauthProviders).toEqual(['google'])
    expect(item.password).toBeUndefined()
  })

  it('links provider to existing user', async () => {
    const existingUser = {
      PK: 'USER#existing-id',
      userId: 'existing-id',
      email: 'test@example.com',
      username: 'testuser',
      isAdmin: false,
      isVerified: true,
    }
    docClient.send.mockResolvedValueOnce({ Items: [existingUser] })
    // Update calls resolve
    docClient.send.mockResolvedValue({})

    const req = makeCallbackRequest('google')
    const res = await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/dashboard')

    // Should have called send for: 1 query + 2 updates (primary + username pointer)
    expect(docClient.send).toHaveBeenCalledTimes(3)
  })

  it('does not duplicate provider when already linked', async () => {
    const existingUser = {
      PK: 'USER#existing-id',
      userId: 'existing-id',
      email: 'test@example.com',
      username: 'testuser',
      isAdmin: false,
      isVerified: true,
      oauthProviders: ['google'],
    }
    docClient.send.mockResolvedValueOnce({ Items: [existingUser] })

    const req = makeCallbackRequest('google')
    const res = await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/dashboard')

    // Only 1 call: the initial query. No updates needed.
    expect(docClient.send).toHaveBeenCalledTimes(1)
  })

  it('sets auth_token cookie on success with SameSite=Lax', async () => {
    const req = makeCallbackRequest('google')
    const res = await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toMatch(/auth_token/)
    expect(setCookie.toLowerCase()).toContain('samesite=lax')
  })

  it('redirects to HTTPS dashboard behind reverse proxy', async () => {
    const req = new Request('http://localhost:3000/api/auth/callback/google?code=test-code&state=valid-state', {
      method: 'GET',
      headers: {
        host: 'wheel-app.example.com',
        'x-forwarded-proto': 'https',
      },
    })
    const res = await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://wheel-app.example.com/dashboard')
  })

  it('clears oauth_state cookie on success', async () => {
    const req = makeCallbackRequest('google')
    const res = await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toMatch(/oauth_state/)
  })

  it('redirects to /login on exchangeCode failure', async () => {
    exchangeCode.mockRejectedValue(new Error('token exchange failed'))

    const req = makeCallbackRequest('google')
    const res = await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login?error=oauth_failed')
  })

  it('redirects to /login when profile has no email', async () => {
    fetchUserProfile.mockResolvedValue({ email: '', name: 'No Email' })

    const req = makeCallbackRequest('google')
    const res = await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login?error=no_email')
  })

  it('auto-generates username from email prefix for new users', async () => {
    fetchUserProfile.mockResolvedValue({ email: 'alice.smith@gmail.com', name: 'Alice' })
    docClient.send.mockResolvedValue({ Items: [] })

    const req = makeCallbackRequest('google')
    await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    // The primary Put is at index 2 (email query + username check + primary put)
    const putCall = docClient.send.mock.calls[2][0]
    const item = putCall.input.Item
    // Username should be derived from 'alice.smith' (dots preserved as they pass the regex)
    expect(item.username).toMatch(/^alice/)
  })

  it('grants admin to emails configured in ADMIN_EMAILS for new OAuth users', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    fetchUserProfile.mockResolvedValue({ email: 'admin@example.com', name: 'Admin' })
    docClient.send.mockResolvedValue({ Items: [] })

    const req = makeCallbackRequest('google')
    await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    const putCall = docClient.send.mock.calls[2][0]
    expect(putCall.input.Item.isAdmin).toBe(true)
  })

  it('does not grant admin to unlisted emails for new OAuth users', async () => {
    delete process.env.ADMIN_EMAILS
    fetchUserProfile.mockResolvedValue({ email: 'admin@example.com', name: 'Admin' })
    docClient.send.mockResolvedValue({ Items: [] })

    const req = makeCallbackRequest('google')
    await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    const putCall = docClient.send.mock.calls[2][0]
    expect(putCall.input.Item.isAdmin).toBe(false)
  })
})
