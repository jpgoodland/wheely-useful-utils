import { GET, POST } from '@/app/api/admin/users/route'
import { DELETE, PATCH } from '@/app/api/admin/users/[userId]/route'

jest.mock('@/lib/dynamodb', () => ({
  docClient: { send: jest.fn() },
  TableNames: { Users: 'WheelApp_Users', Wheels: 'WheelApp_Wheels' },
}))

jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))
jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed') }))

const { docClient } = require('@/lib/dynamodb')
const { getSession } = require('@/lib/session')

const adminSession = { userId: 'admin1', isAdmin: true }
const regularSession = { userId: 'user1', isAdmin: false }

const userItems = [
  { PK: 'USER#u1', userId: 'u1', email: 'a@b.com', username: 'alice', isAdmin: false, isVerified: true },
  { PK: 'USER#u2', userId: 'u2', email: 'b@b.com', username: 'bob',   isAdmin: true,  isVerified: true },
  // username pointer — should be filtered out
  { PK: 'USER#USERNAME#alice', userId: 'u1', email: 'a@b.com', username: 'alice' },
]

beforeEach(() => {
  jest.clearAllMocks()
  docClient.send.mockReset()
})

// ── GET /api/admin/users ──────────────────────────────────────────────────────

describe('GET /api/admin/users', () => {
  it('returns user list for admin', async () => {
    getSession.mockResolvedValue(adminSession)
    docClient.send.mockResolvedValue({ Items: userItems })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    // username pointer item must be excluded
    expect(body.every(u => !u.PK.startsWith('USER#USERNAME#'))).toBe(true)
    expect(body).toHaveLength(2)
  })

  it('returns 403 for non-admin', async () => {
    getSession.mockResolvedValue(regularSession)
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns 403 when not authenticated', async () => {
    getSession.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(403)
  })
})

// ── POST /api/admin/users ─────────────────────────────────────────────────────

