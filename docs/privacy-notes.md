# Privacy Engineering & UK GDPR Notes — LSE Spots

> [!WARNING]
> **Legal Disclaimer**: This document and the implementation within the LSE Spots codebase do NOT constitute formal legal advice. They represent a student-led privacy-by-design architecture under UK GDPR and the Data Protection Act 2018. All policies, controller identities, and hosting assertions must be reviewed and verified by a qualified adviser or the LSE Data Protection Officer before public launch. (Marked as `TODO_VERIFY`).

---

## 1. Architectural Data Flow

```
[Student Device / Browser]
       │
       ├─ (1) Scans physical QR code containing signed zone token
       ├─ (2) Generates/Retrieves anonymous UUID in localStorage ('lse_client_random_id')
       ├─ (3) Cloudflare Turnstile bot check (no cookies, verifies human request)
       │
       ▼
[Edge / Server (Europe/London)]
       │
       ├─ Derives pseudonymous 'device_hash': SHA-256(UUID + IP /24 subnet + Secret Salt)
       ├─ Evaluates in-memory rate limit (1 report / 10 min per space)
       ├─ Discards raw IP and raw UUID immediately (never written to disk or logs)
       │
       ▼
[Database (Supabase EU)]
       │
       ├─ Stores: zone_id, busyness level (0, 1, 2), timestamp (UTC), device_hash
       ├─ Zero PII: No names, student IDs, LSE credentials, precise locations, or photos
       │
       ▼
[Aggregation Pipeline]
       │
       └─ Computes rolling hourly statistics per zone and academic bucket
```

---

## 2. Retention Schedule

| Data Category | Purpose | Retention Period | Deletion Mechanism |
| :--- | :--- | :--- | :--- |
| **Zone Reports** | Real-time seat availability & statistical models | **12 months** | Automated nightly cron (`/api/cron/retention`) purges raw rows older than 365 days. Anonymous hourly aggregate statistics are preserved. |
| **Spam / Rate-Limit Hashes** | Enforce anti-spam rules (10-min report cooldown, 5/hr deletion limit) | **24 hours** | In-memory sliding window and purge job remove hashes older than 24 hours. |
| **Recommendation Events** | Space routing & congestion distribution | **7 days** | Purged automatically after 7 days by retention cron. |
| **Aggregated Statistics** | Typical busyness curves | **Indefinite** | Anonymous aggregates (zone, bucket, weekday, hour, average busyness). Contains no personal data. |

---

## 3. Data Subject Request (DSR) Process

Under UK GDPR Articles 15–17:
1. **Right to Erasure ("Right to be Forgotten")**:
   - Because LSE Spots has no user accounts and never collects student names or emails, we cannot look up data by name or university ID.
   - The app provides a self-service erasure button directly on `/privacy`: **"Delete my reports from this device"**.
   - When tapped, the client transmits its local random token to `POST /api/privacy/delete`. The server calculates the corresponding `device_hash` and deletes all matching reports and recommendation events from the database.
   - Upon successful deletion, the client clears `lse_client_random_id` from local storage.
2. **Right of Access / Rectification**:
   - If a student contacts `privacy@lsespots.app`, we inform them that reports are stored pseudonymously and can only be deleted or inspected via their specific device using the self-service privacy portal.

---

## 4. Data Protection Impact Assessment (DPIA) Checklist

- [x] **Necessity & Proportionality**: Does the system collect only what is strictly necessary to tell students where study seats are? Yes (level, zone, time).
- [x] **No Account Requirements**: Can students view spots and report seats without logging in or providing contact details? Yes.
- [x] **Device Pseudonymisation**: Are client random identifiers salted and one-way hashed with coarse network prefixes? Yes.
- [x] **No Precise Geolocation**: Does the app use GPS or fine location tracking? No; presence is validated purely via physical QR code tokens.
- [x] **Cookieless Operation**: Are there third-party tracking, advertising, or profiling cookies? No. Local storage is strictly necessary for anti-spam rate limiting under UK PECR.
- [x] **Automated Data Lifecycle**: Is there an automated purge routine enforcing the 12-month raw report retention limit? Yes (`/api/cron/retention`).
- [ ] `TODO_VERIFY`: Finalize legal entity name / data controller identity with project supervisor.
- [ ] `TODO_VERIFY`: Validate that Supabase and Vercel hosting regions are pinned to London (`eu-west-2` / `lhr1`) or EU jurisdictions.
