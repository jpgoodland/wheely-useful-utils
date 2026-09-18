/**
 * Security Hardening Test Suite
 *
 * Validates defensive controls implemented across the application:
 * 1. Host/Origin Header Injection Prevention in Email Links
 * 2. Strict Password Policy Enforcement in Admin Resets
 * 3. Consistent RBAC Privilege Assignment (ADMIN_EMAILS)
 * 4. CSPRNG Entropy in Wheel Spins
 * 5. Strict Input Validation & Resource Bounds on Wheels API
 * 6. Rate Limiting Tier Coverage in Proxy for Sensitive Endpoints
 * 7. Defense-in-Depth Security Headers Configuration
 */

import { POST as signupPost } from "@/app/api/auth/signup/route";
import { POST as forgotPasswordPost } from "@/app/api/auth/forgot-password/route";
import { POST as resendVerificationPost } from "@/app/api/auth/resend-verification/route";
import { POST as adminInvitePost } from "@/app/api/admin/invite/route";
import { POST as inviteAcceptPost } from "@/app/api/admin/invite/accept/route";
import { PATCH as adminUserPatch } from "@/app/api/admin/users/[userId]/route";
import { POST as wheelsPost } from "@/app/api/wheels/route";
import { PUT as wheelIdPut } from "@/app/api/wheels/[id]/route";
import { POST as spinPost } from "@/app/api/wheels/[id]/spin/route";
import { proxy } from "@/proxy";
import nextConfig from "@/next.config.mjs";
import crypto from "crypto";

jest.mock("@/lib/dynamodb", () => ({
  docClient: { send: jest.fn() },
  TableNames: { Users: "WheelApp_Users", Wheels: "WheelApp_Wheels" },
}));

jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/session", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/rateLimit", () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 99, resetMs: Date.now() + 60000 }),
}));

jest.mock("bcrypt", () => ({
  hash: jest.fn().mockResolvedValue("hashed"),
  compare: jest.fn().mockResolvedValue(true),
}));

const { docClient } = require("@/lib/dynamodb");
const { sendEmail } = require("@/lib/email");
const { getSession } = require("@/lib/session");
const { checkRateLimit } = require("@/lib/rateLimit");

beforeEach(() => {
  jest.clearAllMocks();
  checkRateLimit.mockReturnValue({ allowed: true, remaining: 99, resetMs: Date.now() + 60000 });
});

// ── 1. Host / Origin Header Injection Prevention ────────────────────────────

describe("Security: Host / Origin Header Injection Prevention", () => {
  const ATTACKER_ORIGIN = "https://evil-attacker.com";

  it("prevents Origin header poisoning in signup verification email", async () => {
    docClient.send.mockResolvedValue({ Items: [] });

    const req = new Request("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ATTACKER_ORIGIN,
        host: "localhost:3000",
      },
      body: JSON.stringify({
        email: "victim@example.com",
        username: "victim123",
        password: "Str0ng!Passw0rd123",
        firstName: "Victim",
        lastName: "User",
      }),
    });

    await signupPost(req);

    expect(sendEmail).toHaveBeenCalled();
    const emailCall = sendEmail.mock.calls[0][0];
    expect(emailCall.text).not.toContain(ATTACKER_ORIGIN);
    expect(emailCall.html).not.toContain(ATTACKER_ORIGIN);
    expect(emailCall.text).toContain("http://localhost:3000/verify");
  });

  it("prevents Origin header poisoning in forgot-password reset email", async () => {
    docClient.send
      .mockResolvedValueOnce({
        Items: [{ PK: "USER#v1", userId: "v1", email: "victim@example.com", username: "victim" }],
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const req = new Request("http://localhost:3000/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ATTACKER_ORIGIN,
        host: "localhost:3000",
      },
      body: JSON.stringify({ email: "victim@example.com" }),
    });

    await forgotPasswordPost(req);

    expect(sendEmail).toHaveBeenCalled();
    const emailCall = sendEmail.mock.calls[0][0];
    expect(emailCall.text).not.toContain(ATTACKER_ORIGIN);
    expect(emailCall.html).not.toContain(ATTACKER_ORIGIN);
    expect(emailCall.text).toContain("http://localhost:3000/reset-password");
  });

  it("prevents Origin header poisoning in resend-verification email", async () => {
    docClient.send
      .mockResolvedValueOnce({
        Items: [{ PK: "USER#v1", userId: "v1", email: "victim@example.com", isVerified: false }],
      })
      .mockResolvedValueOnce({});

    const req = new Request("http://localhost:3000/api/auth/resend-verification", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ATTACKER_ORIGIN,
        host: "localhost:3000",
      },
      body: JSON.stringify({ email: "victim@example.com" }),
    });

    await resendVerificationPost(req);

    expect(sendEmail).toHaveBeenCalled();
    const emailCall = sendEmail.mock.calls[0][0];
    expect(emailCall.text).not.toContain(ATTACKER_ORIGIN);
    expect(emailCall.html).not.toContain(ATTACKER_ORIGIN);
    expect(emailCall.text).toContain("http://localhost:3000/verify");
  });

  it("prevents Origin/Referer header poisoning in admin invitations", async () => {
    getSession.mockResolvedValue({ userId: "admin1", username: "admin", isAdmin: true });
    docClient.send
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({});

    const req = new Request("http://localhost:3000/api/admin/invite", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ATTACKER_ORIGIN,
        referer: `${ATTACKER_ORIGIN}/admin`,
        host: "localhost:3000",
      },
      body: JSON.stringify({ email: "invitee@example.com" }),
    });

    await adminInvitePost(req);

    expect(sendEmail).toHaveBeenCalled();
    const emailCall = sendEmail.mock.calls[0][0];
    expect(emailCall.text).not.toContain(ATTACKER_ORIGIN);
    expect(emailCall.html).not.toContain(ATTACKER_ORIGIN);
    expect(emailCall.text).toContain("http://localhost:3000/signup/invite");
  });
});

