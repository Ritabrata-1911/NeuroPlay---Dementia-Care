import { supabase } from './SupabaseClient';

/*
 * Shared reminder service — used by BOTH CaregiverDashboard and
 * PatientDashboard so the two surfaces stay in sync automatically.
 * Talks to Supabase only — no local/offline fallback, so once the
 * `reminders` table + policies are in place (see backend-instructions.md)
 * this is the single source of truth for both dashboards.
 *
 * Table: public.reminders
 *   id              uuid primary key default gen_random_uuid()
 *   patient_id      uuid not null references patients(id)
 *   caregiver_id    uuid references auth.users(id)
 *   created_by      text  -- 'caregiver' | 'patient'
 *   title           text not null
 *   description     text
 *   time            text  -- 'HH:MM', optional
 *   category        text default 'custom'
 *   is_basic        boolean default false
 *   enabled         boolean default true
 *   completed       boolean default false
 *   completion_date date  -- date it was last marked complete
 *   created_at      timestamptz default now()
 *   updated_at      timestamptz default now()
 *
 *   -- Daily Routine columns (medicine / hydration / activity / appointment).
 *   -- See backend-instructions.md for the exact migration SQL.
 *   routine_type    text  -- 'medicine' | 'hydration' | 'activity' | 'appointment' | null
 *   event_date      date  -- appointment date
 *   target_count    integer  -- hydration daily target (e.g. glasses)
 *   progress_count  integer default 0  -- hydration progress so far today
 *   progress_date   date  -- the day progress_count applies to (resets when stale)
 *
 * Realtime must be enabled on this table (see backend-instructions.md).
 */

// The four starter reminders every patient gets by default. The
// caregiver dashboard renders these as toggle chips; when toggled
// on, a real row is created in the `reminders` table (is_basic:
// true) so it can be checked off and synced like any other reminder.
export const BASIC_REMINDERS = [
    {
        id: 'medication',
        title: 'Medicine reminder',
        description: 'Remember your scheduled medicine.',
        time: '',
        category: 'basic',
        icon: '💊',
    },
    {
        id: 'hydration',
        title: 'Drink some water',
        description: 'Take a moment for a glass of water.',
        time: '',
        category: 'basic',
        icon: '💧',
    },
    {
        id: 'activity',
        title: 'Daily activity',
        description: 'Spend a little time on an everyday activity.',
        time: '',
        category: 'basic',
        icon: '📅',
    },
    {
        id: 'appointments',
        title: "Check today's appointments",
        description: 'Review any appointments planned for today.',
        time: '',
        category: 'basic',
        icon: '🪪',
    },
];

// Daily Routine item types — caregiver-only, persistent (never deleted
// on a day rollover), completion/progress resets automatically each
// day the same way basic reminders already do.
export const ROUTINE_TYPES = {
    MEDICINE: 'medicine',
    HYDRATION: 'hydration',
    ACTIVITY: 'activity',
    APPOINTMENT: 'appointment',
};

const todayStr = () => new Date().toISOString().slice(0, 10);

// A reminder only counts as "completed" for today — this way a
// checked-off reminder automatically resets at midnight without
// needing a cron job anywhere. Hydration's progress_count resets the
// same way, keyed off its own progress_date so a half-finished count
// doesn't get wiped out mid-day.
function normalize(row) {
    if (!row) return row;
    const today = todayStr();
    const completedToday = Boolean(row.completed) && row.completion_date === today;
    const progressToday = row.progress_date === today ? (row.progress_count || 0) : 0;
    return { ...row, completed: completedToday, progress_count: progressToday };
}

// Custom reminders are single-day to-dos, not recurring tasks — once
// the day they were created on has passed, they should disappear
// entirely rather than pile up. Basic reminders are exempt; those are
// meant to recur every day. Deletion happens client-side (calling the
// same `reminders` table the rest of this file already talks to) —
// no schema or backend change involved.
function isFromPreviousDay(row) {
    if (!row?.created_at) return false;
    return String(row.created_at).slice(0, 10) !== todayStr();
}

async function pruneStaleCustomReminders(rows) {
    const stale = rows.filter((row) => !row.is_basic && isFromPreviousDay(row));
    if (stale.length === 0) return;

    const { error } = await supabase
        .from('reminders')
        .delete()
        .in('id', stale.map((row) => row.id));

    if (error) {
        console.error('Unable to prune stale reminders:', error.message);
    }
}

