import { GET, POST } from '@/app/api/wheels/route'

jest.mock('@/lib/dynamodb', () => ({
  docClient: { send: jest.fn() },
  TableNames: { Wheels: 'WheelApp_Wheels' },
}))

jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))

const { docClient } = require('@/lib/dynamodb')
const { getSession } = require('@/lib/session')

const session = { userId: 'u1', username: 'alice' }

const existingWheels = [
  { PK: 'WHEEL#w1', wheelId: 'w1', name: 'My Wheel', ownerId: 'u1', categories: [], collaborators: [], viewers: [] },
  { PK: 'WHEEL#w2', wheelId: 'w2', name: 'Other Wheel', ownerId: 'u2', categories: [], collaborators: [], viewers: [] },
]

beforeEach(() => jest.clearAllMocks())

// ── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/wheels', () => {
  it('happy path - returns wheels owned by the user via OwnerIdIndex', async () => {
    getSession.mockResolvedValue(session)
    const userWheels = existingWheels.filter(w => w.ownerId === session.userId)
    docClient.send.mockImplementation(async (cmd) => {
      if (cmd.input?.IndexName === 'OwnerIdIndex') {
        return { Items: userWheels }
      }
      return { Items: [] }
    })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].wheelId).toBe('w1')
    expect(docClient.send).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        TableName: 'WheelApp_Wheels',
        IndexName: 'OwnerIdIndex',
        KeyConditionExpression: 'ownerId = :uid',
        ExpressionAttributeValues: { ':uid': 'u1' },
      }),
    }))
  })

  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns empty array when user has no wheels', async () => {
    getSession.mockResolvedValue(session)
    docClient.send.mockResolvedValue({ Items: [] })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(0)
  })

  it('returns 500 on DB error', async () => {
    getSession.mockResolvedValue(session)
    docClient.send.mockRejectedValue(new Error('DB down'))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})

// ── POST ─────────────────────────────────────────────────────────────────────

function makePostRequest(body) {
  return new Request('http://localhost/api/wheels', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/wheels', () => {
  it('happy path - creates a wheel and returns it', async () => {
    getSession.mockResolvedValue(session)
    // Scan for limit check returns 0 owned wheels, then PutCommand succeeds
    docClient.send.mockResolvedValue({ Items: [] })

    const res = await makePostRequest({
      name: 'New Wheel',
      categories: [{ name: 'A', weight: 10, color: '#fff' }],
    })
    const response = await POST(res)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.name).toBe('New Wheel')
    expect(body.ownerId).toBe('u1')
    expect(body.categories).toHaveLength(1)
    expect(body.categories[0].name).toBe('A')
  })

  it('fills in default weight and color for categories missing them', async () => {
    getSession.mockResolvedValue(session)
    docClient.send.mockResolvedValue({ Items: [] })

    const res = await makePostRequest({ name: 'Wheel', categories: [{ name: 'X' }] })
    const response = await POST(res)
    const body = await response.json()

    expect(body.categories[0].weight).toBe(10)
    expect(body.categories[0].color).toBe('#ffffff')
  })

  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null)
    const res = await POST(makePostRequest({ name: 'W', categories: [] }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    getSession.mockResolvedValue(session)
    const res = await POST(makePostRequest({ categories: [] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when categories is not an array', async () => {
    getSession.mockResolvedValue(session)
    const res = await POST(makePostRequest({ name: 'W', categories: 'bad' }))
    expect(res.status).toBe(400)
  })

  it('returns 403 when user already has 25 wheels', async () => {
    getSession.mockResolvedValue(session)
    const fullWheels = Array.from({ length: 25 }, (_, i) => ({ ownerId: 'u1', wheelId: `w${i}` }))
    docClient.send.mockResolvedValue({ Count: 25, Items: fullWheels })

    const res = await POST(makePostRequest({ name: 'One More', categories: [] }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/maximum/i)
  })

  it('returns 500 on DB error', async () => {
    getSession.mockResolvedValue(session)
    docClient.send.mockRejectedValue(new Error('DB down'))
    const res = await POST(makePostRequest({ name: 'W', categories: [] }))
    expect(res.status).toBe(500)
  })
})