// ── 2. Password Policy Enforcement on Admin Reset ───────────────────────────

describe("Security: Password Policy Enforcement on Admin Reset", () => {
  const adminSession = { userId: "admin1", isAdmin: true };

  beforeEach(() => {
    getSession.mockResolvedValue(adminSession);
    docClient.send.mockResolvedValue({
      Item: { PK: "USER#u1", userId: "u1", username: "targetuser" },
    });
  });

  const makePatch = (newPassword) =>
    new Request("http://localhost/api/admin/users/u1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });

  const params = { params: Promise.resolve({ userId: "u1" }) };

  it("rejects passwords lacking uppercase letters", async () => {
    const res = await adminUserPatch(makePatch("weakpassword123!"), params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("At least one uppercase letter");
  });

  it("rejects passwords lacking numbers", async () => {
    const res = await adminUserPatch(makePatch("WeakPassword!@#$"), params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("At least one number");
  });

  it("rejects passwords lacking special characters", async () => {
    const res = await adminUserPatch(makePatch("WeakPassword1234"), params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("At least one special character");
  });

  it("rejects passwords shorter than 12 characters", async () => {
    const res = await adminUserPatch(makePatch("Short1!"), params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("At least 12 characters");
  });

  it("rejects common passwords regardless of meeting other criteria", async () => {
    const res = await adminUserPatch(makePatch("password1234"), params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Password is too common");
  });

  it("accepts strong, compliant passwords", async () => {
    const res = await adminUserPatch(makePatch("V3ry$ecureP@ssw0rd!"), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.passwordReset).toBe(true);
  });
});

// ── 3. Consistent RBAC Privilege Assignment (ADMIN_EMAILS) ───────────────────

describe("Security: RBAC Privilege Assignment via ADMIN_EMAILS", () => {
  const originalAdminEmails = process.env.ADMIN_EMAILS;

  afterEach(() => {
    if (originalAdminEmails !== undefined) {
      process.env.ADMIN_EMAILS = originalAdminEmails;
    } else {
      delete process.env.ADMIN_EMAILS;
    }
  });

  it("assigns isAdmin: true when email matches ADMIN_EMAILS", async () => {
    process.env.ADMIN_EMAILS = "alice@company.com, bob@corp.org";

    let capturedItem = null;
    docClient.send.mockImplementation((cmd) => {
      if (cmd.input?.Key?.PK === "INVITE#tok1") {
        return Promise.resolve({
          Item: {
            PK: "INVITE#tok1",
            email: "alice@company.com",
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        });
      }
      if (cmd.input?.Item && cmd.input.Item.PK.startsWith("USER#") && !cmd.input.Item.PK.includes("USERNAME")) {
        capturedItem = cmd.input.Item;
      }
      return Promise.resolve({ Items: [] });
    });

    const req = new Request("http://localhost/api/admin/invite/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: "tok1",
        username: "alice",
        password: "Str0ng!Passw0rd123",
      }),
    });

    const res = await inviteAcceptPost(req);
    expect(res.status).toBe(200);
    expect(capturedItem?.isAdmin).toBe(true);
  });

  it("assigns isAdmin: false when email does not match ADMIN_EMAILS", async () => {
    process.env.ADMIN_EMAILS = "alice@company.com";

    let capturedItem = null;
    docClient.send.mockImplementation((cmd) => {
      if (cmd.input?.Key?.PK === "INVITE#tok2") {
        return Promise.resolve({
          Item: {
            PK: "INVITE#tok2",
            email: "charlie@company.com",
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        });
      }
      if (cmd.input?.Item && cmd.input.Item.PK.startsWith("USER#") && !cmd.input.Item.PK.includes("USERNAME")) {
        capturedItem = cmd.input.Item;
      }
      return Promise.resolve({ Items: [] });
    });

    const req = new Request("http://localhost/api/admin/invite/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: "tok2",
        username: "charlie",
        password: "Str0ng!Passw0rd123",
      }),
    });

    const res = await inviteAcceptPost(req);
    expect(res.status).toBe(200);
    expect(capturedItem?.isAdmin).toBe(false);
  });
});

// ── 4. CSPRNG Entropy in Wheel Spins ────────────────────────────────────────

describe("Security: CSPRNG Entropy in Wheel Spins", () => {
  it("uses crypto.randomBytes for winner calculations", async () => {
    getSession.mockResolvedValue({ userId: "u1" });
    docClient.send
      .mockResolvedValueOnce({
        Item: {
          PK: "WHEEL#w1",
          wheelId: "w1",
          ownerId: "u1",
          categories: [
            { id: "c1", name: "Cat A", weight: 10 },
            { id: "c2", name: "Cat B", weight: 10 },
          ],
        },
      })
      .mockResolvedValueOnce({});

    const randomBytesSpy = jest.spyOn(crypto, "randomBytes");

    const req = new Request("http://localhost/api/wheels/w1/spin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ count: 1 }),
    });

    const res = await spinPost(req, { params: Promise.resolve({ id: "w1" }) });
    expect(res.status).toBe(200);
    expect(randomBytesSpy).toHaveBeenCalled();

    randomBytesSpy.mockRestore();
  });
});

// ── 5. Input Validation & Resource Bounds on Wheels API ─────────────────────

describe("Security: Input Validation & Resource Bounds on Wheels API", () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ userId: "u1" });
    docClient.send.mockResolvedValue({ Items: [] });
  });

  it("rejects wheel creation with name exceeding 100 characters", async () => {
    const req = new Request("http://localhost/api/wheels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "a".repeat(101),
        categories: [{ name: "Valid", weight: 10 }],
      }),
    });
    const res = await wheelsPost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/between 1 and 100/i);
  });

  it("rejects wheel creation with more than 50 categories", async () => {
    const excessiveCategories = Array.from({ length: 51 }, (_, i) => ({
      name: `Cat ${i}`,
      weight: 10,
    }));
    const req = new Request("http://localhost/api/wheels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Too Many Categories",
        categories: excessiveCategories,
      }),
    });
    const res = await wheelsPost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/up to 50/i);
  });

  it("rejects category with non-positive or excessive weight", async () => {
    const req = new Request("http://localhost/api/wheels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Invalid Weight",
        categories: [{ name: "Bad", weight: -5 }],
      }),
    });
    const res = await wheelsPost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/positive number/i);
  });

  it("rejects category with infinite or NaN weight", async () => {
    const req = new Request("http://localhost/api/wheels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "NaN Weight",
        categories: [{ name: "Bad", weight: NaN }],
      }),
    });
    const res = await wheelsPost(req);
    expect(res.status).toBe(400);
  });

  it("rejects sharing with an invalid role", async () => {
    docClient.send.mockResolvedValueOnce({
      Item: { PK: "WHEEL#w1", wheelId: "w1", ownerId: "u1" },
    });

    const req = new Request("http://localhost/api/wheels/w1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "share",
        payload: { identifier: "alice", role: "superadmin_hacker" },
      }),
    });

    const res = await wheelIdPut(req, { params: Promise.resolve({ id: "w1" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/role/i);
  });
});

