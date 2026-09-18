import { POST } from '@/app/api/wheels/[id]/spin/route'

jest.mock('@/lib/dynamodb', () => ({
  docClient: { send: jest.fn() },
  TableNames: { Wheels: 'WheelApp_Wheels' },
}))

jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))

const { docClient } = require('@/lib/dynamodb')
const { getSession } = require('@/lib/session')

const ownerSession = { userId: 'owner1' }
const strangerSession = { userId: 'stranger' }

const wheel = {
  PK: 'WHEEL#wid1',
  wheelId: 'wid1',
  ownerId: 'owner1',
  collaborators: ['collab1'],
  viewers: ['viewer1'],
  categories: [
    { id: 'c1', name: 'Alpha', weight: 10, color: '#f00' },
    { id: 'c2', name: 'Beta', weight: 10, color: '#0f0' },
    { id: 'c3', name: 'Gamma', weight: 10, color: '#00f' },
  ],
}

function makeParams(id = 'wid1') {
  return { params: Promise.resolve({ id }) }
}

function makeRequest(body = {}) {
  return new Request('http://localhost/api/wheels/wid1/spin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => jest.clearAllMocks())

describe('POST /api/wheels/[id]/spin', () => {
  it('happy path - returns a winner and updated categories', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send
      .mockResolvedValueOnce({ Item: wheel })
      .mockResolvedValueOnce({})

    const res = await POST(makeRequest(), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.winners).toHaveLength(1)
    expect(body.newCategories).toHaveLength(3)
  })

  it('winner weight decreases and others increase after a spin', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send
      .mockResolvedValueOnce({ Item: wheel })
      .mockResolvedValueOnce({})

    const res = await POST(makeRequest(), makeParams())
    const body = await res.json()

    const winnerName = body.winners[0].name
    const winnerAfter = body.newCategories.find(c => c.name === winnerName)
    const loserAfter = body.newCategories.find(c => c.name !== winnerName)

    expect(winnerAfter.weight).toBeLessThan(10)
    expect(loserAfter.weight).toBeGreaterThan(10)
  })

  it('total weight is conserved after a spin', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send
      .mockResolvedValueOnce({ Item: wheel })
      .mockResolvedValueOnce({})

    const res = await POST(makeRequest(), makeParams())
    const body = await res.json()

    const totalBefore = wheel.categories.reduce((s, c) => s + c.weight, 0)
    const totalAfter = body.newCategories.reduce((s, c) => s + c.weight, 0)

    expect(totalAfter).toBeCloseTo(totalBefore, 5)
  })

  it('supports multiple spins in one request', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send
      .mockResolvedValueOnce({ Item: wheel })
      .mockResolvedValueOnce({})

    const res = await POST(makeRequest({ count: 3 }), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.winners).toHaveLength(3)
  })

  it('clamps count to max 100', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send
      .mockResolvedValueOnce({ Item: wheel })
      .mockResolvedValueOnce({})

    const res = await POST(makeRequest({ count: 9999 }), makeParams())
    const body = await res.json()

    expect(body.winners).toHaveLength(100)
  })

  it('clamps count to min 1', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send
      .mockResolvedValueOnce({ Item: wheel })
      .mockResolvedValueOnce({})

    const res = await POST(makeRequest({ count: -5 }), makeParams())
    const body = await res.json()

    expect(body.winners).toHaveLength(1)
  })

  it('returns the single category immediately when only one exists', async () => {
    getSession.mockResolvedValue(ownerSession)
    const singleCatWheel = { ...wheel, categories: [{ id: 'c1', name: 'Only', weight: 10 }] }
    docClient.send.mockResolvedValueOnce({ Item: singleCatWheel })

    const res = await POST(makeRequest(), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.winners[0].name).toBe('Only')
  })

  it('returns 400 when wheel has no categories', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send.mockResolvedValueOnce({ Item: { ...wheel, categories: [] } })

    const res = await POST(makeRequest(), makeParams())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/no categories/i)
  })

  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null)
    const res = await POST(makeRequest(), makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 404 when wheel does not exist', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send.mockResolvedValueOnce({ Item: undefined })

    const res = await POST(makeRequest(), makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 403 for a stranger', async () => {
    getSession.mockResolvedValue(strangerSession)
    docClient.send.mockResolvedValueOnce({ Item: wheel })

    const res = await POST(makeRequest(), makeParams())
    expect(res.status).toBe(403)
  })

  it('viewer can spin', async () => {
    getSession.mockResolvedValue({ userId: 'viewer1' })
    docClient.send
      .mockResolvedValueOnce({ Item: wheel })
      .mockResolvedValueOnce({})

    const res = await POST(makeRequest(), makeParams())
    expect(res.status).toBe(200)
  })

  it('returns 500 on DB error', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send.mockRejectedValue(new Error('DB down'))

    const res = await POST(makeRequest(), makeParams())
    expect(res.status).toBe(500)
  })
})
