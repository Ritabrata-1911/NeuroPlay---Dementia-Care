import { supabase } from './SupabaseClient';

/*
 * Emotional & Mental Engagement service — mood check-ins, the daily
 * reflective prompt, and Memory Lane (reminiscence activity) responses.
 * Kept separate from ReminderService.js so that file doesn't grow to
 * cover a conceptually different feature area, following the same
 * "one table, RPC-gated writes, plain selects for reads" pattern.
 *
 * Table: public.mood_logs
 *   id                   uuid primary key default gen_random_uuid()
 *   patient_id           uuid not null references patients(id)
 *   mood                 text not null            -- 'great' | 'calm' | 'tired' | 'unsure'
 *   logged_date          date not null default current_date
 *   reflection_prompt    text
 *   reflection_response  text
 *   created_at           timestamptz default now()
 *   unique (patient_id, logged_date)
 *
 * Table: public.memory_lane_responses
 *   id                uuid primary key default gen_random_uuid()
 *   patient_id        uuid not null references patients(id)
 *   prompt_id         text not null
 *   reaction          text                -- 'loved' | 'nice' | 'unsure' | 'more'
 *   response_text     text
 *   voice_note_url    text
 *   created_at        timestamptz default now()
 *
 * Patient devices run under the anon key and can't write these tables
 * directly, so writes go through SECURITY DEFINER RPCs (see
 * backend-instructions.md):
 *   log_patient_mood(p_patient_id, p_mood, p_reflection_prompt, p_reflection_response)
 *     -- upserts on (patient_id, logged_date)
 *   log_memory_lane_response(p_patient_id, p_prompt_id, p_reaction, p_response_text, p_voice_note_url)
 *     -- inserts a new row
 * Caregivers read both tables directly via normal `select`, scoped by
 * existing RLS to their own patients — same as reminders.
 */

const todayStr = () => new Date().toISOString().slice(0, 10);

// ============================================================
// MOOD CHECK-IN
// ============================================================

// Logs (or updates, if already checked in today) the patient's mood,
// optionally along with their answer to today's reflective prompt.
// Returns the saved row, or null on failure.
export async function logPatientMood(patientId, mood, reflectionPrompt = null, reflectionResponse = null) {
    if (!patientId || !mood) return null;

    const { data, error } = await supabase.rpc('log_patient_mood', {
        p_patient_id: patientId,
        p_mood: mood,
        p_reflection_prompt: reflectionPrompt,
        p_reflection_response: reflectionResponse,
    });

    if (error) {
        console.error('Unable to log mood:', error.message);
        return null;
    }

    return Array.isArray(data) ? data[0] : data;
}

// Fetches just today's entry (if any), so the dashboard can show the
// patient's existing selection pre-filled rather than a blank picker
// on reopen.
export async function fetchTodaysMood(patientId) {
    if (!patientId) return null;

    const { data, error } = await supabase
        .from('mood_logs')
        .select('*')
        .eq('patient_id', patientId)
        .eq('logged_date', todayStr())
        .maybeSingle();

    if (error) {
        console.error('Unable to fetch today\'s mood:', error.message);
        return null;
    }

    return data || null;
}

// Fetches the last `days` days of mood history, most recent first —
// used for the caregiver's 7-day trend widget.
export async function fetchMoodHistory(patientId, days = 7) {
    if (!patientId) return [];

    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    const sinceStr = since.toISOString().slice(0, 10);

    const { data, error } = await supabase
        .from('mood_logs')
        .select('*')
        .eq('patient_id', patientId)
        .gte('logged_date', sinceStr)
        .order('logged_date', { ascending: true });

    if (error) {
        console.error('Unable to fetch mood history:', error.message);
        return [];
    }

    return data || [];
}

// ============================================================
// DAILY REFLECTIVE PROMPT
// ============================================================

