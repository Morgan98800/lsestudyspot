# LSE Spots

> **Student-built, not affiliated with LSE. Estimates only.**  
> An unofficial, mobile-first web app that tells LSE students, in two seconds, where study seats are available right now.

LSE has no occupancy sensors. The app combines:
1. **Proof-of-presence QR codes** placed at physical study zones.
2. **One-tap crowdsourced reports** (zero accounts, no sign-up, submitted in under 3 seconds).
3. **Statistical predictions** calculated from historical reports with exponential decay.

---

## 🎯 The Two Entry Points

The product adheres strictly to two entry points, each with one single job:
1. **Opening the website (`/`)**: Instantly see the answer under the header: *"5 spaces have seats"*. Progressive disclosure reveals attributes and hourly charts only when a row is tapped.
2. **Scanning a QR code at a study spot (`/z/[slug]?t=<token>`)**: 3 huge stacked buttons in the mobile thumb zone ($\ge 96\text{px}$ tall): *"Plenty of seats"*, *"Filling up"*, *"Full"*. Tap once to submit immediately.

---

## 🎨 Visual System & Design Tokens

- **Brand Token**: `--brand: #E4002B` (TODO_VERIFY against official LSE brand guidelines). Used **strictly** for: header bar, "Quiet spaces only" switch when active, primary buttons, and the current hour bar in the busyness chart. **Never used for a status.**
- **Light Theme**:
  - `bg`: `#F6F5F3` | `surface`: `#FFFFFF` | `surface-2`: `#EBE9E6`
  - `ink`: `#1B1B1D` | `ink-2`: `#55555B` | `line`: `#D9D7D3`
- **Dark Theme**:
  - `bg`: `#121214` | `surface`: `#1C1C1F` | `surface-2`: `#2A2A2E`
  - `ink`: `#F2F2F3` | `ink-2`: `#B0B0B8` | `line`: `#35353A`
- **Status Colours (WCAG AA text on background pairs)**:
  - **Plenty of seats** (green): Light `#0B6B49` on `#DAF2E7` | Dark `#5FD3A4` on `#12382B`
  - **Filling up** (amber): Light `#9C4700` on `#FFE7CA` | Dark `#FFB366` on `#40290F`
  - **Full** (charcoal): Light `#3A3A3F` on `#E1DFDB` | Dark `#D4D4DA` on `#2C2C31`  
    *(Full is deliberately charcoal, not red, so it never clashes with the LSE brand red).*
- **Status Icons**: Outlined circle with check (*Plenty of seats*), half-filled outlined circle (*Filling up*), outlined circle with cross (*Full*).
- **Predictions**: Drawn with a **dashed outline and no fill**, displaying `"Usual level"` instead of a relative timestamp. Never presented as live data.
- **Typography**: Bricolage Grotesque (headings, weights 600/800) and Instrument Sans (body). Sentence case everywhere.

## 📐 Design & Product Rules
- **The Answer Comes First**: On the home page, the first thing under the header is the answer ("X spaces have seats").
- **Single Filter**: One toggle switch labelled "Quiet spaces only" (`role="switch"`, `aria-checked`). When on, shows only zones with `noise = silent` or `quiet`. Default off. Switch is brand red when on. This is the ONLY filter.
- **Accordion Content**: Expanded row displays only the prediction note (if prediction), the usual-busy sentence, the 14-bar hourly chart, and the "Looks wrong?" line.
- **Strict Scope Boundaries**: Do not add search, building selectors, walking times, confidence badges, tag rows, "view spot" buttons, group-room or booking features, attribute tags (power, PCs, quiet), or extra filters. They were deliberately removed. Do not integrate with LSE's room booking system.

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Locally
The app starts with an out-of-the-box in-memory hybrid store seeded with 8 campus zones and 3 weeks of realistic term-time reports:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your mobile or desktop browser.

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | Base domain for links, QR codes, and PWA manifest | `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL (optional in dev, activates Postgres mode) | `""` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key | `""` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `""` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile public site key | `""` (dev bypass) |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key | `""` (dev bypass) |
| `ADMIN_SECRET` | Secret passphrase protecting the `/admin` control room | `lsespots-admin-2026` |

---

## 🖨️ Printing Physical QR Signage

Generates printable **A5 Wall Posters** and **A6 Table Stands** with large QR codes ($\ge 3\text{ cm}$, readable from $1\text{ m}$), short fallback links, and the 3-status legend:

```bash
npm run generate-posters
```
Generated PDFs will be in `./dist/posters/`:
- `library-floor-1_A5_wall.pdf` / `library-floor-1_A6_stand.pdf`
- `library-floor-2_A5_wall.pdf` / `library-floor-2_A6_stand.pdf`
- *(and all 8 starter zones)*

> [!IMPORTANT]
> **Permission Notice**: Placing physical stickers, wall posters, or acrylic desk stands on campus requires formal authorization from LSE Estates, LSE Library, or the Students' Union (LSESU). Do not place signage without permission.

---

## 🧪 Testing Suite

### Unit Tests
Tests live estimate math (20-min exponential decay, 90-min cutoff), bucket thresholds (<0.7 Plenty, <1.4 Filling up, else Full), insight generation, and rate limiter hashing:
```bash
npm test
```

### End-to-End Smoke Tests (Playwright)
Validates mobile flows: home shows answer first, Quiet toggle hides non-quiet spaces, accordion expands, 1-tap QR submission, rate limiting, and invalid token edge state:
```bash
npm run test:e2e
```

### Fake Demo Data Command
Synthetic reports can be reset or purged with a single command:
```bash
# Reset to 3 weeks of term-time demo data
npm run reset-demo

