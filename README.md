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
1. Install Node.js 22.12+ (developer setup only).
2. Open this folder in VS Code.
3. In Terminal run: `npm install`
4. Run: `npm run dev`
5. Open the local URL Vite prints (normally http://localhost:5173).

## Important MVP note
This version uses sample/local state so it runs without cloud credentials. File uploads are represented in the UI but are not persisted. Before production, connect a backend/database and object storage.

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
