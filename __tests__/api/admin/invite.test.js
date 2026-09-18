import { POST } from '@/app/api/admin/invite/route'

jest.mock('@/lib/dynamodb', () => ({
  docClient: { send: jest.fn() },
  TableNames: { Users: 'WheelApp_Users' },
}))

jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))

jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}))

const { docClient } = require('@/lib/dynamodb')
const { getSession } = require('@/lib/session')

const adminSession = { userId: 'admin1', username: 'admin', isAdmin: true }
const regularSession = { userId: 'user1', username: 'user', isAdmin: false }

function makeRequest(body) {
  return new Request('http://localhost/api/admin/invite', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  docClient.send.mockReset()
})

// ── POST /api/admin/invite ───────────────────────────────────────────────────

describe('POST /api/admin/invite', () => {
  it('happy path - admin can send an invite', async () => {
    getSession.mockResolvedValue(adminSession)
    // Email check returns empty (no existing user), then PutCommand
    docClient.send
      .mockResolvedValueOnce({ Items: [] })  // QueryCommand (email check)
      .mockResolvedValueOnce({})             // PutCommand (store invite)

    const res = await POST(makeRequest({ email: 'newuser@example.com' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.email).toBe('newuser@example.com')
  })

  // ── Security: auth gating ────────────────────────────────────────────────

  it('returns 403 for non-admin users', async () => {
    getSession.mockResolvedValue(regularSession)
    const res = await POST(makeRequest({ email: 'test@example.com' }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/forbidden/i)
  })

  it('returns 403 when not authenticated', async () => {
    getSession.mockResolvedValue(null)
    const res = await POST(makeRequest({ email: 'test@example.com' }))
    expect(res.status).toBe(403)
  })

  // ── Validation ───────────────────────────────────────────────────────────

  it('returns 400 when email is missing', async () => {
    getSession.mockResolvedValue(adminSession)
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/email/i)
  })

  it('returns 400 for invalid email format', async () => {
    getSession.mockResolvedValue(adminSession)
    const res = await POST(makeRequest({ email: 'not-an-email' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid email/i)
  })

  it('returns 409 when email already exists', async () => {
    getSession.mockResolvedValue(adminSession)
    docClient.send.mockResolvedValueOnce({ Items: [{ userId: 'existing' }] })
    const res = await POST(makeRequest({ email: 'taken@example.com' }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/already exists/i)
  })

  // ── Security: email normalization ────────────────────────────────────────

  it('lowercases the email address to prevent case-based bypass', async () => {
    getSession.mockResolvedValue(adminSession)
    let capturedItem = null
    docClient.send.mockImplementation((cmd) => {
      if (cmd.input?.Item) capturedItem = cmd.input.Item
      return Promise.resolve({ Items: [] })
    })

    const res = await POST(makeRequest({ email: 'Admin@EXAMPLE.com' }))
    expect(res.status).toBe(200)
    expect(capturedItem?.email).toBe('admin@example.com')
  })

  // ── Security: invite token properties ────────────────────────────────────

  it('stores invite with a 7-day expiry', async () => {
    getSession.mockResolvedValue(adminSession)
    let capturedItem = null
    docClient.send.mockImplementation((cmd) => {
      if (cmd.input?.Item) capturedItem = cmd.input.Item
      return Promise.resolve({ Items: [] })
    })

    const before = Date.now()
    const res = await POST(makeRequest({ email: 'timer@test.com' }))
    const after = Date.now()

    expect(res.status).toBe(200)
    expect(capturedItem).toBeTruthy()

    const expiresAt = new Date(capturedItem.expiresAt).getTime()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    // Expires between 7 days from before and 7 days from after
    expect(expiresAt).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000)
    expect(expiresAt).toBeLessThanOrEqual(after + sevenDaysMs + 1000)
  })

  it('stores invite token as INVITE# prefixed PK', async () => {
    getSession.mockResolvedValue(adminSession)
    let capturedItem = null
    docClient.send.mockImplementation((cmd) => {
      if (cmd.input?.Item) capturedItem = cmd.input.Item
      return Promise.resolve({ Items: [] })
    })

    await POST(makeRequest({ email: 'pk@test.com' }))
    expect(capturedItem?.PK).toMatch(/^INVITE#/)
  })

  it('records the inviting user ID and username', async () => {
    getSession.mockResolvedValue(adminSession)
    let capturedItem = null
    docClient.send.mockImplementation((cmd) => {
      if (cmd.input?.Item) capturedItem = cmd.input.Item
      return Promise.resolve({ Items: [] })
    })

    await POST(makeRequest({ email: 'track@test.com' }))
    expect(capturedItem?.invitedBy).toBe('admin1')
    expect(capturedItem?.invitedByUsername).toBe('admin')
  })
})
