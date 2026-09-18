<!-- BEGIN:nextjs-agent-rules -->
# Wheely Useful Utils! — Agent Guidelines & Rules

Next.js 16 (App Router), React 19, Vanilla CSS (Glassmorphic dark UI), AWS DynamoDB.
This version of Next.js has breaking changes — APIs, conventions, and file structure may differ from older training data. Refer to `node_modules/next/dist/docs/` when needed.

## Key Commands
- Build: `npm run build`
- Dev: `npm run dev`
- Test: `npm test`
- Lint: `npm run lint`
- Docker: `docker compose up --build -d`

## Project Architecture & Directory Structure
- `/app`: Next.js 16 App Router (pages and API routes)
  - `/app/page.js`: Landing page (responsive hero, features overview, CTAs)
  - `/app/dashboard/`: Authenticated hub displaying dynamic feature cards
  - `/app/features/`: Modular feature pages
    - `/app/features/wheel/`: Probability wheel spinner (list & creator)
    - `/app/features/wheel/[id]/`: Individual wheel player and configuration
    - `/app/features/<feature-id>/`: Dedicated route for each registered feature
  - `/app/settings/`: Account & administration hub
    - `/app/settings/account/`: User profile, password management, account deletion
    - `/app/settings/admin/`: Admin user management (RBAC role-restricted to admins)
  - `/app/wheel/[id]/`: Backward-compatibility redirect stub to `/features/wheel/[id]`
  - `/app/api/`: REST API endpoints
    - `/app/api/wheels/`: CRUD for wheels & wheel spins
    - `/app/api/auth/`: Login, signup, logout, session verification, password reset, OAuth
    - `/app/api/admin/`: User management, invite by email, role assignments (admin-only)
- `/components`: Shared React UI components (Vanilla CSS)
  - `FeatureCard.js`: Dynamic card component rendering registry items with status badges and Lucide icons
  - `Navigation.js`: Top navbar with responsive mobile drawer/hamburger menu
  - `WheelSpinner.js`: Canvas/SVG-based interactive probability wheel
- `/lib`: Core utilities & state management
  - `featureRegistry.js`: Single source of truth for all application features
  - `dynamodb.js`: AWS DynamoDB client and table helpers
  - `auth.js`: JWT session helpers, password hashing/verification
  - `AuthContext.js`: React client context for auth state (`user`, `login`, `logout`)
- `/terraform`: AWS infrastructure configuration (ECS Fargate, ALB, DynamoDB)
- `/scripts`: Database seed, initialization, and migration scripts
- `/__tests__`: Jest integration and unit tests (mocked DynamoDB & router)

## Feature Registry Pattern: Adding New Features
Features are plug-and-play modules registered centrally in `lib/featureRegistry.js`.

### Step-by-Step Feature Implementation:
1. **Define in Registry (`lib/featureRegistry.js`)**:
   Add a descriptor object to `FEATURES`:
   ```javascript
   {
     id: "my-tool",                     // Unique URL-safe slug
     name: "My Tool Name",              // Human-readable title
     description: "What the tool does", // Short summary for dashboard card
     icon: "Calculator",                // Lucide icon name string
     href: "/features/my-tool",         // Route destination
     color: "#3b82f6",                  // Hex accent color
     status: "dev",                     // "dev" for WIP / development, "live" for production
     requiredRole: null,                // null or "admin" for RBAC
   }
   ```
2. **Register Lucide Icon (`components/FeatureCard.js`)**:
   - Import the corresponding icon from `lucide-react` and add to `ICON_MAP`.
   - Fallback icon is `Dices` if unmapped.
3. **Create the Route Page (`app/features/<id>/page.js`)**:
   - Wrap interactive content with `"use client"` if needed.
   - Include standard breadcrumb navigation (`Dashboard > Feature Name`).
   - Use `.glass-panel` and established styling patterns.
4. **Environment Visibility Rules**:
   - In development (`NODE_ENV !== 'production'`), `status: "dev"` features display on `/dashboard` with a "Coming Soon" badge.
   - In production (`NODE_ENV === 'production'`), `getVisibleFeatures()` automatically filters out `"dev"` items so only completed `"live"` features are visible to end users.
5. **Backend APIs**:
   - Place feature-specific endpoints in `app/api/<feature-id>/...`.
   - Validate session via `getCurrentUser()` or auth cookies where authenticated access is required.
6. **Testing**:
   - Write tests under `__tests__/` for any new utility logic, API routes, or React components.
   - Ensure `npm test` passes with 0 failures before completing changes.

## UI, Styling & Responsive Design Rules
- **STRICT: Vanilla CSS Only**: Do NOT install or use TailwindCSS unless explicitly requested by the user.
- **Design System Tokens (`app/globals.css`)**:
  - Dark glassmorphism theme using CSS variables (`--bg-color`, `--accent-blue`, `--accent-pink`, `--glass-bg`, `--glass-border`, `--glass-glow`).
  - Font: Inter (`font-family: 'Inter', sans-serif`).
- **Standard CSS Utility Classes**:
  - Layout & Containers: `.glass-panel`, `.page-header`, `.breadcrumb`
  - Grids: `.feature-grid`, `.wheels-grid`, `.settings-grid`
  - Buttons: `.btn`, `.btn-primary`, `.btn-outline`, `.btn-danger`
  - Forms: `.form-input`, `.form-group`
- **Mobile Responsiveness (MANDATORY)**:
  - Breakpoints:
    - Tablet: `@media (max-width: 768px)`
    - Phone: `@media (max-width: 480px)`
  - Header: Collapses into a hamburger drawer menu (`.hamburger`, `.nav-links.nav-open`) on screens `< 768px`.
  - Grids: `.feature-grid`, `.wheels-grid`, and `.settings-grid` collapse gracefully from multi-column to single-column on smaller screens.
  - Controls: Action bars, button groups, and form rows must use `flex-wrap: wrap` to prevent clipping or horizontal overflow.
  - Touch targets: Buttons and interactive elements must maintain at least 44px hit areas on touch devices.

## Role-Based Access Control (RBAC) & Settings
- User object contains `isAdmin: boolean`.
- Admin panel is located under `/settings/admin` (NOT `/admin`).
- Settings hub is at `/settings` with cards for "Account" and (if admin) "Administration".
- Client-side routes must redirect non-admin users to `/settings` or `/login`.
- Server API routes (`/api/admin/*`) MUST verify that the requesting user is authenticated and `isAdmin === true`.

## Testing & Quality Assurance
- Run `npm test` to verify all test suites pass.
- Run `npm run build` to verify Next.js compilation, type integrity, and production bundle generation.
- Mock external dependencies (DynamoDB client, Next.js navigation) in tests using standard Jest mocks.
<!-- END:nextjs-agent-rules -->


