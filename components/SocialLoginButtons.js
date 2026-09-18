"use client";

/**
 * Social login buttons for Google, Microsoft, and GitHub.
 *
 * Each button links to /api/auth/oauth/<provider> which initiates the
 * server-side OAuth flow. No client-side JS is needed — the redirect
 * happens naturally.
 */

const providers = [
  {
    name: "Google",
    slug: "google",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-1.14 2.77-2.4 3.61v3h3.86c2.26-2.09 3.59-5.17 3.59-8.46z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.21v3.11C3.18 21.88 7.39 24 12 24z"
        />
        <path
          fill="#FBBC05"
          d="M5.27 14.29c-.25-.72-.39-1.5-.39-2.29s.14-1.57.39-2.29V6.6H1.21A11.94 11.94 0 0 0 0 12c0 1.92.45 3.74 1.21 5.39l4.06-3.1z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.39 0 3.18 2.12 1.21 5.39l4.06 3.11c.95-2.85 3.6-4.96 6.73-4.96z"
        />
      </svg>
    ),
    bgColor: "rgba(255, 255, 255, 0.06)",
    hoverBg: "rgba(255, 255, 255, 0.12)",
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  {
    name: "Microsoft",
    slug: "microsoft",
    icon: (
      <svg width="20" height="20" viewBox="0 0 23 23">
        <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
        <rect x="12" y="1" width="10" height="10" fill="#7fba00"/>
        <rect x="1" y="12" width="10" height="10" fill="#00a4ef"/>
        <rect x="12" y="12" width="10" height="10" fill="#ffb900"/>
      </svg>
    ),
    bgColor: "rgba(255, 255, 255, 0.06)",
    hoverBg: "rgba(255, 255, 255, 0.12)",
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  {
    name: "GitHub",
    slug: "github",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
      </svg>
    ),
    bgColor: "rgba(255, 255, 255, 0.06)",
    hoverBg: "rgba(255, 255, 255, 0.12)",
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
];

export default function SocialLoginButtons() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {providers.map((p) => (
        <a
          key={p.slug}
          id={`social-login-${p.slug}`}
          href={`/api/auth/oauth/${p.slug}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            padding: "0.75rem 1rem",
            borderRadius: "12px",
            background: p.bgColor,
            border: `1px solid ${p.borderColor}`,
            color: "var(--text-main)",
            textDecoration: "none",
            fontWeight: 500,
            fontSize: "0.95rem",
            fontFamily: "inherit",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = p.hoverBg;
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = p.bgColor;
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {p.icon}
          Continue with {p.name}
        </a>
      ))}
    </div>
  );
}
