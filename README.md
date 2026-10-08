# LSE Spots

> **Student-built, not affiliated with LSE. Estimates only.**  
> An unofficial, mobile-first web app that tells LSE students, in two seconds, where study seats are available right now.

LSE has no occupancy sensors. The app combines:
1. **Proof-of-presence QR codes** placed at physical study zones.
2. **One-tap crowdsourced reports** (zero accounts, no sign-up, submitted in under 3 seconds).
3. **Statistical predictions** calculated from historical reports per academic bucket (teaching weeks, reading weeks, exam periods, vacations) with exponential decay.

---

## 🎯 The Two Entry Points

The product adheres strictly to two entry points, each with one single job:
1. **Opening the website (`/`)**: Instantly see the answer under the header: *"5 spaces have seats"*. Progressive disclosure reveals attributes and hourly charts only when a row is tapped.
2. **Scanning a QR code at a study spot (`/z/[slug]?t=<token>`)**: 3 huge stacked buttons in the mobile thumb zone ($\ge 96\text{px}$ tall): *"Plenty of seats"*, *"Filling up"*, *"Full"*. Tap once to submit immediately.

---

## 🕒 Root Cause & Resolution of the 11:46 Wednesday Bug

### The Problem
A live screenshot taken at 11:46 on a Wednesday showed active zones listed as *"Closed now ... (opens 08:00)"*.

### Root Causes
1. **Timezone Evaluation**: The server was running in UTC. During British Summer Time (BST = UTC+1), an 11:46 London request evaluated as 10:46 UTC. Earlier functions that inspected client-side or machine-local dates caused day-of-week and hour shifts.
2. **JavaScript Sunday=0 Indexing**: Standard JS `Date.prototype.getDay()` returns `0` for Sunday and `1` for Monday. When mapping to weekday index arrays without explicit key normalization (`mon..sun`), weekday intervals were shifted by one full day.
3. **String Time Comparisons & Midnight Handling**: String time comparisons treated `'00:00'` as start-of-day rather than end-of-day (closing at midnight), incorrectly flagging evening and overnight intervals as closed.
4. **Hardcoded Fallback**: When an opening interval lookup failed, the system fell back to a hardcoded string `opensAt: '08:00'`, hiding the actual schedule.

### The Fix
- Created a pure, deterministic opening hours engine in `src/lib/algo/opening-hours.ts` (`getOpenState`).
- All calculations are evaluated strictly on the **server** in the `Europe/London` timezone using **Luxon** (`DateTime.setZone('Europe/London')`).
- Handled:
  - Multi-interval opening per day (e.g. `[{"open": "08:00", "close": "12:00"}, {"open": "14:00", "close": "22:00"}]`).
  - 24-hour continuous opening (`"00:00"` to `"24:00"`).
  - Overnight spillover intervals where `close < open` (e.g. `18:00` to `02:00` next morning).
  - Date-specific `opening_exceptions` table (bank holidays, maintenance, exam hours extension).
  - Clock change transitions (BST start in March and BST end in October 2026).
- All API responses return `serverTime` (ISO UTC) so the client corrects freshness relative to real server time regardless of the device clock.

---

## 📅 Academic Term & Exam Calendar (Predictions)

Seat availability patterns differ dramatically between regular teaching weeks, reading weeks, revision/exam periods, and vacations.

### Data Model & Period Derivation
- `academic_periods`: `id`, `academic_year`, `name`, `type` (`teaching` | `reading` | `exam` | `vacation`), `start_date`, `end_date`, `notes`.
- `getPeriod(date)`: Evaluated in `Europe/London`. Derives a 1-based, Monday-start `termWeek` for `teaching` periods.
  - Weeks 1–3: `early`
  - Weeks 4–7: `mid`
  - Weeks 8+: `late`
  - Non-teaching periods (`reading`, `exam`, `vacation`) override teaching periods and set `bucket = type`.

### 5-Step Prediction Fallback Chain
Requires $n \ge 5$ reports at each step before falling back:
1. `zone + bucket + weekday + hour`
2. `zone + bucket + hour` (across all weekdays)
3. `zone + weekday + hour` (across all buckets) + *multiplier*
4. `zone + hour` (across all weekdays and buckets) + *multiplier*
5. `zone-type default synthetic curve` + *multiplier*

