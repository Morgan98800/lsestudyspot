# LSE Spots — Guerrilla Usability Test Plan

## 1. Objective & Methodology
- **Goal**: Validate that students in realistic rushed campus situations can find a free study seat in under 2 seconds and submit an occupancy report in under 5 seconds with zero cognitive friction.
- **Format**: 5 guerrilla hallway usability tests conducted on-campus (Library entrance, Saw Swee Hock café, Marshall Building atrium).
- **Participants**: 5 current LSE students using their own mobile smartphones (iOS Safari and Android Chrome).
- **Target Success Criteria**:
  - Task completion without moderator intervention: **> 90%**
  - Time-to-task: **< 20 seconds** for all tasks (wizard < 30s)
  - Zero misreads of study status (never mistake "Full" for "Available" or "Estimated" for "Live")
  - Median System Usability Scale (SUS) score: **> 85 (Grade A)**

---

## 2. Participant Personas
1. **Priya (MSc Finance)**: 10:40 AM, lecture at 12:00. Looking for a quiet seat with power within 5 minutes walk. Rushed, low laptop battery.
2. **Tom (BSc Government, 2nd Year)**: Group presentation prep with 3 teammates. Needs collaborative discussion seating where talking is allowed.
3. **Amara (LLM Student)**: Deep 6-hour revision session. Needs to know when the Library empties out and where fallback seats exist.
4. **Leo (First Year General Course)**: Doesn't know building acronyms (NAB, CLM, MAR). Needs clear street hints.
5. **Aisha (PhD candidate)**: Accessibility priority; requires step-free access and strict silence.

---

## 3. Test Scenarios & Scripts

### Scenario 1: Quick Seat with Power
- **Prompt**: *"You have a 50-minute break before your next seminar. You need a quiet seat with a working power socket near Houghton Street."*
- **Target Route**: Home screen (`/`)
- **Success Criteria**:
  - User taps the **Quiet** and **Power** filter chips.
  - User identifies a top recommended green card in < 10 seconds.
  - User notices the walking time badge ("3 min walk").

### Scenario 2: Crowdsource Report (Scan -> 1-Tap)
- **Prompt**: *"You just arrived at Library Floor 2. Look at the desk QR sticker. Report to other students that Floor 2 is currently Full."*
- **Target Route**: QR URL (`/z/library-floor-2?t=...` or `/lib2`)
- **Success Criteria**:
  - One tap on the massive red **"Full"** button.
  - Instant confirmation displayed with impact count ("Helped ~24 students").
  - Optional details screen is clearly understood as skippable.
  - Total time from scan to submit: **< 5 seconds**.

### Scenario 3: Forecast & Best Time to Visit
- **Prompt**: *"You plan to do an all-day revision session at the Library tomorrow. Find out what time it usually gets packed and when it empties out."*
- **Target Route**: `/z/library-floor-2`
- **Success Criteria**:
  - User scrolls to the hourly busyness chart.
  - User reads the plain-language insight (e.g. *"Peak rush 12:00, usually empties out after 16:00"*).
  - User correctly distinguishes the current hour from forecasted hours.

### Scenario 4: "I'm in Marshall" Proximity Search
- **Prompt**: *"You are sitting in the Marshall Building ground floor café. You need to find the nearest free seat without walking far."*
- **Target Route**: Home screen (`/`) or Map (`/map`)
- **Success Criteria**:
  - User selects *"I'm in: Marshall Building"* in the location selector.
  - List immediately sorts by estimated walking time from Marshall.
  - User identifies the Marshall 1st Floor Balcony as 1 min walk away.

### Scenario 5: "Find Me a Seat" Wizard
- **Prompt**: *"You don't know where to go. Run the 3-question seat finder for a 3-hour group study session with power."*
- **Target Route**: `/wizard`
- **Success Criteria**:
  - Completes all 3 questions in < 20 seconds.
  - Receives 3 ranked recommendations with single-line rationale.
  - Taps through to the top match.

---

## 4. Observation Checklist for Observers
| Item to Observe | Warning Sign / Red Flag |
| :--- | :--- |
| **Thumb reachability** | Stretching to reach top controls with one hand |
| **Status legibility** | Relying on color only without reading icon/text |
| **Prediction clarity** | Confusion between dashed estimated badge vs live report |
| **Poster scanning** | Hesitation finding the short URL fallback |
| **Is this wrong? link** | Accidentally mis-tapping the feedback link |
| **Network delays** | Frustration during offline or patchy eduroam signal |

---

## 5. Post-Test System Usability Scale (SUS)
Each participant completes the standard 10-item Likert scale (1 = Strongly Disagree, 5 = Strongly Agree):
1. I think that I would like to use LSE Spots frequently during term.
2. I found the app unnecessarily complex.
3. I thought the app was easy to use with one hand.
4. I think that I would need the support of a technical person to use this app.
5. I found the various functions in this app were well integrated.
6. I thought there was too much inconsistency in this app.
7. I would imagine that most LSE students would learn to use this app very quickly.
8. I found the app very cumbersome to use.
9. I felt very confident using the app to find a seat.
10. I needed to learn a lot of things before I could get going with this app.
