/**
 * Password validation rules and utilities.
 *
 * This module is intentionally free of server-only imports so it can be
 * safely imported by both API routes and client components.
 */

/**
 * The 100 most commonly used passwords that should be rejected outright,
 * regardless of whether they technically satisfy the complexity rules.
 * @type {Set<string>}
 */
export const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "password1234",
  "passw0rd", "p@ssword", "p@ssw0rd",
  "123456", "1234567", "12345678", "123456789", "1234567890",
  "111111", "000000", "123123", "654321", "121212", "112233",
  "qwerty", "qwerty123", "qwertyuiop", "qwerty1", "qwerty12",
  "abc123", "abcdef", "abcd1234",
  "letmein", "welcome", "welcome1", "welcome123",
  "monkey", "monkey1", "monkey123",
  "dragon", "dragon1",
  "master", "master1",
  "login", "login1",
  "admin", "admin1", "admin123", "administrator",
  "iloveyou", "iloveyou1",
  "sunshine", "sunshine1",
  "princess", "princess1",
  "shadow", "shadow1",
  "michael", "michael1",
  "jessica", "jessica1",
  "charlie", "charlie1",
  "donald", "donald1",
  "superman", "superman1",
  "batman", "batman1",
  "trustno1",
  "football", "football1",
  "baseball", "baseball1",
  "soccer", "hockey",
  "starwars", "starwars1",
  "whatever", "whatever1",
  "hello", "hello123",
  "hunter", "hunter2",
  "flower", "flower1",
  "access", "access1",
  "secret", "secret1",
  "mustang", "mustang1",
  "696969", "1q2w3e", "1q2w3e4r",
  "zxcvbnm", "asdfghjkl",
  "changeme", "changeme1",
  "newpass", "newpassword",
  "temp", "temp123", "temppass",
  "test", "test123", "testing",
  "pass", "pass1", "pass123",
  "user", "user123",
]);

/**
 * Password requirements (exported so the UI can display them consistently).
 */
export const PASSWORD_RULES = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: true,
};

const SPECIAL_CHAR_RE = /[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|`~]/;

/**
 * Validate a password against all rules.
 *
 * @param {string} password
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePassword(password) {
  const errors = [];

  if (!password || password.length < PASSWORD_RULES.minLength) {
    errors.push(`At least ${PASSWORD_RULES.minLength} characters`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("At least one uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("At least one lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("At least one number");
  }

  if (!SPECIAL_CHAR_RE.test(password)) {
    errors.push("At least one special character (!@#$%^&* etc.)");
  }

  if (password && COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push("Password is too common — choose a more unique password");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Compute a simple strength score (0–4) for UI display purposes.
 * This is intentionally lenient — it rewards entropy, not rule compliance.
 *
 * @param {string} password
 * @returns {0|1|2|3|4}  0=empty, 1=weak, 2=fair, 3=good, 4=strong
 */
export function getPasswordStrength(password) {
  if (!password) return 0;

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= PASSWORD_RULES.minLength) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password) && SPECIAL_CHAR_RE.test(password)) score++;

  return /** @type {0|1|2|3|4} */ (Math.min(score, 4));
}
