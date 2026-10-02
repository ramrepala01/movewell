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

## Run in VS Code
1. Install Node.js 20+.
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
