import { POST } from '@/app/api/auth/verify/route'

jest.mock('@/lib/dynamodb', () => ({
  docClient: { send: jest.fn() },
  TableNames: { Users: 'WheelApp_Users' },
}))

const { docClient } = require('@/lib/dynamodb')

function makeRequest(body) {
  return new Request('http://localhost/api/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const unverifiedUser = {
  userId: 'u1',
  username: 'alice',
  isVerified: false,
  verificationToken: 'valid-token-abc',
}

beforeEach(() => {
  jest.clearAllMocks()
  docClient.send.mockReset()
})

describe('POST /api/auth/verify', () => {
  it('happy path - verifies user successfully', async () => {
    docClient.send
      .mockResolvedValueOnce({ Item: unverifiedUser }) // GetCommand
      .mockResolvedValueOnce({})                        // UpdateCommand (primary)
      .mockResolvedValueOnce({})                        // UpdateCommand (username pointer)

    const res = await POST(makeRequest({ userId: 'u1', token: 'valid-token-abc' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(docClient.send).toHaveBeenCalledTimes(3)
  })

  it('returns 400 when userId or token is missing', async () => {
    const res = await POST(makeRequest({ userId: 'u1' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when user does not exist', async () => {
    docClient.send.mockResolvedValueOnce({ Item: undefined })
    const res = await POST(makeRequest({ userId: 'ghost', token: 'tok' }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when user is already verified', async () => {
    docClient.send.mockResolvedValueOnce({ Item: { ...unverifiedUser, isVerified: true } })
    const res = await POST(makeRequest({ userId: 'u1', token: 'valid-token-abc' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/already/i)
  })

  it('returns 400 when token is wrong', async () => {
    docClient.send.mockResolvedValueOnce({ Item: unverifiedUser })
    const res = await POST(makeRequest({ userId: 'u1', token: 'wrong-token' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid|expired/i)
  })

  it('returns 500 on unexpected error', async () => {
    docClient.send.mockRejectedValueOnce(new Error('DB error'))
    const res = await POST(makeRequest({ userId: 'u1', token: 'tok' }))
    expect(res.status).toBe(500)
  })
})
