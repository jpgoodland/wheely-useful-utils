"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";

function VerifyContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const token = searchParams.get("token");

  const paramsOk = Boolean(userId && token);

  // Derive initial state from URL params so we never call setState
  // synchronously inside an effect body.
  const [status, setStatus] = useState(paramsOk ? "loading" : "error");
  const [message, setMessage] = useState(
    paramsOk ? "Verifying your email address..." : "Invalid verification link. Missing parameters."
  );

  // Resend verification state
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [showResend, setShowResend] = useState(!paramsOk);

  useEffect(() => {
    if (!paramsOk) return; // already in error state from initial useState

    const verify = async () => {
        try {
            const res = await fetch("/api/auth/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, token })
            });
            const data = await res.json();
            if (res.ok) {
                setStatus("success");
                setMessage("Your email has been verified! You can now log into your account.");
            } else {
                setStatus("error");
                setMessage(data.error || "Failed to verify email address.");
                setShowResend(true);
            }
        } catch(e) {
            setStatus("error");
            setMessage("An unexpected network error occurred.");
            setShowResend(true);
        }
    };

    verify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        setResendMsg("A new verification link has been sent! Check your inbox (and spam folder).");
      }
    } catch {
      setResendMsg("Failed to connect. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, padding: "2rem" }}>
      <div className="glass-panel text-center" style={{ width: "100%", maxWidth: "450px", padding: "3rem 2rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
        
        {status === "loading" && (
            <div className="flex flex-col align-center gap-4 text-center">
                <div style={{ padding: "1rem", color: "var(--text-muted)" }}>Testing verification token...</div>
                <h3 style={{ margin: 0, marginTop: "1rem" }}>{message}</h3>
            </div>
        )}
        
        {status === "success" && (
            <div className="flex flex-col align-center gap-4 text-center" style={{ width: "100%", alignItems: "center" }}>
                <CheckCircle size={64} color="#10b981" style={{ marginBottom: "1rem" }} />
                <h2 style={{ margin: 0, color: "#10b981" }}>Email Verified!</h2>
                <p style={{ color: "var(--text-muted)", marginBottom: "2rem", marginTop: "1rem" }}>{message}</p>
                <Link href="/login" className="btn btn-primary" style={{ display: "flex", justifyContent: "center", width: "100%", fontSize: "1.1rem" }}>
                    Proceed to Login
                </Link>
            </div>
        )}

        {status === "error" && (
            <div className="flex flex-col align-center gap-4 text-center" style={{ width: "100%", alignItems: "center" }}>
                <XCircle size={64} color="var(--accent-pink)" style={{ marginBottom: "1rem" }} />
                <h2 style={{ margin: 0, color: "var(--accent-pink)" }}>Verification Failed</h2>
                <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem", marginTop: "1rem" }}>{message}</p>

                {showResend && (
                  <div style={{
                    width: "100%",
                    background: "rgba(59,130,246,0.08)",
                    border: "1px solid rgba(59,130,246,0.25)",
                    borderRadius: "10px",
                    padding: "1.25rem",
                    marginBottom: "1rem",
                    textAlign: "left",
                  }}>
                    <p style={{ fontSize: "0.875rem", marginBottom: "0.75rem", color: "var(--text-main)" }}>
                      Need a new verification link? Enter your email below:
                    </p>
                    <form onSubmit={handleResend} style={{ display: "flex", gap: "0.5rem" }}>
                      <input
                        type="email"
                        className="form-input"
                        style={{ flex: 1, fontSize: "0.875rem", padding: "0.5rem 0.75rem" }}
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        id="verify-resend-email"
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

                <Link href="/login" className="btn btn-outline" style={{ display: "flex", justifyContent: "center", width: "100%", fontSize: "1.1rem" }}>
                    Return to Login
                </Link>
            </div>
        )}

      </div>
    </div>
  );
}

export default function VerifyPage() {
    return (
        <Suspense fallback={<div className="text-center p-8 mt-8" style={{ color: "var(--text-muted)" }}>Loading verification constraints...</div>}>
            <VerifyContent />
        </Suspense>
    );
}
