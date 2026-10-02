
# MoveWell MVP

A runnable React MVP for physiotherapy/therapy booking plus an athlete Strength & Conditioning workspace.

## Features
- Athlete appointment booking for physiotherapy, S&C and recovery providers
- Therapist-prescribed care plan and completion tracking
- Athlete nutrition dashboard: calories, macros, hydration, meals
- Secure-messaging UI concept
- S&C coach portal with athlete roster and readiness
- Exercise library and exercise/video upload UI
- Training program/block views
- Squad nutrition and hydration tracking
- Responsive mobile + desktop layouts

The athlete workspace uses bottom navigation below 640px, a horizontal navigation
bar on tablets, and a sidebar from 1024px. Home, booking, plan, and nutrition
layouts expand into columns as space permits. Coach tables scroll within their
containers on phones, and dialogs scroll on short or landscape screens.

## Mobile web launch

Users open the hosted URL in Safari or Chrome; no source download or npm is required.
This is a demo using sample data, not a live booking service.

GitHub Pages deployment is configured in `.github/workflows/deploy.yml`:
1. Push `main` to `https://github.com/ramrepala01/movewell`.
2. In GitHub **Settings → Pages → Source**, select **GitHub Actions**.
3. If the workflow ran before Pages was enabled, rerun **Deploy MoveWell** in **Actions**.
4. Once deployment succeeds, open `https://ramrepala01.github.io/movewell/` on a phone.

The GitHub repository URL displays source code; the Pages URL runs the app.
Before real clinic use, implement authentication, clinic access permissions,
persistent bookings, private uploads, messaging, and production operational controls.

## Run in VS Code
1. Install Node.js 22.13+ (developer setup only; includes SQLite support).
2. Open this folder in VS Code.
3. In Terminal run: `npm install`
4. Run: `npm run dev` (starts the React frontend and the Recovery Moments API).
5. Open the local URL Vite prints (normally http://localhost:5173).

## Important MVP note
The original booking, messaging, nutrition, and coach upload screens remain sample/local state. Recovery Moments uses a persistent SQLite database when running the API; the GitHub Pages build uses browser storage with the same rules and service, explicitly labeled as a local demo. File uploads in the original coach library are not persisted.

## Recovery Moments

Open **Therapist portal** from the patient header or S&C portal. The sample
physiotherapist is Dr. Maya Rao. Select Ram R., choose **Create Recovery Moment**,
and select exercises from his existing prescribed plan. Aarav and Ishaan have no
approved rehabilitation plan in the original demo, so prescribing is disabled for
them. Coach strength exercises are not automatically approved for rehabilitation.

Specify instructions, duration, repetitions, trigger, permitted hours, date range,
daily maximum, minimum interval, and restrictions. Body area, difficulty, exercise
name, and optional media are inherited from the approved library. Each moment is
limited to five minutes, with doses capped by the patient's approved prescription.
For a quick demonstration, choose **Manual therapist recommendation**, save, and
select **Recommend now**. Return to **Patient app → Home → Today's Recovery**.

Patients can start, snooze for 15 minutes, skip, and complete exercises in order.
The player offers a timer, repetition counter, pause, and saved exercise progress.
Closing the player preserves progress; stopping and skipping ends the event.
Completion is self-reported and does not certify that an exercise was performed.

### Triggers and delivery

- Inactivity: the patient explicitly reports sitting minutes under **Tell us about
  your day**. Elapsed time is added until they report movement or the report expires
  after eight hours. Browser/phone idle time is not treated as body inactivity.
- Before/after activity: explicit patient reports, valid for 30 minutes.
- Morning, evening, fixed time: therapist-selected local time, once per moment per
  patient day. A late app visit may suggest the moment during permitted hours.
- Missed session: either explicitly reported or 60 minutes after the normal routine's
  scheduled time without a completion record. Completing **My plan** records the
  normal routine's completion. Only exercises from that approved routine can be
  selected for therapist-prescribed smaller moments; no new doses are inferred.
- Manual: the assigned therapist requests delivery of an existing active manual
  prescription. Requests expire after 24 hours and still obey delivery constraints.

All schedules use the patient's IANA timezone (the existing demo uses
`Asia/Kolkata`). Start/end dates are inclusive; permitted hours include the start
and exclude the end, with overnight windows supported. The strictest active daily
maximum and minimum interval apply across the patient's prescriptions. Skips and
snoozes count toward the daily maximum. Only one unresolved suggestion is allowed
at a time. Snooze reuses the same event and waits for both its due time and the
notification interval. Outstanding events expire when the local day ends, approval
is revoked, or the prescription is edited/deactivated. Archive preserves history.

In-app notifications use a durable, deduplicated outbox. Rules are evaluated when
the patient opens the dashboard, reports activity, or refreshes (every 30 seconds
while visible). No background device sensing, browser push, Firebase, or APNs is
configured. A future delivery worker can consume the notification outbox; a future
ranking engine must still pass the deterministic eligibility rules.

### Backend and authentication

`npm run dev` starts both services on localhost and explicitly enables sample-account
sessions. `npm run start:api` starts only the API, with demo sign-in disabled by
default. The API listens on `127.0.0.1:8787`; set `API_HOST`, `API_PORT`, and
`MOVEWELL_DB` to override. SQLite migrations run transactionally on startup and
record their version; data defaults to ignored `data/movewell.sqlite`.

