import { DELETE } from '@/app/api/auth/delete-account/route'

jest.mock('@/lib/dynamodb', () => ({
  docClient: { send: jest.fn() },
  TableNames: { Users: 'WheelApp_Users', Wheels: 'WheelApp_Wheels' },
}))

jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))

const { docClient } = require('@/lib/dynamodb')
const { getSession } = require('@/lib/session')

const session = { userId: 'u1', username: 'alice', email: 'alice@example.com' }

const existingWheels = [
  { PK: 'WHEEL#w1', wheelId: 'w1', name: 'My Wheel', ownerId: 'u1' },
  { PK: 'WHEEL#w2', wheelId: 'w2', name: 'Other Wheel', ownerId: 'u2' },
]

function makeRequest() {
  return new Request('http://localhost/api/auth/delete-account', {
    method: 'DELETE',
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'info').mockImplementation(() => {}) // Silence expected log
  jest.spyOn(console, 'error').mockImplementation(() => {}) // Silence expected error logs
})

describe('DELETE /api/auth/delete-account', () => {
  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null)
    const res = await DELETE(makeRequest())
    expect(res.status).toBe(401)
  })

  it('happy path - deletes user, wheels, and clears cookie', async () => {
    getSession.mockResolvedValue(session)
    
    // First, query on OwnerIdIndex returns user's wheels
    docClient.send.mockImplementation(async (command) => {
      if (command.constructor.name === 'QueryCommand' || command.input?.IndexName === 'OwnerIdIndex') {
        return { Items: existingWheels.filter(w => w.ownerId === session.userId) }
      }
      return {} // Mock DeleteCommand success
    })

    const res = await DELETE(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)

    // Verify correct things were deleted
    const calls = docClient.send.mock.calls.map(call => call[0])
    const deletes = calls.filter(cmd => cmd.constructor.name === 'DeleteCommand').map(cmd => cmd.input.Key.PK)

    expect(deletes).toContain('WHEEL#w1')
    expect(deletes).not.toContain('WHEEL#w2')
    expect(deletes).toContain('USER#u1')
    expect(deletes).toContain('USER#USERNAME#alice')

    // Verify cookie cleared
    const cookie = res.headers.get('set-cookie')
    expect(cookie).toMatch(/auth_token/)
    expect(cookie).toMatch(/max-age=0/i)

    // Verify compliance logging
    expect(console.info).toHaveBeenCalled()
    const logArg = JSON.parse(console.info.mock.calls[0][0])
    expect(logArg.event).toBe('ACCOUNT_DELETED')
    expect(logArg.userId).toBe('u1')

    // Verify email was sent
    const { sendEmail } = require('@/lib/email')
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'alice@example.com',
      subject: 'Account Deletion Confirmation'
    }))
  })

  it('skips username deletion if username is absent in session', async () => {
    getSession.mockResolvedValue({ userId: 'u2' })
    
    docClient.send.mockImplementation(async (command) => {
      if (command.constructor.name === 'QueryCommand' || command.input?.IndexName === 'OwnerIdIndex') return { Items: [] }
      return {}
    })

    const res = await DELETE(makeRequest())
    expect(res.status).toBe(200)

    const calls = docClient.send.mock.calls.map(call => call[0])
    const deletes = calls.filter(cmd => cmd.constructor.name === 'DeleteCommand').map(cmd => cmd.input.Key.PK)

    expect(deletes).toContain('USER#u2')
    // No USERNAME delete because there's no username
    expect(deletes.some(pk => pk.includes('USER#USERNAME#'))).toBe(false)
  })

  it('removes user from collaborator and viewer lists on other wheels', async () => {
    getSession.mockResolvedValue(session)
    const otherWheels = [
      { PK: 'WHEEL#shared1', wheelId: 'shared1', name: 'Shared 1', ownerId: 'other-user', collaborators: ['u1', 'someone-else'], viewers: ['u1'] },
      { PK: 'WHEEL#shared2', wheelId: 'shared2', name: 'Shared 2', ownerId: 'other-user', collaborators: ['someone-else'], viewers: [] },
    ]

    docClient.send.mockImplementation(async (command) => {
      if (command.input?.IndexName === 'OwnerIdIndex') return { Items: [] }
      if (command.constructor.name === 'ScanCommand') return { Items: otherWheels }
      return {}
    })

    const res = await DELETE(makeRequest())
    expect(res.status).toBe(200)

    const calls = docClient.send.mock.calls.map(call => call[0])
    const updates = calls.filter(cmd => cmd.constructor.name === 'UpdateCommand')
    expect(updates).toHaveLength(1)
    expect(updates[0].input.Key.PK).toBe('WHEEL#shared1')
    expect(updates[0].input.ExpressionAttributeValues[':c']).toEqual(['someone-else'])
    expect(updates[0].input.ExpressionAttributeValues[':v']).toEqual([])
  })

  it('returns 500 on DB error', async () => {
    getSession.mockResolvedValue(session)
    docClient.send.mockRejectedValue(new Error('DB down'))
    
    const res = await DELETE(makeRequest())
    expect(res.status).toBe(500)
  })
})
