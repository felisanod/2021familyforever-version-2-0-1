# 2021familyforever

A complete, production-ready **installable Progressive Web App** for family member management,
contributions, payments, announcements, and notifications — with a separate **Member interface**
and **Admin panel**, powered by **Supabase** (PostgreSQL, Auth, Storage, RLS, Realtime).

---

## Quick Start

```bash
npm install
npm run dev        # development server
npm run build      # production build + service worker
npm run preview    # preview the production build
```

### PWA assets

All branding assets are generated from the family photo in `icon/image.jpeg`:

```bash
npx tsx generate-icons.ts
```

Generates app icons (192 / 512 / maskable / apple-touch), favicon, push-notification icons,
and iOS splash screens.

### Running the member-seed script

`seed-members.ts` uses Supabase's service-role key and must only run locally.
Create a `.env` file from `.env.example`, enter the service-role key there, and
never commit that file or the key.

---

## Deploy to Cloudflare Pages

This project is ready for Cloudflare Pages. It is a Vite single-page app, so
Cloudflare Pages will automatically serve `index.html` for app routes such as
`/updates` and `/profile` (as long as there is no top-level `404.html`).

1. Create a GitHub repository and push this project to its `main` branch.
2. In Cloudflare, go to **Workers & Pages → Create application → Pages → Import an existing Git repository**.
3. Select the repository and use these build settings:

   | Setting | Value |
   | --- | --- |
   | Framework preset | Vite |
   | Build command | `npm ci && npm run build` |
   | Build output directory | `dist` |
   | Node version | `22` (also pinned by `.nvmrc`) |

4. Select **Save and Deploy**. Cloudflare provides a secure `*.pages.dev` URL.
5. To use a custom domain, add it under **Pages → Custom domains** and follow
   Cloudflare's DNS instructions. HTTPS is automatic after the domain is active.

`public/_headers` is copied into `dist/_headers` during the build. It ensures
the service worker and web manifest are refreshed promptly after a deployment.

---

---

## Architecture

```
Presentation Layer  →  Pages / Components / Layouts
        ↓
Hooks & State       →  AuthContext · useNotifications · useDebounce · useOnlineStatus
        ↓
Services            →  members · contributions · payments · announcements · notifications · storage
        ↓
Supabase Client     →  src/services/supabase.ts (publishable key only)
        ↓
PostgreSQL + RLS    →  supabase-schema.sql
```

- **No database queries inside UI components** — all data access goes through `src/services/`.
- **Backend-authoritative logic** — payment recording, contribution closing, announcement
  publishing, and account status changes run inside PostgreSQL `security definer` functions.
- **No Campaign concept anywhere** — contributions exist independently.

## Key Workflows

**Payment assignment (the only path):**
Contributions → open a contribution → Manage Members → search member → select member →
Record Payment → backend validates → notification generated → UI refreshes.
There is no independent "Payments → Assign Payment" flow; the Payments page is history only.

**Announcement publishing:**
Create → audience selection (All Active Members / Region+City / Selected Members) → Preview
with recipient count → Publish → recipients resolved server-side → notifications fanned out →
members receive realtime badge updates.

## Database

Apply the full schema from the Supabase SQL Editor or Management API:

```
supabase-schema.sql   (idempotent — safe to re-run)
```

Tables: `profiles`, `contributions`, `payments`, `announcements`,
`announcement_recipients`, `notifications`, `device_tokens`.

Security model:
- Row Level Security on every table; members see only their own payments/notifications and
  published announcements addressed to them.
- Direct inserts into `payments` and `notifications` are blocked (`with check (false)`) —
  they can only be created by backend functions, which also generate notifications.
- A trigger prevents non-admins from changing their own role/account status.
- Storage buckets `profile-pictures` (owner-scoped writes) and `announcement-images`
  (admin-only writes).
- Realtime enabled for notifications, announcements, contributions, payments, profiles.

## Frontend

- React 19 + TypeScript + Vite + Tailwind CSS v4
- Warm light editorial design (indigo primary `#4F46E5`, coral secondary `#F97316`,
  off-white background `#F7F8FC`) — no dark/glass styling
- Desktop sidebar layout, mobile bottom navigation (+ compact "More" menu for admins)
- Realtime notification badge, deep-linked notification center, mark-all-as-read
- Install prompt (real browser mechanism, dismiss remembered), offline indicator,
  branded splash/loading experience, push notification handlers (`public/push-sw.js`)
- Lazy-loaded routes, debounced search, pagination, accessible forms/dialogs/badges
  (status is never color-only)

## Environment

`src/services/supabase.ts` contains only the public URL + publishable key — safe for frontend
use. The secret key and access token must never be committed or shipped to clients.