// A small rotating set — deterministic by day so every patient sees
// the same warm, low-effort prompt on a given date and it doesn't
// reshuffle on every reload.
const DAILY_REFLECTIVE_PROMPTS = [
    'What made you smile today?',
    'Tell me about a favorite memory.',
    'Who did you talk to today that made you happy?',
    'What is something you are looking forward to?',
    "What's a small thing that felt good today?",
    'Is there a song that always lifts your mood?',
    'What is a place that feels peaceful to you?',
];

function dayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    return Math.floor(diff / 86400000);
}

// Returns today's prompt text — the same for every patient on a
// given calendar day.
export function getDailyReflectivePrompt() {
    const index = dayOfYear(new Date()) % DAILY_REFLECTIVE_PROMPTS.length;
    return DAILY_REFLECTIVE_PROMPTS[index];
}

// ============================================================
// MEMORY LANE (reminiscence activity)
// ============================================================

// Static v1 prompt library — NER-specific imagery/themes rather than
// generic stock content (per spec 3.1 / point d). Move to a `content`
// table later if caregiver-editable, per-region prompt sets are wanted.
const MEMORY_LANE_PROMPTS = [
    {
        id: 'bihu-festival',
        emoji: '🌾',
        title: 'Bihu Festival',
        question: 'Does this remind you of a Bihu celebration you enjoyed?',
    },
    {
        id: 'hornbill-festival',
        emoji: '🪶',
        title: 'Hornbill Festival',
        question: 'Have you ever attended a Hornbill Festival, or heard stories about one?',
    },
    {
        id: 'home-cooked-meal',
        emoji: '🍛',
        title: 'A Home-Cooked Meal',
        question: "What's a meal like this called in your family?",
    },
    {
        id: 'childhood-game',
        emoji: '🪁',
        title: 'A Childhood Game',
        question: 'Did you play a game like this as a child?',
    },
    {
        id: 'tea-garden',
        emoji: '🍃',
        title: 'A Tea Garden',
        question: 'Does this remind you of a place near where you grew up?',
    },
    {
        id: 'river-landscape',
        emoji: '🏞️',
        title: 'A Familiar River',
        question: 'Is there a river or landscape from home that this brings to mind?',
    },
    {
        id: 'bamboo-craft',
        emoji: '🎍',
        title: 'Bamboo Craft',
        question: 'Did anyone in your family make things like this?',
    },
    {
        id: 'winter-fair',
        emoji: '🔥',
        title: 'A Winter Gathering',
        question: 'Do you remember gathering with family or neighbors like this?',
    },
];

// Static for v1 — kept as a function so callers don't need to know
// that, and so it can become an async fetch from a `content` table
// later with no call-site changes.
export function fetchMemoryLanePrompts() {
    return MEMORY_LANE_PROMPTS;
}

// Records a patient's reaction to a Memory Lane prompt. No score, no
// "correct" reaction — just a warm log of engagement. Returns the
// saved row, or null on failure.
export async function logMemoryLaneResponse(patientId, promptId, reaction = null, responseText = null, voiceNoteUrl = null) {
    if (!patientId || !promptId) return null;

    const { data, error } = await supabase.rpc('log_memory_lane_response', {
        p_patient_id: patientId,
        p_prompt_id: promptId,
        p_reaction: reaction,
        p_response_text: responseText,
        p_voice_note_url: voiceNoteUrl,
    });

    if (error) {
        console.error('Unable to log Memory Lane response:', error.message);
        return null;
    }

    return Array.isArray(data) ? data[0] : data;
}

// Fetches the most recent Memory Lane responses for a patient — used
// on the caregiver's Mood & Engagement card as a conversation-starter
// feed ("I saw you mentioned Bihu, tell me about that!").
export async function fetchMemoryLaneResponses(patientId, limit = 5) {
    if (!patientId) return [];

    const { data, error } = await supabase
        .from('memory_lane_responses')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Unable to fetch Memory Lane responses:', error.message);
        return [];
    }

    return data || [];
}