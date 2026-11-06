# 2021familyforever

A complete, production-ready **installable Progressive Web App** for family member management,
contributions, payments, announcements, and notifications — with a separate **Member interface**
and **Admin panel**, powered by **Supabase** (PostgreSQL, Auth, Storage, RLS, Realtime).

---

## Quick Start

```bash
npm install
npm run dev        # development server (available on 0.0.0.0)
npm run build      # production build + service worker
npm run preview    # preview the production build on 0.0.0.0:4173
```

## Reports and access audit

The member reports page reads each signed-in member's own contribution status
and payments. Admins select one contribution to see its member payment
statuses, cumulative payments, balances, collection progress, charts, and
PDF export; report data refreshes when payments change. Statuses are based on
cumulative confirmed payments, so partial payments are included and a member
is fully paid once their total meets the required amount. Report access is
protected by route roles and Supabase row-level security. Application visit
and login audit records are stored in the `application_activity` table, which
only active admins can read. Admins can review and filter those records at
`/admin/activity`, including recent successful and failed logins and recent
member activity. Login credentials are never written to the audit table;
failed phone identifiers are masked. Login attempts are limited to eight
attempts per account and IP address per 15-minute window.

Before deploying the updated website, apply the current `supabase-schema.sql`
in the Supabase SQL Editor and deploy the login audit function:

```bash
npx supabase login
npx supabase link --project-ref khhntxdmmqqjsdnlqqpo
npx supabase functions deploy login-with-audit
```

Deploy the Edge Function before the website update because login attempts are
authenticated and audited by that function. It uses Supabase's built-in
`SUPABASE_URL`, `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`), and
`SUPABASE_SERVICE_ROLE_KEY` function secrets. The service-role key remains
server-side and must never be added to the website environment or source.

## Android app

The Android app is a Capacitor wrapper that loads the live website at
`https://2021familyforever-version-2-0-1.felisanod.workers.dev/`. Install
Android Studio, the Android SDK, and JDK 21, then run:

```bash
npm install
npx cap add android       # only needed the first time
npm run android:sync      # build the website and copy it into Android
npm run android:open      # open the native project in Android Studio
```

In Android Studio, select a device or emulator and run the `app` configuration.
The app requests notification permission only when enabled in the profile.
Android's system photo picker handles profile-picture selection without broad
photo or storage permissions.

Notifications use the site's existing Supabase Realtime feed while the app is
open. Delivering notifications while the app is closed requires a push provider
(such as Firebase Cloud Messaging) and backend delivery; granting Android
notification permission alone cannot provide background push.

### PWA assets

All branding assets are generated from the family photo in `icon/image.png`:

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

## Deploy to Cloudflare Workers

This Vite single-page app is deployed as static assets on a Cloudflare Worker.
[`wrangler.jsonc`](./wrangler.jsonc) points Wrangler to the built `dist/`
directory, configures SPA fallback for routes such as `/reports` and
`/profile`, and uses [`src/worker.ts`](./src/worker.ts) as the Worker entry
point to serve those assets.

In **Workers & Pages → your Worker → Settings → Build**, use:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Root directory | `/` |
| Git branch | The branch you want Cloudflare to deploy (for example `main`) |

Set the **Deploy command** to `npm run deploy`. Do not set it to
`npx wrangler versions upload`; that uploads a version rather than performing
the production deployment. If a separate **Version command** is required by
the Cloudflare project, set it to `npm run deploy:version`. The checked-in
Worker entry point and `ASSETS` binding allow that command to load the built
app instead of failing because there is no Worker script. Both npm scripts use
the project's pinned Wrangler version.

After changing Cloudflare build settings, deploy the latest commit from the
configured Git branch. A manual deployment of an older commit will not include
the Wrangler configuration or Worker entry point added for static assets.
Node `22` is pinned by `.nvmrc`. `public/_headers` is copied into `dist/` so
the service worker and web manifest are refreshed promptly after deployment.

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
- Responsive green-and-white neumorphic theme with soft raised/inset surfaces,
  accessible focus states, and matching contribution chart colors
- Mobile app shell with safe-area-aware Android-style app bars, touch-sized
  bottom navigation, standalone PWA metadata, and compact responsive charts
- Desktop sidebar layout, mobile bottom navigation (+ compact "More" menu for admins)
- Realtime notification badge, deep-linked notification center, mark-all-as-read
- Install prompt (real browser mechanism, dismiss remembered), offline indicator,
  branded splash/loading experience, push notification handlers (`public/push-sw.js`)
- Lazy-loaded routes, debounced search, pagination, accessible forms/dialogs/badges
  (status is never color-only)

## Environment

`src/services/supabase.ts` contains only the public URL + publishable key — safe for frontend
use. The secret key and access token must never be committed or shipped to clients.