### Cold-Start Multipliers
When falling back from a bucket with no data (steps 3–5), an admin-configurable multiplier is applied and clamped strictly to $[0.0, 2.0]$:
- `exam`: `1.15` (spaces fill up earlier and stay fuller)
- `reading`: `1.10`
- `vacation`: `0.60`
- `teaching`: `1.00`
- Multipliers are **never** applied when real historical data exists (steps 1 and 2).

### Exam Notice
During the `exam` bucket, an extra line appears in the expanded accordion row:
*"It's exam period, so spaces fill up earlier."*

### Loading Official LSE Term Dates
> [!IMPORTANT]
> **Action Required Before Public Launch**:
> Copy the official term dates from LSE's published academic calendar and verify them before launch.

1. Open `data/academic-periods.template.csv`.
2. Verify or update dates from [LSE Academic Calendar](https://info.lse.ac.uk/current-students/term-dates).
3. Seed into the database:
```bash
npm run seed-calendar
# Or specify a custom CSV:
npx tsx scripts/seed-calendar.ts data/academic-periods.template.csv
```
4. Or use the web interface at `/admin/calendar` to import CSVs or edit periods directly.

---

## 🔒 Privacy & UK GDPR Compliance

### Route `/privacy`
A plain-English privacy notice written for a general reading age (no dense legal jargon), divided into 9 short sections:
1. **Who runs this**: Student project, independent and not affiliated with LSE. Contact: `privacy@lsespots.app`.
2. **What we collect**: Table detailing space reported, busyness level, UTC time, pseudonymous device hash, and temporary 24h spam hash.
3. **What we do not collect**: No names, emails, LSE credentials, precise GPS locations, camera, microphone, photos, or contacts. No user accounts.
4. **Why we collect it**: Legitimate interests (seat availability & anti-spam).
5. **How long we keep it**: Reports permanently deleted after 12 months; spam hashes after 24 hours; suggestion events after 7 days.
6. **Who else handles it**: Vercel (London / EU), Supabase (London / EU), Cloudflare Turnstile, cookieless analytics.
7. **Cookies & storage**: One random local storage token (`lse_client_random_id`) strictly necessary for anti-spam rate limiting under UK PECR. No cookie pop-ups.
8. **Your rights**: Access, rectify, delete data; lodge complaint with ICO (`ico.org.uk`).
9. **Changes & last updated**: Updated October 2026.

### "Delete my reports from this device" Feature
- Self-service button on `/privacy`.
- Calls `POST /api/privacy/delete` transmitting `client_random_id`.
- The server hashes the ID with the secret salt, deletes all matching reports and recommendation events from the database, and returns the deleted count.
- Rate-limited to 5 requests per hour per IP hash. Raw IDs are never logged.
- Clears `lse_client_random_id` from local storage upon completion.

### Automated Retention Purge
- Automated scheduled endpoint: `GET /api/cron/retention`.
- Purges raw reports $> 12$ months, recommendation events $> 7$ days, and rate-limit hashes $> 24$ hours.
- Only logs aggregate counts; never logs personal data.
- Full details documented in [`docs/privacy-notes.md`](./docs/privacy-notes.md).

---

## 🛠️ Admin Control Room

- `/admin`: Manage zones, rotate QR tokens, inspect reports volume, view weekly opening hours editor with Zod validation, and manage date-specific opening exceptions.
- `/admin/calendar`: Manage academic periods, import calendar CSVs, and adjust cold-start prediction multipliers.
- Both routes protected by `ADMIN_SECRET` (configured via environment variable).

---

## 🧪 Testing Suite

### 1. Unit & Regression Tests (54 tests)
```bash
npm test
```
Covers:
- `tests/opening-hours.test.ts`: Wednesday 11:46 regression, boundary minutes, overnight intervals, 24h zones, BST March/October clock change transitions, UTC summer requests, and Zod interval validation.
- `tests/calendar.test.ts`: Period start/end dates, 1-based Monday-start term weeks, bucket assignment, overlap checking, 5-step fallback chain, and multiplier clamping $[0, 2]$.
- `tests/privacy.test.ts`: Plain English copy completeness, device data deletion, 5/hr rate limiting, and 12-month retention purge.
- `tests/estimate.test.ts`, `tests/map-color.test.ts`, `tests/recommendation.test.ts`, `tests/search.test.ts`, `tests/outlier.test.ts`, `tests/rate-limiter.test.ts`.

### 2. End-to-End Tests (Playwright)
```bash
npx playwright test --project="Mobile Chrome"
```
Validates mobile viewport flows:
- Home shows answer first ("X spaces have seats").
- Quiet-only toggle filter.
- Campus map view.
- 1-tap QR submission -> thank you screen -> rate limiting on immediate re-submission.
- Invalid QR token edge screen.
- Viewport and safe-area spacing on iPhone 13 & iPhone SE.
- 404, error boundary, and offline fallback routes.
- PWA install-to-home-screen prompt and instructions.
- SEO canonical URLs, robots.txt, and sitemap.xml.
- Feedback form, live character counter, inline validation, and admin feedback management.

---

## 🚀 The 5 Production Upgrades

### 1. Feedback (`/feedback` + Admin Control)
- **User Entry Points**:
  - Persistent text link "Send feedback" next to "Privacy" in the footer of every page (`/`, `/privacy`, `/feedback`, `/404`).
  - Small text link on the QR thank-you screen after submitting a report (`/feedback?from=/z/[slug]`). Never shown before submitting on the QR page to keep it to the 3 huge reporting buttons.
- **Form Experience**:
  - Choice buttons ($\ge 56\text{px}$ touch targets): *"Something is wrong"*, *"I have an idea"*, *"Something else"*.
  - Textarea with live character counter (10–500 chars) and choice-reactive helper text.
  - Optional email field for replies ("Leave empty to stay anonymous").
  - Clear inline error messages next to fields with auto-focus on the first error.
  - Context auto-attached silently: relative `from` path (sanitized, max 200 chars), zone slug, app version (`v0.1.0`). No raw IP, user agent, or GPS stored.
- **Anti-Spam & Eduroam Rate Limiting**:
  - `POST /api/feedback` with Zod validation, honeypot rejection, and optional invisible Cloudflare Turnstile.
  - Primary rate limit: **3 submissions per hour per device hash**.
  - Campus Wi-Fi safety ceiling: **60 submissions per hour per IP hash** (protects shared eduroam public IPs while preventing bot flooding). Applied identically to `/api/report`.
- **Admin Feedback Room (`/admin/feedback`)**:
  - Password protected via `ADMIN_SECRET` with session persistence.
  - New feedback counter badge in the admin navigation.
  - Status filters (*All*, *New*, *Seen*, *Done*).
  - List newest first with kind badge, status badge, message, context path, zone slug, formatted date, and a `mailto:` link for reply emails.
  - Action buttons: "Mark seen", "Mark done", and "Delete".
- **Optional Webhook Alerts**:
  - When `FEEDBACK_WEBHOOK_URL` is configured, posts a minimal alert: `"New feedback: <kind> - <site_url>/admin/feedback"`. Message text and emails are never forwarded to third parties.

### 2. Link Preview & Social Open Graph Images
- Dynamic 1200x630 PNG images generated using Next.js `ImageResponse` at `/opengraph-image` and `/twitter-image`.
- Design: LSE-red background (`#E4002B`), white wordmark *"LSE Spots"*, outlined *"Unofficial"* pill, headline *"Find a free study seat"*, and a white rounded preview panel displaying the 3 status rows (*"Plenty of seats"*, *"Filling up"*, *"Full"*) with inline SVG icons. No LSE logo or crest used.
- Zero runtime network requests: uses static TTF fonts bundled in the repository (`BricolageGrotesque-Bold.ttf` and `InstrumentSans-Regular.ttf`).
- Distinct per-page canonical URLs (`/`, `/privacy`, `/feedback`).
- Robots & SEO: `/robots.txt` and `/sitemap.xml` generated dynamically; `/z/*` and `/admin/*` marked with `noindex, nofollow`.

### 3. Friendly 404, Error Boundary & Offline Pages
- **404 Page (`app/not-found.tsx`)**: Same branded header bar, clean copy (*"We can't find that page"*, *"The link may be old or mistyped."*), *"See free spaces"* primary button, and *"Send feedback"* link. Returns HTTP 404.
- **Client Error Boundary (`app/error.tsx`)**: Catches runtime errors gracefully (*"Something went wrong"*, *"It's not you. Try again in a moment."*), logs errors server-side without leaking stack traces or sensitive internals, and offers *"Try again"* (`reset()`) and *"See free spaces"*.
- **Root Error Boundary (`app/global-error.tsx`)**: Minimal inline-styled fallback rendering its own `<html>` and `<body>` tags if the root layout crashes.
- **Offline Fallback (`app/offline/page.tsx`)**: Precached by the service worker for uncached routes (*"You're offline. Connect to the internet to see free spaces."*). The home page itself continues to serve cached data with the existing timestamped banner (*"Offline. Showing data from HH:MM."*).

### 4. Install-to-Home-Screen Prompt & PWA Assets
- **Web App Manifest (`app/manifest.ts` & `public/manifest.json`)**: Name & Short Name *"LSE Spots"*, `start_url: "/?source=pwa"`, `display: "standalone"`, `theme_color: "#E4002B"`, `background_color: "#E4002B"`.
- **Icon Suite Generated from SVG (`scripts/make-icons.ts`)**:
  - `icon-192.png` (192x192)
  - `icon-512.png` (512x512)
  - `icon-maskable-512.png` (512x512 with glyph centered inside 80% safe zone)
  - `apple-touch-icon.png` (180x180)
  - `favicon.ico` (48x48)
- **Prompt Banner (`src/components/InstallBanner.tsx`)**:
  - Full-width card positioned above the footer (never a blocking modal, never covering content).
  - Only appears on the **3rd distinct visit day** OR after a successful report submission on the QR thank-you screen.
  - Never shown if already installed in standalone mode, during search, or on initial visit.
  - Android/Chrome: Captures `beforeinstallprompt`, triggers native prompt on button tap.
  - iOS: Displays platform-native share instructions (*"Tap the Share button, then 'Add to Home Screen'."*). Hidden inside in-app webviews (Instagram, TikTok, LinkedIn, etc.) where home screen installation is unsupported.
  - 44px close button backs off prompt for 30 days.

### 5. Viewport & Bottom Spacing (Safari Toolbar Fix)
- Solved the mobile Safari dynamic toolbar overlapping content by switching layout heights from `100vh` to `100dvh`.
- Global layout adds `pb-[calc(96px+env(safe-area-inset-bottom))]` on `<main>`, guaranteeing the footer is always at least $80\text{px}$ above the viewport bottom.
- QR report page is exempted via `has-[[data-page='qr']]:pb-0` and uses `min-h-[100dvh] flex flex-col justify-between`.
- Responsive button heights: $\ge 72\text{px}$ on short displays ($\le 700\text{px}$, e.g. iPhone SE) and $\ge 96\text{px}$ on taller displays ($\ge 701\text{px}$). All 3 buttons fit entirely within the viewport without scrolling.
- Red header bar extends seamlessly underneath the iOS status bar (`pt-[env(safe-area-inset-top,0px)]` with `apple-mobile-web-app-status-bar-style: "black-translucent"` and `viewport-fit=cover`).

---

## ⚙️ Environment Variables

Configure the following variables in `.env.local` or your hosting provider dashboard:

| Variable | Required? | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SITE_URL` | Recommended | `https://lsestudyspot.vercel.app` | Base URL used for metadata, OpenGraph images, robots.txt, and sitemap.xml. |
| `ADMIN_SECRET` | Required | `lse_admin_secret_2026` | Secret password required to access `/admin`, `/admin/calendar`, and `/admin/feedback`. |
| `FEEDBACK_WEBHOOK_URL` | Optional | `https://hooks.slack.com/services/...` | Slack/Discord webhook URL to receive notifications when new feedback is submitted. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Optional | `0x4AAAAAA...` | Cloudflare Turnstile invisible CAPTCHA site key for feedback & report spam protection. |
| `TURNSTILE_SECRET_KEY` | Optional | `0x4AAAAAA...` | Cloudflare Turnstile secret key for server-side token validation. |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | `https://xyz.supabase.co` | Supabase database URL (in-memory mock store used automatically if omitted). |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | `eyJhbGci...` | Supabase service role key for database queries and migrations. |

---

## 📋 Complete List of `TODO_VERIFY` Items & Assumptions

All unverified campus facts, academic dates, legal controller identities, and infrastructure assertions are listed below:

| Category | Item Marked `TODO_VERIFY` | Current Assumption in Code | Action Required Before Launch |
| :--- | :--- | :--- | :--- |
| **Production Domain** | `NEXT_PUBLIC_SITE_URL` | `https://lsestudyspot.vercel.app` | Confirm official launch domain (e.g. if pointing to a custom `.ac.uk` or `.app` domain) and update DNS/Vercel settings. |
| **Contact Email** | Privacy & Feedback Contact | `morgancanteri15@gmail.com` / `privacy@lsespots.app` | Confirm official student project email mailbox and ensure incoming messages are monitored. |
| **Feedback Alerts** | `FEEDBACK_WEBHOOK_URL` | Unset (silent skip) | Add Slack or Discord incoming webhook URL if real-time admin alert notifications are desired. |
| **Bot Protection** | Cloudflare Turnstile Keys | Unset (falls back to local rate limiting) | Register production domain in Cloudflare dashboard and set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` & `TURNSTILE_SECRET_KEY`. |
| **Brand Identity** | `--brand` hex color | `#E4002B` | Check against official LSE Design & Brand guidelines manual. No LSE logo or crest used. |
| **Data Controller** | Controller Name & Email | LSE Spots Student Project Team, `privacy@lsespots.app` | Confirm student project lead or supervising faculty contact. |
| **Legal Basis** | GDPR Lawful Basis | Legitimate Interests (UK GDPR Art. 6(1)(f)) | Confirm with university legal adviser or DPO. |
| **PECR Storage** | Local Storage Random ID & Visit Counter | Strictly necessary exemption for anti-spam rate limiting and install prompt dismissal under UK PECR | Confirm with student legal adviser / confirm analytics remain cookieless. |
| **Hosting Region** | Vercel Deployment Region | London (`lhr1`) / EU | Ensure Vercel production project settings specify `lhr1`. |
| **Database Region** | Supabase Project Region | London (`eu-west-2`) / EU | Ensure Supabase database instance is provisioned in `eu-west-2`. |
| **Academic Dates** | Term & Exam Dates 2026/27 | Template rows in `data/academic-periods.template.csv` | Cross-check and verify exact start/end dates against LSE official calendar. |
| **Cold-Start Multipliers** | Busyness Multipliers | Exam: 1.15, Reading: 1.1, Vacation: 0.6 | Calibrate multipliers against first-term empirical data. |
| **Library, Floor 1** | Drink policy & PC area | PCs and quiet study, opens 08:30–00:00 | Confirm PC area bottled drink rules with Library desk. |
| **Library, Floor 1** | Exam hours | Extended 24/7 during Lent exam period | Verify official 24/7 opening dates with Library operations. |
| **Library, Floor 2** | Power socket density | Perimeter carrels equipped with power | Confirm socket coverage across Floor 2 desks. |
| **Library, Floor 2** | Acoustic policy | Quiet study policy | Confirm acoustic enforcement level. |
| **Library, Floor 3** | Postgraduate rooms | Silent study; open to all students | Verify if side rooms require postgraduate card access. |
| **Student Centre, Floor 2** | Weekend hours | Saw Swee Hock upper floors close 20:00 Sat, 18:00 Sun | Check SU reception desk for weekend term hours. |
| **Marshall Atrium** | Evening access | Ground floor atrium open to general study | Confirm tap-in gate access rules after 18:00. |
| **NAB Study Seating** | Event closures | Floor 2 balcony study seating | Check if executive education events close this area. |
| **Centre Building Atrium** | High counter seating | High counter seating along Houghton St | Check power socket status on counter bar. |
| **Shaw Library (Old Bldg)** | Power sockets | Oak reading tables have no power | Check if floor plugs were added during recent works. |
| **Shaw Library (Old Bldg)** | Lunchtime concerts | Reading room closed Thursdays 12:30–14:00 | Confirm lunchtime concert schedule with Old Building reception. |

