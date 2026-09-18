"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, UserPlus, Loader2 } from "lucide-react";
import { validatePassword } from "@/lib/password";
import PasswordStrengthIndicator from "@/components/PasswordStrengthIndicator";
import PasswordInput from "@/components/PasswordInput";

function InviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const hasToken = Boolean(token);

  const [inviteData, setInviteData] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Derive initial error/loading from token presence so effect body stays async-only
  const [error, setError] = useState(hasToken ? "" : "No invitation token provided.");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(hasToken);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!hasToken) return; // error state already set from initial useState

    fetch(`/api/admin/invite/accept?token=${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setInviteData(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to validate invitation.");
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const { valid, errors: pwErrors } = validatePassword(password);
    if (!valid) {
      setError(pwErrors.join(", "));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username, password, firstName, lastName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        setSuccess(data.message);
        setTimeout(() => router.push("/login"), 2000);
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, padding: "2rem" }}>
        <div className="glass-panel text-center" style={{ width: "100%", maxWidth: "440px", padding: "3rem 2rem" }}>
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite", margin: "0 auto 1rem" }} />
          <p>Validating your invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !inviteData) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, padding: "2rem" }}>
        <div className="glass-panel text-center" style={{ width: "100%", maxWidth: "440px", padding: "3rem 2rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>😔</div>
          <h2>Invalid Invitation</h2>
          <p style={{ marginTop: "0.5rem" }}>{error}</p>
          <Link href="/signup" className="btn btn-primary" style={{ marginTop: "1.5rem", display: "inline-flex" }}>
            Sign Up Instead
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, padding: "2rem" }}>
      <div className="glass-panel" style={{ width: "100%", maxWidth: "440px" }}>
        <div className="text-center" style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "48px", height: "48px", borderRadius: "12px", background: "rgba(59,130,246,0.15)", marginBottom: "0.75rem" }}>
            <Mail size={24} style={{ color: "var(--accent-blue)" }} />
          </div>
          <h2 style={{ margin: "0.5rem 0 0.25rem" }}>You&apos;re Invited!</h2>
          <p style={{ fontSize: "0.9rem", margin: 0 }}>
            <span style={{ fontWeight: 500, color: "var(--text-main)" }}>{inviteData?.invitedBy}</span> has invited you to join Spin the Wheel
          </p>
        </div>

        <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "10px", padding: "0.75rem 1rem", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
          <span style={{ color: "var(--text-muted)" }}>Email: </span>
          <span style={{ fontWeight: 500 }}>{inviteData?.email}</span>
        </div>

        {success ? (
          <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid #10b981", borderRadius: "10px", padding: "1rem", textAlign: "center" }}>
            <p style={{ color: "#34d399", fontWeight: 500, margin: 0 }}>{success}</p>
            <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>Redirecting to login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <div className="form-group" style={{ flex: 1, minWidth: "140px" }}>
                <label className="form-label">First Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  autoComplete="given-name"
                />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: "140px" }}>
                <label className="form-label">Last Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <PasswordInput
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="At least 12 characters"
                required
                autoComplete="new-password"
              />
              <PasswordStrengthIndicator password={password} />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                autoComplete="new-password"
              />
            </div>

            {error && <div className="form-error mb-4">{error}</div>}

            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "0.5rem" }} disabled={submitting}>
              <UserPlus size={18} /> {submitting ? "Creating Account..." : "Create Account"}
            </button>
          </form>
        )}

        <p className="text-center mt-8">
          Already have an account? <Link href="/login" style={{ color: "var(--accent-blue)" }}>Login</Link>
        </p>
      </div>
    </div>
  );
}

export default function InviteSignup() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, padding: "2rem" }}>
        <div className="glass-panel text-center" style={{ width: "100%", maxWidth: "440px", padding: "3rem 2rem" }}>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <InviteForm />
    </Suspense>
  );
}
