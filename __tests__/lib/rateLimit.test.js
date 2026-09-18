// Use fake timers so we can control the sliding window precisely
jest.useFakeTimers()

// Re-import fresh module for each test to get a clean store
let checkRateLimit

beforeEach(async () => {
  jest.resetModules()
  jest.useFakeTimers()
  ;({ checkRateLimit } = await import('@/lib/rateLimit'))
})

afterEach(() => {
  jest.useRealTimers()
})

describe('checkRateLimit', () => {
  it('allows requests under the limit', () => {
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit('key1', 5, 60_000)
      expect(r.allowed).toBe(true)
    }
  })

  it('blocks the request that exceeds the limit', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('key1', 5, 60_000)
    const r = checkRateLimit('key1', 5, 60_000)
    expect(r.allowed).toBe(false)
    expect(r.remaining).toBe(0)
  })

  it('remaining decrements correctly', () => {
    const r1 = checkRateLimit('key2', 10, 60_000)
    expect(r1.remaining).toBe(9)
    const r2 = checkRateLimit('key2', 10, 60_000)
    expect(r2.remaining).toBe(8)
  })

  it('resets after the window expires', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('key3', 5, 60_000)
    expect(checkRateLimit('key3', 5, 60_000).allowed).toBe(false)

    // Advance past the window
    jest.advanceTimersByTime(61_000)

    expect(checkRateLimit('key3', 5, 60_000).allowed).toBe(true)
  })

  it('uses a sliding window, not a fixed window', () => {
    // Use 4 of 5 slots at t=0
    for (let i = 0; i < 4; i++) checkRateLimit('key4', 5, 60_000)

    // Advance 30 s — those 4 are still in the window
    jest.advanceTimersByTime(30_000)
    checkRateLimit('key4', 5, 60_000) // 5th — still allowed
    expect(checkRateLimit('key4', 5, 60_000).allowed).toBe(false) // 6th — blocked

    // Advance another 31 s — the first 4 (from t=0) have now expired
    jest.advanceTimersByTime(31_000)
    // Only the t=30s and t=30s entries remain (2 entries), so 3 more are allowed
    expect(checkRateLimit('key4', 5, 60_000).allowed).toBe(true)
  })

  it('isolates different keys', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('keyA', 5, 60_000)
    expect(checkRateLimit('keyA', 5, 60_000).allowed).toBe(false)
    // keyB is unaffected
    expect(checkRateLimit('keyB', 5, 60_000).allowed).toBe(true)
  })

  it('provides a resetMs in the future when blocked', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('key5', 5, 60_000)
    const r = checkRateLimit('key5', 5, 60_000)
    expect(r.allowed).toBe(false)
    expect(r.resetMs).toBeGreaterThan(Date.now())
  })

  it('evicts stale entries periodically', () => {
    checkRateLimit('key_evict', 5, 60_000)
    
    // Advance timers by 16 minutes to trigger eviction (3rd interval callback at 15 mins)
    jest.advanceTimersByTime(16 * 60 * 1000)
    
    // It should allow the request after eviction
    const r = checkRateLimit('key_evict', 5, 60_000)
    expect(r.allowed).toBe(true)
  })
})
