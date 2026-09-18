/**
 * Tests for the JWT secret guard in lib/auth.js.
 * Each test resets modules so the env var is re-evaluated.
 */

const ORIGINAL_ENV = process.env.NODE_ENV
const ORIGINAL_SECRET = process.env.JWT_SECRET

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_ENV
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.JWT_SECRET
  } else {
    process.env.JWT_SECRET = ORIGINAL_SECRET
  }
  jest.resetModules()
})

async function importSignToken() {
  const mod = await import('@/lib/auth')
  return mod.signToken
}

describe('lib/auth - JWT secret guard', () => {
  it('uses the env var secret when JWT_SECRET is set', async () => {
    process.env.JWT_SECRET = 'a-strong-test-secret-32-chars-long!!'
    const signToken = await importSignToken()
    // Should not throw
    await expect(signToken({ userId: 'u1' })).resolves.toBeTruthy()
  })

  it('throws in production when JWT_SECRET is missing', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.JWT_SECRET
    const signToken = await importSignToken()
    await expect(signToken({ userId: 'u1' })).rejects.toThrow(/JWT_SECRET/)
  })

  it('throws in staging/test when JWT_SECRET is missing', async () => {
    process.env.NODE_ENV = 'staging'
    delete process.env.JWT_SECRET
    const signToken = await importSignToken()
    await expect(signToken({ userId: 'u1' })).rejects.toThrow(/JWT_SECRET/)
  })

  it('uses the insecure fallback only in development', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.JWT_SECRET
    const signToken = await importSignToken()
    // Should not throw — dev fallback is acceptable
    await expect(signToken({ userId: 'u1' })).resolves.toBeTruthy()
  })
})