// ── 6. Rate Limiting Tier Coverage in Proxy ──────────────────────────────────

describe("Security: Rate Limiting Tier Assignment in Proxy", () => {
  const makeNextRequest = (pathname) => {
    const { NextRequest } = require("next/server");
    return new NextRequest(`http://localhost${pathname}`, {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
  };

  const sensitiveAuthEndpoints = [
    "/api/auth/login",
    "/api/auth/signup",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/resend-verification",
    "/api/admin/invite/accept",
  ];

  sensitiveAuthEndpoints.forEach((endpoint) => {
    it(`classifies ${endpoint} under the strict auth-mutate rate limit tier`, () => {
      proxy(makeNextRequest(endpoint));
      const calls = checkRateLimit.mock.calls;
      const hasAuthMutate = calls.some(([key]) => key.startsWith("auth-mutate:"));
      expect(hasAuthMutate).toBe(true);
    });
  });
});

// ── 7. Defense-in-Depth Security Headers Configuration ───────────────────────

describe("Security: Defense-in-Depth HTTP Headers", () => {
  it("defines comprehensive security headers in next.config.mjs", async () => {
    const headersConfig = await nextConfig.headers();
    const globalRule = headersConfig.find((rule) => rule.source === "/(.*)");
    expect(globalRule).toBeDefined();

    const headers = globalRule.headers;
    const getHeader = (key) => headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

    expect(getHeader("x-frame-options")).toBe("DENY");
    expect(getHeader("x-content-type-options")).toBe("nosniff");
    expect(getHeader("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(getHeader("cross-origin-opener-policy")).toBe("same-origin");
    expect(getHeader("cross-origin-resource-policy")).toBe("same-origin");
    expect(getHeader("x-permitted-cross-domain-policies")).toBe("none");

    const csp = getHeader("content-security-policy");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
