import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from './SupabaseClient';
import AddPatientForm from './AddPatientForm';
import CodeCountdown from './CodeCountdown';
import SettingsPanel from './SettingsPanel';
import './CaregiverDashboard.css';
import {
    fetchRemindersForPatient,
    saveReminder,
    toggleReminderCompletion,
    deleteReminder,
    subscribeToReminderChanges,
    saveRoutineItem,
    deleteRoutineItem,
    setHydrationTarget,
} from './ReminderService';
import {
    fetchMoodHistory,
    fetchMemoryLaneResponses,
} from './EngagementService';
import {
    useStatusTick,
    ReminderStatusBadge,
    getReminderRowClassName,
} from './useReminderAlarms';

// Picks a gender-appropriate avatar for a patient card.
const getPatientAvatar = (patient) => {
    const raw = patient?.gender ?? patient?.sex ?? patient?.patient_gender ?? '';
    const value = String(raw).trim().toLowerCase();

    if (['male', 'm', 'man', 'boy'].includes(value)) {
        return { emoji: '👴', label: 'male patient', ring: 'ring-blue' };
    }

    if (['female', 'f', 'woman', 'girl'].includes(value)) {
        return { emoji: '👵', label: 'female patient', ring: 'ring-pink' };
    }

    return { emoji: '🧓', label: 'patient', ring: 'ring-neutral' };
};

const getMessageInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const formatJoinedDate = (isoString) => {
    if (!isoString) return null;

    const d = new Date(isoString);

    if (Number.isNaN(d.getTime())) return null;

    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

const formatSessionDate = (isoString) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour < 12) return 'caregiverDashboard.header.greeting.morning';
    if (hour < 17) return 'caregiverDashboard.header.greeting.afternoon';

    return 'caregiverDashboard.header.greeting.evening';
};

const PROFILE_FIELDS = [
    { key: 'full_name', labelKey: 'caregiverDashboard.profile.fullName' },
    { key: 'phone_number', labelKey: 'caregiverDashboard.profile.phoneNumber' },
    { key: 'alt_phone', labelKey: 'caregiverDashboard.profile.alternatePhone' },
    { key: 'dob', labelKey: 'caregiverDashboard.profile.dateOfBirth' },
    { key: 'gender', labelKey: 'caregiverDashboard.profile.gender' },
    { key: 'area', labelKey: 'caregiverDashboard.profile.area' },
    { key: 'address', labelKey: 'caregiverDashboard.profile.address' },
    { key: 'country', labelKey: 'caregiverDashboard.profile.country' },
    { key: 'relationship', labelKey: 'caregiverDashboard.profile.relationshipToPatient' },
    { key: 'experience', labelKey: 'caregiverDashboard.profile.yearsOfExperience' },
    { key: 'emergency_name', labelKey: 'caregiverDashboard.profile.emergencyContact' },
    { key: 'emergency_phone', labelKey: 'caregiverDashboard.profile.emergencyContactPhone' },
];

const SIDEBAR_LINKS = [
    { key: 'dashboard', icon: '🏠', labelKey: 'caregiverDashboard.sidebar.dashboard' },
    { key: 'patients', icon: '🧑‍🤝‍🧑', labelKey: 'caregiverDashboard.sidebar.patients' },
    { key: 'reminders', icon: '⏰', labelKey: 'caregiverDashboard.sidebar.reminders' },
    { key: 'reports', icon: '📊', labelKey: 'caregiverDashboard.sidebar.reports' },
    { key: 'resources', icon: '📘', labelKey: 'caregiverDashboard.sidebar.resources' },
    { key: 'settings', icon: '⚙️', labelKey: 'caregiverDashboard.sidebar.settings' },
];

const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
});

const GAME_META = {
    memory_match: { labelKey: 'caregiverDashboard.games.memoryMatch', icon: '🧩' },
    number_memory: { labelKey: 'caregiverDashboard.games.numberMemory', icon: '🔢' },
    picture_recall: { labelKey: 'caregiverDashboard.games.pictureRecall', icon: '🖼️' },
};

const buildSampleSessions = (seed) => {
    const games = Object.keys(GAME_META);
    const sessions = [];
    const now = Date.now();

    for (let i = 0; i < 9; i++) {
        const game = games[(i + seed) % games.length];
        const daysAgo = i * 1.6;
        const baseAccuracy = 55 + ((seed * 7 + i * 5) % 40);
        sessions.push({
            id: `sample-${seed}-${i}`,
            game,
            score: Math.round(baseAccuracy * 3.2),
            accuracy: Math.min(98, baseAccuracy),
            duration_seconds: 90 + ((seed + i) % 5) * 30,
            played_at: new Date(now - daysAgo * 86400000).toISOString(),
        });
    }
    return sessions;
};

const getSampleSessionsForPatient = (patientId, index) => buildSampleSessions(index || 0);

const summarizeSessionsByGame = (sessions) => {
    const byGame = {};
    Object.keys(GAME_META).forEach((g) => {
        byGame[g] = { count: 0, bestScore: 0, accuracySum: 0 };
    });

    sessions.forEach((s) => {
        const bucket = byGame[s.game];
        if (!bucket) return;
        bucket.count += 1;
        bucket.bestScore = Math.max(bucket.bestScore, s.score);
        bucket.accuracySum += s.accuracy;
    });

    return byGame;
};

