import { GET, POST } from '@/app/api/admin/invite/accept/route'

jest.mock('@/lib/dynamodb', () => ({
  docClient: { send: jest.fn() },
  TableNames: { Users: 'WheelApp_Users' },
}))

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed_password') }))
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, resetMs: Date.now() + 1000 }),
}))

const { docClient } = require('@/lib/dynamodb')
const { checkRateLimit } = require('@/lib/rateLimit')

const validInvite = {
  PK: 'INVITE#validtoken123',
  inviteId: 'inv-1',
  email: 'invited@example.com',
  invitedBy: 'admin1',
  invitedByUsername: 'admin',
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
}

const expiredInvite = {
  ...validInvite,
  expiresAt: new Date(Date.now() - 1000).toISOString(), // expired 1 second ago
}

function makeGetRequest(token) {
  const url = token
    ? `http://localhost/api/admin/invite/accept?token=${token}`
    : 'http://localhost/api/admin/invite/accept'
  return new Request(url, { method: 'GET' })
}

function makePostRequest(body) {
  return new Request('http://localhost/api/admin/invite/accept', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  docClient.send.mockReset()
})

// ── GET /api/admin/invite/accept ─────────────────────────────────────────────

describe('GET /api/admin/invite/accept', () => {
  it('happy path - valid token returns email and inviter', async () => {
    docClient.send.mockResolvedValueOnce({ Item: validInvite })

    const res = await GET(makeGetRequest('validtoken123'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.email).toBe('invited@example.com')
    expect(body.invitedBy).toBe('admin')
  })

  it('returns 400 when token is missing', async () => {
    const res = await GET(makeGetRequest(null))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/missing/i)
  })

  it('returns 404 when token is invalid/unknown', async () => {
    docClient.send.mockResolvedValueOnce({ Item: undefined })

    const res = await GET(makeGetRequest('bogustoken'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/invalid|expired/i)
  })

  it('returns 410 when invite has expired', async () => {
    docClient.send.mockResolvedValueOnce({ Item: expiredInvite })

    const res = await GET(makeGetRequest('expiredtoken'))
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.error).toMatch(/expired/i)
  })
})

// ── POST /api/admin/invite/accept ────────────────────────────────────────────

