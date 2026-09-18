import {
  isMockEnabled,
  getAuthUrl,
  exchangeCode,
  fetchUserProfile,
} from "@/lib/oauth";

describe("lib/oauth mock mode", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
      OAUTH_MOCK: "true",
      OAUTH_GOOGLE_CLIENT_ID: "mock-google-id",
      OAUTH_GOOGLE_CLIENT_SECRET: "mock-google-secret",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("isMockEnabled returns true when OAUTH_MOCK is true", () => {
    process.env.OAUTH_MOCK = "true";
    expect(isMockEnabled("google")).toBe(true);
  });

  it("isMockEnabled returns true when NODE_ENV is development and client ID starts with mock-", () => {
    delete process.env.OAUTH_MOCK;
    process.env.NODE_ENV = "development";
    process.env.OAUTH_GOOGLE_CLIENT_ID = "mock-google-id";
    expect(isMockEnabled("google")).toBe(true);
  });

  it("isMockEnabled returns true when NODE_ENV is development and client ID is empty", () => {
    delete process.env.OAUTH_MOCK;
    process.env.NODE_ENV = "development";
    process.env.OAUTH_GOOGLE_CLIENT_ID = "";
    expect(isMockEnabled("google")).toBe(true);
  });

  it("isMockEnabled returns false in production even with mock IDs", () => {
    delete process.env.OAUTH_MOCK;
    process.env.NODE_ENV = "production";
    process.env.OAUTH_GOOGLE_CLIENT_ID = "mock-google-id";
    expect(isMockEnabled("google")).toBe(false);
  });

  it("getAuthUrl redirects to local sandbox url when mock is enabled", () => {
    const url = getAuthUrl("google", "teststate", "http://localhost:3000/api/auth/callback/google");
    expect(url).toBe("http://localhost:3000/auth/mock?provider=google&state=teststate&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback%2Fgoogle");
  });

  it("exchangeCode returns access token encoding the email", async () => {
    const code = "mock-code-google-ZGV2ZWxvcGVyQGV4YW1wbGUuY29t"; // base64 for developer@example.com
    const token = await exchangeCode("google", code, "http://localhost:3000/callback");
    expect(token).toBe("mock-token-google-ZGV2ZWxvcGVyQGV4YW1wbGUuY29t");
  });

  it("fetchUserProfile decodes user email and name from mock access token", async () => {
    const token = "mock-token-google-ZGV2ZWxvcGVyQGV4YW1wbGUuY29t";
    const profile = await fetchUserProfile("google", token);
    expect(profile.email).toBe("developer@example.com");
    expect(profile.name).toBe("developer");
  });

  it("fetchUserProfile uses fallback for invalid base64 encoding", async () => {
    const token = "mock-token-google-invalid!!!";
    const profile = await fetchUserProfile("google", token);
    expect(profile.email).toBe("mock-user@example.com");
    expect(profile.name).toBe("mock-user");
  });
});
