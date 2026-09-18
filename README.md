# Wheely Useful Utils! 🛠️

A modern, modular multi-tool web application built with **Next.js 16 (App Router)**, **React 19**, **Vanilla CSS (Glassmorphic dark design)**, and **AWS DynamoDB**.

Originally starting as a dynamic probability wheel spinner, the platform is architected to easily scale with new business and productivity tools through a central feature registry.

---

## Features & Capabilities

- 🎡 **Spin the Wheel**: Dynamic probability wheels with auto-adjusting odds for fair random selection.
- 📋 **Random List Picker** *(Dev)*: Quick item picker for raffles, giveaways, and decision making.
- 👥 **Team Generator** *(Dev)*: Split rosters into balanced, randomized teams.
- 🪙 **Coin Flip** *(Dev)*: Animated heads-or-tails flip for fast binary decisions.
- 👤 **Account & RBAC**: User authentication, profile management, and role-based access control with an administration panel (`/settings/admin`).
- 📱 **Mobile & Tablet Optimized**: Fully responsive glassmorphism interface with drawer navigation, adaptive grids, and touch-friendly controls.

---

## Architecture Overview

- **Feature Registry (`lib/featureRegistry.js`)**: Single source of truth defining available capabilities, routes, icons, and development statuses.
  - In development (`NODE_ENV !== "production"`), all features (including in-progress features with "Coming Soon" badges) are displayed on `/dashboard`.
  - In production, only completed `status: "live"` features are exposed.
- **Routing**:
  - `/` — Public landing page
  - `/dashboard` — Authenticated tool hub with dynamic feature cards
  - `/features/<id>` — Modular feature pages (e.g. `/features/wheel`, `/features/wheel/[id]`)
  - `/settings` — User settings hub
  - `/settings/account` — Profile and password management
  - `/settings/admin` — Admin panel for user management and email invites
- **Design System**: Strict Vanilla CSS with CSS custom properties (`app/globals.css`) and glassmorphic panels. No external CSS frameworks.

For detailed developer and agent instructions, see [AGENTS.md](file:///Users/jpgoodland/workspace/wheel-app/AGENTS.md).

---

## Adding a New Feature

1. **Register the feature** in `lib/featureRegistry.js`:
   ```javascript
   {
     id: "my-feature",
     name: "My Feature",
     description: "Describe what the tool does.",
     icon: "Wrench", // Lucide icon name
     href: "/features/my-feature",
     color: "#3b82f6",
     status: "dev", // "dev" for WIP, "live" for production
     requiredRole: null,
   }
   ```
2. **Register the icon** in `components/FeatureCard.js` (import from `lucide-react` and add to `ICON_MAP`).
3. **Create the page** at `app/features/<id>/page.js`.
4. The feature card will automatically appear on the `/dashboard`!

---

## Local Development (Docker)

```bash
# Start Next.js (port 3000) & local DynamoDB (port 8000) + auto-init tables
docker compose up --build -d

# View local logs (including console-printed email invites)
docker compose logs web -f

# Shut down the stack
docker compose down
```

## Local Development (Host Machine)

Requires Node v20+ and local `.env.local` configuration:
```env
NODE_ENV=development
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=fakeMyKeyId
AWS_SECRET_ACCESS_KEY=fakeSecretAccessKey
DYNAMODB_ENDPOINT=http://localhost:8000
JWT_SECRET=super_secret_local_key_for_jwt
OAUTH_MOCK=true
```

Commands:
```bash
npm install     # Install dependencies
npm run dev     # Start Next.js dev server (http://localhost:3000)
npm run build   # Build production application
npm test        # Run Jest test suite
npm run lint    # Run ESLint check
```

---

## AWS Deployment

Production deployment on ECS Fargate, ALB, and DynamoDB. Infrastructure configurations are maintained in [terraform/](file:///Users/jpgoodland/workspace/wheel-app/terraform).


