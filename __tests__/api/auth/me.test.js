import { GET } from '@/app/api/auth/me/route'

jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))

const { getSession } = require('@/lib/session')

beforeEach(() => jest.clearAllMocks())

describe('GET /api/auth/me', () => {
  it('returns the session user when authenticated', async () => {
    const session = { userId: 'u1', username: 'alice', email: 'a@b.com' }
    getSession.mockResolvedValue(session)

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user).toEqual(session)
  })

  it('returns null user when not authenticated', async () => {
    getSession.mockResolvedValue(null)

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user).toBeNull()
  })
})
