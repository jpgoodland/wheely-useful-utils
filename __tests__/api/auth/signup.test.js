import { POST } from '@/app/api/auth/signup/route'

// Mock DynamoDB
jest.mock('@/lib/dynamodb', () => ({
  docClient: { send: jest.fn() },
  TableNames: { Users: 'WheelApp_Users' },
}))

// Mock email module to avoid real SES calls
jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}))

// Mock rate limiting
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, resetMs: Date.now() + 1000 })
}))

const { docClient } = require('@/lib/dynamodb')
const { checkRateLimit } = require('@/lib/rateLimit')

function makeRequest(body) {
  return new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  checkRateLimit.mockReturnValue({ allowed: true, resetMs: Date.now() + 1000 })
  // Default: no existing user found
  docClient.send.mockResolvedValue({ Items: [] })
})

describe('POST /api/auth/signup', () => {
  it('happy path - creates a new user and returns success', async () => {
    let capturedItem = null
    docClient.send.mockImplementation((cmd) => {
      if (cmd.input?.Item && cmd.input.Item.PK.startsWith('USER#') && !cmd.input.Item.PK.startsWith('USER#USERNAME#')) {
        capturedItem = cmd.input.Item
      }
      return Promise.resolve({ Items: [] })
    })

    const res = await POST(makeRequest({
      email: 'test@example.com',
      username: 'testuser',
      password: 'Str0ng!Passw0rd',
      firstName: 'John',
      lastName: 'Doe',
    }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(capturedItem?.firstName).toBe('John')
    expect(capturedItem?.lastName).toBe('Doe')
  })

  it('returns 400 when fields are missing', async () => {
    const res = await POST(makeRequest({ email: 'test@example.com' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/missing fields/i)
  })

  it('returns 400 when firstName or lastName is missing or empty', async () => {
    const res = await POST(makeRequest({
      email: 'test@example.com',
      username: 'testuser',
      password: 'Str0ng!Passw0rd',
      firstName: '   ',
      lastName: 'Doe',
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/first and last name/i)
  })

  it('returns 400 for invalid email format', async () => {
    const res = await POST(makeRequest({
      email: 'not-an-email',
      username: 'user',
      password: 'Str0ng!Passw0rd',
      firstName: 'John',
      lastName: 'Doe',
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid email/i)
  })

  it('returns 409 when email already exists', async () => {
    docClient.send.mockResolvedValueOnce({ Items: [{ userId: 'existing' }] })
    const res = await POST(makeRequest({
      email: 'taken@example.com',
      username: 'newuser',
      password: 'Str0ng!Passw0rd',
      firstName: 'John',
      lastName: 'Doe',
    }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/already exists/i)
  })

  it('returns 409 when username already taken', async () => {
    // First query (email) returns empty, second (username) returns a hit
    docClient.send
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Items: [{ userId: 'existing' }] })
    const res = await POST(makeRequest({
      email: 'new@example.com',
      username: 'takenuser',
      password: 'Str0ng!Passw0rd',
      firstName: 'John',
      lastName: 'Doe',
    }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/username already taken/i)
  })

  it('returns 500 on unexpected DynamoDB error', async () => {
    docClient.send.mockRejectedValueOnce(new Error('DynamoDB down'))
    const res = await POST(makeRequest({
      email: 'a@b.com',
      username: 'user',
      password: 'Str0ng!Passw0rd',
      firstName: 'John',
      lastName: 'Doe',
    }))
    expect(res.status).toBe(500)
  })

  it('grants admin role when email is in ADMIN_EMAILS allowlist', async () => {
    process.env.ADMIN_EMAILS = 'boss@example.com, super@example.com'
    docClient.send.mockResolvedValue({ Items: [] })
    let capturedItem = null
    docClient.send.mockImplementation((cmd) => {
      if (cmd.input?.Item) capturedItem = cmd.input.Item
      return Promise.resolve({ Items: [] })
    })

    const res = await POST(makeRequest({
      email: 'boss@example.com',
      username: 'boss',
      password: 'Str0ng!Passw0rd',
      firstName: 'Boss',
      lastName: 'User',
    }))
    expect(res.status).toBe(200)
    expect(capturedItem?.isAdmin).toBe(true)
  })

  it('does not grant admin role when email is not in ADMIN_EMAILS allowlist', async () => {
    process.env.ADMIN_EMAILS = 'boss@example.com'
    docClient.send.mockResolvedValue({ Items: [] })
    let capturedItem = null
    docClient.send.mockImplementation((cmd) => {
      if (cmd.input?.Item) capturedItem = cmd.input.Item
      return Promise.resolve({ Items: [] })
    })

    const res = await POST(makeRequest({
      email: 'user@example.com',
      username: 'regularuser',
      password: 'Str0ng!Passw0rd',
      firstName: 'Regular',
      lastName: 'User',
    }))
    expect(res.status).toBe(200)
    expect(capturedItem?.isAdmin).toBe(false)
  })

  it('does not grant admin role when ADMIN_EMAILS is unset', async () => {
    delete process.env.ADMIN_EMAILS
    docClient.send.mockResolvedValue({ Items: [] })
    let capturedItem = null
    docClient.send.mockImplementation((cmd) => {
      if (cmd.input?.Item) capturedItem = cmd.input.Item
      return Promise.resolve({ Items: [] })
    })

    const res = await POST(makeRequest({
      email: 'boss@example.com',
      username: 'boss2',
      password: 'Str0ng!Passw0rd',
      firstName: 'Boss',
      lastName: 'User',
    }))
    expect(res.status).toBe(200)
    expect(capturedItem?.isAdmin).toBe(false)
  })

  it('returns 429 when rate limit is exceeded', async () => {
    checkRateLimit.mockReturnValueOnce({ allowed: false, resetMs: Date.now() + 60000 })
    const res = await POST(makeRequest({
      email: 'user@example.com',
      username: 'user',
      password: 'Str0ng!Passw0rd',
      firstName: 'John',
      lastName: 'Doe',
    }))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/too many/i)
  })
})
