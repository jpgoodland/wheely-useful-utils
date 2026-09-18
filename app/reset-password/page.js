"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, CheckCircle, XCircle } from "lucide-react";
import { validatePassword } from "@/lib/password";
import PasswordStrengthIndicator from "@/components/PasswordStrengthIndicator";
import PasswordInput from "@/components/PasswordInput";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const userId = searchParams.get("userId");
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const [clientErrors, setClientErrors] = useState([]);

  // Missing link params
  if (!userId || !token) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, padding: "2rem" }}>
        <div className="glass-panel text-center" style={{ width: "100%", maxWidth: "440px", padding: "3rem 2rem" }}>
          <XCircle size={64} color="var(--accent-pink)" style={{ marginBottom: "1rem" }} />
          <h2 style={{ color: "var(--accent-pink)" }}>Invalid Reset Link</h2>
          <p style={{ margin: "1rem 0 2rem" }}>This password reset link is missing required parameters.</p>
          <Link href="/forgot-password" className="btn btn-primary" style={{ display: "inline-flex" }}>
            Request a New Link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setClientErrors([]);

    // Client-side validation
    const { valid, errors } = validatePassword(newPassword);
    if (!valid) {
      setClientErrors(errors);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, token, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "An unexpected error occurred.");
        // Allow retry unless token is definitively invalid/expired
      } else {
        setStatus("success");
        setTimeout(() => router.push("/login"), 3000);
      }
    } catch {
      setStatus("error");
      setErrorMsg("An unexpected network error occurred.");
    }
  };

  if (status === "success") {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, padding: "2rem" }}>
        <div className="glass-panel text-center" style={{ width: "100%", maxWidth: "440px", padding: "3rem 2rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <CheckCircle size={64} color="#10b981" style={{ marginBottom: "1rem" }} />
          <h2 style={{ color: "#10b981" }}>Password Updated!</h2>
          <p style={{ margin: "1rem 0 2rem" }}>Your password has been reset successfully. Redirecting you to login...</p>
          <Link href="/login" className="btn btn-primary" style={{ display: "inline-flex" }}>
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, padding: "2rem" }}>
      <div className="glass-panel" style={{ width: "100%", maxWidth: "440px" }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "48px", height: "48px", borderRadius: "12px",
            background: "rgba(59,130,246,0.12)", marginBottom: "1rem",
          }}>
            <KeyRound size={24} style={{ color: "var(--accent-blue)" }} />
          </div>
          <h2 style={{ marginBottom: "0.25rem" }}>Set New Password</h2>
          <p style={{ fontSize: "0.9rem" }}>Choose a strong password for your account.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="rp-new" className="form-label">New Password</label>
            <PasswordInput
              id="rp-new"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setClientErrors([]); setErrorMsg(""); }}
              placeholder="At least 12 characters"
              required
              autoComplete="new-password"
            />
            <PasswordStrengthIndicator password={newPassword} />
          </div>

          <div className="form-group">
            <label htmlFor="rp-confirm" className="form-label">Confirm New Password</label>
            <PasswordInput
              id="rp-confirm"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setErrorMsg(""); }}
              placeholder="Re-enter your new password"
              required
              autoComplete="new-password"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <span className="form-error" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                Passwords do not match
              </span>
            )}
          </div>

          {clientErrors.length > 0 && (
            <div className="form-error mb-4">
              <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                {clientErrors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}

          {errorMsg && (
            <div className="form-error mb-4">
              {errorMsg}{" "}
              {errorMsg.toLowerCase().includes("expired") && (
                <Link href="/forgot-password" style={{ color: "var(--accent-blue)" }}>
                  Request a new link
                </Link>
              )}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "0.5rem" }}
            disabled={status === "loading"}
          >
            {status === "loading" ? "Saving..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="text-center p-8 mt-8" style={{ color: "var(--text-muted)" }}>
        Loading...
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
