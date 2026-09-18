process.env.JWT_SECRET = 'test-secret-for-jest-32-chars-long!!'
process.env.OAUTH_GOOGLE_CLIENT_ID = 'google-test-cid'
process.env.OAUTH_GOOGLE_CLIENT_SECRET = 'google-test-cs'
process.env.OAUTH_MOCK = 'true'

import { GET } from '@/app/api/auth/callback/[provider]/route'

// Mock DynamoDB
jest.mock('@/lib/dynamodb', () => ({
  docClient: { send: jest.fn() },
  TableNames: { Users: 'WheelApp_Users' },
}))

// Mock next/headers cookies()
const mockCookies = {
  get: jest.fn(),
  set: jest.fn(),
}
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => Promise.resolve(mockCookies)),
}))

const { docClient } = require('@/lib/dynamodb')

function makeCallbackRequest(provider, { code, state = 'valid-state', error: errorParam } = {}) {
  const params = new URLSearchParams()
  if (code) params.set('code', code)
  if (state) params.set('state', state)
  if (errorParam) params.set('error', errorParam)

  return new Request(`http://localhost/api/auth/callback/${provider}?${params}`, {
    method: 'GET',
    headers: { host: 'localhost:3000' },
  })
}

describe('GET /api/auth/callback/[provider] in mock mode', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCookies.get.mockReturnValue({ value: 'valid-state' })
    docClient.send.mockResolvedValue({ Items: [] })
  })

  it('exchanges mock code and logs in developer@example.com', async () => {
    // developer@example.com base64 is ZGV2ZWxvcGVyQGV4YW1wbGUuY29t
    const code = 'mock-code-google-ZGV2ZWxvcGVyQGV4YW1wbGUuY29t'
    const req = makeCallbackRequest('google', { code })

    const res = await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/dashboard')

    // Should have queried DynamoDB and put items since the user doesn't exist
    // 1 query, 1 username check query, 2 puts (user and username pointer)
    expect(docClient.send).toHaveBeenCalledTimes(4)

    // Check primary user Put item
    const putCall = docClient.send.mock.calls[2][0]
    const item = putCall.input.Item
    expect(item.email).toBe('developer@example.com')
    expect(item.username).toBe('developer')
    expect(item.isVerified).toBe(true)
    expect(item.isAdmin).toBe(false)
    expect(item.authProvider).toBe('google')
    expect(item.oauthProviders).toEqual(['google'])

    // Check JWT token cookie set
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toMatch(/auth_token/)
  })

  it('handles admin@example.com correctly and sets isAdmin to true via ADMIN_EMAILS', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    // admin@example.com base64 is YWRtaW5AZXhhbXBsZS5jb20=
    const code = 'mock-code-google-YWRtaW5AZXhhbXBsZS5jb20='
    const req = makeCallbackRequest('google', { code })

    const res = await GET(req, { params: Promise.resolve({ provider: 'google' }) })

    expect(res.status).toBe(307)

    const putCall = docClient.send.mock.calls[2][0]
    const item = putCall.input.Item
    expect(item.email).toBe('admin@example.com')
    expect(item.isAdmin).toBe(true)
  })
})