function makePost(body) {
  return new Request('http://localhost/api/admin/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/users', () => {
  it('happy path - creates a pre-verified user', async () => {
    getSession.mockResolvedValue(adminSession)
    // email check, username check, put primary, put username pointer
    docClient.send
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})

    const res = await POST(makePost({ email: 'new@x.com', username: 'newuser', password: 'Str0ng!Passw0rd123' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.isVerified).toBe(true)
    expect(body.password).toBeUndefined() // password must not be returned
  })

  it('can create an admin user', async () => {
    getSession.mockResolvedValue(adminSession)
    docClient.send.mockResolvedValue({ Items: [] })

    const res = await POST(makePost({ email: 'adm@x.com', username: 'adminuser', password: 'Str0ng!Passw0rd123', isAdmin: true }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.isAdmin).toBe(true)
  })

  it('returns 400 for missing fields', async () => {
    getSession.mockResolvedValue(adminSession)
    const res = await POST(makePost({ email: 'x@x.com' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid email', async () => {
    getSession.mockResolvedValue(adminSession)
    const res = await POST(makePost({ email: 'bad', username: 'u', password: 'Str0ng!Passw0rd123' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when password does not meet complexity requirements', async () => {
    getSession.mockResolvedValue(adminSession)
    const res = await POST(makePost({ email: 'valid@x.com', username: 'validuser', password: 'weak' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/password does not meet requirements/i)
  })

  it('returns 409 when email already exists', async () => {
    getSession.mockResolvedValue(adminSession)
    docClient.send.mockResolvedValueOnce({ Items: [{ userId: 'existing' }] })
    const res = await POST(makePost({ email: 'taken@x.com', username: 'u', password: 'Str0ng!Passw0rd123' }))
    expect(res.status).toBe(409)
  })

  it('returns 409 when username already taken', async () => {
    getSession.mockResolvedValue(adminSession)
    docClient.send
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Items: [{ userId: 'existing' }] })
    const res = await POST(makePost({ email: 'new@x.com', username: 'taken', password: 'Str0ng!Passw0rd123' }))
    expect(res.status).toBe(409)
  })

  it('returns 403 for non-admin', async () => {
    getSession.mockResolvedValue(regularSession)
    const res = await POST(makePost({ email: 'x@x.com', username: 'u', password: 'Str0ng!Passw0rd123' }))
    expect(res.status).toBe(403)
  })
})

// ── DELETE /api/admin/users/[userId] ─────────────────────────────────────────

function makeParams(userId) {
  return { params: Promise.resolve({ userId }) }
}

describe('DELETE /api/admin/users/[userId]', () => {
  it('happy path - deletes user and their username pointer', async () => {
    getSession.mockResolvedValue(adminSession)
    docClient.send.mockImplementation(async (cmd) => {
      if (cmd.input?.Key?.PK === 'USER#u1' && cmd.constructor.name === 'GetCommand') {
        return { Item: { PK: 'USER#u1', userId: 'u1', username: 'alice' } }
      }
      if (cmd.input?.IndexName === 'OwnerIdIndex') {
        return { Items: [] }
      }
      if (cmd.constructor.name === 'ScanCommand') {
        return { Items: [] }
      }
      return {}
    })

    const res = await DELETE(new Request('http://localhost'), makeParams('u1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)

    const calls = docClient.send.mock.calls.map(c => c[0])
    const deletes = calls.filter(c => c.constructor.name === 'DeleteCommand').map(c => c.input.Key.PK)
    expect(deletes).toContain('USER#u1')
    expect(deletes).toContain('USER#USERNAME#alice')
  })

  it('returns 400 when admin tries to delete themselves', async () => {
    getSession.mockResolvedValue(adminSession)
    const res = await DELETE(new Request('http://localhost'), makeParams('admin1'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when user not found', async () => {
    getSession.mockResolvedValue(adminSession)
    docClient.send.mockResolvedValueOnce({ Item: undefined })
    const res = await DELETE(new Request('http://localhost'), makeParams('ghost'))
    expect(res.status).toBe(404)
  })

  it('returns 403 for non-admin', async () => {
    getSession.mockResolvedValue(regularSession)
    const res = await DELETE(new Request('http://localhost'), makeParams('u1'))
    expect(res.status).toBe(403)
  })
})

// ── PATCH /api/admin/users/[userId] ──────────────────────────────────────────

function makePatch(userId, body) {
  return new Request('http://localhost', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/admin/users/[userId]', () => {
  it('happy path - grants admin role', async () => {
    getSession.mockResolvedValue(adminSession)
    docClient.send
      .mockResolvedValueOnce({ Item: { PK: 'USER#u1', userId: 'u1', username: 'alice', isAdmin: false } })
      .mockResolvedValueOnce({}) // update primary
      .mockResolvedValueOnce({}) // update username pointer

    const res = await PATCH(makePatch('u1', { isAdmin: true }), makeParams('u1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.isAdmin).toBe(true)
  })

  it('happy path - revokes admin role from another user', async () => {
    getSession.mockResolvedValue(adminSession)
    docClient.send
      .mockResolvedValueOnce({ Item: { PK: 'USER#u2', userId: 'u2', username: 'bob', isAdmin: true } })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})

    const res = await PATCH(makePatch('u2', { isAdmin: false }), makeParams('u2'))
    expect(res.status).toBe(200)
  })

  it('returns 400 when admin tries to remove their own admin role', async () => {
    getSession.mockResolvedValue(adminSession)
    const res = await PATCH(makePatch('admin1', { isAdmin: false }), makeParams('admin1'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when no valid fields provided', async () => {
    getSession.mockResolvedValue(adminSession)
    const res = await PATCH(makePatch('u1', { randomField: 'hello' }), makeParams('u1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/nothing to update/i)
  })

  it('returns 404 when user not found', async () => {
    getSession.mockResolvedValue(adminSession)
    docClient.send.mockResolvedValueOnce({ Item: undefined })
    const res = await PATCH(makePatch('ghost', { isAdmin: true }), makeParams('ghost'))
    expect(res.status).toBe(404)
  })

  it('returns 403 for non-admin', async () => {
    getSession.mockResolvedValue(regularSession)
    const res = await PATCH(makePatch('u1', { isAdmin: true }), makeParams('u1'))
    expect(res.status).toBe(403)
  })
})

// ── PATCH /api/admin/users/[userId] — Password Reset ─────────────────────────

describe('PATCH /api/admin/users/[userId] - password reset', () => {
  it('happy path - resets password and updates both records', async () => {
    getSession.mockResolvedValue(adminSession)
    docClient.send
      .mockResolvedValueOnce({ Item: { PK: 'USER#u1', userId: 'u1', username: 'alice', isAdmin: false } })
      .mockResolvedValueOnce({}) // update primary
      .mockResolvedValueOnce({}) // update username pointer

    const res = await PATCH(makePatch('u1', { newPassword: 'Str0ng!Passw0rd123' }), makeParams('u1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.passwordReset).toBe(true)
    expect(docClient.send).toHaveBeenCalledTimes(3) // get + 2 updates
  })

  it('returns 400 when password does not meet complexity requirements', async () => {
    getSession.mockResolvedValue(adminSession)
    docClient.send
      .mockResolvedValueOnce({ Item: { PK: 'USER#u1', userId: 'u1', username: 'alice' } })

    const res = await PATCH(makePatch('u1', { newPassword: 'abc' }), makeParams('u1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Password does not meet requirements|At least 12 characters/i)
  })

  it('can update isAdmin and password in a single request', async () => {
    getSession.mockResolvedValue(adminSession)
    docClient.send
      .mockResolvedValueOnce({ Item: { PK: 'USER#u1', userId: 'u1', username: 'alice', isAdmin: false } })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})

    const res = await PATCH(makePatch('u1', { isAdmin: true, newPassword: 'Str0ng!Passw0rd123' }), makeParams('u1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.isAdmin).toBe(true)
    expect(body.passwordReset).toBe(true)
  })

  // ── Security: password hashing ────────────────────────────────────────────

  it('hashes the password with bcrypt before storing', async () => {
    const bcrypt = require('bcrypt')
    getSession.mockResolvedValue(adminSession)

    let capturedUpdateExpr = null
    let capturedExprValues = null
    docClient.send.mockImplementation((cmd) => {
      // Capture the first UpdateCommand (primary user record)
      if (cmd.input?.UpdateExpression && !capturedUpdateExpr) {
        capturedUpdateExpr = cmd.input.UpdateExpression
        capturedExprValues = cmd.input.ExpressionAttributeValues
      }
      if (cmd.input?.Key) {
        return Promise.resolve({ Item: { PK: 'USER#u1', userId: 'u1', username: 'alice' } })
      }
      return Promise.resolve({})
    })

    await PATCH(makePatch('u1', { newPassword: 'Str0ng!Passw0rd123' }), makeParams('u1'))

    expect(bcrypt.hash).toHaveBeenCalledWith('Str0ng!Passw0rd123', 10)
    expect(capturedUpdateExpr).toContain('password = :pw')
    expect(capturedExprValues[':pw']).toBe('hashed') // from our bcrypt mock
  })

  // ── Security: response format ─────────────────────────────────────────────

  it('does not leak the password in the response', async () => {
    getSession.mockResolvedValue(adminSession)
    docClient.send
      .mockResolvedValueOnce({ Item: { PK: 'USER#u1', userId: 'u1', username: 'alice' } })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})

    const res = await PATCH(makePatch('u1', { newPassword: 'Str0ng!Passw0rd123' }), makeParams('u1'))
    const body = await res.json()

    expect(body.password).toBeUndefined()
    expect(body.newPassword).toBeUndefined()
    expect(body.passwordReset).toBe(true)
  })
})
