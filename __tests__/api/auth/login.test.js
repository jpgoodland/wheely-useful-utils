process.env.JWT_SECRET = 'test-secret-for-jest-32-chars-long!!'

import { POST } from '@/app/api/auth/login/route'

jest.mock('@/lib/dynamodb', () => ({
  docClient: { send: jest.fn() },
  TableNames: { Users: 'WheelApp_Users' },
}))

// bcrypt is slow in tests - mock it
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}))

// Mock rate limiting
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, resetMs: Date.now() + 1000 })
}))

const { docClient } = require('@/lib/dynamodb')
const { checkRateLimit } = require('@/lib/rateLimit')
const bcrypt = require('bcrypt')

function makeRequest(body) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const verifiedUser = {
  userId: 'u1',
  email: 'alice@example.com',
  username: 'alice',
  password: 'hashed',
  isVerified: true,
}

beforeEach(() => {
  jest.clearAllMocks()
  checkRateLimit.mockReturnValue({ allowed: true, resetMs: Date.now() + 1000 })
})

describe('POST /api/auth/login', () => {
  it('happy path - returns success and sets cookie', async () => {
    docClient.send.mockResolvedValue({ Items: [verifiedUser] })
    bcrypt.compare.mockResolvedValue(true)

    const res = await POST(makeRequest({ identifier: 'alice', password: 'correct' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.username).toBe('alice')
    expect(body.firstName).toBeNull()
    expect(body.lastName).toBeNull()
    expect(res.headers.get('set-cookie')).toMatch(/auth_token/)
  })

  it('returns firstName and lastName when present on user', async () => {
    const userWithName = {
      ...verifiedUser,
      firstName: 'Alice',
      lastName: 'Smith',
    }
    docClient.send.mockResolvedValue({ Items: [userWithName] })
    bcrypt.compare.mockResolvedValue(true)

    const res = await POST(makeRequest({ identifier: 'alice', password: 'correct' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.firstName).toBe('Alice')
    expect(body.lastName).toBe('Smith')
  })

  it('returns 400 when fields are missing', async () => {
    const res = await POST(makeRequest({ identifier: 'alice' }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when user not found', async () => {
    docClient.send.mockResolvedValue({ Items: [] })
    const res = await POST(makeRequest({ identifier: 'ghost', password: 'pass' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/invalid credentials/i)
  })

  it('returns 401 when password is wrong', async () => {
    docClient.send.mockResolvedValue({ Items: [verifiedUser] })
    bcrypt.compare.mockResolvedValue(false)

    const res = await POST(makeRequest({ identifier: 'alice', password: 'wrong' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not verified', async () => {
    docClient.send.mockResolvedValue({ Items: [{ ...verifiedUser, isVerified: false }] })
    bcrypt.compare.mockResolvedValue(true)

    const res = await POST(makeRequest({ identifier: 'alice', password: 'correct' }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/verify your email/i)
  })

  it('returns 500 on unexpected error', async () => {
    docClient.send.mockRejectedValue(new Error('DB error'))
    const res = await POST(makeRequest({ identifier: 'alice', password: 'pass' }))
    expect(res.status).toBe(500)
  })

  it('returns 400 when user has no password (OAuth-only account)', async () => {
    const oauthOnlyUser = {
      userId: 'u2',
      email: 'oauth@example.com',
      username: 'oauthuser',
      isVerified: true,
      authProvider: 'google',
      oauthProviders: ['google'],
      // No password field
    }
    docClient.send.mockResolvedValue({ Items: [oauthOnlyUser] })

    const res = await POST(makeRequest({ identifier: 'oauth@example.com', password: 'anything' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/social login/i)
  })

  it('returns 429 when rate limit is exceeded', async () => {
    checkRateLimit.mockReturnValueOnce({ allowed: false, resetMs: Date.now() + 60000 })
    const res = await POST(makeRequest({ identifier: 'alice', password: 'correct' }))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/too many/i)
  })
})
