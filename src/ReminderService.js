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

const todayStr = () => new Date().toISOString().slice(0, 10);

// A reminder only counts as "completed" for today — this way a
// checked-off reminder automatically resets at midnight without
// needing a cron job anywhere.
function normalize(row) {
    if (!row) return row;
    const completedToday = Boolean(row.completed) && row.completion_date === todayStr();
    return { ...row, completed: completedToday };
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

    return (data || []).map(normalize);
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