The original project had no database or authentication. The new API uses opaque,
server-side, eight-hour sessions with HttpOnly/SameSite cookies, origin checks,
patient ownership checks, and therapist role checks. Sample identity selection is
available only with `DEMO_AUTH_ENABLED=true`. This is demo authentication, not a
production identity provider. Before using real patient data, connect the session
boundary to real authentication and an existing clinician/patient assignment system.
Booking and messaging have not been converted into live services.

GitHub Pages cannot execute Node or SQLite. Its default local mode stores sample
prescriptions/events only in the current browser. It is not a multi-user backend.
To host persistent Recovery Moments, serve the frontend and API on the same origin
and build with `VITE_API_BASE_URL` set to that origin. Set server `APP_ORIGIN` to
the exact frontend origin (HTTPS also enables Secure session cookies). Cross-origin
CORS access is intentionally not enabled. `VITE_RECOVERY_MODE=local` explicitly
selects the browser demo. `npm run dev:frontend` expects a separately running API;
`MOVEWELL_API_PROXY` overrides the development proxy target.

### Modules and REST API

- `shared/catalog.mjs`: existing patient/provider/exercise records, reused by the UI.
- `server/migrations/001_recovery_moments.sql`: canonical identities, approvals,
  normal routines/logs, Recovery Moments, ordered exercises, events, outbox, signals,
  and sessions. Core event fields are indexed; immutable prescription snapshots and
  snooze history preserve what was actually recommended.
- `server/recovery/RecoveryMomentRepository.mjs`: transactional SQLite data access.
- `recovery/RecoveryMomentService.mjs`: authorization, validation, event lifecycle,
  approved-dose enforcement, and descriptive adherence analytics.
- `recovery/RecoveryMomentRulesEngine.mjs`: pure deterministic eligibility boundary.
- `recovery/RecoveryMomentNotificationService.mjs`: deduplicated in-app outbox.
- `recovery/ui/`: therapist prescribing, patient dashboard, and exercise player.

All REST routes require session cookies except health and explicitly enabled demo
sign-in. Mutating routes accept JSON and reject cross-origin requests.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/recovery-moments/catalog` | Accessible patients, approved exercises, routines |
| GET | `/api/recovery-moments/today` | Evaluate and retrieve the signed-in patient's day |
| GET | `/api/recovery-moments/:id` | Read an accessible prescription |
| POST | `/api/recovery-moments` | Assigned therapist creates prescription |
| PUT | `/api/recovery-moments/:id` | Assigned therapist updates prescription |
| DELETE | `/api/recovery-moments/:id` | Archive without deleting adherence history |
| POST | `/api/recovery-moments/:id/recommend` | Request an approved manual recommendation |
| POST | `/api/recovery-moments/:id/start` | Start event (`eventId`) |
| POST | `/api/recovery-moments/:id/progress` | Record next exercise (`eventId`, `exerciseId`) |
| POST | `/api/recovery-moments/:id/complete` | Complete event (`eventId`, `completedExerciseIds`) |
| POST | `/api/recovery-moments/:id/skip` | Skip event (`eventId`) |
| POST | `/api/recovery-moments/:id/snooze` | Postpone event (`eventId`, `minutes`, 5–240) |
| GET | `/api/patients/:patientId/recovery-moments` | Accessible patient's prescriptions |
| GET | `/api/patients/:patientId/recovery-moment-history` | History and nonclinical adherence counts |
| POST | `/api/recovery-context` | Patient inactivity/activity report |
| POST | `/api/rehabilitation-routines/:id/status` | Patient reports `COMPLETED` or `MISSED` |
| POST | `/api/demo/session` | Sample sign-in (`personId`), when explicitly enabled |
| GET | `/api/session` | Current authenticated identity |
| POST | `/api/session/logout` | Revoke current session |

### Verification

Run `npm test` for service, rules, persistence, authorization, and REST tests.
Run `npm run build` for the production frontend. For browser tests, first install
Chromium using `npx playwright install chromium`, then run `npm run test:browser`.
Tests start their own temporary API and frontend and cover prescribing, patient
delivery, player progress, resume, completion, snooze, skip, editing, disabling,
analytics, and responsive layouts. Run `BROWSER_TEST_MODE=local npm run test:browser`
after building to check the GitHub Pages browser-storage mode. Optionally set
`BROWSER_EXECUTABLE` to an existing compatible Chromium/Chrome executable.

## Suggested production API modules
- `/api/auth` — identity, roles, MFA
- `/api/providers` — therapists, trainers, S&C profiles
- `/api/availability` — provider schedules
- `/api/appointments` — booking/reschedule/cancel
- `/api/athletes` — athlete profiles and permissions
- `/api/exercises` — exercise metadata/media
- `/api/programs` — blocks, sessions, prescriptions
- `/api/workouts` — completion, load, RPE, results
- `/api/nutrition` — meals, macro/hydration/weight logs
- `/api/messages` — athlete/provider messaging
- `/api/notifications` — push/SMS/email reminders

For a healthcare production deployment, design privacy, consent, role-based access, audit logging, encryption, retention and jurisdiction-specific compliance before using real patient/athlete health information.
