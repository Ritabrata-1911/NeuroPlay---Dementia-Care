import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from './SupabaseClient';
import './PatientDashboard.css';
import {
    fetchRemindersForPatient,
    saveReminder,
    toggleReminderCompletion,
    deleteReminder,
    subscribeToReminderChanges,
    incrementHydration,
    decrementHydration,
    togglePatientRoutineCompletion,
} from './ReminderService';
import {
    useReminderAlarms,
    ReminderAlarmBanner,
    ReminderStatusBadge,
    getReminderRowClassName,
} from './useReminderAlarms';

import MemoryMatchGame from './MemoryMatchGame';
import PictureRecallGame from './PictureRecallGame';
import NumberMemoryGame from './NumberMemoryGame';
import MemoryMapGame from './MemoryMapGame';
import MindSnap from './MindSnap'; // NEW GAME IMPORTED HERE

const GAME_CATEGORIES = [
    { id: 'memory', icon: '🧠' },
    { id: 'numbers', icon: '🔢' },
    { id: 'visual', icon: '🖼️' },
    { id: 'attention', icon: '🎯' },
];

const GAMES = [
    { id: 'mind-snap', icon: '🧠', category: 'memory', playable: true },
    { id: 'memory-match', icon: '🧠', category: 'memory', playable: true },
    { id: 'memory-map', icon: '🗺️', category: 'visual', playable: true },
    { id: 'number-memory', icon: '🔢', category: 'numbers', playable: true },
    { id: 'picture-recall', icon: '🖼️', category: 'visual', playable: true },
    { id: 'attention', icon: '🎯', category: 'attention', playable: false },
];

function formatReminderTime(reminder) {
    if (!reminder?.reminder_time && !reminder?.due_time) {
        return '';
    }

    const value = reminder.reminder_time || reminder.due_time;

    try {
        const date = new Date(`1970-01-01T${value}`);
        if (Number.isNaN(date.getTime())) return value;

        return date.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
        });
    } catch {
        return value;
    }
}

function getGreetingKey() {
    const hour = new Date().getHours();

    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
}

function normalizeReminder(reminder) {
    return {
        ...reminder,
        completed: Boolean(reminder.completed),
        type: reminder.is_basic ? 'basic' : 'custom',
        category: reminder.category || 'General',
    };
}

