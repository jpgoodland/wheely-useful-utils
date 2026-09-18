import { GET, DELETE, PUT } from '@/app/api/wheels/[id]/route'

jest.mock('@/lib/dynamodb', () => ({
  docClient: { send: jest.fn() },
  TableNames: { Wheels: 'WheelApp_Wheels', Users: 'WheelApp_Users' },
}))

jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))

const { docClient } = require('@/lib/dynamodb')
const { getSession } = require('@/lib/session')

const ownerSession = { userId: 'owner1' }
const collabSession = { userId: 'collab1' }
const viewerSession = { userId: 'viewer1' }
const strangerSession = { userId: 'stranger' }

const wheel = {
  PK: 'WHEEL#wid1',
  wheelId: 'wid1',
  name: 'Test Wheel',
  ownerId: 'owner1',
  collaborators: ['collab1'],
  viewers: ['viewer1'],
  categories: [
    { id: 'c1', name: 'Alpha', weight: 10, color: '#f00' },
    { id: 'c2', name: 'Beta', weight: 10, color: '#0f0' },
  ],
}

function makeParams(id = 'wid1') {
  return { params: Promise.resolve({ id }) }
}

function makeRequest(method, body) {
  return new Request(`http://localhost/api/wheels/wid1`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => jest.clearAllMocks())

// ── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/wheels/[id]', () => {
  it('happy path - owner can fetch wheel', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send.mockResolvedValue({ Item: wheel })

    const res = await GET(makeRequest('GET'), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.wheelId).toBe('wid1')
  })

  it('collaborator can fetch wheel', async () => {
    getSession.mockResolvedValue(collabSession)
    docClient.send.mockResolvedValue({ Item: wheel })

    const res = await GET(makeRequest('GET'), makeParams())
    expect(res.status).toBe(200)
  })

  it('viewer can fetch wheel', async () => {
    getSession.mockResolvedValue(viewerSession)
    docClient.send.mockResolvedValue({ Item: wheel })

    const res = await GET(makeRequest('GET'), makeParams())
    expect(res.status).toBe(200)
  })

  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null)
    const res = await GET(makeRequest('GET'), makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 404 when wheel does not exist', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send.mockResolvedValue({ Item: undefined })

    const res = await GET(makeRequest('GET'), makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 403 for a stranger', async () => {
    getSession.mockResolvedValue(strangerSession)
    docClient.send.mockResolvedValue({ Item: wheel })

    const res = await GET(makeRequest('GET'), makeParams())
    expect(res.status).toBe(403)
  })

  it('returns 500 on DB error', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send.mockRejectedValue(new Error('DB down'))

    const res = await GET(makeRequest('GET'), makeParams())
    expect(res.status).toBe(500)
  })
})

// ── DELETE ────────────────────────────────────────────────────────────────────

describe('DELETE /api/wheels/[id]', () => {
  it('happy path - owner can delete wheel', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send
      .mockResolvedValueOnce({ Item: wheel })  // GetCommand
      .mockResolvedValueOnce({})               // DeleteCommand

    const res = await DELETE(makeRequest('DELETE'), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 404 when wheel does not exist', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send.mockResolvedValue({ Item: undefined })

    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 403 when collaborator tries to delete', async () => {
    getSession.mockResolvedValue(collabSession)
    docClient.send.mockResolvedValue({ Item: wheel })

    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(403)
  })

  it('returns 403 when stranger tries to delete', async () => {
    getSession.mockResolvedValue(strangerSession)
    docClient.send.mockResolvedValue({ Item: wheel })

    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(403)
  })

  it('returns 500 on DB error', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send.mockRejectedValue(new Error('DB down'))

    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(500)
  })
})

// ── PUT ───────────────────────────────────────────────────────────────────────

