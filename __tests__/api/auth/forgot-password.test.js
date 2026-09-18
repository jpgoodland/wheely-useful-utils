import { POST } from '@/app/api/auth/forgot-password/route'
import { sendEmail } from '@/lib/email'

jest.mock('@/lib/dynamodb', () => ({
  docClient: { send: jest.fn() },
  TableNames: { Users: 'WheelApp_Users' },
}))

jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, resetMs: Date.now() + 1000 })
}))

const { docClient } = require('@/lib/dynamodb')

function makeRequest(body) {
  return new Request('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  docClient.send.mockReset()
})

describe('POST /api/auth/forgot-password', () => {
  it('happy path - returns 200 and sends email', async () => {
    docClient.send.mockResolvedValueOnce({ Items: [{ PK: 'USER#1', userId: '1', email: 'test@example.com' }] })
    docClient.send.mockResolvedValue({}) // Update primary
    
    const res = await POST(makeRequest({ email: 'test@example.com' }))
    expect(res.status).toBe(200)
    expect(sendEmail).toHaveBeenCalled()
  })
  
  it('returns 200 even if user not found to prevent enumeration', async () => {
    docClient.send.mockResolvedValueOnce({ Items: [] })
    
    const res = await POST(makeRequest({ email: 'notfound@example.com' }))
    expect(res.status).toBe(200)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('fails if rate limit is exceeded', async () => {
    const rateLimitMock = require('@/lib/rateLimit').checkRateLimit
    rateLimitMock.mockReturnValueOnce({ allowed: false, resetMs: Date.now() + 1000 })
    const res = await POST(makeRequest({ email: 'test@example.com' }))
    expect(res.status).toBe(429)
  })

  it('returns 200 even if email is missing to prevent enumeration', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(200)
  })

  it('fails if SES throws an error', async () => {
    docClient.send.mockResolvedValueOnce({ Items: [{ PK: 'USER#1', userId: '1', email: 'test@example.com' }] })
    docClient.send.mockResolvedValue({}) // Update primary
    sendEmail.mockRejectedValueOnce(new Error('SES error'))
    
    const res = await POST(makeRequest({ email: 'test@example.com' }))
    expect(res.status).toBe(500)
  })

  it('fails if database throws an error', async () => {
    docClient.send.mockRejectedValueOnce(new Error('DB error'))
    const res = await POST(makeRequest({ email: 'test@example.com' }))
    expect(res.status).toBe(500)
  })
})