# Clear all synthetic reports
npm run reset-demo -- --clear
```

---

## ➕ How to Add a New Study Zone

1. Open `src/lib/data/starter-zones.ts`.
2. Add the zone definition:
```typescript
{
  id: 'zone-new-spot',
  slug: 'new-study-spot',
  name: 'New Academic Building, floor 3',
  descriptor: 'Silent carrels',
  building: 'New Academic Building',
  floor: 'Floor 3',
  noise: 'silent', // 'silent' | 'quiet' | 'social'
  has_power: true,
  has_pcs: false,
  opening_hours: {
    mon: { open: '08:30', close: '21:00' },
    // ...
  },
  is_active: true,
  qr_token: 'qr_tok_new_v1',
}
```
3. Run `npm run generate-posters` to produce the print-ready PDF signage.

---

## 📋 VERIFICATION CHECKLIST FOR TODO_VERIFY CAMPUS DATA

No campus facts have been invented. All starter zone names, floor boundaries, acoustic policies, and hours are marked as `TODO_VERIFY` until verified in person on campus:

| Zone | Item Marked `TODO_VERIFY` | Current Assumption in Code | Physical Check Required on Campus |
| :--- | :--- | :--- | :--- |
| **Brand Red Token** | `#E4002B` hex color | LSE Red `#E4002B` | Check against official LSE Design & Identity manual. |
| **Library, floor 1** | Drink policy & PC area | PCs and quiet study, opens 08:30–00:00 | Confirm PC area drink policy with Library service desk. |
| **Library, floor 1** | Exam hours | Extended 24/7 during Lent exam period | Verify official 24/7 calendar dates. |
| **Library, floor 2** | Power socket density | Perimeter carrels equipped with power | Inspect socket availability across all perimeter desks. |
| **Library, floor 2** | Acoustic enforcement | Quiet study policy | Confirm acoustic enforcement level on Floor 2. |
| **Library, floor 3** | Postgraduate rooms | Silent study; open to all students | Verify if side study rooms require PhD card access. |
| **Student Centre, floor 2** | Weekend hours | Saw Swee Hock upper floors close 20:00 Sat, 18:00 Sun | Check SU reception desk for term weekend hours. |
| **Marshall atrium** | Evening access | Ground floor atrium open to general study | Confirm whether tap-in gates apply to atrium after 18:00. |
| **NAB study seating** | Conference closures | Floor 2 balcony study seating | Check if executive education events close this area. |
| **Centre Building atrium** | Sockets along glass | High counter seating along Houghton St | Check socket power status along window bar. |
| **Shaw Library (Old Bldg)** | Power sockets | Oak reading tables have no power | Check if floor plugs were added during recent works. |
| **Shaw Library (Old Bldg)** | Lunchtime concerts | Reading room closed Thursdays 12:30–14:00 | Confirm lunchtime concert schedule with Old Building reception. |

---

## 🔒 Privacy & UK GDPR Compliance

- **No Accounts**: Zero sign-up, zero logins, zero names or emails collected.
- **Pseudonymous Device Hash**: 10-minute rate limit enforced via a one-way SHA-256 hash of a local random ID + coarse `/24` IP prefix. Raw IP addresses are never recorded.
- **Data Retention**: Raw reports are automatically deleted after 12 months. Only aggregated hourly averages are kept.
- **No Third-Party Trackers**: No advertising pixels or external analytics beacons.
