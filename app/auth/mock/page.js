"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Terminal, Shield, User, ArrowRight, XCircle, Mail } from "lucide-react";

function MockOAuthSandboxContent() {
  const searchParams = useSearchParams();
  const provider = searchParams.get("provider") || "google";
  const state = searchParams.get("state") || "";
  const redirectUri = searchParams.get("redirect_uri") || "";

  const [email, setEmail] = useState("user@example.com");
  const [customEmail, setCustomEmail] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const activeEmail = useCustom ? customEmail : email;

  const handleAuthorize = () => {
    if (!activeEmail || !activeEmail.includes("@")) {
      alert("Please enter a valid email address.");
      return;
    }

    const encodedEmail = btoa(activeEmail.toLowerCase());
    const mockCode = `mock-code-${provider}-${encodedEmail}`;

    // Redirect to the callback URL
    try {
      const callbackUrl = new URL(redirectUri);
      callbackUrl.searchParams.set("code", mockCode);
      callbackUrl.searchParams.set("state", state);
      window.location.href = callbackUrl.toString();
    } catch (e) {
      alert("Invalid redirect URI received. Cannot proceed.");
    }
  };

  const handleCancel = () => {
    window.location.href = `/login?error=access_denied`;
  };

  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

  return (
    <div className="sandbox-container">
      <style dangerouslySetInnerHTML={{__html: `
        .sandbox-container {
          display: flex;
          justify-content: center;
          align-items: center;
          flex: 1;
          padding: 2rem;
          position: relative;
        }
        .sandbox-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 520px;
          background: rgba(13, 18, 30, 0.45);
          border: 1px solid rgba(59, 130, 246, 0.2);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3), 0 0 30px rgba(59, 130, 246, 0.08);
          border-radius: 24px;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          padding: 2.5rem;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sandbox-card:hover {
          border-color: rgba(59, 130, 246, 0.35);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4), 0 0 50px rgba(59, 130, 246, 0.15);
        }
        .mock-option {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 1rem 1.25rem;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--glass-border);
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          user-select: none;
        }
        .mock-option:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-1px);
        }
        .mock-option.active-user {
          background: rgba(59, 130, 246, 0.08);
          border-color: var(--accent-blue);
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.15);
        }
        .mock-option.active-admin {
          background: rgba(16, 185, 129, 0.08);
          border-color: #10b981;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.15);
        }
        .mock-option.active-custom {
          background: rgba(236, 72, 153, 0.08);
          border-color: var(--accent-pink);
          box-shadow: 0 0 12px rgba(236, 72, 153, 0.15);
        }
        .provider-badge {
          text-transform: capitalize;
          font-weight: 600;
          padding: 0.25rem 0.6rem;
          border-radius: 6px;
          font-size: 0.75rem;
          letter-spacing: 0.02em;
        }
        .provider-badge.google {
          background: rgba(66, 133, 244, 0.12);
          color: #8ab4f8;
          border: 1px solid rgba(66, 133, 244, 0.25);
        }
        .provider-badge.microsoft {
          background: rgba(242, 80, 34, 0.12);
          color: #ff8f6b;
          border: 1px solid rgba(242, 80, 34, 0.25);
        }
        .provider-badge.github {
          background: rgba(255, 255, 255, 0.08);
          color: #e6edf3;
          border: 1px solid rgba(255, 255, 255, 0.15);
        }
      `}} />
      <div className="sandbox-card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "42px", height: "42px", borderRadius: "12px", background: "rgba(59, 130, 246, 0.15)", color: "var(--accent-blue)" }}>
            <Terminal size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, letterSpacing: "-0.01em" }}>OAuth Mock Sandbox</h2>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>Local Development & Testing Environment</p>
          </div>
        </div>

        <div style={{ background: "rgba(0, 0, 0, 0.2)", border: "1px solid var(--glass-border)", borderRadius: "12px", padding: "1rem", marginBottom: "1.5rem", fontSize: "0.85rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "0.5rem", alignItems: "center" }}>
            <span style={{ color: "var(--text-muted)" }}>Provider:</span>
            <div>
              <span className={`provider-badge ${provider}`}>{providerName}</span>
            </div>
            
            <span style={{ color: "var(--text-muted)" }}>State:</span>
            <span style={{ fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-main)" }} title={state}>{state || "none"}</span>
            
            <span style={{ color: "var(--text-muted)" }}>Redirect URI:</span>
            <span style={{ fontFamily: "monospace", fontSize: "0.75rem", wordBreak: "break-all", color: "var(--text-muted)" }}>{redirectUri || "none"}</span>
          </div>
        </div>

        <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "1.5rem", lineHeight: "1.5" }}>
          Simulating the consent flow. Select a test account profile to authorize and return to the application:
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <div
            className={`mock-option ${!useCustom && email === "user@example.com" ? "active-user" : ""}`}
            onClick={() => {
              setUseCustom(false);
              setEmail("user@example.com");
            }}
          >
            <input
              type="radio"
              name="profile"
              checked={!useCustom && email === "user@example.com"}
              readOnly
              style={{ accentColor: "var(--accent-blue)", cursor: "pointer" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
              <User size={16} style={{ color: "var(--accent-blue)", opacity: 0.9 }} />
              <div>
                <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>Standard User Account</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>user@example.com</div>
              </div>
            </div>
          </div>

          <div
            className={`mock-option ${!useCustom && email === "admin@example.com" ? "active-admin" : ""}`}
            onClick={() => {
              setUseCustom(false);
              setEmail("admin@example.com");
            }}
          >
            <input
              type="radio"
              name="profile"
              checked={!useCustom && email === "admin@example.com"}
              readOnly
              style={{ accentColor: "#10b981", cursor: "pointer" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
              <Shield size={16} style={{ color: "#10b981" }} />
              <div>
                <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>Administrator Account</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>admin@example.com</div>
              </div>
            </div>
          </div>

          <div
            className={`mock-option ${useCustom ? "active-custom" : ""}`}
            onClick={() => setUseCustom(true)}
          >
            <input
              type="radio"
              name="profile"
              checked={useCustom}
              readOnly
              style={{ accentColor: "var(--accent-pink)", cursor: "pointer" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Mail size={16} style={{ color: "var(--accent-pink)", opacity: 0.9 }} />
                <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Custom Email Profile</span>
              </div>
              {useCustom && (
                <input
                  type="email"
                  className="form-input"
                  placeholder="enter.any.email@domain.com"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  style={{
                    marginTop: "0.4rem",
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.85rem",
                    width: "100%",
                    borderRadius: "8px",
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid rgba(255, 255, 255, 0.1)"
                  }}
                  onClick={(e) => e.stopPropagation()}
                  required
                />
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
          <button onClick={handleCancel} className="btn btn-outline" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
            <XCircle size={16} /> Cancel
          </button>
          <button onClick={handleAuthorize} className="btn btn-primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
            Authorize & Continue <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MockOAuthSandbox() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, padding: "2rem" }}>
        <div className="glass-panel" style={{ width: "100%", maxWidth: "500px", padding: "3rem", textAlign: "center" }}>
          <h3>Loading Sandbox...</h3>
        </div>
      </div>
    }>
      <MockOAuthSandboxContent />
    </Suspense>
  );
}
