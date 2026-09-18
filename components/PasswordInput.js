"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * A drop-in replacement for <input type="password"> with a reveal/hide toggle.
 * Accepts all standard input props via rest spread.
 *
 * @param {{ id?: string, value: string, onChange: Function, placeholder?: string, required?: boolean, autoComplete?: string, style?: object }} props
 */
export default function PasswordInput({ id, value, onChange, placeholder, required, autoComplete, style, ...rest }) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <input
        {...rest}
        id={id}
        type={visible ? "text" : "password"}
        className="form-input"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        style={{ paddingRight: "2.75rem", width: "100%", ...style }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          right: "0.75rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0.25rem",
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          transition: "color 0.15s ease",
          lineHeight: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-main)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
