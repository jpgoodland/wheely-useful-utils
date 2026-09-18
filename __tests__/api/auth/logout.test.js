import { POST } from '@/app/api/auth/logout/route'

describe('POST /api/auth/logout', () => {
  it('returns success and clears the auth_token cookie', async () => {
    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)

    const cookie = res.headers.get('set-cookie')
    expect(cookie).toMatch(/auth_token/)
    expect(cookie).toMatch(/max-age=0/i)
  })
})
