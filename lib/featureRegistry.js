/**
 * Feature Registry
 *
 * To add a new feature to the platform:
 *   1. Add an entry to the FEATURES array below
 *   2. Create a route at app/features/<id>/page.js
 *
 * Status values:
 *   "live"  — visible in all environments
 *   "dev"   — visible only when NODE_ENV !== "production"
 */

export const FEATURES = [
  {
    id: "wheel",
    name: "Spin the Wheel",
    description:
      "Create dynamic probability wheels, spin to randomly select options, and watch odds auto-adjust for fair distribution.",
    icon: "Dices",
    href: "/features/wheel",
    color: "#3b82f6",
    status: "live",
    requiredRole: null,
  },
  {
    id: "random-list",
    name: "Random List Picker",
    description:
      "Paste or build a list and instantly pick one or more random items — perfect for raffles, assignments, and giveaways.",
    icon: "ListChecks",
    href: "/features/random-list",
    color: "#8b5cf6",
    status: "dev",
    requiredRole: null,
  },
  {
    id: "team-generator",
    name: "Team Generator",
    description:
      "Split a roster into balanced teams randomly. Great for scrimmages, hackathons, and classroom groups.",
    icon: "Users",
    href: "/features/team-generator",
    color: "#10b981",
    status: "dev",
    requiredRole: null,
  },
  {
    id: "coin-flip",
    name: "Coin Flip",
    description:
      "A simple heads-or-tails coin flip with animated results — settles debates in seconds.",
    icon: "CircleDot",
    href: "/features/coin-flip",
    color: "#f59e0b",
    status: "dev",
    requiredRole: null,
  },
];

/**
 * Return features visible for the current environment.
 * In production only "live" features are shown.
 * In development all features are shown.
 */
export function getVisibleFeatures() {
  if (process.env.NODE_ENV === "production") {
    return FEATURES.filter((f) => f.status === "live");
  }
  return FEATURES;
}
