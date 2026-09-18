"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { FeatureCard } from "@/components/FeatureCard";
import { getVisibleFeatures } from "@/lib/featureRegistry";

export default function Dashboard() {
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

  const features = getVisibleFeatures();

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ marginBottom: "0.25rem" }}>
            Welcome, {user.firstName || user.username}
          </h2>
          <p style={{ fontSize: "0.95rem" }}>
            Choose a tool below to get started.
          </p>
        </div>
      </div>

      <div className="feature-grid">
        {features.map((feature) => (
          <FeatureCard key={feature.id} {...feature} />
        ))}
      </div>
    </div>
  );
}
