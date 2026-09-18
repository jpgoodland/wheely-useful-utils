"use client";

import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { ArrowRight, Wrench } from "lucide-react";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <div
      className="text-center"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "1rem",
      }}
    >
      <div className="glass-panel" style={{ maxWidth: "800px", width: "100%" }}>
        <h1>Wheely Useful Utils!</h1>
        <p className="mb-8" style={{ fontSize: "1.15rem" }}>
          Your toolkit for randomised decision making — spin wheels, pick from
          lists, generate teams, and settle debates in seconds.
        </p>

        <div
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {user ? (
            <Link href="/dashboard" className="btn btn-primary">
              Go to Dashboard <ArrowRight size={18} />
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-outline">
                Login
              </Link>
              <Link href="/signup" className="btn btn-primary">
                Create Account <Wrench size={18} />
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
