import { GET } from '@/app/.well-known/microsoft-identity-association.json/route';

describe('Microsoft Identity Association Endpoint', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.MICROSOFT_ASSOCIATION_APP_ID;
    delete process.env.OAUTH_MICROSOFT_CLIENT_ID;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns empty associatedApplications array when no env vars are set', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ associatedApplications: [] });
  });

  it('uses MICROSOFT_ASSOCIATION_APP_ID when provided', async () => {
    process.env.MICROSOFT_ASSOCIATION_APP_ID = 'test-custom-app-id-123';
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      associatedApplications: [{ applicationId: 'test-custom-app-id-123' }],
    });
  });

  it('falls back to OAUTH_MICROSOFT_CLIENT_ID when MICROSOFT_ASSOCIATION_APP_ID is not set', async () => {
    process.env.OAUTH_MICROSOFT_CLIENT_ID = 'test-oauth-ms-client-id-456';
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      associatedApplications: [{ applicationId: 'test-oauth-ms-client-id-456' }],
    });
  });
});