export default function CaregiverDashboard() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [view, setView] = useState('dashboard');
    const [user, setUser] = useState(null);
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [reportsPatientId, setReportsPatientId] = useState(null);
    const [activeResourceModal, setActiveResourceModal] = useState(null);
    const [emergencyCardPatientId, setEmergencyCardPatientId] = useState(null);

    const [reminders, setReminders] = useState([]);
    const [reminderPatientId, setReminderPatientId] = useState(null);
    const [reminderLoading, setReminderLoading] = useState(false);
    const [showReminderForm, setShowReminderForm] = useState(false);
    const [editingReminder, setEditingReminder] = useState(null);
    const [reminderForm, setReminderForm] = useState({
        title: '',
        description: '',
        time: '',
        category: 'custom',
    });

    // Daily Routine (medicine / activity / appointment / hydration) —
    // caregiver-only. Set once, repeats every day until edited; the
    // patient can only mark items complete, never add/edit/delete.
    const [routineForms, setRoutineForms] = useState({
        medicine: { open: false, editingId: null, title: '', time: '' },
        activity: { open: false, editingId: null, title: '', time: '' },
        appointment: { open: false, editingId: null, title: '', event_date: '' },
    });
    const [hydrationTargetInput, setHydrationTargetInput] = useState(8);
    const [hydrationSaving, setHydrationSaving] = useState(false);

    const BREATHING_PHASES = ['inhale', 'hold1', 'exhale', 'hold2'];
    const BREATHING_LABELS = { inhale: 'Inhale', hold1: 'Hold', exhale: 'Exhale', hold2: 'Hold' };
    const [breathingActive, setBreathingActive] = useState(false);
    const [breathingPhaseIndex, setBreathingPhaseIndex] = useState(0);
    const [breathingTimer, setBreathingTimer] = useState(4);

    useEffect(() => {
        if (!breathingActive) return;
        const interval = setInterval(() => {
            setBreathingTimer((prev) => {
                if (prev > 1) return prev - 1;
                setBreathingPhaseIndex((idx) => (idx + 1) % BREATHING_PHASES.length);
                return 4;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [breathingActive]);

    const todayKey = `neuroplay_checklist_${new Date().toISOString().slice(0, 10)}`;
    const CHECKLIST_ITEMS = [
        { key: 'medication', labelKey: 'caregiverDashboard.checklist.medication' },
        { key: 'hydration', labelKey: 'caregiverDashboard.checklist.hydration' },
        { key: 'activity', labelKey: 'caregiverDashboard.checklist.activity' },
        { key: 'mood', labelKey: 'caregiverDashboard.checklist.mood' },
    ];
    const [checklistState, setChecklistState] = useState(() => {
        try {
            const saved = localStorage.getItem(todayKey);
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    const toggleChecklistItem = (key) => {
        setChecklistState((prev) => {
            const updated = { ...prev, [key]: !prev[key] };
            try {
                localStorage.setItem(todayKey, JSON.stringify(updated));
            } catch {
                // localStorage unavailable — no-op.
            }
            return updated;
        });
    };

    const [patientOnlineStatus, setPatientOnlineStatus] = useState({});

    // Mood & Engagement — aggregated lightweight view across all of this
    // caregiver's patients, for the dashboard overview card. Mood and
    // Memory Lane tables don't carry patient_name themselves (see
    // EngagementService.js), so it's attached client-side from `patients`.
    const [moodByPatient, setMoodByPatient] = useState({});
    const [memoryLaneFeed, setMemoryLaneFeed] = useState([]);

    useEffect(() => {
        if (patients.length === 0) return;
        let mounted = true;

        (async () => {
            const moodEntries = await Promise.all(
                patients.map(async (p) => ({ patientId: p.id, history: await fetchMoodHistory(p.id, 7) }))
            );

            const laneEntries = await Promise.all(
                patients.map(async (p) => {
                    const rows = await fetchMemoryLaneResponses(p.id, 3);
                    return rows.map((row) => ({ ...row, patient_name: p.full_name || p.name }));
                })
            );

            if (!mounted) return;

            const nextMoodByPatient = {};
            moodEntries.forEach(({ patientId, history }) => {
                nextMoodByPatient[patientId] = history;
            });
            setMoodByPatient(nextMoodByPatient);

            const combinedFeed = laneEntries
                .flat()
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 5);
            setMemoryLaneFeed(combinedFeed);
        })();

        return () => {
            mounted = false;
        };
    }, [patients]);

    const MOOD_EMOJI = { great: '😊', calm: '😌', tired: '🥱', unsure: '🤔' };

    const [patientMessages, setPatientMessages] = useState([]);

    const unreadMessageCount = patientMessages.filter(
        (message) => !message.read_at
    ).length;

    useEffect(() => {
        if (!user?.id) return;

        let mounted = true;

        const loadPatientMessages = async () => {
            const { data, error } = await supabase
                .from('patient_notes')
                .select('*')
                .eq('caregiver_id', user.id)
                .is('archived_at', null)
                .order('created_at', { ascending: false });

            if (!mounted) return;

            if (error) {
                console.error('Unable to load patient notes:', error.message);
                setPatientMessages([]);
                return;
            }

            setPatientMessages(data || []);
        };

        loadPatientMessages();

        const channel = supabase
            .channel(`caregiver-notes-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'patient_notes',
                    filter: `caregiver_id=eq.${user.id}`
                },
                (payload) => {
                    if (!mounted) return;
                    setPatientMessages((previous) => [payload.new, ...previous]);
                }
            )
            .subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    const markNoteAsRead = async (noteId) => {
        setPatientMessages((previous) =>
            previous.map((message) =>
                message.id === noteId
                    ? { ...message, read_at: new Date().toISOString() }
                    : message
            )
        );

        const { error } = await supabase
            .from('patient_notes')
            .update({ read_at: new Date().toISOString() })
            .eq('id', noteId);

        if (error) {
            console.error('Unable to mark note as read:', error.message);
        }
    };

    const markAllNotesAsRead = async () => {
        const unreadIds = patientMessages
            .filter((message) => !message.read_at)
            .map((message) => message.id);

        if (unreadIds.length === 0) return;

        const nowIso = new Date().toISOString();

        setPatientMessages((previous) =>
            previous.map((message) =>
                unreadIds.includes(message.id)
                    ? { ...message, read_at: nowIso }
                    : message
            )
        );

        const { error } = await supabase
            .from('patient_notes')
            .update({ read_at: nowIso })
            .in('id', unreadIds);

        if (error) {
            console.error('Unable to mark all notes as read:', error.message);
        }
    };

    const archiveNote = async (noteId) => {
        setPatientMessages((previous) =>
            previous.filter((message) => message.id !== noteId)
        );

        const { error } = await supabase
            .from('patient_notes')
            .update({ archived_at: new Date().toISOString() })
            .eq('id', noteId);

        if (error) {
            console.error('Unable to archive note:', error.message);
        }
    };

    useEffect(() => {
        fetchUserAndPatients();
    }, []);

    useEffect(() => {
        try {
            const saved =
                localStorage.getItem('neuroplay_large_text') === 'true';

            document.documentElement.style.fontSize = saved ? '18px' : '';
        } catch {
            // localStorage unavailable — no-op.
        }
    }, []);

    useEffect(() => {
        if (patients.length > 0 && !reportsPatientId) {
            setReportsPatientId(patients[0].id);
        }
    }, [patients, reportsPatientId]);


    useEffect(() => {
        if (!patients || patients.length === 0) {
            setPatientOnlineStatus({});
            return;
        }

        const channels = [];

        patients.forEach((patient) => {
            if (!patient?.id) return;

            const channelName =
                `neuroplay-patient-presence-${patient.id}`;

            const channel = supabase.channel(channelName, {
                config: {
                    presence: {
                        key: `caregiver-${user?.id || 'dashboard'}`
                    }
                }
            });

            const updateOnlineStatus = () => {
                const presenceState = channel.presenceState();

                const hasPatientPresence =
                    Object.keys(presenceState).length > 0;

                setPatientOnlineStatus((previous) => ({
                    ...previous,
                    [patient.id]: hasPatientPresence
                }));
            };

            channel.on(
                'presence',
                { event: 'sync' },
                updateOnlineStatus
            );

            channel.on(
                'presence',
                { event: 'join' },
                updateOnlineStatus
            );

            channel.on(
                'presence',
                { event: 'leave' },
                updateOnlineStatus
            );

            channels.push(channel);

            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    updateOnlineStatus();
                }
            });
        });

        return () => {
            channels.forEach((channel) => {
                supabase.removeChannel(channel);
            });
        };
    }, [patients, user?.id]);

    useEffect(() => {
        if (patients.length > 0 && !reminderPatientId) {
            setReminderPatientId(patients[0].id);
        }
    }, [patients, reminderPatientId]);

    useEffect(() => {
        let unsubscribe = null;
        if (!reminderPatientId) {
            setReminders([]);
            return undefined;
        }

        let active = true;
        setReminderLoading(true);
        fetchRemindersForPatient(reminderPatientId).then((data) => {
            if (active) {
                setReminders(data);
                setReminderLoading(false);
            }
        });

        unsubscribe = subscribeToReminderChanges(reminderPatientId, (next) => {
            if (active) setReminders(next);
        });

        return () => {
            active = false;
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, [reminderPatientId]);

    const resetReminderForm = () => {
        setReminderForm({ title: '', description: '', time: '', category: 'custom' });
        setEditingReminder(null);
        setShowReminderForm(false);
    };

    const handleReminderSubmit = async (event) => {
        event.preventDefault();
        if (!reminderPatientId || !reminderForm.title.trim()) return;

        setReminderLoading(true);
        const saved = await saveReminder({
            ...reminderForm,
            title: reminderForm.title.trim(),
            description: reminderForm.description.trim(),
            patient_id: reminderPatientId,
            caregiver_id: user?.id || null,
            id: editingReminder?.id || undefined,
            is_basic: false,
        });

        if (saved) {
            setReminders((prev) => {
                const exists = prev.some((item) => item.id === saved.id);
                return exists ? prev.map((item) => item.id === saved.id ? saved : item) : [saved, ...prev];
            });
        }
        setReminderLoading(false);
        resetReminderForm();
    };

    const handleReminderToggle = async (reminder) => {
        const updated = await toggleReminderCompletion(reminder);
        if (updated) {
            setReminders((prev) => prev.map((item) => item.id === updated.id ? updated : item));
        }
    };

    // Status colors only, no sound/banner — the alarm itself is
    // patient-dashboard-only. This just keeps the badges/tints below
    // ticking live as reminders cross into "missed".
    useStatusTick();

    const handleReminderDelete = async (reminder) => {
        if (!window.confirm(`Delete the reminder "${reminder.title}"?`)) return;
        const removed = await deleteReminder(reminder);
        if (removed) setReminders((prev) => prev.filter((item) => item.id !== reminder.id));
    };

    const openReminderEditor = (reminder) => {
        setEditingReminder(reminder);
        setReminderForm({
            title: reminder.title || '',
            description: reminder.description || '',
            time: reminder.time || '',
            category: reminder.category || 'custom',
        });
        setShowReminderForm(true);
    };

    // Pulls the caregiver's saved hydration target into the input
    // whenever the selected patient (or their loaded reminders) change,
    // so the field always opens showing what's actually saved.
    useEffect(() => {
        const hydration = reminders.find((r) => r.routine_type === 'hydration');
        if (hydration) setHydrationTargetInput(hydration.target_count || 8);
        else setHydrationTargetInput(8);
    }, [reminderPatientId, reminders]);

    const updateRoutineForm = (type, patch) => {
        setRoutineForms((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));
    };

    const openRoutineForm = (type, item = null) => {
        updateRoutineForm(type, item
            ? { open: true, editingId: item.id, title: item.title, time: item.time || '', event_date: item.event_date || '' }
            : { open: true, editingId: null, title: '', time: '', event_date: '' });
    };

    const closeRoutineForm = (type) => {
        updateRoutineForm(type, { open: false, editingId: null, title: '', time: '', event_date: '' });
    };

    const handleRoutineSubmit = async (type, event) => {
        event.preventDefault();
        if (!reminderPatientId) return;
        const form = routineForms[type];
        if (!form.title.trim()) return;

        const saved = await saveRoutineItem({
            id: form.editingId || undefined,
            patient_id: reminderPatientId,
            caregiver_id: user?.id || null,
            routine_type: type,
            title: form.title.trim(),
            time: type !== 'appointment' ? (form.time || null) : null,
            event_date: type === 'appointment' ? (form.event_date || null) : null,
        });

        if (saved) {
            setReminders((prev) => {
                const exists = prev.some((item) => item.id === saved.id);
                return exists ? prev.map((item) => item.id === saved.id ? saved : item) : [saved, ...prev];
            });
        }
        closeRoutineForm(type);
    };

    const handleRoutineDelete = async (item) => {
        if (!window.confirm(`Remove "${item.title}" from the daily plan? This applies to every future day too.`)) return;
        const removed = await deleteRoutineItem(item);
        if (removed) setReminders((prev) => prev.filter((r) => r.id !== item.id));
    };

    const handleHydrationSave = async () => {
        if (!reminderPatientId) return;
        setHydrationSaving(true);
        const existing = reminders.find((r) => r.routine_type === 'hydration');
        const saved = await setHydrationTarget({
            patientId: reminderPatientId,
            caregiverId: user?.id || null,
            target: Math.max(1, Number(hydrationTargetInput) || 8),
            existing,
        });
        if (saved) {
            setReminders((prev) => {
                const exists = prev.some((item) => item.id === saved.id);
                return exists ? prev.map((item) => item.id === saved.id ? saved : item) : [saved, ...prev];
            });
        }
        setHydrationSaving(false);
    };

    const renderDailyRoutinePanel = () => {
        const selectedReminderPatient = patients.find((p) => p.id === reminderPatientId) || patients[0] || null;
        const medicines = reminders.filter((r) => r.routine_type === 'medicine' && r.enabled !== false);
        const activities = reminders.filter((r) => r.routine_type === 'activity' && r.enabled !== false);
        const appointments = reminders.filter((r) => r.routine_type === 'appointment' && r.enabled !== false);
        const hydration = reminders.find((r) => r.routine_type === 'hydration');

        const renderInlineForm = (type, dateField = false) => {
            const form = routineForms[type];
            return (
                <form className="routine-inline-form" onSubmit={(e) => handleRoutineSubmit(type, e)}>
                    <input
                        value={form.title}
                        onChange={(e) => updateRoutineForm(type, { title: e.target.value })}
                        placeholder={type === 'medicine'
                            ? t('caregiverDashboard.dailyRoutine.medicineName')
                            : type === 'activity'
                                ? t('caregiverDashboard.dailyRoutine.activityName')
                                : t('caregiverDashboard.dailyRoutine.doctorReason')}
                        maxLength={80}
                        required
                    />
                    {dateField ? (
                        <input type="date" value={form.event_date} onChange={(e) => updateRoutineForm(type, { event_date: e.target.value })} />
                    ) : (
                        <input type="time" value={form.time} onChange={(e) => updateRoutineForm(type, { time: e.target.value })} />
                    )}
                    <div className="routine-inline-form-actions">
                        <button type="button" className="btn-outline" onClick={() => closeRoutineForm(type)}>{t('caregiverDashboard.dailyRoutine.cancel')}</button>
                        <button type="submit" className="reminder-save-btn">{form.editingId ? t('caregiverDashboard.dailyRoutine.save') : t('caregiverDashboard.dailyRoutine.add')}</button>
                    </div>
                </form>
            );
        };

        const renderRoutineList = (items, type, dateField = false) => (
            items.length === 0 ? (
                <div className="routine-empty-row">{t('caregiverDashboard.dailyRoutine.nothingSet')}</div>
            ) : (
                <div className="routine-item-list">
                    {items.map((item) => (
                        <div key={item.id} className={`routine-item-row ${getReminderRowClassName(item)}`}>
                            <div className="routine-item-main">
                                <strong>{item.title}</strong>
                                <span className="routine-item-meta">
                                    {dateField
                                        ? (item.event_date ? `📅 ${item.event_date}` : t('caregiverDashboard.dailyRoutine.noDate'))
                                        : (item.time ? `🕐 ${item.time}` : t('caregiverDashboard.dailyRoutine.noTime'))}
                                </span>
                                <ReminderStatusBadge reminder={item} />
                            </div>
                            <div className="routine-item-actions">
                                <button type="button" onClick={() => openRoutineForm(type, item)} aria-label={t('caregiverDashboard.dailyRoutine.editItem', { title: item.title })}>{t('caregiverDashboard.reminders.edit')}</button>
                                <button type="button" onClick={() => handleRoutineDelete(item)} aria-label={t('caregiverDashboard.dailyRoutine.removeItem', { title: item.title })}>{t('caregiverDashboard.dailyRoutine.remove')}</button>
                            </div>
                        </div>
                    ))}
                </div>
            )
        );

        return (
            <section className="daily-routine-panel" id="daily-routine-section">
                <div className="reminders-panel-header">
                    <div>
                        <p className="reminders-eyebrow">{t('caregiverDashboard.dailyRoutine.managed')}</p>
                        <h2 className="section-title">{t('caregiverDashboard.dailyRoutine.title')}</h2>
                        <p className="section-subtitle">{t('caregiverDashboard.dailyRoutine.subtitle')}</p>
                    </div>
                </div>

                {!selectedReminderPatient ? (
                    <div className="reminder-empty-state">{t('caregiverDashboard.dailyRoutine.addPatient')}</div>
                ) : (
                    <div className="routine-grid">
                        <div className="routine-card">
                            <div className="routine-card-header">
                                <span className="routine-card-icon">💊</span>
                                <h3>{t('caregiverDashboard.dailyRoutine.medicine')}</h3>
                                <button type="button" className="routine-add-btn" onClick={() => openRoutineForm('medicine')}>{t('caregiverDashboard.dailyRoutine.add')}</button>
                            </div>
                            {routineForms.medicine.open && renderInlineForm('medicine')}
                            {renderRoutineList(medicines, 'medicine')}
                        </div>

                        <div className="routine-card">
                            <div className="routine-card-header">
                                <span className="routine-card-icon">💧</span>
                                <h3>{t('caregiverDashboard.dailyRoutine.hydration')}</h3>
                            </div>
                            <p className="routine-card-hint">{t('caregiverDashboard.dailyRoutine.routineHint')}</p>
                            <div className="hydration-config-row">
                                <label>
                                    {t('caregiverDashboard.dailyRoutine.dailyTarget')}
                                    <input
                                        type="number"
                                        min={1}
                                        max={20}
                                        value={hydrationTargetInput}
                                        onChange={(e) => setHydrationTargetInput(e.target.value)}
                                    />
                                </label>
                                <button type="button" className="reminder-save-btn" onClick={handleHydrationSave} disabled={hydrationSaving}>
                                    {hydrationSaving ? t('caregiverDashboard.dailyRoutine.saving') : t('caregiverDashboard.dailyRoutine.saveTarget')}
                                </button>
                            </div>
                            {hydration && (
                                <p className="routine-card-hint">
                                    {t('caregiverDashboard.dailyRoutine.todaySoFar', { progress: hydration.progress_count || 0, target: hydration.target_count || 8 })}
                                    {hydration.completed ? t('caregiverDashboard.dailyRoutine.goalMet') : ''}
                                </p>
                            )}
                        </div>

                        <div className="routine-card">
                            <div className="routine-card-header">
                                <span className="routine-card-icon">📅</span>
                                <h3>{t('caregiverDashboard.dailyRoutine.dailyActivity')}</h3>
                                <button type="button" className="routine-add-btn" onClick={() => openRoutineForm('activity')}>{t('caregiverDashboard.dailyRoutine.add')}</button>
                            </div>
                            {routineForms.activity.open && renderInlineForm('activity')}
                            {renderRoutineList(activities, 'activity')}
                        </div>

                        <div className="routine-card">
                            <div className="routine-card-header">
                                <span className="routine-card-icon">🏥</span>
                                <h3>{t('caregiverDashboard.dailyRoutine.appointments')}</h3>
                                <button type="button" className="routine-add-btn" onClick={() => openRoutineForm('appointment')}>{t('caregiverDashboard.dailyRoutine.add')}</button>
                            </div>
                            {routineForms.appointment.open && renderInlineForm('appointment', true)}
                            {renderRoutineList(appointments, 'appointment', true)}
                        </div>
                    </div>
                )}
            </section>
        );
    };

    const renderRemindersPanel = () => {
        const selectedReminderPatient = patients.find((p) => p.id === reminderPatientId) || patients[0] || null;
        const visibleReminders = reminders.filter((r) => r.enabled !== false && !r.routine_type);
        const completedCount = visibleReminders.filter((r) => r.completed).length;

        return (
            <section className="reminders-panel" id="reminders-section">
                <div className="reminders-panel-header">
                    <div>
                        <p className="reminders-eyebrow">{t('caregiverDashboard.reminders.caregiverAdded')}</p>
                        <h2 className="section-title">{t('caregiverDashboard.reminders.customTitle')}</h2>
                        <p className="section-subtitle">{t('caregiverDashboard.reminders.customSubtitle')}</p>
                    </div>
                    <button className="reminder-add-btn" type="button" onClick={() => { setEditingReminder(null); setReminderForm({ title: '', description: '', time: '', category: 'custom' }); setShowReminderForm(true); }} disabled={!selectedReminderPatient}>
                        {t('caregiverDashboard.reminders.addReminder')}
                    </button>
                </div>

                {patients.length > 1 && (
                    <div className="reminder-patient-picker">
                        <span>{t('caregiverDashboard.reminders.patient')}</span>
                        {patients.map((patient) => (
                            <button
                                type="button"
                                key={patient.id}
                                className={`filter-pill ${patient.id === selectedReminderPatient?.id ? 'filter-pill-active' : ''}`}
                                onClick={() => setReminderPatientId(patient.id)}
                            >
                                {patient.full_name}
                            </button>
                        ))}
                    </div>
                )}

                {selectedReminderPatient && (
                    <div className="reminder-summary-row">
                        <span>{completedCount} of {visibleReminders.length} completed</span>
                        <span>{selectedReminderPatient.full_name}</span>
                    </div>
                )}

                {showReminderForm && (
                    <form className="reminder-form-card" onSubmit={handleReminderSubmit}>
                        <div className="reminder-form-heading">
                            <div>
                                <h3>{editingReminder ? t('caregiverDashboard.reminders.editReminder') : t('caregiverDashboard.reminders.createCustomReminder')}</h3>
                                <p>{t('caregiverDashboard.reminders.visibleToPatient')}</p>
                            </div>
                            <button type="button" className="reminder-close-btn" onClick={resetReminderForm}>✕</button>
                        </div>
                        <div className="reminder-form-grid">
                            <label>
                                Title
                                <input value={reminderForm.title} onChange={(e) => setReminderForm((prev) => ({ ...prev, title: e.target.value }))} placeholder={t('caregiverDashboard.reminders.exampleTitle')} maxLength={80} required />
                            </label>
                            <label>
                                Time
                                <input type="time" value={reminderForm.time} onChange={(e) => setReminderForm((prev) => ({ ...prev, time: e.target.value }))} />
                            </label>
                            <label className="reminder-form-wide">
                                Note
                                <textarea value={reminderForm.description} onChange={(e) => setReminderForm((prev) => ({ ...prev, description: e.target.value }))} placeholder={t('caregiverDashboard.reminders.optionalNote')} maxLength={180} rows={3} />
                            </label>
                        </div>
                        <div className="reminder-form-actions">
                            <button type="button" className="btn-outline" onClick={resetReminderForm}>{t('caregiverDashboard.reminders.cancel')}</button>
                            <button type="submit" className="reminder-save-btn" disabled={reminderLoading}>{editingReminder ? t('caregiverDashboard.reminders.saveChanges') : t('caregiverDashboard.reminders.createReminder')}</button>
                        </div>
                    </form>
                )}

                {!selectedReminderPatient ? (
                    <div className="reminder-empty-state">{t('caregiverDashboard.reminders.addPatientFirst')}</div>
                ) : reminderLoading ? (
                    <div className="reminder-empty-state">{t('caregiverDashboard.reminders.loading')}</div>
                ) : visibleReminders.length === 0 ? (
                    <div className="reminder-empty-state">{t('caregiverDashboard.reminders.noReminders')}</div>
                ) : (
                    <div className="reminder-list">
                        {visibleReminders.map((reminder) => (
                            <div key={reminder.id} className={`reminder-row-card ${reminder.completed ? 'reminder-row-completed' : ''} ${getReminderRowClassName(reminder)}`}>
                                <button type="button" className={`reminder-check ${reminder.completed ? 'checked' : ''}`} onClick={() => handleReminderToggle(reminder)} aria-label={t(reminder.completed ? 'caregiverDashboard.reminders.markIncomplete' : 'caregiverDashboard.reminders.markComplete', { title: reminder.title })}>
                                    {reminder.completed ? '✓' : ''}
                                </button>
                                <div className="reminder-row-main">
                                    <div className="reminder-row-title-line">
                                        <strong>{reminder.title}</strong>
                                        <span className={`reminder-type-badge ${reminder.is_basic ? 'basic' : 'custom'}`}>{reminder.is_basic ? 'Basic' : 'Custom'}</span>
                                    </div>
                                    {reminder.description && <p>{reminder.description}</p>}
                                    <div className="reminder-row-meta">
                                        {reminder.time && <span>🕐 {reminder.time}</span>}
                                        {reminder.completed ? <span>{t('caregiverDashboard.reminders.completedToday')}</span> : <span>{t('caregiverDashboard.reminders.notCompleted')}</span>}
                                        {reminder.created_by === 'patient' && <span>{t('caregiverDashboard.reminders.addedByPatient')}</span>}
                                        <ReminderStatusBadge reminder={reminder} />
                                    </div>
                                </div>
                                {!reminder.is_basic && (
                                    <div className="reminder-row-actions">
                                        <button type="button" onClick={() => openReminderEditor(reminder)} aria-label={t('caregiverDashboard.reminders.editItem', { title: reminder.title })}>{t('caregiverDashboard.reminders.edit')}</button>
                                        <button type="button" onClick={() => handleReminderDelete(reminder)} aria-label={t('caregiverDashboard.reminders.deleteItem', { title: reminder.title })}>{t('caregiverDashboard.reminders.delete')}</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>
        );
    };

    const fetchUserAndPatients = async () => {
        setLoading(true);

        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error(
                "Auth error:",
                authError?.message
            );

            setLoading(false);
            return;
        }

        setUser(user);

        const { data, error } = await supabase
            .from('patients_with_active_code')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error(
                "Error fetching patients:",
                error.message
            );

            alert(
                "Failed to load patients. Check database permissions."
            );
        } else if (data) {
            setPatients(data);

            const initialStatus = {};

            data.forEach((patient) => {
                initialStatus[patient.id] = false;
            });

            setPatientOnlineStatus(initialStatus);
        }

        setLoading(false);
    };

    const handleRegenerateCode = async (patientId) => {
        const confirmRegenerate = window.confirm(
            "Are you sure? Regenerating the code will make the previous patient login code invalid."
        );

        if (!confirmRegenerate) return;

        const { data, error } = await supabase.rpc(
            'generate_or_refresh_patient_code',
            {
                p_patient_id: patientId
            }
        );

        if (error) {
            console.error(
                'Failed to regenerate code:',
                error.message
            );

            alert(
                "Failed to regenerate code. Ensure you have permission."
            );

            return;
        }

        const generated = data[0];

        setPatients((prevPatients) =>
            prevPatients.map((patient) =>
                patient.id === patientId
                    ? {
                        ...patient,
                        login_code: generated.new_code,
                        code_expires_at: generated.expires_at
                    }
                    : patient
            )
        );
    };

    const handleDischargePatient = async (
        patientId,
        patientName
    ) => {
        const confirmRemove = window.confirm(
            `Are you sure you want to remove ${patientName}? They will disappear from your dashboard and their device access will be revoked. This can be undone by contacting support, but not from this screen.`
        );

        if (!confirmRemove) return;

        const { error } = await supabase.rpc(
            'discharge_patient_record',
            {
                p_target_patient_id: patientId
            }
        );

        if (error) {
            console.error(
                'Failed to discharge patient:',
                error.message
            );

            alert(
                "Failed to remove patient. Please try again."
            );

            return;
        }

        setPatients((prevPatients) =>
            prevPatients.filter(
                (patient) => patient.id !== patientId
            )
        );

        setPatientOnlineStatus((previous) => {
            const updated = { ...previous };
            delete updated[patientId];
            return updated;
        });
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    const handleSidebarClick = (key) => {
        if (key === 'dashboard') {
            setView('dashboard');

            setTimeout(() => {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            }, 0);

            return;
        }

        if (key === 'patients' || key === 'settings' || key === 'reports' || key === 'resources' || key === 'reminders') {
            setView(key);
            return;
        }
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="loading-spinner" />
                <p>{t('caregiverDashboard.loading.dashboard')}</p>
            </div>
        );
    }

    if (view === 'addPatient') {
        return (
            <AddPatientForm
                onBack={() => {
                    setView('dashboard');
                    fetchUserAndPatients();
                }}
                user={user}
            />
        );
    }

    const meta = user?.user_metadata || {};

    const caregiverName =
        meta.full_name ||
        user?.email?.split('@')[0] ||
        'Caregiver';

    const caregiverInitial =
        caregiverName.trim().charAt(0).toUpperCase() || 'C';

    const caregiverFirstName =
        caregiverName.trim().split(/\s+/)[0] || t('caregiverDashboard.header.caregiver');

    const filteredPatients = patients.filter((p) =>
        (p.full_name || '')
            .toLowerCase()
            .includes(searchTerm.trim().toLowerCase())
    );

    const renderSidebar = (activeKey) => (
        <aside className="dashboard-sidebar">
            <div className="sidebar-brand">
                <span role="img" aria-label="brain">
                    🧠
                </span>
                <span>NeuroPlay</span>
            </div>

            <nav className="sidebar-nav">
                {SIDEBAR_LINKS.map((link) => (
                    <button
                        key={link.key}
                        className={`sidebar-link ${link.key === activeKey
                                ? 'sidebar-link-active'
                                : ''
                            }`}
                        onClick={() =>
                            handleSidebarClick(link.key)
                        }
                    >
                        <span className="sidebar-link-icon">
                            {link.icon}
                        </span>

                        {t(link.labelKey)}
                    </button>
                ))}
            </nav>

            <div className="sidebar-help-card">
                <span className="sidebar-help-icon">
                    💬
                </span>

                <p>
                    {t('caregiverDashboard.sidebar.helpText')}
                </p>

                <button
                    onClick={() =>
                        alert(
                            t('caregiverDashboard.sidebar.supportComingSoon')
                        )
                    }
                >
                    {t('caregiverDashboard.sidebar.contactSupport')}
                </button>
            </div>
        </aside>
    );

    const renderPageHeader = (title, subtitle) => (
        <header className="dashboard-header">
            <div className="header-title">
                {subtitle && <p className="header-subtitle">{subtitle}</p>}
                <h1>{title}</h1>
            </div>

            <div className="header-actions">
                <button
                    className="header-avatar-btn"
                    onClick={() => setShowProfileModal(true)}
                >
                    <span className="header-avatar-circle">
                        {caregiverInitial}
                    </span>
                    {caregiverFirstName}
                </button>

                <button className="header-logout-btn" onClick={handleLogout}>
                    {t('caregiverDashboard.header.logout')}
                </button>
            </div>
        </header>
    );

    const renderProfileModal = () => {
        if (!showProfileModal) return null;

        return (
            <div
                className="modal-overlay"
                onClick={() =>
                    setShowProfileModal(false)
                }
            >
                <div
                    className="modal-content"
                    onClick={(e) =>
                        e.stopPropagation()
                    }
                >
                    <button
                        className="modal-close-btn"
                        onClick={() =>
                            setShowProfileModal(false)
                        }
                    >
                        ✕
                    </button>

                    <div className="profile-modal-header">
                        <span className="profile-modal-avatar">
                            {caregiverInitial}
                        </span>

                        <div>
                            <h2>{caregiverName}</h2>

                            <p className="profile-modal-email">
                                {user?.email}
                            </p>
                        </div>
                    </div>

                    <div className="profile-details-grid">
                        {PROFILE_FIELDS.map(
                            ({ key, labelKey }) => {
                                const value = meta[key];

                                if (!value) return null;

                                return (
                                    <div
                                        className="profile-detail-row"
                                        key={key}
                                    >
                                        <span className="profile-detail-label">
                                            {t(labelKey)}
                                        </span>

                                        <span className="profile-detail-value">
                                            {value}
                                        </span>
                                    </div>
                                );
                            }
                        )}
                    </div>

                    {PROFILE_FIELDS.every(
                        ({ key }) => !meta[key]
                    ) && (
                            <p className="profile-empty-note">
                                {t('caregiverDashboard.profile.empty')}
                            </p>
                        )}
                </div>
            </div>
        );
    };

    if (view === 'patients') {
        return (
            <div className="dashboard-shell">
                {renderSidebar('patients')}

                <div className="dashboard-main">
                    <header className="dashboard-header">
                        <div className="header-title">
                            <h1>{t('caregiverDashboard.patients.title')}</h1>
                        </div>

                        <div className="header-actions">
                            <button
                                className="header-avatar-btn"
                                onClick={() =>
                                    setShowProfileModal(true)
                                }
                            >
                                <span className="header-avatar-circle">
                                    {caregiverInitial}
                                </span>

                                {caregiverFirstName}
                            </button>

                            <button
                                className="header-logout-btn"
                                onClick={handleLogout}
                            >
                                {t('caregiverDashboard.header.logout')}
                            </button>
                        </div>
                    </header>

                    <div
                        id="patients-section"
                        className="patients-section-header patients-section-header-solo"
                    >
                        <div className="patients-toolbar">
                            <div className="patient-search-box">
                                <span className="patient-search-icon">
                                    🔍
                                </span>

                                <input
                                    type="text"
                                    placeholder={t('caregiverDashboard.patients.searchPlaceholder')}
                                    value={searchTerm}
                                    onChange={(e) =>
                                        setSearchTerm(
                                            e.target.value
                                        )
                                    }
                                />
                            </div>

                            <div className="patient-filter-pills">
                                <button className="filter-pill filter-pill-active">
                                    {t('caregiverDashboard.patients.all')}
                                </button>

                                <button
                                    className="filter-pill"
                                    onClick={() =>
                                        alert(
                                            t('caregiverDashboard.patients.customFiltersComingSoon')
                                        )
                                    }
                                >
                                    {t('caregiverDashboard.patients.needsAttention')}
                                </button>
                            </div>
                        </div>
                    </div>

                    {patients.length === 0 ? (
                        <div className="empty-state">
                            <p>
                                {t('caregiverDashboard.patients.noPatients')}
                            </p>

                            <button
                                className="nav-btn"
                                onClick={() =>
                                    setView('addPatient')
                                }
                            >
                                {t('caregiverDashboard.patients.addFirstPatient')}
                            </button>
                        </div>
                    ) : filteredPatients.length === 0 ? (
                        <div className="empty-state">
                            <p>
                                {t('caregiverDashboard.patients.noMatch', { searchTerm })}
                            </p>

                            <button
                                className="nav-btn"
                                onClick={() =>
                                    setSearchTerm('')
                                }
                            >
                                {t('caregiverDashboard.patients.clearSearch')}
                            </button>
                        </div>
                    ) : (
                        <div className="patients-grid">
                            {filteredPatients.map(
                                (patient) => {
                                    const avatar =
                                        getPatientAvatar(
                                            patient
                                        );

                                    const joined =
                                        formatJoinedDate(
                                            patient.created_at
                                        );

                                    const isOnline =
                                        patientOnlineStatus[
                                        patient.id
                                        ] === true;

                                    return (
                                        <div
                                            key={patient.id}
                                            className="patient-card"
                                        >
                                            <span
                                                className={`patient-status-pill ${isOnline
                                                        ? 'patient-status-online'
                                                        : 'patient-status-offline'
                                                    }`}
                                            >
                                                <span className="status-dot">
                                                    ●
                                                </span>

                                                {isOnline
                                                    ? t('caregiverDashboard.patients.online')
                                                    : t('caregiverDashboard.patients.offline')}
                                            </span>

                                            <div className="patient-card-header">
                                                <span
                                                    className={`patient-avatar ${avatar.ring}`}
                                                    role="img"
                                                    aria-label={
                                                        avatar.label
                                                    }
                                                >
                                                    {avatar.emoji}
                                                </span>

                                                <div>
                                                    <h3>
                                                        {
                                                            patient.full_name
                                                        }
                                                    </h3>

                                                    {joined && (
                                                        <p className="patient-joined-date">
                                                            {t('caregiverDashboard.patients.added')}{' '}
                                                            {
                                                                joined
                                                            }
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="patient-credentials">
                                                <div className="credential-row">
                                                    <span className="credential-label">
                                                        {t('caregiverDashboard.patients.patientId')}
                                                    </span>

                                                    <span className="credential-value">
                                                        {
                                                            patient.patient_id
                                                        }
                                                    </span>
                                                </div>

                                                <div className="credential-row">
                                                    <span className="credential-label">
                                                        {t('caregiverDashboard.patients.loginCode')}
                                                    </span>

                                                    <div
                                                        style={{
                                                            display:
                                                                'flex',
                                                            alignItems:
                                                                'center',
                                                            gap: '8px'
                                                        }}
                                                    >
                                                        <span className="credential-value code">
                                                            {patient.login_code ||
                                                                t('caregiverDashboard.patients.expiredNone')}
                                                        </span>

                                                        {patient.login_code &&
                                                            patient.code_expires_at && (
                                                                <CodeCountdown
                                                                    key={
                                                                        patient.code_expires_at
                                                                    }
                                                                    expiresAt={
                                                                        patient.code_expires_at
                                                                    }
                                                                />
                                                            )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="patient-actions">
                                                <button
                                                    className="btn-outline"
                                                    onClick={() => {
                                                        if (
                                                            patient.login_code
                                                        ) {
                                                            navigator.clipboard.writeText(
                                                                patient.login_code
                                                            );
                                                        } else {
                                                            alert(
                                                                t('caregiverDashboard.patients.noActiveCode')
                                                            );
                                                        }
                                                    }}
                                                >
                                                    {t('caregiverDashboard.patients.copyCode')}
                                                </button>

                                                <button
                                                    className="btn-outline"
                                                    onClick={() => {
                                                        setReportsPatientId(patient.id);
                                                        setView('reports');
                                                    }}
                                                >
                                                    👁️ {t('caregiverDashboard.patients.viewPatient')}
                                                </button>

                                                <button
                                                    className="btn-outline btn-warning"
                                                    onClick={() =>
                                                        handleRegenerateCode(
                                                            patient.id
                                                        )
                                                    }
                                                >
                                                    🔄 {t('caregiverDashboard.patients.regenerateCode')}
                                                </button>

                                                <button
                                                    className="btn-outline btn-warning"
                                                    onClick={() =>
                                                        handleDischargePatient(
                                                            patient.id,
                                                            patient.full_name
                                                        )
                                                    }
                                                >
                                                    🗑️ {t('caregiverDashboard.patients.removePatient')}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }
                            )}
                        </div>
                    )}

                    <footer className="dashboard-footer">
                        {t('caregiverDashboard.footer')}
                    </footer>
                </div>

                {renderProfileModal()}
            </div>
        );
    }

    if (view === 'reports') {
        const selectedPatient =
            patients.find((p) => p.id === reportsPatientId) || patients[0] || null;

        const patientIndex = selectedPatient
            ? patients.findIndex((p) => p.id === selectedPatient.id)
            : 0;

        const sessions = selectedPatient
            ? getSampleSessionsForPatient(selectedPatient.id, patientIndex)
            : [];

        const byGame = summarizeSessionsByGame(sessions);
        const recentSessions = sessions.slice(0, 6);

        const totalSessionsThisWeek = sessions.filter((s) => {
            const days = (Date.now() - new Date(s.played_at).getTime()) / 86400000;
            return days <= 7;
        }).length;

        const avgAccuracy = sessions.length
            ? Math.round(sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessions.length)
            : 0;

        const mostPlayedGame = Object.entries(byGame).sort((a, b) => b[1].count - a[1].count)[0];

        return (
            <div className="dashboard-shell">
                {renderSidebar('reports')}

                <div className="dashboard-main">
                    {renderPageHeader(t('caregiverDashboard.reports.title'), t('caregiverDashboard.reports.cognitivePerformance'))}

                    <div className="sample-data-note">
                        {t('caregiverDashboard.reports.sampleDataNote')}
                    </div>

                    {patients.length === 0 ? (
                        <div className="empty-state">
                            <p>{t('caregiverDashboard.reports.noPatient')}</p>
                            <button className="nav-btn" onClick={() => setView('addPatient')}>
                                {t('caregiverDashboard.patients.addFirstPatient')}
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="stats-grid reports-stats-grid">
                                <div className="stat-card">
                                    <span className="stat-card-icon stat-icon-blue">🗓️</span>
                                    <h3>{t('caregiverDashboard.reports.sessionsThisWeek')}</h3>
                                    <p className="stat-value">{totalSessionsThisWeek}</p>
                                </div>
                                <div className="stat-card">
                                    <span className="stat-card-icon stat-icon-navy">🎯</span>
                                    <h3>{t('caregiverDashboard.reports.averageAccuracy')}</h3>
                                    <p className="stat-value">{avgAccuracy}%</p>
                                </div>
                                <div className="stat-card">
                                    <span className="stat-card-icon stat-icon-amber">🏆</span>
                                    <h3>{t('caregiverDashboard.reports.mostPlayedGame')}</h3>
                                    <p className="stat-value stat-value-text">
                                        {mostPlayedGame ? GAME_META[mostPlayedGame[0]].label : '—'}
                                    </p>
                                </div>
                            </div>

                            <div className="reports-patient-picker">
                                {patients.map((p) => (
                                    <button
                                        key={p.id}
                                        className={`filter-pill ${p.id === selectedPatient?.id ? 'filter-pill-active' : ''}`}
                                        onClick={() => setReportsPatientId(p.id)}
                                    >
                                        {p.full_name}
                                    </button>
                                ))}
                            </div>

                            <div className="report-game-grid">
                                {Object.entries(GAME_META).map(([key, meta]) => {
                                    const stat = byGame[key];
                                    const avg = stat.count ? Math.round(stat.accuracySum / stat.count) : 0;
                                    return (
                                        <div key={key} className="report-game-card">
                                            <div className="report-game-card-head">
                                                <span className="report-game-icon">{meta.icon}</span>
                                                <h3>{t(meta.labelKey)}</h3>
                                            </div>
                                            <div className="report-game-metrics">
                                                <div>
                                                    <span className="report-metric-value">{stat.count}</span>
                                                    <span className="report-metric-label">{t('caregiverDashboard.reports.sessions')}</span>
                                                </div>
                                                <div>
                                                    <span className="report-metric-value">{stat.bestScore}</span>
                                                    <span className="report-metric-label">{t('caregiverDashboard.reports.bestScore')}</span>
                                                </div>
                                                <div>
                                                    <span className="report-metric-value">{avg}%</span>
                                                    <span className="report-metric-label">{t('caregiverDashboard.reports.avgAccuracy')}</span>
                                                </div>
                                            </div>
                                            <div className="report-accuracy-bar">
                                                <div className="report-accuracy-fill" style={{ width: `${avg}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="report-history-card">
                                <h3 className="section-title">{t('caregiverDashboard.reports.recentActivity')}</h3>
                                <table className="report-history-table">
                                    <thead>
                                        <tr>
                                            <th>{t('caregiverDashboard.reports.game')}</th>
                                            <th>{t('caregiverDashboard.reports.score')}</th>
                                            <th>{t('caregiverDashboard.reports.accuracy')}</th>
                                            <th>{t('caregiverDashboard.reports.duration')}</th>
                                            <th>{t('caregiverDashboard.reports.played')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentSessions.map((s) => (
                                            <tr key={s.id}>
                                                <td>
                                                    <span className="report-history-game">
                                                        {GAME_META[s.game].icon} {t(GAME_META[s.game].labelKey)}
                                                    </span>
                                                </td>
                                                <td>{s.score}</td>
                                                <td>{s.accuracy}%</td>
                                                <td>{t('caregiverDashboard.reports.minutes', { count: Math.round(s.duration_seconds / 60) })}</td>
                                                <td>{formatSessionDate(s.played_at)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    <footer className="dashboard-footer">
                        {t('caregiverDashboard.footer')}
                    </footer>
                </div>

                {renderProfileModal()}
            </div>
        );
    }

    if (view === 'reminders') {
        return (
            <div className="dashboard-shell">
                {renderSidebar('reminders')}

                <div className="dashboard-main">
                    {renderPageHeader(t('caregiverDashboard.reminders.title'), t('caregiverDashboard.reminders.subtitle'))}

                    {renderDailyRoutinePanel()}

                    {renderRemindersPanel()}

                    <footer className="dashboard-footer">
                        {t('caregiverDashboard.footer')}
                    </footer>
                </div>

                {renderProfileModal()}
            </div>
        );
    }

    if (view === 'resources') {
        const toolCards = [
            {
                key: 'breathing',
                icon: '🧘',
                titleKey: 'caregiverDashboard.resources.quickCalm.title',
                descKey: 'caregiverDashboard.resources.quickCalm.description',
            },
            {
                key: 'emergencyCard',
                icon: '🪪',
                titleKey: 'caregiverDashboard.resources.emergencyCard.title',
                descKey: 'caregiverDashboard.resources.emergencyCard.description',
            },
            {
                key: 'reportsGuide',
                icon: '📈',
                titleKey: 'caregiverDashboard.resources.reportsGuide.title',
                descKey: 'caregiverDashboard.resources.reportsGuide.description',
            },
            {
                key: 'faq',
                icon: '❓',
                titleKey: 'caregiverDashboard.resources.faq.title',
                descKey: 'caregiverDashboard.resources.faq.description',
            },
            {
                key: 'glossary',
                icon: '🧠',
                titleKey: 'caregiverDashboard.resources.glossary.title',
                descKey: 'caregiverDashboard.resources.glossary.description',
            },
        ];

        const referenceCards = [
            {
                key: 'directory',
                icon: '🩺',
                titleKey: 'caregiverDashboard.resources.directory.title',
                descKey: 'caregiverDashboard.resources.directory.description',
            },
            {
                key: 'manual',
                icon: '📘',
                titleKey: 'caregiverDashboard.resources.manual.title',
                descKey: 'caregiverDashboard.resources.manual.description',
            },
            {
                key: 'tips',
                icon: '📚',
                titleKey: 'caregiverDashboard.resources.tips.title',
                descKey: 'caregiverDashboard.resources.tips.description',
            },
            {
                key: 'support',
                icon: '🤝',
                titleKey: 'caregiverDashboard.resources.support.title',
                descKey: 'caregiverDashboard.resources.support.description',
            },
        ];

        const emergencyPatient =
            patients.find((p) => p.id === emergencyCardPatientId) || patients[0] || null;

        const breathingPhase = BREATHING_PHASES[breathingPhaseIndex];

        const toggleBreathing = () => {
            if (breathingActive) {
                setBreathingActive(false);
            } else {
                setBreathingPhaseIndex(0);
                setBreathingTimer(4);
                setBreathingActive(true);
            }
        };

        const closeResourceModal = () => {
            setActiveResourceModal(null);
            setBreathingActive(false);
        };

        const renderResourceModal = () => {
            if (!activeResourceModal) return null;

            return (
                <div className="modal-overlay" onClick={closeResourceModal}>
                    <div className="modal-content resource-modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={closeResourceModal}>✕</button>

                        {activeResourceModal === 'breathing' && (
                            <div>
                                <h2>🧘 {t('caregiverDashboard.resources.quickCalm.title')}</h2>
                                <p className="resource-modal-lead">{t('caregiverDashboard.breathing.instruction')}</p>
                                <div className="breathing-tool">
                                    <div className={`breathing-tool-circle ${breathingActive ? `phase-${breathingPhase}` : ''}`}>
                                        <span className="breathing-tool-label">{breathingActive ? t(`caregiverDashboard.breathing.${breathingPhase === 'hold1' || breathingPhase === 'hold2' ? 'hold' : breathingPhase}`) : t('caregiverDashboard.breathing.ready')}</span>
                                        <span className="breathing-tool-timer">{breathingActive ? breathingTimer : '4s'}</span>
                                    </div>
                                    <button type="button" className="btn-primary" onClick={toggleBreathing}>
                                        {breathingActive ? t('caregiverDashboard.breathing.stop') : t('caregiverDashboard.breathing.start')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeResourceModal === 'emergencyCard' && (
                            <div>
                                <h2>🪪 {t('caregiverDashboard.resources.emergencyCard.title')}</h2>
                                {patients.length === 0 ? (
                                    <p>{t('caregiverDashboard.resources.emergencyCard.addPatient')}</p>
                                ) : (
                                    <>
                                        {patients.length > 1 && (
                                            <div className="emergency-card-picker">
                                                {patients.map((p) => (
                                                    <button
                                                        key={p.id}
                                                        className={`filter-pill ${p.id === emergencyPatient?.id ? 'filter-pill-active' : ''}`}
                                                        onClick={() => setEmergencyCardPatientId(p.id)}
                                                    >
                                                        {p.full_name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        <div className="emergency-card-print">
                                            <div className="emergency-card-header">
                                                <span role="img" aria-label={t('caregiverDashboard.accessibility.brain')}>🧠</span> {t('caregiverDashboard.resources.emergencyCard.cardTitle')}
                                            </div>
                                            <div className="emergency-card-row">
                                                <span>{t('caregiverDashboard.resources.emergencyCard.patient')}</span>
                                                <strong>{emergencyPatient?.full_name || '—'}</strong>
                                            </div>
                                            <div className="emergency-card-row">
                                                <span>{t('caregiverDashboard.resources.emergencyCard.patientId')}</span>
                                                <strong>{emergencyPatient?.patient_id || '—'}</strong>
                                            </div>
                                            <div className="emergency-card-row">
                                                <span>{t('caregiverDashboard.resources.emergencyCard.emergencyContact')}</span>
                                                <strong>{meta.emergency_name || '—'}</strong>
                                            </div>
                                            <div className="emergency-card-row">
                                                <span>{t('caregiverDashboard.resources.emergencyCard.emergencyPhone')}</span>
                                                <strong>{meta.emergency_phone || '—'}</strong>
                                            </div>
                                            <div className="emergency-card-row">
                                                <span>{t('caregiverDashboard.resources.emergencyCard.caregiver')}</span>
                                                <strong>{caregiverName}</strong>
                                            </div>
                                            <div className="emergency-card-row">
                                                <span>{t('caregiverDashboard.resources.emergencyCard.caregiverPhone')}</span>
                                                <strong>{meta.phone_number || '—'}</strong>
                                            </div>
                                            <div className="emergency-card-footer">
                                                {t('caregiverDashboard.resources.emergencyCard.nationalEmergency')}
                                            </div>
                                        </div>

                                        <button type="button" className="btn-primary" onClick={() => window.print()}>
                                            {t('caregiverDashboard.resources.emergencyCard.printCard')}
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {activeResourceModal === 'reportsGuide' && (
                            <div>
                                <h2>📈 {t('caregiverDashboard.resources.reportsGuide.title')}</h2>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.reportsGuide.sessions')}</h4>
                                    <p>{t('caregiverDashboard.resources.reportsGuide.sessionsText')}</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.reportsGuide.score')}</h4>
                                    <p>{t('caregiverDashboard.resources.reportsGuide.scoreText')}</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.reportsGuide.accuracy')}</h4>
                                    <p>{t('caregiverDashboard.resources.reportsGuide.accuracyText')}</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.reportsGuide.watchFor')}</h4>
                                    <p>{t('caregiverDashboard.resources.reportsGuide.watchForText')}</p>
                                </div>
                            </div>
                        )}

                        {activeResourceModal === 'faq' && (
                            <div>
                                <h2>❓ {t('caregiverDashboard.resources.faq.title')}</h2>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.faq.whatIsLoginCode')}</h4>
                                    <p>{t('caregiverDashboard.resources.faq.loginCodeText')}</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.faq.codeExpires')}</h4>
                                    <p>{t('caregiverDashboard.resources.faq.codeExpiresText')}</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.faq.onlineOffline')}</h4>
                                    <p>{t('caregiverDashboard.resources.faq.onlineOfflineText')}</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.faq.addPatient')}</h4>
                                    <p>{t('caregiverDashboard.resources.faq.addPatientText')}</p>
                                </div>
                            </div>
                        )}

                        {activeResourceModal === 'glossary' && (
                            <div>
                                <h2>🧠 {t('caregiverDashboard.resources.glossary.title')}</h2>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.glossary.sundowning')}</h4>
                                    <p>{t('caregiverDashboard.resources.glossary.sundowningText')}</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.glossary.cognitiveDecline')}</h4>
                                    <p>{t('caregiverDashboard.resources.glossary.cognitiveDeclineText')}</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.glossary.caregiverBurnout')}</h4>
                                    <p>{t('caregiverDashboard.resources.glossary.caregiverBurnoutText')}</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.glossary.reminiscenceTherapy')}</h4>
                                    <p>{t('caregiverDashboard.resources.glossary.reminiscenceTherapyText')}</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.glossary.validationApproach')}</h4>
                                    <p>{t('caregiverDashboard.resources.glossary.validationApproachText')}</p>
                                </div>
                            </div>
                        )}

                        {activeResourceModal === 'directory' && (
                            <div>
                                <h2>🩺 {t('caregiverDashboard.resources.directory.title')}</h2>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.directory.assam')}</h4>
                                    <p>{t('caregiverDashboard.resources.directory.assamDetails')} {t('caregiverDashboard.resources.directory.assamAmc')} {t('caregiverDashboard.resources.directory.assamSilchar')}</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.directory.meghalaya')}</h4>
                                    <p>{t('caregiverDashboard.resources.directory.meghalayaNeigrihms')} {t('caregiverDashboard.resources.directory.meghalayaCivil')}</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.directory.manipur')}</h4>
                                    <p>{t('caregiverDashboard.resources.directory.manipurRims')} {t('caregiverDashboard.resources.directory.manipurJnims')}</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.directory.otherStates')}</h4>
                                    <p>{t('caregiverDashboard.resources.directory.tripuraAgmc')} {t('caregiverDashboard.resources.directory.mizoramZmc')} {t('caregiverDashboard.resources.directory.nagalandKohima')} {t('caregiverDashboard.resources.directory.trihms')} {t('caregiverDashboard.resources.directory.stnm')}</p>
                                </div>
                                <div className="resource-modal-block resource-modal-emergency">
                                    <h4>{t('caregiverDashboard.resources.directory.emergencyHelplines')}</h4>
                                    <p>{t('caregiverDashboard.resources.directory.teleManas')} 14416. {t('caregiverDashboard.resources.directory.nationalEmergency')} 112.</p>
                                </div>
                            </div>
                        )}

                        {activeResourceModal === 'manual' && (
                            <div>
                                <h2>📘 {t('caregiverDashboard.resources.manual.title')}</h2>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.manual.dailyRoutine')}</h4>
                                    <p>{t('caregiverDashboard.resources.manual.dailyRoutineText')}</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.manual.managingSundowning')}</h4>
                                    <p>{t('caregiverDashboard.resources.manual.managingSundowningText')}</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.manual.breathingReset')}</h4>
                                    <p>{t('caregiverDashboard.resources.manual.breathingResetText')}</p>
                                </div>
                            </div>
                        )}

                        {activeResourceModal === 'tips' && (
                            <div>
                                <h2>📚 {t('caregiverDashboard.resources.tips.title')}</h2>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.tips.nutrition')}</h4>
                                    <p>{t('caregiverDashboard.resources.tips.nutritionText')}</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.tips.sleep')}</h4>
                                    <p>{t('caregiverDashboard.resources.tips.sleepText')}</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.tips.homeSafety')}</h4>
                                    <p>{t('caregiverDashboard.resources.tips.homeSafetyText')}</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.tips.communication')}</h4>
                                    <p>{t('caregiverDashboard.resources.tips.communicationText')}</p>
                                </div>
                            </div>
                        )}

                        {activeResourceModal === 'support' && (
                            <div>
                                <h2>🤝 {t('caregiverDashboard.resources.support.title')}</h2>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.support.localGroups')}</h4>
                                    <p>{t('caregiverDashboard.resources.support.localGroupsText')}</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>{t('caregiverDashboard.resources.support.nationalOrganizations')}</h4>
                                    <p>{t('caregiverDashboard.resources.support.nationalOrganizationsText')}</p>
                                </div>
                                <div className="resource-modal-block resource-modal-emergency">
                                    <h4>{t('caregiverDashboard.resources.support.caregiverMentalHealth')}</h4>
                                    <p>{t('caregiverDashboard.resources.support.caregiverMentalHealthText')}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        };

        return (
            <div className="dashboard-shell">
                {renderSidebar('resources')}

                <div className="dashboard-main">
                    {renderPageHeader(t('caregiverDashboard.resources.title'), t('caregiverDashboard.resources.subtitle'))}

                    <h3 className="section-title resources-section-heading">{t('caregiverDashboard.resources.toolsForYou')}</h3>
                    <div className="resources-dashboard-grid">
                        {toolCards.map((card) => (
                            <div key={card.key} className="resource-dash-card">
                                <span className="resource-dash-icon">{card.icon}</span>
                                <h3>{t(card.titleKey)}</h3>
                                <p>{t(card.descKey)}</p>
                                <button
                                    className="btn-outline"
                                    onClick={() => setActiveResourceModal(card.key)}
                                >
                                    {t('caregiverDashboard.resources.open')}
                                </button>
                            </div>
                        ))}

                        <div className="resource-dash-card checklist-card">
                            <span className="resource-dash-icon">✅</span>
                            <h3>{t('caregiverDashboard.checklist.title')}</h3>
                            <p>{t('caregiverDashboard.checklist.subtitle')}</p>
                            <div className="checklist-items">
                                {CHECKLIST_ITEMS.map((item) => (
                                    <label key={item.key} className="checklist-row">
                                        <input
                                            type="checkbox"
                                            checked={!!checklistState[item.key]}
                                            onChange={() => toggleChecklistItem(item.key)}
                                        />
                                        <span className={checklistState[item.key] ? 'checklist-done' : ''}>
                                            {t(item.labelKey)}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <h3 className="section-title resources-section-heading">{t('caregiverDashboard.resources.generalReference')}</h3>
                    <div className="resources-dashboard-grid">
                        {referenceCards.map((card) => (
                            <div key={card.key} className="resource-dash-card">
                                <span className="resource-dash-icon">{card.icon}</span>
                                <h3>{t(card.titleKey)}</h3>
                                <p>{t(card.descKey)}</p>
                                <button
                                    className="btn-outline"
                                    onClick={() => setActiveResourceModal(card.key)}
                                >
                                    {t('caregiverDashboard.resources.open')}
                                </button>
                            </div>
                        ))}
                    </div>

                    <footer className="dashboard-footer">
                        {t('caregiverDashboard.footer')}
                    </footer>
                </div>

                {renderResourceModal()}
                {renderProfileModal()}
            </div>
        );
    }

    if (view === 'settings') {
        return (
            <div className="dashboard-shell">
                {renderSidebar('settings')}

                <div className="dashboard-main">
                    <SettingsPanel
                        onBack={() =>
                            setView('dashboard')
                        }
                        patients={patients}
                        user={user}
                        caregiverName={caregiverName}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-shell dashboard-home-shell">
            {renderSidebar('dashboard')}

            <div className="dashboard-main">
                <header className="dashboard-header">
                    <div className="header-title">
                        <p className="header-subtitle">
                            {t(getGreeting())}, {caregiverName} 👋
                        </p>

                        <h1>{t('caregiverDashboard.dashboard.overview')}</h1>
                    </div>

                    <div className="header-actions">
                        <button
                            className="header-avatar-btn"
                            onClick={() =>
                                setShowProfileModal(true)
                            }
                        >
                            <span className="header-avatar-circle">
                                {caregiverInitial}
                            </span>

                            {caregiverFirstName}
                        </button>

                        <button
                            className="header-logout-btn"
                            onClick={handleLogout}
                        >
                            {t('caregiverDashboard.header.logout')}
                        </button>
                    </div>
                </header>

                <div className="page-status-strip">
                    <span className="sync-chip">
                        <span className="sync-dot" />
                        {t('caregiverDashboard.dashboard.allDataSynced')}
                    </span>

                    <span className="page-status-date">
                        {todayLabel}
                    </span>
                </div>

                <div className="stats-grid stats-grid-top">
                    <div
                        className="stat-card primary-action"
                        onClick={() =>
                            setView('addPatient')
                        }
                    >
                        <span className="stat-card-icon">
                            ➕
                        </span>

                        <h2>{t('caregiverDashboard.dashboard.addPatient')}</h2>

                        <p
                            style={{
                                margin: '0.5rem 0 0',
                                opacity: 0.9
                            }}
                        >
                            {t('caregiverDashboard.dashboard.registerPatientCredentials')}
                        </p>
                    </div>

                    <div
                        className="stat-card"
                        style={{ cursor: 'pointer' }}
                        onClick={() =>
                            setView('patients')
                        }
                    >
                        <span className="stat-card-icon stat-icon-blue">
                            👥
                        </span>

                        <h3>{t('caregiverDashboard.patients.title')}</h3>

                        <p className="stat-value">
                            {patients.length}
                        </p>
                    </div>

                    <div
                        className="stat-card"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setView('reports')}
                    >
                        <span className="stat-card-icon stat-icon-navy">
                            📈
                        </span>

                        <h3>{t('caregiverDashboard.dashboard.patientProgress')}</h3>

                        <p className="stat-placeholder">
                            {t('caregiverDashboard.dashboard.cognitivePerformanceTrends')}
                        </p>
                    </div>
                </div>

                <div className="stat-card alerts-panel-standalone mood-engagement-card">
                    <div className="alerts-panel-standalone-head">
                        <div className="alerts-panel-title-group">
                            <span className="alerts-panel-icon">💛</span>
                            <div>
                                <h3>Mood & Engagement</h3>
                                <p className="alerts-panel-subtitle">Last 7 days across your patients</p>
                            </div>
                        </div>
                    </div>

                    {patients.length === 0 ? (
                        <p className="stat-placeholder">No patients yet.</p>
                    ) : (
                        <div className="mood-engagement-body">
                            {patients.map((p) => {
                                const history = moodByPatient[p.id] || [];
                                const today = new Date().toISOString().slice(0, 10);
                                const todaysEntry = history.find((h) => h.logged_date === today);

                                return (
                                    <div className="mood-patient-row" key={p.id}>
                                        <span className="mood-patient-name">{p.full_name || p.name}</span>
                                        <div className="mood-week-strip">
                                            {history.length === 0 ? (
                                                <span className="mood-empty">No check-ins yet</span>
                                            ) : (
                                                history.map((h) => (
                                                    <span key={h.id} title={`${h.logged_date}: ${h.mood}`} className="mood-day-emoji">
                                                        {MOOD_EMOJI[h.mood] || '·'}
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                        <span className="mood-today-tag">
                                            {todaysEntry ? `Today: ${MOOD_EMOJI[todaysEntry.mood] || ''}` : 'No check-in today'}
                                        </span>
                                        {todaysEntry?.reflection_response && (
                                            <p className="mood-reflection-text">"{todaysEntry.reflection_response}"</p>
                                        )}
                                    </div>
                                );
                            })}

                            {memoryLaneFeed.length > 0 && (
                                <div className="memory-lane-feed">
                                    <span className="mood-patient-name">Recent Memory Lane moments</span>
                                    {memoryLaneFeed.map((row) => (
                                        <div className="memory-lane-feed-item" key={row.id}>
                                            <strong>{row.patient_name}</strong>
                                            <span> — {row.prompt_id.replace(/-/g, ' ')}</span>
                                            {row.response_text && <p>"{row.response_text}"</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="stat-card alerts-panel-standalone">
                    <div className="alerts-panel-standalone-head">
                        <div className="alerts-panel-title-group">
                            <span className="alerts-panel-icon">🔔</span>
                            <div>
                                <h3>{t('caregiverDashboard.dashboard.alertsMessages')}</h3>
                                <p className="alerts-panel-subtitle">
                                    {unreadMessageCount > 0
                                        ? t('caregiverDashboard.dashboard.unreadNotes', { count: unreadMessageCount })
                                        : t('caregiverDashboard.dashboard.allCaughtUp')}
                                </p>
                            </div>
                        </div>

                        {unreadMessageCount > 1 && (
                            <button
                                type="button"
                                className="alerts-mark-all-btn"
                                onClick={markAllNotesAsRead}
                            >
                                {t('caregiverDashboard.dashboard.markAllRead')}
                            </button>
                        )}
                    </div>

                    {patientMessages.length === 0 ? (
                        <p className="stat-placeholder">
                            {t('caregiverDashboard.dashboard.noNewMessages')}
                        </p>
                    ) : (
                        <div className="alerts-message-list">
                            {patientMessages.map((message) => (
                                <div
                                    className={`msg-item ${message.read_at ? 'is-read' : 'unread'}`}
                                    key={message.id}
                                >
                                    <span className="msg-avatar">
                                        {message.patient_avatar_url ? (
                                            <img src={message.patient_avatar_url} alt="" />
                                        ) : (
                                            getMessageInitials(message.patient_name)
                                        )}
                                    </span>

                                    <div className="msg-body">
                                        <div className="msg-content">
                                            <p className="msg-meta-line">
                                                <span className="msg-name-inline">
                                                    {message.patient_name || 'Patient'}
                                                </span>
                                                <span className="msg-meta-sub">{t('caregiverDashboard.dashboard.sentNote')}</span>
                                                {!message.read_at && <span className="msg-unread-tag">{t('caregiverDashboard.dashboard.new')}</span>}
                                            </p>

                                            <p className="msg-text-line">
                                                {message.message}
                                            </p>

                                            <div className="msg-actions">
                                                {!message.read_at && (
                                                    <button
                                                        type="button"
                                                        className="msg-action-btn primary"
                                                        onClick={() => markNoteAsRead(message.id)}
                                                    >
                                                        {t('caregiverDashboard.dashboard.markAsRead')}
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    className="msg-action-btn"
                                                    onClick={() => archiveNote(message.id)}
                                                >
                                                    {t('caregiverDashboard.dashboard.dismiss')}
                                                </button>
                                            </div>
                                        </div>

                                        <span className="msg-time">
                                            {message.created_at
                                                ? new Date(message.created_at).toLocaleString('en-US')
                                                : t('caregiverDashboard.dashboard.justNow')}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <footer className="dashboard-footer">
                    {t('caregiverDashboard.footer')}
                </footer>
            </div>

            {renderProfileModal()}
        </div>
    );
}