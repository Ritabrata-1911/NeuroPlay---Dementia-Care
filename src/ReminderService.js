import { supabase } from './SupabaseClient';

export const BASIC_REMINDERS = [
    {
        id: 'medication',
        title: 'Medicine reminder',
        description: 'Remember your scheduled medicine.',
        time: '',
        category: 'medicine',
        icon: '💊',
    },
    {
        id: 'hydration',
        title: 'Drink some water',
        description: 'Take a moment for a glass of water.',
        time: '',
        category: 'hydration',
        icon: '💧',
    },
    {
        id: 'activity',
        title: 'Daily activity',
        description:
            'Spend a little time on an everyday activity.',
        time: '',
        category: 'activity',
        icon: '📅',
    },
    {
        id: 'appointment',
        title: 'Check today’s appointments',
        description:
            'Review any appointments planned for today.',
        time: '',
        category: 'appointment',
        icon: '🏥',
    },
];

const LOCAL_STORAGE_PREFIX = 'neuroplay_reminders_';

const getStorageKey = (patientId) =>
    `${LOCAL_STORAGE_PREFIX}${patientId}`;

const getToday = () =>
    new Date().toISOString().slice(0, 10);

const safeReadLocalReminders = (patientId) => {
    try {
        const raw = localStorage.getItem(
            getStorageKey(patientId)
        );

        if (!raw) return [];

        const parsed = JSON.parse(raw);

        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const safeWriteLocalReminders = (
    patientId,
    reminders
) => {
    try {
        localStorage.setItem(
            getStorageKey(patientId),
            JSON.stringify(reminders)
        );
    } catch {
        // localStorage may be unavailable.
    }
};

const normalizeReminder = (reminder) => {
    const today = getToday();

    const completedToday =
        reminder.completion_date === today
            ? Boolean(reminder.completed)
            : false;

    return {
        ...reminder,
        completed: completedToday,
        enabled:
            reminder.enabled !== false,
    };
};

const sortReminders = (reminders) => {
    return [...reminders].sort((a, b) => {
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }

        if (a.time && b.time) {
            return a.time.localeCompare(b.time);
        }

        if (a.time && !b.time) return -1;
        if (!a.time && b.time) return 1;

        return String(a.title || '').localeCompare(
            String(b.title || '')
        );
    });
};

const mergeBasicReminders = (
    reminders,
    patientId
) => {
    const existingTitles = new Set(
        reminders.map((item) => item.title)
    );

    const basic = BASIC_REMINDERS.map((item) => ({
        id: `basic-${item.id}-${patientId}`,
        patient_id: patientId,
        title: item.title,
        description: item.description,
        time: item.time,
        category: item.category,
        icon: item.icon,
        is_basic: true,
        enabled: true,
        completed: false,
        completion_date: null,
    }));

    return [
        ...basic.filter(
            (item) => !existingTitles.has(item.title)
        ),
        ...reminders,
    ];
};

export async function fetchRemindersForPatient(
    patientId
) {
    if (!patientId) return [];

    const {
        data,
        error,
    } = await supabase
        .from('reminders')
        .select('*')
        .eq('patient_id', patientId)
        .eq('enabled', true)
        .order('time', {
            ascending: true,
            nullsFirst: false,
        })
        .order('created_at', {
            ascending: true,
        });

    if (!error && Array.isArray(data)) {
        const normalized = data.map(normalizeReminder);

        const merged = mergeBasicReminders(
            normalized,
            patientId
        );

        return sortReminders(merged);
    }

    /*
     * The reminders table may not exist yet.
     * Fall back to browser storage so the UI can still
     * be developed before the backend is added.
     */
    if (error) {
        console.warn(
            'Supabase reminders table unavailable. Using local reminder storage.',
            error.message
        );
    }

    const localReminders =
        safeReadLocalReminders(patientId).map(
            normalizeReminder
        );

    return sortReminders(
        mergeBasicReminders(
            localReminders,
            patientId
        )
    );
}

export async function saveReminder(
    reminder
) {
    if (!reminder?.patient_id) {
        return null;
    }

    const payload = {
        patient_id: reminder.patient_id,
        caregiver_id:
            reminder.caregiver_id || null,
        title: reminder.title,
        description:
            reminder.description || '',
        time: reminder.time || null,
        category:
            reminder.category || 'custom',
        is_basic:
            Boolean(reminder.is_basic),
        enabled:
            reminder.enabled !== false,
        completed:
            Boolean(reminder.completed),
        completed_at:
            reminder.completed_at || null,
        completion_date:
            reminder.completion_date || null,
    };

    /*
     * Existing custom reminder:
     * update the existing database row.
     */
    if (reminder.id && !String(reminder.id).startsWith('basic-')) {
        const {
            data,
            error,
        } = await supabase
            .from('reminders')
            .update(payload)
            .eq('id', reminder.id)
            .select()
            .single();

        if (!error && data) {
            return normalizeReminder(data);
        }

        if (error) {
            console.warn(
                'Unable to update reminder in Supabase. Using local storage.',
                error.message
            );
        }
    }

    /*
     * Basic reminders use a stable title/patient lookup.
     * This allows the same basic reminder to be shared
     * across caregiver and patient dashboards.
     */
    if (reminder.is_basic) {
        const {
            data: existing,
            error: findError,
        } = await supabase
            .from('reminders')
            .select('*')
            .eq('patient_id', reminder.patient_id)
            .eq('is_basic', true)
            .eq('title', reminder.title)
            .maybeSingle();

        if (!findError && existing) {
            const {
                data,
                error,
            } = await supabase
                .from('reminders')
                .update(payload)
                .eq('id', existing.id)
                .select()
                .single();

            if (!error && data) {
                return normalizeReminder(data);
            }
        }

        const {
            data,
            error,
        } = await supabase
            .from('reminders')
            .insert(payload)
            .select()
            .single();

        if (!error && data) {
            return normalizeReminder(data);
        }
    } else {
        /*
         * New custom reminder.
         */
        const {
            data,
            error,
        } = await supabase
            .from('reminders')
            .insert(payload)
            .select()
            .single();

        if (!error && data) {
            return normalizeReminder(data);
        }

        if (error) {
            console.warn(
                'Unable to insert reminder in Supabase. Using local storage.',
                error.message
            );
        }
    }

    /*
     * Browser fallback.
     */
    const local = safeReadLocalReminders(
        reminder.patient_id
    );

    const localId =
        reminder.id ||
        `local-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`;

    const localReminder = normalizeReminder({
        ...payload,
        ...reminder,
        id: localId,
        patient_id: reminder.patient_id,
        created_at:
            reminder.created_at ||
            new Date().toISOString(),
        updated_at:
            new Date().toISOString(),
    });

    const index = local.findIndex(
        (item) => item.id === localId
    );

    if (index >= 0) {
        local[index] = localReminder;
    } else {
        local.unshift(localReminder);
    }

    safeWriteLocalReminders(
        reminder.patient_id,
        local
    );

    return localReminder;
}

export async function toggleReminderCompletion(
    reminder
) {
    if (!reminder?.patient_id) {
        return null;
    }

    const completed = !Boolean(
        reminder.completed
    );

    const today = getToday();

    const payload = {
        completed,
        completed_at: completed
            ? new Date().toISOString()
            : null,
        completion_date: completed
            ? today
            : null,
        updated_at:
            new Date().toISOString(),
    };

    /*
     * Database-backed custom reminder.
     */
    if (
        reminder.id &&
        !String(reminder.id).startsWith('basic-') &&
        !String(reminder.id).startsWith('local-')
    ) {
        const {
            data,
            error,
        } = await supabase
            .from('reminders')
            .update(payload)
            .eq('id', reminder.id)
            .select()
            .single();

        if (!error && data) {
            return normalizeReminder(data);
        }

        if (error) {
            console.warn(
                'Unable to update reminder completion in Supabase.',
                error.message
            );
        }
    }

    /*
     * Basic reminder:
     * locate its database row using patient + title.
     */
    if (reminder.is_basic) {
        const {
            data: existing,
            error: findError,
        } = await supabase
            .from('reminders')
            .select('*')
            .eq('patient_id', reminder.patient_id)
            .eq('is_basic', true)
            .eq('title', reminder.title)
            .maybeSingle();

        if (!findError && existing) {
            const {
                data,
                error,
            } = await supabase
                .from('reminders')
                .update(payload)
                .eq('id', existing.id)
                .select()
                .single();

            if (!error && data) {
                return normalizeReminder(data);
            }
        }
    }

    /*
     * Local fallback.
     */
    const local = safeReadLocalReminders(
        reminder.patient_id
    );

    const updated = {
        ...reminder,
        ...payload,
        completed,
    };

    const index = local.findIndex(
        (item) =>
            item.id === reminder.id ||
            (
                item.title === reminder.title &&
                item.patient_id ===
                    reminder.patient_id
            )
    );

    if (index >= 0) {
        local[index] = updated;
    } else {
        local.push(updated);
    }

    safeWriteLocalReminders(
        reminder.patient_id,
        local
    );

    window.dispatchEvent(
        new CustomEvent(
            'neuroplay-reminder-change',
            {
                detail: {
                    patientId:
                        reminder.patient_id,
                },
            }
        )
    );

    return normalizeReminder(updated);
}

export async function deleteReminder(
    reminder
) {
    if (!reminder?.patient_id) {
        return false;
    }

    /*
     * Basic reminders are not permanently deleted.
     * They can simply be disabled.
     */
    if (reminder.is_basic) {
        if (
            reminder.id &&
            !String(reminder.id).startsWith(
                'basic-'
            )
        ) {
            const { error } =
                await supabase
                    .from('reminders')
                    .update({
                        enabled: false,
                        updated_at:
                            new Date().toISOString(),
                    })
                    .eq(
                        'id',
                        reminder.id
                    );

            if (!error) return true;
        }

        return true;
    }

    if (
        reminder.id &&
        !String(reminder.id).startsWith('local-')
    ) {
        const { error } =
            await supabase
                .from('reminders')
                .delete()
                .eq('id', reminder.id);

        if (!error) {
            return true;
        }

        console.warn(
            'Unable to delete reminder from Supabase. Removing local copy instead.',
            error.message
        );
    }

    const local = safeReadLocalReminders(
        reminder.patient_id
    );

    const filtered = local.filter(
        (item) => item.id !== reminder.id
    );

    safeWriteLocalReminders(
        reminder.patient_id,
        filtered
    );

    window.dispatchEvent(
        new CustomEvent(
            'neuroplay-reminder-change',
            {
                detail: {
                    patientId:
                        reminder.patient_id,
                },
            }
        )
    );

    return true;
}

export function subscribeToReminderChanges(
    patientId,
    onChange
) {
    if (!patientId) {
        return () => {};
    }

    let channel;

    try {
        channel = supabase
            .channel(
                `neuroplay-reminders-${patientId}`
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'reminders',
                    filter: `patient_id=eq.${patientId}`,
                },
                async () => {
                    try {
                        const reminders =
                            await fetchRemindersForPatient(
                                patientId
                            );

                        onChange?.(reminders);
                    } catch (error) {
                        console.error(
                            'Unable to refresh reminders:',
                            error
                        );
                    }
                }
            )
            .subscribe();
    } catch (error) {
        console.error(
            'Unable to subscribe to reminder changes:',
            error
        );
    }

    const handleLocalChange = async (
        event
    ) => {
        if (
            event?.detail?.patientId !==
            patientId
        ) {
            return;
        }

        const reminders =
            await fetchRemindersForPatient(
                patientId
            );

        onChange?.(reminders);
    };

    window.addEventListener(
        'neuroplay-reminder-change',
        handleLocalChange
    );

    const handleStorageChange = async (
        event
    ) => {
        if (
            event.key !==
            getStorageKey(patientId)
        ) {
            return;
        }

        const reminders =
            await fetchRemindersForPatient(
                patientId
            );

        onChange?.(reminders);
    };

    window.addEventListener(
        'storage',
        handleStorageChange
    );

    return () => {
        window.removeEventListener(
            'neuroplay-reminder-change',
            handleLocalChange
        );

        window.removeEventListener(
            'storage',
            handleStorageChange
        );

        if (channel) {
            supabase.removeChannel(channel);
        }
    };
}

/*
 * Alias used by dashboards that prefer the shorter
 * getReminders() name.
 */
export const getReminders =
    fetchRemindersForPatient;