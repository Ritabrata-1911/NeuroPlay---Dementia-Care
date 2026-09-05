// sessionStore.js
// -----------------------------------------------------------------------------
// Persists a completed game session to Supabase (table: public.game_sessions).
// Reuses the app's existing Supabase client from ./SupabaseClient, so there is
// nothing extra to configure. If the call fails (offline, or the table isn't
// created yet) it falls back to localStorage so the game NEVER breaks
// mid-session. See schema.sql for the table definition.
// -----------------------------------------------------------------------------

import { supabase } from './SupabaseClient';

const LOCAL_KEY = 'neuroplay_game_sessions';

// Optional escape hatch: pass a different Supabase client instance to override
// the shared one (rarely needed). Any other argument is ignored, so an old
// configureGameStore({ supabaseUrl, ... }) call left in main.jsx won't break.
let _override = null;
export function configureGameStore(clientOrConfig) {
  if (clientOrConfig && typeof clientOrConfig.from === 'function') {
    _override = clientOrConfig;
  }
}

function getClient() {
  return _override || supabase || null;
}

export function getLocalSessions() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    return JSON.parse(window.localStorage.getItem(LOCAL_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function saveLocal(session) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return session;
    const list = getLocalSessions();
    const row = { ...session, id: session.id || `local-${Date.now()}` };
    list.push(row);
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
    return row;
  } catch (e) {
    return session;
  }
}
// -----------------------------------------------------------------------------
// Map the display-metrics object to the EXACT columns of public.game_sessions
// (the shared NeuroPlay table). The table has a fixed set of core columns; any
// game-specific extras belong in raw_metadata (JSONB). Sending a key that is
// NOT a real column makes Postgres reject the WHOLE insert, so buildSessionRow
// must emit these keys and nothing else.
//
// Backend conventions (from the table owner):
//   - patient_id     UUID, required (RLS enforced)
//   - difficulty_level  Integer  (we map easy=1, medium=2, hard=3)
//   - accuracy / mistake_rate / hint_rate  Numeric 0.0–1.0 (NOT 0–100)
//   - completion_time / average_response_time  Numeric seconds
//   - raw_metadata   Optional JSONB for per-game telemetry
// -----------------------------------------------------------------------------
const DIFFICULTY_TO_INT = { easy: 1, medium: 2, hard: 3 };

// UI keeps rates as 0–100 for display; the table wants 0.0–1.0 decimals.
function toRatio(pct) {
  return (Number(pct) || 0) / 100;
}

export function buildSessionRow(m) {
  return {
    patient_id: m.patient_id || null,
    game_name: m.game_name,
    difficulty_level: DIFFICULTY_TO_INT[m.difficulty_label] ?? null,
    attempts: m.attempts,
    correct_answers: m.correct_answers,
    incorrect_answers: m.incorrect_answers,
    accuracy: toRatio(m.accuracy),
    mistake_rate: toRatio(m.mistake_rate),
    hint_rate: toRatio(m.hint_rate),
    completion_time: m.completion_time,
    average_response_time: m.average_response_time,
    raw_metadata: {
      game_title: m.game_title,
      difficulty_label: m.difficulty_label,
      total_questions: m.total_questions,
      hints_used: m.hints_used,
      patient_name: m.patient_name,
      question_details: m.question_details,
      played_at: m.played_at,
    },
  };
}

// Save a completed session. Always resolves; never throws (the game must not
// break). Accepts the display-metrics object from computeSessionMetrics() and
// maps it to the table's columns via buildSessionRow() before inserting.
// Returns { ok, storedIn: 'supabase' | 'local', data }.
export async function saveGameSession(metrics) {
  const client = getClient();
  if (client) {
    try {
      const row = buildSessionRow(metrics);
      const { data, error } = await client
        .from('game_sessions')
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return { ok: true, storedIn: 'supabase', data };
    } catch (e) {
      console.error('[NeuroPlay] Supabase save failed; storing locally instead.', e);
    }
  }
  const data = saveLocal(metrics);
  return { ok: true, storedIn: 'local', data };
}

// -----------------------------------------------------------------------------
// Build the session row (all required metrics) from per-question records.
//
// records: [{ objectId, name, region, category, difficulty,
//             attempts (1-3), hintsShown (0-2), correct, responseTimeMs }]
// meta:    { difficulty, sessionDurationMs, patientId, patientName, gameName, gameTitle }
// -----------------------------------------------------------------------------
export function computeSessionMetrics(records, meta = {}) {
  const totalQuestions = records.length;
  const correct = records.filter((r) => r.correct).length;
  const incorrect = totalQuestions - correct;
  const attempts = records.reduce((s, r) => s + (r.attempts || 0), 0);
  // Each solved question ends in exactly one correct attempt.
  const incorrectAttempts = Math.max(attempts - correct, 0);
  const hintsUsed = records.reduce((s, r) => s + (r.hintsShown || 0), 0);
  const questionsWithHints = records.filter((r) => (r.hintsShown || 0) > 0).length;
  const totalResponseMs = records.reduce((s, r) => s + (r.responseTimeMs || 0), 0);

  const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
  const secs1 = (ms) => Math.round(ms / 100) / 10; // seconds, 1 decimal place
  // NOTE: this object is the DISPLAY shape used by the results screen (rates as
  // 0–100). saveGameSession() maps it to the DB columns via buildSessionRow(),
  // where rates become 0.0–1.0 and difficulty becomes an integer.
  return {
    game_name: meta.gameName || 'object_recognition',
    game_title: meta.gameTitle || 'Object Recognition (North-East India)',
    patient_id: meta.patientId != null ? String(meta.patientId) : null,
    patient_name: meta.patientName || null,
    difficulty_label: meta.difficulty || null,
    total_questions: totalQuestions,
    correct_answers: correct,
    incorrect_answers: incorrect,
    attempts,
    accuracy: pct(correct, totalQuestions),
    mistake_rate: pct(incorrectAttempts, attempts),
    hint_rate: pct(questionsWithHints, totalQuestions),
    hints_used: hintsUsed,
    completion_time: Math.round((meta.sessionDurationMs || totalResponseMs) / 1000),
    average_response_time:
      totalQuestions > 0 ? secs1(totalResponseMs / totalQuestions) : 0,
    question_details: records.map((r) => ({
      object_id: r.objectId,
      name: r.name,
      region: r.region,
      category: r.category,
      difficulty: r.difficulty,
      attempts: r.attempts,
      hints: r.hintsShown,
      correct: r.correct,
      response_time_sec: secs1(r.responseTimeMs || 0),
    })),
    played_at: new Date().toISOString(),
  };
}