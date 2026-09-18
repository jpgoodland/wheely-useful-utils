"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import { User, ShieldCheck, ChevronRight } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="text-center mt-8">Loading...</div>;
  }

  const settingsCards = [
    {
      id: "account",
      name: "Account",
      description: "Manage your profile and account settings.",
      icon: User,
      href: "/settings/account",
      color: "#3b82f6",
      show: true,
    },
    {
      id: "admin",
      name: "Administration",
      description: "Manage users, roles, and platform settings.",
      icon: ShieldCheck,
      href: "/settings/admin",
      color: "#ec4899",
      show: user.isAdmin,
    },
  ];

  return (
    <div>
      <nav className="breadcrumb">
        <Link href="/dashboard">Dashboard</Link>
        <ChevronRight size={14} className="separator" />
        <span>Settings</span>
      </nav>

      <div className="page-header">
        <h2>Settings</h2>
      </div>

      <div className="settings-grid">
        {settingsCards
          .filter((c) => c.show)
          .map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className="glass-panel"
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "flex",
                alignItems: "center",
                gap: "1.25rem",
                padding: "1.5rem",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "14px",
                  background: `${card.color}22`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <card.icon size={24} style={{ color: card.color }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>{card.name}</h3>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
                  {card.description}
                </p>
              </div>
              <ChevronRight
                size={20}
                style={{ marginLeft: "auto", opacity: 0.4, flexShrink: 0 }}
              />
            </Link>
          ))}
      </div>
    </div>
  );
}