describe('POST /api/admin/invite/accept', () => {
  it('happy path - creates pre-verified user and deletes invite', async () => {
    docClient.send
      .mockResolvedValueOnce({ Item: validInvite })      // GetCommand (invite lookup)
      .mockResolvedValueOnce({ Items: [] })               // QueryCommand (email check)
      .mockResolvedValueOnce({ Items: [] })               // QueryCommand (username check)
      .mockResolvedValueOnce({})                          // PutCommand (primary user item)
      .mockResolvedValueOnce({})                          // PutCommand (username pointer)
      .mockResolvedValueOnce({})                          // DeleteCommand (delete invite)

    const res = await POST(makePostRequest({
      token: 'validtoken123',
      username: 'newuser',
      password: 'Str0ng!Passw0rd',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toMatch(/account created/i)
    // Verify: GetCommand + QueryCommand*2 + PutCommand*2 + DeleteCommand = 6 calls
    expect(docClient.send).toHaveBeenCalledTimes(6)
  })

  // ── Validation ───────────────────────────────────────────────────────────

  it('returns 400 when token is missing', async () => {
    const res = await POST(makePostRequest({ username: 'user', password: 'Str0ng!Passw0rd' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/missing/i)
  })

  it('returns 400 when username is missing', async () => {
    const res = await POST(makePostRequest({ token: 'tok', password: 'Str0ng!Passw0rd' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const res = await POST(makePostRequest({ token: 'tok', username: 'user' }))
    expect(res.status).toBe(400)
  })

  // ── Token validation ────────────────────────────────────────────────────

  it('returns 404 when invite token is invalid', async () => {
    docClient.send.mockResolvedValueOnce({ Item: undefined })

    const res = await POST(makePostRequest({
      token: 'badtoken',
      username: 'user',
      password: 'Str0ng!Passw0rd',
    }))
    expect(res.status).toBe(404)
  })

  it('returns 410 when invite token has expired', async () => {
    docClient.send.mockResolvedValueOnce({ Item: expiredInvite })

    const res = await POST(makePostRequest({
      token: 'expiredtoken',
      username: 'user',
      password: 'Str0ng!Passw0rd',
    }))
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.error).toMatch(/expired/i)
  })

  // ── Conflict detection ──────────────────────────────────────────────────

  it('returns 409 when email is already registered', async () => {
    docClient.send
      .mockResolvedValueOnce({ Item: validInvite })
      .mockResolvedValueOnce({ Items: [{ PK: 'USER#existingid', userId: 'existingid' }] })

    const res = await POST(makePostRequest({
      token: 'validtoken123',
      username: 'newuser',
      password: 'Str0ng!Passw0rd',
    }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/email already exists/i)
  })

  it('returns 409 when username is already taken', async () => {
    docClient.send
      .mockResolvedValueOnce({ Item: validInvite })
      .mockResolvedValueOnce({ Items: [] })  // email check OK
      .mockResolvedValueOnce({ Items: [{ PK: 'USER#existingid', userId: 'existingid' }] })

    const res = await POST(makePostRequest({
      token: 'validtoken123',
      username: 'takenname',
      password: 'Str0ng!Passw0rd',
    }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/username already taken/i)
  })

  // ── Security: pre-verified status ───────────────────────────────────────

  it('creates the user as pre-verified (isVerified: true)', async () => {
    let capturedUser = null
    docClient.send.mockImplementation((cmd) => {
      // Capture the first PutCommand (primary user item)
      if (cmd.input?.Item?.PK?.startsWith('USER#') && !cmd.input.Item.PK.includes('USERNAME#') && !capturedUser) {
        capturedUser = cmd.input.Item
      }
      return Promise.resolve({ Item: validInvite, Items: [] })
    })

    const res = await POST(makePostRequest({
      token: 'validtoken123',
      username: 'verified_user',
      password: 'Str0ng!Passw0rd',
    }))

    expect(res.status).toBe(200)
    expect(capturedUser).toBeTruthy()
    expect(capturedUser.isVerified).toBe(true)
  })

  // ── Security: no self-promotion to admin ────────────────────────────────

  it('creates regular users as non-admin (isAdmin: false)', async () => {
    let capturedUser = null
    docClient.send.mockImplementation((cmd) => {
      if (cmd.input?.Item?.PK?.startsWith('USER#') && !cmd.input.Item.PK.includes('USERNAME#') && !capturedUser) {
        capturedUser = cmd.input.Item
      }
      return Promise.resolve({ Item: validInvite, Items: [] })
    })

    const res = await POST(makePostRequest({
      token: 'validtoken123',
      username: 'hopeful_admin',
      password: 'Str0ng!Passw0rd',
    }))

    expect(res.status).toBe(200)
    expect(capturedUser?.isAdmin).toBe(false)
  })

  it('creates the user as admin (isAdmin: true) if their email is in ADMIN_EMAILS', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    let capturedUser = null
    docClient.send.mockImplementation((cmd) => {
      if (cmd.input?.Item?.PK?.startsWith('USER#') && !cmd.input.Item.PK.includes('USERNAME#') && !capturedUser) {
        capturedUser = cmd.input.Item
      }
      return Promise.resolve({ Item: { ...validInvite, email: 'admin@example.com' }, Items: [] })
    })

    const res = await POST(makePostRequest({
      token: 'validtoken123',
      username: 'real_admin',
      password: 'Str0ng!Passw0rd',
    }))

    expect(res.status).toBe(200)
    expect(capturedUser?.isAdmin).toBe(true)
  })

  it('creates the user as non-admin (isAdmin: false) if ADMIN_EMAILS is unset', async () => {
    delete process.env.ADMIN_EMAILS
    let capturedUser = null
    docClient.send.mockImplementation((cmd) => {
      if (cmd.input?.Item?.PK?.startsWith('USER#') && !cmd.input.Item.PK.includes('USERNAME#') && !capturedUser) {
        capturedUser = cmd.input.Item
      }
      return Promise.resolve({ Item: { ...validInvite, email: 'admin@example.com' }, Items: [] })
    })

    const res = await POST(makePostRequest({
      token: 'validtoken123',
      username: 'real_admin2',
      password: 'Str0ng!Passw0rd',
    }))

    expect(res.status).toBe(200)
    expect(capturedUser?.isAdmin).toBe(false)
  })

  // ── Security: single-use token ──────────────────────────────────────────

  it('deletes the invite token after successful use', async () => {
    docClient.send
      .mockResolvedValueOnce({ Item: validInvite })      // GetCommand (invite lookup)
      .mockResolvedValueOnce({ Items: [] })               // QueryCommand (email check)
      .mockResolvedValueOnce({ Items: [] })               // QueryCommand (username check)
      .mockResolvedValueOnce({})                          // PutCommand (primary)
      .mockResolvedValueOnce({})                          // PutCommand (username pointer)
      .mockResolvedValueOnce({})                          // DeleteCommand (invite)

    await POST(makePostRequest({
      token: 'validtoken123',
      username: 'singleuse',
      password: 'Str0ng!Passw0rd',
    }))

    // The last call should be the DeleteCommand for the invite token
    const calls = docClient.send.mock.calls
    const lastCallInput = calls[calls.length - 1][0].input
    expect(lastCallInput.Key.PK).toBe('INVITE#validtoken123')
    expect(docClient.send).toHaveBeenCalledTimes(6)
  })

  // ── Security: filters INVITE# items from uniqueness checks ──────────────

  it('ignores INVITE# items when checking email uniqueness', async () => {
    docClient.send
      .mockResolvedValueOnce({ Item: validInvite })
      // Email check returns only INVITE# items (not real users)
      .mockResolvedValueOnce({ Items: [{ PK: 'INVITE#sometoken', email: 'invited@example.com' }] })
      .mockResolvedValueOnce({ Items: [] })  // username check
      .mockResolvedValueOnce({})             // PutCommand (primary)
      .mockResolvedValueOnce({})             // PutCommand (username pointer)
      .mockResolvedValueOnce({})             // DeleteCommand (invite)

    const res = await POST(makePostRequest({
      token: 'validtoken123',
      username: 'newuser',
      password: 'Str0ng!Passw0rd',
    }))

    // Should succeed because INVITE# items are filtered out
    expect(res.status).toBe(200)
  })

  // ── Security: password is hashed ────────────────────────────────────────

  it('hashes the password before storing', async () => {
    const bcrypt = require('bcrypt')
    let capturedUser = null
    docClient.send.mockImplementation((cmd) => {
      if (cmd.input?.Item?.PK?.startsWith('USER#') && !cmd.input.Item.PK.includes('USERNAME#') && !capturedUser) {
        capturedUser = cmd.input.Item
      }
      return Promise.resolve({ Item: validInvite, Items: [] })
    })

    await POST(makePostRequest({
      token: 'validtoken123',
      username: 'hashtest',
      password: 'PlainT3xt!P@ssword',
    }))

    expect(bcrypt.hash).toHaveBeenCalledWith('PlainT3xt!P@ssword', 10)
    expect(capturedUser?.password).toBe('hashed_password')
    expect(capturedUser?.password).not.toBe('PlainT3xt!P@ssword')
  })

  // ── Error handling ──────────────────────────────────────────────────────

  it('returns 500 on unexpected error', async () => {
    docClient.send.mockRejectedValueOnce(new Error('DB down'))

    const res = await POST(makePostRequest({
      token: 'tok',
      username: 'user',
      password: 'Str0ng!Passw0rd',
    }))
    expect(res.status).toBe(500)
  })
})
