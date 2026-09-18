"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 200) {
        setError(data.error || "An unexpected error occurred.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, padding: "2rem" }}>
      <div className="glass-panel" style={{ width: "100%", maxWidth: "400px" }}>

        {submitted ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: "64px", height: "64px", borderRadius: "50%",
              background: "rgba(16,185,129,0.12)", marginBottom: "1.5rem",
            }}>
              <CheckCircle size={36} color="#10b981" />
            </div>
            <h2 style={{ color: "#10b981", marginBottom: "0.75rem" }}>Check Your Email</h2>
            <p style={{ marginBottom: "2rem" }}>
              If an account with <strong style={{ color: "var(--text-main)" }}>{email}</strong> exists,
              a password reset link has been sent. Check your inbox (and spam folder).
            </p>
            <Link href="/login" className="btn btn-outline" style={{ display: "inline-flex", gap: "0.5rem" }}>
              <ArrowLeft size={16} /> Back to Login
            </Link>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: "48px", height: "48px", borderRadius: "12px",
                background: "rgba(59,130,246,0.12)", marginBottom: "1rem",
              }}>
                <Mail size={24} style={{ color: "var(--accent-blue)" }} />
              </div>
              <h2 style={{ marginBottom: "0.25rem" }}>Forgot Password?</h2>
              <p style={{ fontSize: "0.9rem" }}>
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="fp-email" className="form-label">Email Address</label>
                <input
                  id="fp-email"
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              {error && <div className="form-error mb-4">{error}</div>}

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "0.5rem" }}
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>

            <p className="text-center mt-8">
              <Link href="/login" style={{ color: "var(--accent-blue)", display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.9rem" }}>
                <ArrowLeft size={14} /> Back to Login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