export default function PatientDashboard({ onLogout }) {
    const { t, i18n } = useTranslation();
    const [patient, setPatient] = useState(null);
    const [activeGame, setActiveGame] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');

    const [reminders, setReminders] = useState([]);
    const [remindersLoading, setRemindersLoading] = useState(true);
    const [reminderError, setReminderError] = useState('');
    const [showReminderForm, setShowReminderForm] = useState(false);
    const [reminderSaving, setReminderSaving] = useState(false);
    const [reminderForm, setReminderForm] = useState({
        title: '',
        description: '',
        time: '',
    });

    const [moodSelected, setMoodSelected] = useState(null);
    const [noteSaved, setNoteSaved] = useState(false);
    const [sendingNote, setSendingNote] = useState(false);

    // Which Daily Care Overview cards are currently expanded — these 4
    // (medicine / hydration / activity / appointments) are set by the
    // caregiver only; the patient can view and mark complete but never
    // add, edit, or delete them. Stored as a list so more than one card
    // can stay open at once.
    const [expandedRoutine, setExpandedRoutine] = useState([]);
    const [hydrationBusy, setHydrationBusy] = useState(false);

    useEffect(() => {
        const storedSession = sessionStorage.getItem(
            'neuroplay_patient_session'
        );

        if (!storedSession) {
            onLogout?.();
            return;
        }

        try {
            const parsedPatient = JSON.parse(storedSession);

            if (!parsedPatient?.id && !parsedPatient?.patient_id) {
                onLogout?.();
                return;
            }

            setPatient(parsedPatient);
        } catch (error) {
            console.error('Unable to restore patient session:', error);
            sessionStorage.removeItem('neuroplay_patient_session');
            onLogout?.();
        }
    }, [onLogout]);

    useEffect(() => {
        const patientId = patient?.id || patient?.patient_id;
        if (!patientId) return undefined;

        let active = true;
        setRemindersLoading(true);
        setReminderError('');

        fetchRemindersForPatient(patientId).then((data) => {
            if (!active) return;
            setReminders(data.map(normalizeReminder));
            setRemindersLoading(false);
        }).catch((error) => {
            console.error('Unable to load reminders:', error);
            if (!active) return;
            setReminderError(t('patientDashboard.errors.remindersLoadFailed'));
            setRemindersLoading(false);
        });

        const unsubscribe = subscribeToReminderChanges(patientId, (next) => {
            if (active) setReminders(next.map(normalizeReminder));
        });

        return () => {
            active = false;
            unsubscribe();
        };
    }, [patient]);

    // Routine items (medicine/activity/appointment) are caregiver-owned
    // and the patient device runs under the anon key, so completion is
    // toggled via the toggle_patient_reminder RPC rather than a direct
    // table update. True custom reminders (patient's own one-off items)
    // still go through the existing direct-update path.
    const handleReminderToggle = async (reminder) => {
        const updated = reminder?.routine_type
            ? await togglePatientRoutineCompletion(reminder)
            : await toggleReminderCompletion(reminder);
        if (updated) {
            setReminders((prev) => prev.map((item) => item.id === updated.id ? normalizeReminder(updated) : item));
        }
    };

    const { activeAlerts, dismissAlert } = useReminderAlarms(reminders);

    const handleReminderSubmit = async (event) => {
        event.preventDefault();
        const patientId = patient?.id || patient?.patient_id;
        if (!patientId || !reminderForm.title.trim()) return;

        setReminderSaving(true);
        const saved = await saveReminder({
            title: reminderForm.title.trim(),
            description: reminderForm.description.trim(),
            time: reminderForm.time,
            category: 'custom',
            patient_id: patientId,
            created_by: 'patient',
            is_basic: false,
        });

        if (saved) {
            setReminders((prev) => [...prev, normalizeReminder(saved)]);
        }

        setReminderSaving(false);
        setReminderForm({ title: '', description: '', time: '' });
        setShowReminderForm(false);
    };

    const handleReminderDelete = async (reminder) => {
        if (!window.confirm(t('patientDashboard.confirm.deleteReminder', { title: reminder.title }))) return;
        const removed = await deleteReminder(reminder);
        if (removed) setReminders((prev) => prev.filter((item) => item.id !== reminder.id));
    };

    function handleSignOut() {
        sessionStorage.removeItem('neuroplay_patient_session');
        onLogout?.();
    }

    async function handleSendNoteToCaregiver() {
        const message = window.prompt(t('patientDashboard.prompts.writeNote'));
        const trimmedMessage = message?.trim();

        if (!trimmedMessage) return;

        const patientId = patient?.id || patient?.patient_id;

        if (!patientId) {
            window.alert(
                t('patientDashboard.alerts.noteSessionInvalid')
            );
            return;
        }

        setSendingNote(true);

        const { error } = await supabase.rpc('send_patient_note', {
            p_patient_id: patientId,
            p_message: trimmedMessage,
        });

        setSendingNote(false);

        if (error) {
            console.error('Unable to send note to caregiver:', error);
            window.alert(t('patientDashboard.alerts.noteFailed'));
            return;
        }

        window.alert(t('patientDashboard.alerts.noteSent'));
    }

    function handleFeatureClick(featureName) {
        window.alert(t('patientDashboard.alerts.comingSoon', { feature: featureName }));
    }

    function toggleRoutineCard(type) {
        setExpandedRoutine((prev) =>
            prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
        );
    }

    async function handleHydrationChange(hydrationReminder, delta) {
        if (!hydrationReminder || hydrationBusy) return;
        setHydrationBusy(true);
        const updater = delta > 0 ? incrementHydration : decrementHydration;
        const updated = await updater(hydrationReminder);
        if (updated) {
            setReminders((prev) => prev.map((item) => item.id === updated.id ? normalizeReminder(updated) : item));
        }
        setHydrationBusy(false);
    }

    function handleGameHome() {
        setActiveGame(null);
    }

    const groupedGames = useMemo(() => {
        return GAME_CATEGORIES.map((category) => ({
            ...category,
            games: GAMES.filter(
                (game) => game.category === category.id
            ),
        })).filter((category) => category.games.length > 0);
    }, []);

    if (!patient) {
        return null;
    }

    if (activeGame === 'mind-snap') {
        return <MindSnap patient={patient} onHome={handleGameHome} />;
    }

    if (activeGame === 'memory-match') {
        return <MemoryMatchGame patient={patient} onHome={handleGameHome} />;
    }

    if (activeGame === 'memory-map') {
        return <MemoryMapGame patient={patient} onHome={handleGameHome} />;
    }

    if (activeGame === 'number-memory') {
        return <NumberMemoryGame patient={patient} onHome={handleGameHome} />;
    }

    if (activeGame === 'picture-recall') {
        return <PictureRecallGame patient={patient} onHome={handleGameHome} />;
    }

    const patientName =
        patient.full_name ||
        patient.name ||
        t('patientDashboard.fallback.there');

    // FRONTEND-ONLY FALLBACK: Change the strings below to whatever caregiver name/contact you want to display
    const caregiverName =
        patient.caregiver_full_name ||
        patient.caregiver_name ||
        patient.caregiverName ||
        patient.assigned_caregiver ||
        'Ritabrata Roy Chowdhury'; // <- Frontend fallback name

    const caregiverContact =
        patient.caregiver_phone ||
        patient.caregiver_contact ||
        patient.caregiverContact ||
        t('patientDashboard.fallback.primaryContact'); // <- Frontend fallback contact

    const currentDateString = new Date().toLocaleDateString(i18n.language, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    return (
        <div className="db-app-layout">
            <aside className="db-sidebar">
                <div className="db-brand-box">
                    <div className="db-brand-icon">🧠</div>
                    <div className="db-brand-title">
                        <h1>{t('brand')}</h1>
                        <span className="db-brand-subtitle">{t('patientDashboard.sidebar.subtitle')}</span>
                    </div>
                </div>

                <nav className="db-nav-links">
                    <button
                        className={`db-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setActiveTab('dashboard')}
                    >
                        <span className="db-nav-icon">📊</span>
                        <span>{t('patientDashboard.sidebar.dashboard')}</span>
                    </button>
                    <button
                        className={`db-nav-item ${activeTab === 'schedule' ? 'active' : ''}`}
                        onClick={() => setActiveTab('schedule')}
                    >
                        <span className="db-nav-icon">📅</span>
                        <span>{t('patientDashboard.sidebar.schedule')}</span>
                    </button>
                    <button
                        className={`db-nav-item ${activeTab === 'exercises' ? 'active' : ''}`}
                        onClick={() => setActiveTab('exercises')}
                    >
                        <span className="db-nav-icon">🎮</span>
                        <span>{t('patientDashboard.sidebar.exercises')}</span>
                    </button>
                    <button
                        className={`db-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                    >
                        <span className="db-nav-icon">⚙️</span>
                        <span>{t('patientDashboard.sidebar.settings')}</span>
                    </button>
                </nav>

                <div className="db-sidebar-footer">
                    <div className="db-sidebar-support-card">
                        <p>{t('patientDashboard.sidebar.supportPrompt')}</p>
                        <button
                            className="db-btn db-btn-secondary db-full-width"
                            onClick={() => handleFeatureClick(t('patientDashboard.sidebar.support'))}
                        >
                            {t('patientDashboard.sidebar.contactSupport')}
                        </button>
                    </div>
                </div>
            </aside>

            <div className="db-main-wrapper">
                <ReminderAlarmBanner
                    alerts={activeAlerts}
                    onDismiss={dismissAlert}
                    onComplete={handleReminderToggle}
                />

                <header className="db-topbar">
                    <div className="db-topbar-title">
                        <h2>
                            {activeTab === 'dashboard' && t('patientDashboard.topbar.overview')}
                            {activeTab === 'schedule' && t('patientDashboard.topbar.schedule')}
                            {activeTab === 'exercises' && t('patientDashboard.topbar.exercises')}
                            {activeTab === 'settings' && t('patientDashboard.topbar.settings')}
                        </h2>
                    </div>

                    <div className="db-topbar-actions">
                        <div className="db-user-pill">
                            <div className="db-avatar">
                                {patientName.charAt(0).toUpperCase()}
                            </div>
                            <div className="db-user-info">
                                <span className="db-user-name">{patientName}</span>
                                <span className="db-user-role">{t('patientDashboard.topbar.activeSession')}</span>
                            </div>
                        </div>

                        <button
                            className="db-btn db-btn-secondary"
                            onClick={handleSignOut}
                        >
                            {t('patientDashboard.topbar.signOut')}
                        </button>
                    </div>
                </header>

                <main className="db-main-content">
                    {activeTab === 'dashboard' && (
                        <>
                            <section className="db-welcome-banner">
                                <div className="db-welcome-text">
                                    <span className="db-badge-pill">{t(`patientDashboard.greeting.${getGreetingKey()}`)}</span>
                                    <h2>{t('patientDashboard.welcome.heading', { name: patientName })}</h2>
                                    <p>
                                        {t('patientDashboard.welcome.subtitle')}
                                    </p>
                                </div>
                                <div className="db-welcome-graphic">🧠</div>
                            </section>

                            <div className="db-companion-grid">
                                <div className="db-companion-card">
                                    <div className="db-companion-header">
                                        <div className="db-companion-avatar">👩‍⚕️</div>
                                        <div>
                                            <h4>{t('patientDashboard.companion.assignedCaregiver')}</h4>
                                            <p>{caregiverName} • {caregiverContact}</p>
                                        </div>
                                    </div>
                                    <div className="db-companion-body">
                                        <span>{t('patientDashboard.companion.quote')}</span>
                                    </div>
                                    <div className="db-companion-actions">
                                        <button
                                            className="db-btn db-btn-secondary db-sm"
                                            onClick={handleSendNoteToCaregiver}
                                            disabled={sendingNote}
                                        >
                                            {sendingNote ? t('patientDashboard.companion.sending') : t('patientDashboard.companion.sendNote')}
                                        </button>
                                    </div>
                                </div>

                                <div className="db-companion-card">
                                    <div className="db-weather-header">
                                        <div>
                                            <span className="db-date-tag">📅 {currentDateString}</span>
                                            <h4>{t('patientDashboard.weather.heading')}</h4>
                                        </div>
                                        <div className="db-weather-badge">
                                            <span>⛅</span>
                                            <div>
                                                <strong>22°C</strong>
                                                <small>{t('patientDashboard.weather.condition')}</small>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="db-mood-check">
                                        <span className="db-mood-label">{t('patientDashboard.mood.label')}</span>
                                        <div className="db-mood-options">
                                            {[
                                                { emoji: '😊', label: t('patientDashboard.mood.great'), id: 'great' },
                                                { emoji: '😌', label: t('patientDashboard.mood.calm'), id: 'calm' },
                                                { emoji: '🥱', label: t('patientDashboard.mood.tired'), id: 'tired' },
                                                { emoji: '🤔', label: t('patientDashboard.mood.unsure'), id: 'unsure' },
                                            ].map((m) => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    className={`db-mood-btn ${moodSelected === m.id ? 'selected' : ''}`}
                                                    onClick={() => {
                                                        setMoodSelected(m.id);
                                                        setNoteSaved(true);
                                                        setTimeout(() => setNoteSaved(false), 3000);
                                                    }}
                                                >
                                                    <span>{m.emoji}</span>
                                                    <small>{m.label}</small>
                                                </button>
                                            ))}
                                        </div>
                                        {noteSaved && (
                                            <div className="db-saved-toast">✓ {t('patientDashboard.mood.saved')}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'schedule' && (() => {
                        const medicines = reminders.filter((r) => r.routine_type === 'medicine' && r.enabled !== false);
                        const activities = reminders.filter((r) => r.routine_type === 'activity' && r.enabled !== false);
                        const appointments = reminders.filter((r) => r.routine_type === 'appointment' && r.enabled !== false);
                        const hydration = reminders.find((r) => r.routine_type === 'hydration');
                        const hydrationProgress = hydration?.progress_count || 0;
                        const hydrationTarget = hydration?.target_count || 8;

                        return (
                            <>
                                <section className="db-section">
                                    <div className="db-section-header">
                                        <div>
                                            <h3>{t('patientDashboard.schedule.overviewTitle')}</h3>
                                            <p>{t('patientDashboard.schedule.overviewSubtitle')}</p>
                                        </div>
                                    </div>

                                    <div className="db-routine-accordion">
                                        <div className="db-routine-accordion-item">
                                            <button
                                                className={`db-shortcut-card ${expandedRoutine.includes('medicine') ? 'db-shortcut-card-active' : ''}`}
                                                onClick={() => toggleRoutineCard('medicine')}
                                            >
                                                <span className="db-shortcut-icon">💊</span>
                                                <div>
                                                    <strong>{t('patientDashboard.schedule.medicineLog')}</strong>
                                                    <small>{medicines.length > 0 ? t('patientDashboard.schedule.takenToday', { done: medicines.filter((m) => m.completed).length, total: medicines.length }) : t('patientDashboard.schedule.reviewPrescriptions')}</small>
                                                </div>
                                                <span className="db-arrow">{expandedRoutine.includes('medicine') ? '▾' : '→'}</span>
                                            </button>

                                            {expandedRoutine.includes('medicine') && (
                                                <div className="db-routine-detail">
                                                    {medicines.length === 0 ? (
                                                        <p className="db-routine-empty">{t('patientDashboard.schedule.noMedicines')}</p>
                                                    ) : (
                                                        medicines.map((item) => (
                                                            <div key={item.id} className={`db-routine-row ${item.completed ? 'completed' : ''} ${getReminderRowClassName(item)}`}>
                                                                <button
                                                                    type="button"
                                                                    className={`pt-reminder-checkbox ${item.completed ? 'checked' : ''}`}
                                                                    onClick={() => handleReminderToggle(item)}
                                                                    aria-label={`Mark ${item.title} ${item.completed ? 'not taken' : 'taken'}`}
                                                                >
                                                                    {item.completed ? '✓' : ''}
                                                                </button>
                                                                <div className="db-routine-row-main">
                                                                    <strong>{item.title}</strong>
                                                                    {item.time && <span>🕐 {item.time}</span>}
                                                                    <ReminderStatusBadge reminder={item} />
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="db-routine-accordion-item">
                                            <button
                                                className={`db-shortcut-card ${expandedRoutine.includes('hydration') ? 'db-shortcut-card-active' : ''}`}
                                                onClick={() => toggleRoutineCard('hydration')}
                                            >
                                                <span className="db-shortcut-icon">💧</span>
                                                <div>
                                                    <strong>{t('patientDashboard.schedule.hydrationTracker')}</strong>
                                                    <small>{hydration ? t('patientDashboard.schedule.glassesToday', { progress: hydrationProgress, target: hydrationTarget }) : t('patientDashboard.schedule.monitorWater')}</small>
                                                </div>
                                                <span className="db-arrow">{expandedRoutine.includes('hydration') ? '▾' : '→'}</span>
                                            </button>

                                            {expandedRoutine.includes('hydration') && (
                                                <div className="db-routine-detail">
                                                    {!hydration ? (
                                                        <p className="db-routine-empty">{t('patientDashboard.schedule.noHydrationGoal')}</p>
                                                    ) : (
                                                        <div className="db-hydration-panel">
                                                            <div className="db-hydration-bar-track">
                                                                <div
                                                                    className="db-hydration-bar-fill"
                                                                    style={{ width: `${Math.min(100, (hydrationProgress / hydrationTarget) * 100)}%` }}
                                                                />
                                                            </div>
                                                            <p className="db-hydration-count">{t('patientDashboard.schedule.glassesToday', { progress: hydrationProgress, target: hydrationTarget })}</p>
                                                            <div className="db-hydration-actions">
                                                                <button
                                                                    type="button"
                                                                    className="db-hydration-btn"
                                                                    onClick={() => handleHydrationChange(hydration, -1)}
                                                                    disabled={hydrationBusy || hydrationProgress <= 0}
                                                                    aria-label="Remove one glass"
                                                                >
                                                                    −
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="db-hydration-btn db-hydration-btn-primary"
                                                                    onClick={() => handleHydrationChange(hydration, 1)}
                                                                    disabled={hydrationBusy}
                                                                >
                                                                    + {t('patientDashboard.schedule.addGlass')}
                                                                </button>
                                                            </div>
                                                            {hydration.completed && <p className="db-hydration-done">{t('patientDashboard.schedule.goalReached')} ✓</p>}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="db-routine-accordion-item">
                                            <button
                                                className={`db-shortcut-card ${expandedRoutine.includes('activity') ? 'db-shortcut-card-active' : ''}`}
                                                onClick={() => toggleRoutineCard('activity')}
                                            >
                                                <span className="db-shortcut-icon">📅</span>
                                                <div>
                                                    <strong>{t('patientDashboard.schedule.routineCalendar')}</strong>
                                                    <small>{activities.length > 0 ? t('patientDashboard.schedule.doneToday', { done: activities.filter((a) => a.completed).length, total: activities.length }) : t('patientDashboard.schedule.checkActivities')}</small>
                                                </div>
                                                <span className="db-arrow">{expandedRoutine.includes('activity') ? '▾' : '→'}</span>
                                            </button>

                                            {expandedRoutine.includes('activity') && (
                                                <div className="db-routine-detail">
                                                    {activities.length === 0 ? (
                                                        <p className="db-routine-empty">{t('patientDashboard.schedule.noActivities')}</p>
                                                    ) : (
                                                        activities.map((item) => (
                                                            <div key={item.id} className={`db-routine-row ${item.completed ? 'completed' : ''} ${getReminderRowClassName(item)}`}>
                                                                <button
                                                                    type="button"
                                                                    className={`pt-reminder-checkbox ${item.completed ? 'checked' : ''}`}
                                                                    onClick={() => handleReminderToggle(item)}
                                                                    aria-label={`Mark ${item.title} ${item.completed ? 'not done' : 'done'}`}
                                                                >
                                                                    {item.completed ? '✓' : ''}
                                                                </button>
                                                                <div className="db-routine-row-main">
                                                                    <strong>{item.title}</strong>
                                                                    {item.time && <span>🕐 {item.time}</span>}
                                                                    <ReminderStatusBadge reminder={item} />
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="db-routine-accordion-item">
                                            <button
                                                className={`db-shortcut-card ${expandedRoutine.includes('appointment') ? 'db-shortcut-card-active' : ''}`}
                                                onClick={() => toggleRoutineCard('appointment')}
                                            >
                                                <span className="db-shortcut-icon">🏥</span>
                                                <div>
                                                    <strong>{t('patientDashboard.schedule.appointments')}</strong>
                                                    <small>{appointments.length > 0 ? t('patientDashboard.schedule.onFile', { count: appointments.length }) : t('patientDashboard.schedule.viewVisits')}</small>
                                                </div>
                                                <span className="db-arrow">{expandedRoutine.includes('appointment') ? '▾' : '→'}</span>
                                            </button>

                                            {expandedRoutine.includes('appointment') && (
                                                <div className="db-routine-detail">
                                                    {appointments.length === 0 ? (
                                                        <p className="db-routine-empty">{t('patientDashboard.schedule.noAppointments')}</p>
                                                    ) : (
                                                        appointments.map((item) => (
                                                            <div key={item.id} className={`db-routine-row ${item.completed ? 'completed' : ''} ${getReminderRowClassName(item)}`}>
                                                                <button
                                                                    type="button"
                                                                    className={`pt-reminder-checkbox ${item.completed ? 'checked' : ''}`}
                                                                    onClick={() => handleReminderToggle(item)}
                                                                    aria-label={`Mark ${item.title} ${item.completed ? 'not checked' : 'checked'}`}
                                                                >
                                                                    {item.completed ? '✓' : ''}
                                                                </button>
                                                                <div className="db-routine-row-main">
                                                                    <strong>{item.title}</strong>
                                                                    {item.event_date && <span>📅 {item.event_date}</span>}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                <section className="db-section">
                                    <div className="db-section-header pt-schedule-header">
                                        <div>
                                            <h3>{t('patientDashboard.custom.title')}</h3>
                                            <p>{t('patientDashboard.custom.subtitle')}</p>
                                        </div>

                                        <button
                                            type="button"
                                            className="pt-reminder-add-btn"
                                            onClick={() => setShowReminderForm((prev) => !prev)}
                                        >
                                            + {t('patientDashboard.custom.addReminder')}
                                        </button>
                                    </div>

                                    {reminderError && (
                                        <div className="db-alert db-alert-warning">{reminderError}</div>
                                    )}

                                    {showReminderForm && (
                                        <form className="pt-reminder-form" onSubmit={handleReminderSubmit}>
                                            <div className="pt-reminder-form-grid">
                                                <label>
                                                    {t('patientDashboard.custom.formTitleLabel')}
                                                    <input
                                                        value={reminderForm.title}
                                                        onChange={(e) => setReminderForm((prev) => ({ ...prev, title: e.target.value }))}
                                                        placeholder={t('patientDashboard.custom.titlePlaceholder')}
                                                        maxLength={80}
                                                        required
                                                    />
                                                </label>

                                                <label>
                                                    {t('patientDashboard.custom.timeLabel')}
                                                    <input
                                                        type="time"
                                                        value={reminderForm.time}
                                                        onChange={(e) => setReminderForm((prev) => ({ ...prev, time: e.target.value }))}
                                                    />
                                                </label>

                                                <label className="pt-reminder-form-wide">
                                                    {t('patientDashboard.custom.noteLabel')}
                                                    <textarea
                                                        value={reminderForm.description}
                                                        onChange={(e) => setReminderForm((prev) => ({ ...prev, description: e.target.value }))}
                                                        placeholder={t('patientDashboard.custom.notePlaceholder')}
                                                        maxLength={180}
                                                        rows={2}
                                                    />
                                                </label>
                                            </div>

                                            <div className="pt-reminder-form-actions">
                                                <button type="button" className="pt-reminder-cancel-btn" onClick={() => setShowReminderForm(false)}>{t('patientDashboard.custom.cancel')}</button>
                                                <button type="submit" className="pt-reminder-save-btn" disabled={reminderSaving}>
                                                    {reminderSaving ? t('patientDashboard.custom.saving') : t('patientDashboard.custom.createReminder')}
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {remindersLoading ? (
                                        <div className="db-loading-state">{t('patientDashboard.custom.loadingSchedule')}</div>
                                    ) : (
                                        <div className="db-card-container">
                                            <div className="db-list-stack">
                                                {reminders.filter((r) => r.enabled !== false && !r.routine_type).map((reminder) => (
                                                    <ReminderRow
                                                        key={reminder.id}
                                                        reminder={reminder}
                                                        onToggle={handleReminderToggle}
                                                        onDelete={handleReminderDelete}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </section>
                            </>
                        );
                    })()}

                    {activeTab === 'exercises' && (
                        <section className="db-section">
                            <div className="db-section-header">
                                <div>
                                    <h3>{t('patientDashboard.exercises.title')}</h3>
                                    <p>{t('patientDashboard.exercises.subtitle')}</p>
                                </div>
                            </div>

                            <div className="db-exercises-grid">
                                {groupedGames.map((category) => (
                                    <div className="db-exercise-category-card" key={category.id}>
                                        <div className="db-category-heading">
                                            <span className="db-category-emoji">{category.icon}</span>
                                            <div>
                                                <h4>{t(`patientDashboard.gameCategories.${category.id}.title`)}</h4>
                                                <p>{t(`patientDashboard.gameCategories.${category.id}.description`)}</p>
                                            </div>
                                        </div>

                                        <div className="db-exercise-items-list">
                                            {category.games.map((game) => (
                                                <div
                                                    className={`db-exercise-row ${!game.playable ? 'disabled' : ''}`}
                                                    key={game.id}
                                                >
                                                    <div className="db-exercise-info">
                                                        <span className="db-exercise-icon">{game.icon}</span>
                                                        <div>
                                                            <div className="db-exercise-title-line">
                                                                <strong>{t(`patientDashboard.games.${game.id}.title`)}</strong>
                                                                <span className={`db-status-pill ${game.playable ? 'active' : 'upcoming'}`}>
                                                                    {game.playable ? t('patientDashboard.exercises.ready') : t('patientDashboard.exercises.comingSoon')}
                                                                </span>
                                                            </div>
                                                            <p>{t(`patientDashboard.games.${game.id}.description`)}</p>
                                                        </div>
                                                    </div>

                                                    <button
                                                        className="db-btn db-btn-primary"
                                                        disabled={!game.playable}
                                                        onClick={() => {
                                                            if (game.playable) {
                                                                setActiveGame(game.id);
                                                            }
                                                        }}
                                                    >
                                                        {game.playable ? t('patientDashboard.exercises.play') : t('patientDashboard.exercises.locked')}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {activeTab === 'settings' && (
                        <section className="db-section">
                            <div className="db-section-header">
                                <div>
                                    <h3>{t('patientDashboard.settings.title')}</h3>
                                    <p>{t('patientDashboard.settings.subtitle')}</p>
                                </div>
                            </div>

                            <div className="db-card-container" style={{ padding: '2rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '400px' }}>
                                    <div>
                                        <strong style={{ display: 'block', fontSize: '0.875rem', color: 'var(--db-navy-text)' }}>{t('patientDashboard.settings.fullName')}</strong>
                                        <span style={{ fontSize: '0.95rem', color: 'var(--db-slate-text)' }}>{patientName}</span>
                                    </div>
                                    <div>
                                        <strong style={{ display: 'block', fontSize: '0.875rem', color: 'var(--db-navy-text)' }}>{t('patientDashboard.settings.patientId')}</strong>
                                        <span style={{ fontSize: '0.95rem', color: 'var(--db-slate-text)' }}>{patient.id || patient.patient_id}</span>
                                    </div>
                                    <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--db-border-color)' }}>
                                        <button className="db-btn db-btn-secondary" onClick={handleSignOut}>
                                            {t('patientDashboard.settings.signOut')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}
                </main>

                <footer className="db-footer">
                    <span>{t('patientDashboard.footer.platform')}</span>
                    <span>{t('patientDashboard.footer.tagline')}</span>
                </footer>
            </div>
        </div>
    );
}

function ReminderRow({ reminder, onToggle, onDelete }) {
    const { t } = useTranslation();
    const time = formatReminderTime(reminder);

    return (
        <div className={`db-row-item ${reminder.completed ? 'completed' : ''} ${getReminderRowClassName(reminder)}`}>
            <label className="db-checkbox-label">
                <input
                    type="checkbox"
                    checked={Boolean(reminder.completed)}
                    onChange={() => onToggle(reminder)}
                    aria-label={`Mark ${reminder.title} ${reminder.completed ? 'incomplete' : 'complete'}`}
                />
                <span className="db-custom-check">
                    {reminder.completed ? '✓' : ''}
                </span>
            </label>

            <div className="db-row-details">
                <div className="db-row-title-bar">
                    <strong>{reminder.title}</strong>
                    <span className={`db-type-tag ${reminder.type === 'custom' ? 'custom' : 'basic'}`}>
                        {reminder.type === 'custom' ? t('patientDashboard.reminderRow.custom') : t('patientDashboard.reminderRow.standard')}
                    </span>
                </div>

                {reminder.description && (
                    <p>{reminder.description}</p>
                )}

                <div className="db-row-metadata">
                    <span>{reminder.category}</span>
                    {time && (
                        <>
                            <span>•</span>
                            <span>{time}</span>
                        </>
                    )}
                    <ReminderStatusBadge reminder={reminder} />
                </div>
            </div>

            <div className="pt-reminder-row-end">
                <div className="db-row-status-text">
                    {reminder.completed ? t('patientDashboard.reminderRow.done') : t('patientDashboard.reminderRow.pending')}
                </div>

                {reminder.type === 'custom' && onDelete && (
                    <button
                        type="button"
                        className="pt-reminder-delete-btn"
                        onClick={() => onDelete(reminder)}
                        aria-label={`Delete ${reminder.title}`}
                    >
                        {t('patientDashboard.reminderRow.delete')}
                    </button>
                )}
            </div>
        </div>
    );
}