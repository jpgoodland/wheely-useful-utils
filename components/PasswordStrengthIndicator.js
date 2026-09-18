"use client";

import { validatePassword, getPasswordStrength, PASSWORD_RULES } from "@/lib/password";

/**
 * A reusable password strength indicator component.
 * Shows a coloured bar + checklist of unmet requirements.
 *
 * @param {{ password: string }} props
 */
export default function PasswordStrengthIndicator({ password }) {
  if (!password) return null;

  const strength = getPasswordStrength(password);
  const { errors } = validatePassword(password);

  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthColors = ["", "#ef4444", "#f59e0b", "#3b82f6", "#10b981"];
  const color = strengthColors[strength];
  const label = strengthLabels[strength];

  // Requirements checklist
  const requirements = [
    { label: `At least ${PASSWORD_RULES.minLength} characters`, met: password.length >= PASSWORD_RULES.minLength },
    { label: "Uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter", met: /[a-z]/.test(password) },
    { label: "Number", met: /[0-9]/.test(password) },
    { label: "Special character (!@#$%^&* etc.)", met: /[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|`~]/.test(password) },
    { label: "Not a common password", met: errors.every(e => !e.includes("common")) },
  ];

  return (
    <div className="password-strength-wrapper">
      {/* Bar */}
      <div className="strength-bar-track">
        {[1, 2, 3, 4].map((seg) => (
          <div
            key={seg}
            className="strength-bar-segment"
            style={{
              background: strength >= seg ? color : "rgba(255,255,255,0.08)",
              transition: "background 0.3s ease",
            }}
          />
        ))}
      </div>

      {/* Label */}
      {strength > 0 && (
        <div className="strength-label" style={{ color }}>
          {label}
        </div>
      )}

      {/* Checklist */}
      <ul className="strength-checklist">
        {requirements.map(({ label: reqLabel, met }) => (
          <li key={reqLabel} className={`strength-check-item ${met ? "met" : "unmet"}`}>
            <span className="check-icon">{met ? "✓" : "✗"}</span>
            {reqLabel}
          </li>
        ))}
      </ul>
    </div>
  );
}
