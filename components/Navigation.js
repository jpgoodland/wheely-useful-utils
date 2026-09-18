"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { LogOut, LayoutDashboard, Settings, Menu, X } from "lucide-react";

export function Navigation() {
  const { user, logoutLocally } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="header">
      <Link href="/" className="logo">
        <span style={{ fontSize: "1.8rem" }}>🛠️</span> Wheely Useful Utils!
      </Link>

      <button
        className="hamburger"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        {menuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <nav className={`nav-links${menuOpen ? " nav-open" : ""}`}>
        {user ? (
          <>
            <span className="nav-link" style={{ pointerEvents: "none" }}>
              Hi, {user.firstName || user.username}
            </span>
            <Link
              href="/dashboard"
              className="nav-link"
              onClick={() => setMenuOpen(false)}
            >
              <LayoutDashboard
                size={20}
                style={{ verticalAlign: "middle", marginRight: "4px" }}
              />
              Dashboard
            </Link>
            <Link
              href="/settings"
              className="nav-link"
              onClick={() => setMenuOpen(false)}
            >
              <Settings
                size={20}
                style={{ verticalAlign: "middle", marginRight: "4px" }}
              />
              Settings
            </Link>
            <button
              onClick={() => {
                logoutLocally();
                setMenuOpen(false);
              }}
              className="btn btn-outline"
              style={{ padding: "0.4rem 1rem", fontSize: "0.875rem" }}
            >
              <LogOut size={16} /> Logout
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="nav-link"
              onClick={() => setMenuOpen(false)}
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="btn btn-primary"
              style={{ padding: "0.5rem 1.25rem" }}
              onClick={() => setMenuOpen(false)}
            >
              Sign Up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
