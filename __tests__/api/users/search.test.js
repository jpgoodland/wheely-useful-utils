import { GET } from '@/app/api/users/search/route'

jest.mock('@/lib/dynamodb', () => ({
  docClient: { send: jest.fn() },
  TableNames: { Users: 'WheelApp_Users' },
}))

jest.mock('@/lib/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, resetMs: Date.now() + 1000 }),
}))

const { docClient } = require('@/lib/dynamodb')
const { getSession } = require('@/lib/session')
const { checkRateLimit } = require('@/lib/rateLimit')

function makeRequest(query = '') {
  return new Request(`http://localhost/api/users/search?q=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: { 'content-type': 'application/json' },
  })
}

const currentSession = {
  userId: 'current-user-id',
  username: 'currentuser',
  email: 'current@example.com',
}

const sampleUsers = [
  {
    PK: 'USER#current-user-id',
    userId: 'current-user-id',
    username: 'currentuser',
    email: 'current@example.com',
    firstName: 'Current',
    lastName: 'User',
  },
  {
    PK: 'USER#u-jane',
    userId: 'u-jane',
    username: 'janedoe',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
  },
  {
    PK: 'USER#u-bob',
    userId: 'u-bob',
    username: 'bobs',
    email: 'bob@example.com',
    firstName: 'Bob',
    lastName: 'Smith',
  },
  {
    PK: 'USER#u-legacy',
    userId: 'u-legacy',
    username: 'legacyuser',
    email: 'legacy@example.com',
    // No firstName or lastName (legacy backward compatibility)
  },
  {
    PK: 'USER#USERNAME#janedoe', // Pointer item (should be filtered out)
    userId: 'u-jane',
    username: 'janedoe',
  },
  {
    PK: 'INVITE#token123', // Invite token (should be filtered out)
    email: 'invited@example.com',
  },
]

beforeEach(() => {
  jest.clearAllMocks()
  checkRateLimit.mockReturnValue({ allowed: true, resetMs: Date.now() + 1000 })
  getSession.mockResolvedValue(currentSession)
  docClient.send.mockResolvedValue({ Items: sampleUsers })
})

describe('GET /api/users/search', () => {
  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null)
    const res = await GET(makeRequest('jane'))
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limit is exceeded', async () => {
    checkRateLimit.mockReturnValueOnce({ allowed: false, resetMs: Date.now() + 60000 })
    const res = await GET(makeRequest('jane'))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/too many search requests/i)
  })

  it('returns empty array when query is less than 2 characters', async () => {
    const res = await GET(makeRequest('j'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual([])
    expect(docClient.send).not.toHaveBeenCalled()
  })

  it('matches user by first name', async () => {
    const res = await GET(makeRequest('jane'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].userId).toBe('u-jane')
    expect(body[0].fullName).toBe('Jane Doe')
  })

  it('matches user by last name', async () => {
    const res = await GET(makeRequest('smith'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].userId).toBe('u-bob')
    expect(body[0].firstName).toBe('Bob')
    expect(body[0].lastName).toBe('Smith')
  })

  it('matches user by full name ("Jane Doe")', async () => {
    const res = await GET(makeRequest('Jane Doe'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].username).toBe('janedoe')
  })

  it('matches user by username', async () => {
    const res = await GET(makeRequest('bobs'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].userId).toBe('u-bob')
  })

  it('matches user by email', async () => {
    const res = await GET(makeRequest('jane@example.com'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].email).toBe('jane@example.com')
  })

  it('excludes current user from search results', async () => {
    const res = await GET(makeRequest('current'))
    const body = await res.json()
    expect(res.status).toBe(200)
    // "Current User" matches the query, but must be excluded because userId matches session
    expect(body.find(u => u.userId === 'current-user-id')).toBeUndefined()
  })

  it('filters out pointer items and invite tokens', async () => {
    const res = await GET(makeRequest('invited'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveLength(0)
  })

  it('falls back to username for legacy user without firstName', async () => {
    const res = await GET(makeRequest('legacy'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].username).toBe('legacyuser')
    expect(body[0].firstName).toBeNull()
    expect(body[0].fullName).toBe('legacyuser')
  })
})
