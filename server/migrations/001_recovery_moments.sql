CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
-- Persist the existing demo catalog; these are the canonical identities and approvals.
CREATE TABLE people (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('PATIENT','THERAPIST','COACH')));
CREATE TABLE patients (id TEXT PRIMARY KEY REFERENCES people(id), therapistId TEXT NOT NULL REFERENCES people(id), timeZone TEXT NOT NULL);
CREATE TABLE exercises (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE exercise_approvals (id TEXT PRIMARY KEY, patientId TEXT NOT NULL REFERENCES patients(id), therapistId TEXT NOT NULL REFERENCES people(id), exerciseId TEXT NOT NULL REFERENCES exercises(id), data TEXT NOT NULL, UNIQUE(patientId,exerciseId));
CREATE TABLE rehabilitation_routines (id TEXT PRIMARY KEY, patientId TEXT NOT NULL REFERENCES patients(id), data TEXT NOT NULL);
CREATE TABLE routine_logs (id TEXT PRIMARY KEY, patientId TEXT NOT NULL REFERENCES patients(id), data TEXT NOT NULL);
CREATE TABLE recovery_moments (
 id TEXT PRIMARY KEY, patientId TEXT NOT NULL REFERENCES patients(id), therapistId TEXT NOT NULL REFERENCES people(id),
 title TEXT NOT NULL, description TEXT NOT NULL, triggerType TEXT NOT NULL, triggerValue TEXT,
 allowedStartTime TEXT NOT NULL, allowedEndTime TEXT NOT NULL, maxPerDay INTEGER NOT NULL CHECK(maxPerDay BETWEEN 1 AND 12),
 minimumIntervalMinutes INTEGER NOT NULL CHECK(minimumIntervalMinutes BETWEEN 1 AND 1440), active INTEGER NOT NULL,
 startDate TEXT NOT NULL, endDate TEXT, restrictions TEXT NOT NULL, routineId TEXT REFERENCES rehabilitation_routines(id),
 createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE recovery_moment_exercises (
 id TEXT PRIMARY KEY, recoveryMomentId TEXT NOT NULL REFERENCES recovery_moments(id) ON DELETE CASCADE,
 exerciseId TEXT NOT NULL REFERENCES exercises(id), sortOrder INTEGER NOT NULL, durationSeconds INTEGER NOT NULL,
 repetitions INTEGER NOT NULL, instructions TEXT NOT NULL, UNIQUE(recoveryMomentId,sortOrder)
);
CREATE TABLE recovery_moment_events (
 id TEXT PRIMARY KEY, recoveryMomentId TEXT NOT NULL REFERENCES recovery_moments(id), patientId TEXT NOT NULL REFERENCES patients(id),
 triggeredAt TEXT NOT NULL, startedAt TEXT, completedAt TEXT, status TEXT NOT NULL CHECK(status IN ('AVAILABLE','STARTED','COMPLETED','SKIPPED','SNOOZED','EXPIRED')),
 data TEXT NOT NULL, UNIQUE(recoveryMomentId,patientId,triggeredAt)
);
CREATE INDEX recovery_events_patient ON recovery_moment_events(patientId,triggeredAt);
CREATE TABLE recovery_notifications (id TEXT PRIMARY KEY, patientId TEXT NOT NULL REFERENCES patients(id), data TEXT NOT NULL);
CREATE TABLE recovery_signals (id TEXT PRIMARY KEY, patientId TEXT NOT NULL REFERENCES patients(id), data TEXT NOT NULL);
CREATE TABLE sessions (tokenHash TEXT PRIMARY KEY, personId TEXT NOT NULL REFERENCES people(id), expiresAt TEXT NOT NULL);
