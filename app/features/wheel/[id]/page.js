"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { WheelSpinner } from "@/components/WheelSpinner";
import { ChevronRight } from "lucide-react";

export default function WheelPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const [wheel, setWheel] = useState(null);
  const [error, setError] = useState("");

  const [lastWinners, setLastWinners] = useState([]);

  const fetchWheel = useCallback(async () => {
    try {
      const res = await fetch(`/api/wheels/${id}`);
      if (res.ok) {
        const data = await res.json();
        setWheel(data);
      } else {
        const d = await res.json();
        setError(d.error || "Failed to load wheel");
      }
    } catch (e) {
      setError("An error occurred loading the wheel");
    }
  }, [id]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    } else if (user) {
      fetchWheel();
    }
  }, [user, loading, router, fetchWheel]);

  const onSpinComplete = async (spinCount) => {
    setLastWinners([]);
    const res = await fetch(`/api/wheels/${id}/spin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: spinCount }),
    });
    if (res.ok) {
      const data = await res.json();
      const winners = data.winners;
      const newCategories = data.newCategories;

      return new Promise((resolve) => {
        resolve({ winners });

        setTimeout(() => {
          setWheel({ ...wheel, categories: newCategories });
          setLastWinners(winners);
        }, 4500);
      });
    } else {
      throw new Error("Spin failed backend validation");
    }
  };

  if (loading || !user) return null;
  if (error)
    return (
      <div className="text-center mt-8">
        <h2>{error}</h2>
      </div>
    );
  if (!wheel)
    return <div className="text-center mt-8">Loading...</div>;

  return (
    <div style={{ display: "flex", gap: "2rem", flexDirection: "column" }}>
      <nav className="breadcrumb">
        <Link href="/dashboard">Dashboard</Link>
        <ChevronRight size={14} className="separator" />
        <Link href="/features/wheel">Spin the Wheel</Link>
        <ChevronRight size={14} className="separator" />
        <span>{wheel.name}</span>
      </nav>

      <div className="flex justify-between align-center" style={{ flexWrap: "wrap" }}>
        <h2>{wheel.name}</h2>
      </div>

      <div
        style={{
          display: "grid",
          gap: "2rem",
        }}
        className="wheel-layout"
      >
        {/* Left Col - Spinner */}
        <div
          className="glass-panel"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {lastWinners.length > 0 && (
            <div
              className="mb-4"
              style={{
                background: "rgba(16, 185, 129, 0.2)",
                border: "1px solid #10b981",
                padding: "1rem",
                borderRadius: "12px",
                width: "100%",
                maxWidth: "500px",
                animation: "fadein 0.5s",
              }}
            >
              <h3
                style={{
                  margin: "0 0 0.5rem 0",
                  color: "#34d399",
                  textAlign: "center",
                }}
              >
                🎉 Winning Result{lastWinners.length > 1 ? "s" : ""} 🎉
              </h3>
              {lastWinners.length > 1 ? (
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: "1.5rem",
                    color: "#f8fafc",
                  }}
                >
                  {lastWinners.map((w, i) => (
                    <li key={i}>{w.name}</li>
                  ))}
                </ol>
              ) : (
                <p
                  style={{
                    textAlign: "center",
                    margin: 0,
                    fontWeight: "bold",
                  }}
                >
                  {lastWinners[0].name}
                </p>
              )}
            </div>
          )}

          <WheelSpinner
            categories={wheel.categories || []}
            onSpinComplete={onSpinComplete}
          />
        </div>

        {/* Right Col - Controls & Share */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            height: "100%",
          }}
        >
          <div
            className="glass-panel"
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
            }}
          >
            <h3 className="mb-4 text-center">Probabilities</h3>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                minHeight: 0,
              }}
            >
              {wheel.categories?.map((c) => {
                const total = wheel.categories.reduce(
                  (s, x) => s + x.weight,
                  0
                );
                const perc =
                  total > 0
                    ? ((c.weight / total) * 100).toFixed(1)
                    : 0;
                return (
                  <div
                    key={c.id}
                    className="flex justify-between align-center"
                    style={{
                      background: "rgba(0,0,0,0.2)",
                      padding: "0.5rem 1rem",
                      borderRadius: "8px",
                      flexWrap: "wrap",
                      gap: "0.25rem",
                    }}
                  >
                    <div className="flex align-center gap-4">
                      <div
                        style={{
                          width: "12px",
                          height: "12px",
                          borderRadius: "50%",
                          background: c.color,
                          flexShrink: 0,
                        }}
                      ></div>
                      <span style={{ wordBreak: "break-word" }}>{c.name}</span>
                    </div>
                    <div className="flex align-center gap-4">
                      <span
                        style={{ fontSize: "0.80rem", opacity: 0.8 }}
                      >
                        {c.selectedCount || 0} wins
                      </span>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          opacity: 0.8,
                          fontWeight: "bold",
                        }}
                      >
                        {perc}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                textAlign: "center",
                marginTop: "1.5rem",
              }}
            >
              (Go to{" "}
              <Link
                href="/features/wheel"
                style={{ color: "var(--accent-blue)" }}
              >
                Wheel Management
              </Link>{" "}
              to configure categories)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
