"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";
import SocialLoginButtons from "@/components/SocialLoginButtons";

const OAUTH_ERROR_MESSAGES = {
  oauth_failed: "Social login failed. Please try again or log in with your email and password.",
  invalid_state: "Login session expired or invalid. Please try again.",
  unsupported_provider: "The selected login provider is not supported.",
  no_email: "Unable to retrieve your email from the social login provider.",
  missing_params: "Incomplete response from the social login provider. Please try again.",
  access_denied: "Sign in was cancelled or access was denied by the provider.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginStateLocally } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Resend verification state
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  const errorParam = searchParams.get("error");
  const urlError = errorParam ? (OAUTH_ERROR_MESSAGES[errorParam] || errorParam) : "";
  const displayError = error || urlError;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setShowResend(false);
    setResendMsg("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error);
        // Show resend option when the account is unverified (403)
        if (res.status === 403) {
          setShowResend(true);
          // Pre-fill email field if the identifier looks like an email
          if (identifier.includes("@")) {
            setResendEmail(identifier);
          }
        }
      } else {
        loginStateLocally({
          userId: data.userId,
          username: data.username,
          firstName: data.firstName || null,
          lastName: data.lastName || null,
          isAdmin: data.isAdmin,
        });
        router.push("/dashboard");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (e) => {
    e.preventDefault();
    setResendLoading(true);
    setResendMsg("");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setResendMsg(data.error || "Failed to send email. Please try again.");
      } else {
        setResendMsg("Verification email sent! Check your inbox (and spam folder).");
      }
    } catch {
      setResendMsg("Failed to connect. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, padding: "2rem" }}>
      <div className="glass-panel" style={{ width: "100%", maxWidth: "400px" }}>
        <h2 className="text-center mt-4">Welcome Back</h2>
        
        <div style={{ marginTop: "2rem" }}>
          <SocialLoginButtons />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1.5rem 0" }}>
          <div style={{ flex: 1, height: "1px", background: "var(--glass-border)" }}></div>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>or continue with email</span>
          <div style={{ flex: 1, height: "1px", background: "var(--glass-border)" }}></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-identifier" className="form-label">Email or Username</label>
            <input 
              id="login-identifier"
              type="text" 
              className="form-input" 
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor="login-password" className="form-label" style={{ marginBottom: 0 }}>Password</label>
              <Link
                href="/forgot-password"
                style={{ fontSize: "0.8rem", color: "var(--accent-blue)", textDecoration: "none" }}
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{ marginTop: "0.5rem" }}
            />
          </div>
          
          {displayError && <div className="form-error mb-4">{displayError}</div>}

          {/* Resend verification inline panel */}
          {showResend && (
            <div style={{
              background: "rgba(59,130,246,0.08)",
              border: "1px solid rgba(59,130,246,0.25)",
              borderRadius: "10px",
              padding: "1rem",
              marginBottom: "1rem",
            }}>
              <p style={{ fontSize: "0.85rem", marginBottom: "0.75rem", color: "var(--text-main)" }}>
                Didn&apos;t receive the verification email?
              </p>
              <form onSubmit={handleResend} style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="email"
                  className="form-input"
                  style={{ flex: 1, fontSize: "0.85rem", padding: "0.5rem 0.75rem" }}
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
                <button
                  type="submit"
                  className="btn btn-outline"
                  style={{ fontSize: "0.8rem", padding: "0.5rem 0.9rem", whiteSpace: "nowrap" }}
                  disabled={resendLoading}
                >
                  {resendLoading ? "Sending..." : "Resend"}
                </button>
              </form>
              {resendMsg && (
                <p style={{ fontSize: "0.8rem", marginTop: "0.5rem", color: "#34d399" }}>{resendMsg}</p>
              )}
            </div>
          )}
          
          <button type="submit" className="btn btn-primary w-100" style={{ width: "100%", marginTop: "1rem" }} disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        
        <p className="text-center mt-8">
          Don&apos;t have an account? <Link href="/signup" style={{ color: "var(--accent-blue)" }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, padding: "2rem" }}>Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
