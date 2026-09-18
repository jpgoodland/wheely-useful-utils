// Set JWT_SECRET before importing auth module (required in non-dev environments)
process.env.JWT_SECRET = 'test-secret-for-jest-32-chars-long!!'

import { signToken, verifyToken } from '@/lib/auth'

describe('auth - signToken / verifyToken', () => {
  it('signs a token and verifies it back', async () => {
    const payload = { userId: 'u1', email: 'a@b.com', username: 'alice' }
    const token = await signToken(payload)
    expect(typeof token).toBe('string')

    const result = await verifyToken(token)
    expect(result.userId).toBe('u1')
    expect(result.email).toBe('a@b.com')
    expect(result.username).toBe('alice')
  })

  it('returns null for a tampered token', async () => {
    const token = await signToken({ userId: 'u1' })
    const tampered = token.slice(0, -5) + 'XXXXX'
    const result = await verifyToken(tampered)
    expect(result).toBeNull()
  })

  it('returns null for a completely invalid token', async () => {
    const result = await verifyToken('not.a.jwt')
    expect(result).toBeNull()
  })

  it('returns null for an empty string', async () => {
    const result = await verifyToken('')
    expect(result).toBeNull()
  })
})
