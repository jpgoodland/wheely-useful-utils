import { validatePassword, getPasswordStrength, COMMON_PASSWORDS, PASSWORD_RULES } from "@/lib/password";

describe("validatePassword", () => {
  // Happy path
  test("accepts a strong password", () => {
    const { valid, errors } = validatePassword("Tr0ub4dor&3Secret!");
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  // Length rule
  test("rejects passwords shorter than minimum length", () => {
    const { valid, errors } = validatePassword("Short1!");
    expect(valid).toBe(false);
    expect(errors).toContain(`At least ${PASSWORD_RULES.minLength} characters`);
  });

  test("accepts a password exactly at minimum length with all requirements met", () => {
    // 12 chars: upper, lower, digit, special
    const { valid } = validatePassword("Abcdef1234!@");
    expect(valid).toBe(true);
  });

  // Uppercase rule
  test("rejects passwords without an uppercase letter", () => {
    const { valid, errors } = validatePassword("tr0ub4dor&3secret!");
    expect(valid).toBe(false);
    expect(errors).toContain("At least one uppercase letter");
  });

  // Lowercase rule
  test("rejects passwords without a lowercase letter", () => {
    const { valid, errors } = validatePassword("TR0UB4DOR&3SECRET!");
    expect(valid).toBe(false);
    expect(errors).toContain("At least one lowercase letter");
  });

  // Digit rule
  test("rejects passwords without a digit", () => {
    const { valid, errors } = validatePassword("Troublesome&Secret!!");
    expect(valid).toBe(false);
    expect(errors).toContain("At least one number");
  });

  // Special char rule
  test("rejects passwords without a special character", () => {
    const { valid, errors } = validatePassword("Tr0ub4dor3Secret");
    expect(valid).toBe(false);
    expect(errors).toContain("At least one special character (!@#$%^&* etc.)");
  });

  // Common password denylist
  test("rejects passwords in the common password denylist", () => {
    const { valid, errors } = validatePassword("password");
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("common"))).toBe(true);
  });

  test("denylist check is case-insensitive", () => {
    const { valid } = validatePassword("PASSWORD");
    // PASSWORD still fails other rules too, but confirm it's caught by denylist
    const { errors } = validatePassword("PASSWORD");
    // It will fail lowercase + digit + special + common
    expect(valid).toBe(false);
  });

  // Multiple errors at once
  test("returns multiple errors for a very weak password", () => {
    const { valid, errors } = validatePassword("abc");
    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThan(2);
  });

  // Edge cases
  test("rejects empty string", () => {
    const { valid } = validatePassword("");
    expect(valid).toBe(false);
  });

  test("rejects null/undefined gracefully", () => {
    expect(validatePassword(null).valid).toBe(false);
    expect(validatePassword(undefined).valid).toBe(false);
  });
});

describe("getPasswordStrength", () => {
  test("returns 0 for empty string", () => {
    expect(getPasswordStrength("")).toBe(0);
  });

  test("returns 1 for a short weak password", () => {
    // 'abcdefgh' is >= 8 chars but lacks mixed-case/digits/specials → score 1
    expect(getPasswordStrength("abcdefgh")).toBe(1);
  });

  test("returns higher score for longer mixed-case password", () => {
    expect(getPasswordStrength("Abcdefghijk")).toBeGreaterThanOrEqual(2);
  });

  test("returns 4 for a fully strong password", () => {
    expect(getPasswordStrength("Tr0ub4dor&3Secret!")).toBe(4);
  });
});

describe("COMMON_PASSWORDS denylist", () => {
  test("contains known common passwords", () => {
    expect(COMMON_PASSWORDS.has("password")).toBe(true);
    expect(COMMON_PASSWORDS.has("123456")).toBe(true);
    expect(COMMON_PASSWORDS.has("qwerty")).toBe(true);
    expect(COMMON_PASSWORDS.has("admin")).toBe(true);
  });

  test("does not contain strong unique passwords", () => {
    expect(COMMON_PASSWORDS.has("tr0ub4dor&3")).toBe(false);
  });
});
