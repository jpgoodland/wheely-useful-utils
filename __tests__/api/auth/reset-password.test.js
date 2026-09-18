import { POST } from '@/app/api/auth/reset-password/route'

jest.mock('@/lib/dynamodb', () => ({
  docClient: { send: jest.fn() },
  TableNames: { Users: 'WheelApp_Users' },
}))
jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed_pw') }))
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, resetMs: Date.now() + 1000 })
}))

const { docClient } = require('@/lib/dynamodb')

function makeRequest(body) {
  return new Request('http://localhost/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  docClient.send.mockReset()
})

describe('POST /api/auth/reset-password', () => {
  it('happy path - updates password', async () => {
    docClient.send.mockResolvedValueOnce({ 
      Item: { 
        PK: 'USER#1', userId: '1', 
        passwordResetToken: 'tok', 
        passwordResetExpiry: new Date(Date.now() + 100000).toISOString() 
      } 
    })
    docClient.send.mockResolvedValue({})
    
    const res = await POST(makeRequest({ userId: '1', token: 'tok', newPassword: 'Str0ng!Passw0rd' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
  
  it('fails if token is invalid', async () => {
    docClient.send.mockResolvedValueOnce({ 
      Item: { 
        PK: 'USER#1', userId: '1', 
        passwordResetToken: 'tok', 
        passwordResetExpiry: new Date(Date.now() + 100000).toISOString() 
      } 
    })
    const res = await POST(makeRequest({ userId: '1', token: 'badtok', newPassword: 'Str0ng!Passw0rd' }))
    expect(res.status).toBe(400)
  })

  it('fails if password does not meet requirements', async () => {
    const res = await POST(makeRequest({ userId: '1', token: 'tok', newPassword: 'weak' }))
    expect(res.status).toBe(400)
  })

  it('fails if rate limit is exceeded', async () => {
    const rateLimitMock = require('@/lib/rateLimit').checkRateLimit
    rateLimitMock.mockReturnValueOnce({ allowed: false, resetMs: Date.now() + 1000 })
    const res = await POST(makeRequest({ userId: '1', token: 'tok', newPassword: 'Str0ng!Passw0rd' }))
    expect(res.status).toBe(429)
  })

  it('fails if required fields are missing', async () => {
    const res = await POST(makeRequest({ userId: '1', newPassword: 'Str0ng!Passw0rd' }))
    expect(res.status).toBe(400)
  })

  it('fails if database throws an error', async () => {
    docClient.send.mockRejectedValueOnce(new Error('DB error'))
    const res = await POST(makeRequest({ userId: '1', token: 'tok', newPassword: 'Str0ng!Passw0rd' }))
    expect(res.status).toBe(500)
  })

  it('fails if user is not found', async () => {
    docClient.send.mockResolvedValueOnce({ Item: undefined })
    const res = await POST(makeRequest({ userId: '1', token: 'tok', newPassword: 'Str0ng!Passw0rd' }))
    expect(res.status).toBe(400)
  })

  it('fails if user has no reset token requested', async () => {
    docClient.send.mockResolvedValueOnce({ Item: { PK: 'USER#1', userId: '1' } })
    const res = await POST(makeRequest({ userId: '1', token: 'tok', newPassword: 'Str0ng!Passw0rd' }))
    expect(res.status).toBe(400)
  })

  it('fails if reset token is expired', async () => {
    docClient.send.mockResolvedValueOnce({ 
      Item: { 
        PK: 'USER#1', userId: '1', 
        passwordResetToken: 'tok', 
        passwordResetExpiry: new Date(Date.now() - 100000).toISOString() 
      } 
    })
    const res = await POST(makeRequest({ userId: '1', token: 'tok', newPassword: 'Str0ng!Passw0rd' }))
    expect(res.status).toBe(400)
  })

  it('updates username pointer if user has a username', async () => {
    docClient.send.mockResolvedValueOnce({ 
      Item: { 
        PK: 'USER#1', userId: '1', username: 'testuser',
        passwordResetToken: 'tok', 
        passwordResetExpiry: new Date(Date.now() + 100000).toISOString() 
      } 
    })
    docClient.send.mockResolvedValue({}) // primary
    docClient.send.mockResolvedValue({}) // pointer

    const res = await POST(makeRequest({ userId: '1', token: 'tok', newPassword: 'Str0ng!Passw0rd' }))
    expect(res.status).toBe(200)
    expect(docClient.send).toHaveBeenCalledTimes(3) // 1 get, 2 updates
  })
})
