"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";
import { validatePassword } from "@/lib/password";
import PasswordStrengthIndicator from "@/components/PasswordStrengthIndicator";
import SocialLoginButtons from "@/components/SocialLoginButtons";

export default function Signup() {
  const router = useRouter();
  const { loginStateLocally } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your first and last name.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address format.");
      return;
    }

    // Client-side password validation
    const { valid, errors: pwErrors } = validatePassword(password);
    if (!valid) {
      setError(pwErrors.join(", "));
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password, firstName, lastName }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error);
      } else {
        setSuccessMsg(data.message || "Please check your email to verify your account.");
        setEmail("");
        setUsername("");
        setFirstName("");
        setLastName("");
        setPassword("");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, padding: "2rem" }}>
      <div className="glass-panel" style={{ width: "100%", maxWidth: "400px" }}>
        <h2 className="text-center mt-4">Create Account</h2>
        
        <div style={{ marginTop: "2rem" }}>
          <SocialLoginButtons />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1.5rem 0" }}>
          <div style={{ flex: 1, height: "1px", background: "var(--glass-border)" }}></div>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>or sign up with email</span>
          <div style={{ flex: 1, height: "1px", background: "var(--glass-border)" }}></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div className="form-group" style={{ flex: 1, minWidth: "140px" }}>
              <label htmlFor="signup-firstname" className="form-label">First Name</label>
              <input 
                id="signup-firstname"
                type="text" 
                className="form-input" 
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
              />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: "140px" }}>
              <label htmlFor="signup-lastname" className="form-label">Last Name</label>
              <input 
                id="signup-lastname"
                type="text" 
                className="form-input" 
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="signup-email" className="form-label">Email</label>
            <input 
              id="signup-email"
              type="email" 
              className="form-input" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="signup-username" className="form-label">Username</label>
            <input 
              id="signup-username"
              type="text" 
              className="form-input" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="signup-password" className="form-label">Password</label>
            <PasswordInput
              id="signup-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              required
              autoComplete="new-password"
              placeholder="At least 12 characters"
            />
            <PasswordStrengthIndicator password={password} />
          </div>
          
          {error && <div className="form-error mb-4">{error}</div>}
          {successMsg && <div className="form-error mb-4" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#34d399", border: "1px solid #10b981" }}>{successMsg}</div>}
          
          <button type="submit" className="btn btn-primary w-100" style={{ width: "100%", marginTop: "1rem" }} disabled={loading}>
            {loading ? "Signing up..." : "Sign Up"}
          </button>
        </form>
        
        <p className="text-center mt-8">
          Already have an account? <Link href="/login" style={{ color: "var(--accent-blue)" }}>Login</Link>
        </p>
      </div>
    </div>
  );
}