describe('PUT /api/wheels/[id] - updateCategories', () => {
  const newCats = [{ id: 'c3', name: 'Gamma', weight: 10, color: '#00f' }]

  it('happy path - owner can update categories', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send
      .mockResolvedValueOnce({ Item: wheel })
      .mockResolvedValueOnce({})

    const res = await PUT(makeRequest('PUT', { action: 'updateCategories', payload: newCats }), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('collaborator can update categories', async () => {
    getSession.mockResolvedValue(collabSession)
    docClient.send
      .mockResolvedValueOnce({ Item: wheel })
      .mockResolvedValueOnce({})

    const res = await PUT(makeRequest('PUT', { action: 'updateCategories', payload: newCats }), makeParams())
    expect(res.status).toBe(200)
  })

  it('viewer cannot update categories', async () => {
    getSession.mockResolvedValue(viewerSession)
    docClient.send.mockResolvedValue({ Item: wheel })

    const res = await PUT(makeRequest('PUT', { action: 'updateCategories', payload: newCats }), makeParams())
    expect(res.status).toBe(403)
  })

  it('returns 400 for unknown action', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send.mockResolvedValue({ Item: wheel })

    const res = await PUT(makeRequest('PUT', { action: 'unknownAction', payload: {} }), makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null)
    const res = await PUT(makeRequest('PUT', { action: 'updateCategories', payload: [] }), makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 404 when wheel not found', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send.mockResolvedValue({ Item: undefined })

    const res = await PUT(makeRequest('PUT', { action: 'updateCategories', payload: [] }), makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 400 when payload is not an array', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send.mockResolvedValue({ Item: wheel })

    const res = await PUT(makeRequest('PUT', { action: 'updateCategories', payload: 'not-an-array' }), makeParams())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid data')
  })

  it('returns 400 when category name exceeds 50 characters', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send.mockResolvedValue({ Item: wheel })

    const longNameCat = [{ id: 'c3', name: 'a'.repeat(51), weight: 10, color: '#00f' }]
    const res = await PUT(makeRequest('PUT', { action: 'updateCategories', payload: longNameCat }), makeParams())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Category name exceeds 50 characters')
  })
})

describe('PUT /api/wheels/[id] - share', () => {
  it('happy path - owner can share with a user', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send
      .mockResolvedValueOnce({ Item: wheel })                          // GetCommand (wheel)
      .mockResolvedValueOnce({ Items: [{ userId: 'newuser1' }] })     // QueryCommand (find user)
      .mockResolvedValueOnce({})                                       // UpdateCommand

    const res = await PUT(
      makeRequest('PUT', { action: 'share', payload: { identifier: 'newuser@example.com', role: 'viewer' } }),
      makeParams()
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 403 when collaborator tries to share', async () => {
    getSession.mockResolvedValue(collabSession)
    docClient.send.mockResolvedValue({ Item: wheel })

    const res = await PUT(
      makeRequest('PUT', { action: 'share', payload: { identifier: 'x@y.com', role: 'viewer' } }),
      makeParams()
    )
    expect(res.status).toBe(403)
  })

  it('returns 404 when target user not found', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send
      .mockResolvedValueOnce({ Item: wheel })
      .mockResolvedValueOnce({ Items: [] })

    const res = await PUT(
      makeRequest('PUT', { action: 'share', payload: { identifier: 'ghost@x.com', role: 'viewer' } }),
      makeParams()
    )
    expect(res.status).toBe(404)
  })

  it('sends email when target user has an email', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send
      .mockResolvedValueOnce({ Item: wheel })
      .mockResolvedValueOnce({ Items: [{ userId: 'newuser1', email: 'newuser@example.com', username: 'newuser' }] })
      .mockResolvedValueOnce({})

    const res = await PUT(
      makeRequest('PUT', { action: 'share', payload: { identifier: 'newuser@example.com', role: 'viewer' } }),
      makeParams()
    )
    expect(res.status).toBe(200)
    const { sendEmail } = require('@/lib/email')
    expect(sendEmail).toHaveBeenCalled()
  })

  it('returns 500 on DB error', async () => {
    getSession.mockResolvedValue(ownerSession)
    docClient.send.mockRejectedValue(new Error('DB down'))

    const res = await PUT(makeRequest('PUT', { action: 'updateCategories', payload: [] }), makeParams())
    expect(res.status).toBe(500)
  })
})