export async function fetchRemindersForPatient(patientId) {
    if (!patientId) return [];

    const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Unable to fetch reminders:', error.message);
        return [];
    }

    const rows = data || [];
    const fresh = rows.filter((row) => row.is_basic || !isFromPreviousDay(row));

    // Fire-and-forget: don't make the caller wait on the cleanup —
    // the stale rows are already excluded from what's returned below,
    // so the UI is correct immediately either way.
    pruneStaleCustomReminders(rows);

    return fresh.map(normalize);
}

// Alias in case other code in the project calls it by this name.
export const getReminders = fetchRemindersForPatient;

// Creates a reminder when `reminder.id` is missing (or is a local
// "basic-..." placeholder id), otherwise updates the existing row.
// For basic reminders without an id yet, looks up any existing row
// for that patient + title first so re-enabling a basic reminder
// updates it instead of creating a duplicate.
export async function saveReminder(reminder) {
    if (!reminder?.patient_id || !reminder?.title) return null;

    let existingId = reminder.id && !String(reminder.id).startsWith('basic-')
        ? reminder.id
        : null;

    if (!existingId && reminder.is_basic) {
        const { data: existing } = await supabase
            .from('reminders')
            .select('id')
            .eq('patient_id', reminder.patient_id)
            .eq('is_basic', true)
            .eq('title', reminder.title)
            .maybeSingle();

        if (existing?.id) existingId = existing.id;
    }

    const payload = {
        ...(existingId ? { id: existingId } : {}),
        patient_id: reminder.patient_id,
        caregiver_id: reminder.caregiver_id ?? null,
        created_by: reminder.created_by || (reminder.caregiver_id ? 'caregiver' : 'patient'),
        title: reminder.title,
        description: reminder.description || '',
        time: reminder.time || null,
        category: reminder.category || 'custom',
        is_basic: Boolean(reminder.is_basic),
        enabled: reminder.enabled ?? true,
        completed: Boolean(reminder.completed),
        completion_date: reminder.completed ? (reminder.completion_date || todayStr()) : null,
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('reminders')
        .upsert(payload)
        .select()
        .single();

    if (error) {
        console.error('Unable to save reminder:', error.message);
        return null;
    }

    return normalize(data);
}

export async function toggleReminderCompletion(reminder) {
    if (!reminder?.id) return null;

    const willComplete = !reminder.completed;

    const { data, error } = await supabase
        .from('reminders')
        .update({
            completed: willComplete,
            completion_date: willComplete ? todayStr() : null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', reminder.id)
        .select()
        .single();

    if (error) {
        console.error('Unable to update reminder:', error.message);
        return null;
    }

    return normalize(data);
}

// Basic reminders are never hard-deleted (the caregiver toggles them
// off instead, via saveReminder with enabled: false). Custom reminders
// are removed outright.
export async function deleteReminder(reminder) {
    if (!reminder?.id) return false;

    if (reminder.is_basic) {
        const { error } = await supabase
            .from('reminders')
            .update({ enabled: false, updated_at: new Date().toISOString() })
            .eq('id', reminder.id);

        if (error) {
            console.error('Unable to disable basic reminder:', error.message);
            return false;
        }
        return true;
    }

    const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', reminder.id);

    if (error) {
        console.error('Unable to delete reminder:', error.message);
        return false;
    }

    return true;
}

// ============================================================
// DAILY ROUTINE ITEMS (medicine / activity / appointment / hydration)
// Caregiver-only: patients can view + mark complete / log water,
// but never create, edit, or delete these. They're stored as
// is_basic rows in the same `reminders` table (so they auto-survive
// the daily prune and reset their completion status for free), with
// `routine_type` set so the UI can group them.
// ============================================================

// Lightweight readiness check for the Daily Routine migration. Used
// by the Caregiver Dashboard to show a clear "setup pending" banner
// instead of routine adds silently failing when the
// routine_type/event_date/target_count/progress_count/progress_date
// columns don't exist on `reminders` yet (see backend-instructions.md).
export async function checkRoutineSchemaReady() {
    const { error } = await supabase
        .from('reminders')
        .select('routine_type')
        .limit(1);

    if (error && /column .*routine_type.* does not exist/i.test(error.message)) {
        return false;
    }

    return true;
}

// Generic save for medicine / activity / appointment rows. Pass an
// `id` to update an existing item, omit it to create a new one.
export async function saveRoutineItem(item) {
    if (!item?.patient_id || !item?.title || !item?.routine_type) return null;

    const payload = {
        ...(item.id ? { id: item.id } : {}),
        patient_id: item.patient_id,
        caregiver_id: item.caregiver_id ?? null,
        created_by: 'caregiver',
        title: item.title,
        description: item.description || '',
        time: item.time || null,
        event_date: item.event_date || null,
        category: item.routine_type,
        routine_type: item.routine_type,
        is_basic: true,
        enabled: item.enabled ?? true,
        completed: Boolean(item.completed),
        completion_date: item.completed ? (item.completion_date || todayStr()) : null,
        target_count: item.target_count ?? null,
        progress_count: item.progress_count ?? 0,
        progress_date: item.progress_date ?? null,
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('reminders')
        .upsert(payload)
        .select()
        .single();

    if (error) {
        console.error('Unable to save routine item:', error.message);
        return null;
    }

    return normalize(data);
}

// Caregiver-only hard delete — used for removing a medicine, an
// activity, or an appointment from the daily plan entirely (not a
// daily reset, an actual "this no longer applies" removal).
export async function deleteRoutineItem(item) {
    if (!item?.id) return false;

    const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', item.id);

    if (error) {
        console.error('Unable to delete routine item:', error.message);
        return false;
    }

    return true;
}

// Creates the single hydration row for a patient if it doesn't exist
// yet, or updates its daily target if it does. `existing` is the
// current hydration reminder row (or null/undefined the first time).
export async function setHydrationTarget({ patientId, caregiverId, target, existing }) {
    return saveRoutineItem({
        id: existing?.id,
        patient_id: patientId,
        caregiver_id: caregiverId,
        routine_type: ROUTINE_TYPES.HYDRATION,
        title: 'Drink some water',
        description: 'Stay hydrated throughout the day.',
        target_count: target,
        progress_count: existing?.progress_count ?? 0,
        progress_date: existing?.progress_date ?? null,
        completed: existing?.completed ?? false,
        completion_date: existing?.completion_date ?? null,
    });
}

// Routine items (medicine / activity / appointment) are set by the
// caregiver; the patient device runs under the anon key and is not
// allowed to write directly to the `reminders` table for these rows.
// This calls the toggle_patient_reminder RPC your backend exposes,
// which verifies row ownership server-side (id + patient_id must
// match) before flipping completed/completion_date.
export async function togglePatientRoutineCompletion(reminder) {
    if (!reminder?.id || !reminder?.patient_id) return null;

    const { data, error } = await supabase.rpc('toggle_patient_reminder', {
        p_reminder_id: reminder.id,
        p_patient_id: reminder.patient_id,
    });

    if (error) {
        console.error('Unable to toggle routine item:', error.message);
        return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    return normalize(row);
}

// +1 / -1 glass of water, via the log_patient_hydration RPC (patient
// devices can't write progress_count/completed directly). One RPC
// covers both directions — p_delta is +1 for a logged glass, -1 to
// undo one.
async function adjustHydration(reminder, delta) {
    if (!reminder?.id || !reminder?.patient_id) return null;

    const { data, error } = await supabase.rpc('log_patient_hydration', {
        p_reminder_id: reminder.id,
        p_patient_id: reminder.patient_id,
        p_delta: delta,
    });

    if (error) {
        console.error('Unable to update hydration progress:', error.message);
        return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    return normalize(row);
}

export const incrementHydration = (reminder) => adjustHydration(reminder, 1);
export const decrementHydration = (reminder) => adjustHydration(reminder, -1);

// Subscribes to every insert/update/delete for one patient's
// reminders and re-fetches the full list on change, so both the
// caregiver and patient dashboards refresh in real time no matter
// who made the edit. Returns an unsubscribe function.
export function subscribeToReminderChanges(patientId, onChange) {
    if (!patientId) return () => {};

    const channel = supabase
        .channel(`reminders-${patientId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'reminders',
                filter: `patient_id=eq.${patientId}`,
            },
            () => {
                fetchRemindersForPatient(patientId).then(onChange);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}