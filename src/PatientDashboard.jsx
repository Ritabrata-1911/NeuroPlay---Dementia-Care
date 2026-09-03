import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from './SupabaseClient';
import './PatientDashboard.css';
import {
    fetchRemindersForPatient,
    saveReminder,
    toggleReminderCompletion,
    deleteReminder,
    subscribeToReminderChanges,
} from './ReminderService';

import MemoryMatchGame from './MemoryMatchGame';
import PictureRecallGame from './PictureRecallGame';
import NumberMemoryGame from './NumberMemoryGame';
import MemoryMapGame from './MemoryMapGame';
import MindSnap from './MindSnap'; // NEW GAME IMPORTED HERE

const GAME_CATEGORIES = [
    {
        id: 'memory',
        title: 'Memory Exercises',
        description: 'Practise remembering sequences and patterns.',
        icon: '🧠',
    },
    {
        id: 'numbers',
        title: 'Numbers & Recall',
        description: 'Engage with numeric memory activities.',
        icon: '🔢',
    },
    {
        id: 'visual',
        title: 'Visual & Spatial',
        description: 'Observe scenes, maps, and objects.',
        icon: '🖼️',
    },
    {
        id: 'attention',
        title: 'Focus & Attention',
        description: 'Targeted focus and attention training.',
        icon: '🎯',
    },
];

const GAMES = [
    {
        id: 'mind-snap',
        title: 'Mind Snap',
        description: 'Test visual short-term memory, attention, and concentration.',
        icon: '🧠',
        category: 'memory',
        playable: true,
    },
    {
        id: 'memory-match',
        title: 'Memory Match',
        description: 'Match pairs of cards to exercise visual memory.',
        icon: '🧠',
        category: 'memory',
        playable: true,
    },
    {
        id: 'memory-map',
        title: 'Memory Map',
        description: 'Exercise spatial memory by remembering locations on a map.',
        icon: '🗺️',
        category: 'visual',
        playable: true,
    },
    {
        id: 'number-memory',
        title: 'Number Memory',
        description: 'Remember numbers and recall them accurately.',
        icon: '🔢',
        category: 'numbers',
        playable: true,
    },
    {
        id: 'picture-recall',
        title: 'Object Recognition',
        description: 'Observe details and answer questions about what you saw.',
        icon: '🖼️',
        category: 'visual',
        playable: true,
    },
    {
        id: 'attention',
        title: 'Attention Challenge',
        description: 'Advanced focus module coming soon.',
        icon: '🎯',
        category: 'attention',
        playable: false,
    },
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

function getGreeting() {
    const hour = new Date().getHours();

    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
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
            setReminderError('Reminders could not be loaded.');
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

    const handleReminderToggle = async (reminder) => {
        const updated = await toggleReminderCompletion(reminder);
        if (updated) {
            setReminders((prev) => prev.map((item) => item.id === updated.id ? normalizeReminder(updated) : item));
        }
    };

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
        if (!window.confirm(`Delete the reminder "${reminder.title}"?`)) return;
        const removed = await deleteReminder(reminder);
        if (removed) setReminders((prev) => prev.filter((item) => item.id !== reminder.id));
    };

    function handleSignOut() {
        sessionStorage.removeItem('neuroplay_patient_session');
        onLogout?.();
    }

    async function handleSendNoteToCaregiver() {
        const message = window.prompt('Write a note for your caregiver:');
        const trimmedMessage = message?.trim();

        if (!trimmedMessage) return;

        const patientId = patient?.id || patient?.patient_id;

        if (!patientId) {
            window.alert(
                'Your note could not be sent — your session looks invalid. Please log in again.'
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
            window.alert('Your note could not be sent. Please try again.');
            return;
        }

        window.alert('Your note has been sent to your caregiver.');
    }

    function handleFeatureClick(featureName) {
        window.alert(`${featureName} module is coming soon.`);
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
        'there';

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
        'Primary Contact'; // <- Frontend fallback contact

    const currentDateString = new Date().toLocaleDateString('en-US', {
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
                        <h1>NeuroPlay</h1>
                        <span className="db-brand-subtitle">Patient Portal</span>
                    </div>
                </div>

                <nav className="db-nav-links">
                    <button
                        className={`db-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setActiveTab('dashboard')}
                    >
                        <span className="db-nav-icon">📊</span>
                        <span>Dashboard</span>
                    </button>
                    <button
                        className={`db-nav-item ${activeTab === 'schedule' ? 'active' : ''}`}
                        onClick={() => setActiveTab('schedule')}
                    >
                        <span className="db-nav-icon">📅</span>
                        <span>Schedule & Tasks</span>
                    </button>
                    <button
                        className={`db-nav-item ${activeTab === 'exercises' ? 'active' : ''}`}
                        onClick={() => setActiveTab('exercises')}
                    >
                        <span className="db-nav-icon">🎮</span>
                        <span>Brain Exercises</span>
                    </button>
                    <button
                        className={`db-nav-item ${activeTab === 'wellness' ? 'active' : ''}`}
                        onClick={() => setActiveTab('wellness')}
                    >
                        <span className="db-nav-icon">💧</span>
                        <span>Wellness Logs</span>
                    </button>
                    <button
                        className={`db-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                    >
                        <span className="db-nav-icon">⚙️</span>
                        <span>Settings</span>
                    </button>
                </nav>

                <div className="db-sidebar-footer">
                    <div className="db-sidebar-support-card">
                        <p>Need a hand with your routine?</p>
                        <button
                            className="db-btn db-btn-secondary db-full-width"
                            onClick={() => handleFeatureClick('Support')}
                        >
                            Contact Support
                        </button>
                    </div>
                </div>
            </aside>

            <div className="db-main-wrapper">
                <header className="db-topbar">
                    <div className="db-topbar-title">
                        <h2>
                            {activeTab === 'dashboard' && 'Overview'}
                            {activeTab === 'schedule' && 'Schedule & Reminders'}
                            {activeTab === 'exercises' && 'Cognitive Exercises'}
                            {activeTab === 'wellness' && 'Daily Care Overview'}
                            {activeTab === 'settings' && 'Account Settings'}
                        </h2>
                    </div>

                    <div className="db-topbar-actions">
                        <div className="db-user-pill">
                            <div className="db-avatar">
                                {patientName.charAt(0).toUpperCase()}
                            </div>
                            <div className="db-user-info">
                                <span className="db-user-name">{patientName}</span>
                                <span className="db-user-role">Active Session</span>
                            </div>
                        </div>

                        <button
                            className="db-btn db-btn-secondary"
                            onClick={handleSignOut}
                        >
                            Sign Out
                        </button>
                    </div>
                </header>

                <main className="db-main-content">
                    {activeTab === 'dashboard' && (
                        <>
                            <section className="db-welcome-banner">
                                <div className="db-welcome-text">
                                    <span className="db-badge-pill">{getGreeting()}</span>
                                    <h2>Welcome back, {patientName}</h2>
                                    <p>
                                        Review your daily care overview, check weather updates, or access your tools from the navigation menu.
                                    </p>
                                </div>
                                <div className="db-welcome-graphic">🧠</div>
                            </section>

                            <div className="db-companion-grid">
                                <div className="db-companion-card">
                                    <div className="db-companion-header">
                                        <div className="db-companion-avatar">👩‍⚕️</div>
                                        <div>
                                            <h4>Assigned Caregiver</h4>
                                            <p>{caregiverName} • {caregiverContact}</p>
                                        </div>
                                    </div>
                                    <div className="db-companion-body">
                                        <span>"Have a wonderful and structured day ahead. Reach out if you need any help with your daily activities!"</span>
                                    </div>
                                    <div className="db-companion-actions">
                                        <button 
                                            className="db-btn db-btn-secondary db-sm"
                                            onClick={handleSendNoteToCaregiver}
                                            disabled={sendingNote}
                                        >
                                            {sendingNote ? 'Sending…' : 'Send Note to Caregiver'}
                                        </button>
                                    </div>
                                </div>

                                <div className="db-companion-card">
                                    <div className="db-weather-header">
                                        <div>
                                            <span className="db-date-tag">📅 {currentDateString}</span>
                                            <h4>Today's Outlook</h4>
                                        </div>
                                        <div className="db-weather-badge">
                                            <span>⛅</span>
                                            <div>
                                                <strong>22°C</strong>
                                                <small>Pleasant & Sunny</small>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="db-mood-check">
                                        <span className="db-mood-label">How are you feeling right now?</span>
                                        <div className="db-mood-options">
                                            {[
                                                { emoji: '😊', label: 'Great', id: 'great' },
                                                { emoji: '😌', label: 'Calm', id: 'calm' },
                                                { emoji: '🥱', label: 'Tired', id: 'tired' },
                                                { emoji: '🤔', label: 'Unsure', id: 'unsure' },
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
                                            <div className="db-saved-toast">✓ Mood recorded for today. Thank you!</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'schedule' && (
                        <section className="db-section">
                            <div className="db-section-header pt-schedule-header">
                               <div>
                                    <h3>Routine & Schedule Management</h3>
                                    <p>Review all assigned tasks, medications, and daily events.</p>
                               </div>

                               <button
                                    type="button"
                                    className="pt-reminder-add-btn"
                                    onClick={() => setShowReminderForm((prev) => !prev)}
                               >
                                    + Add reminder
                               </button>
                            </div>

                            {reminderError && (
                                <div className="db-alert db-alert-warning">{reminderError}</div>
                            )}

                            {showReminderForm && (
                                <form className="pt-reminder-form" onSubmit={handleReminderSubmit}>
                                    <div className="pt-reminder-form-grid">
                                        <label>
                                            Title
                                            <input
                                                value={reminderForm.title}
                                                onChange={(e) => setReminderForm((prev) => ({ ...prev, title: e.target.value }))}
                                                placeholder="e.g. Call my sister"
                                                maxLength={80}
                                                required
                                            />
                                        </label>

                                        <label>
                                            Time (optional)
                                            <input
                                                type="time"
                                                value={reminderForm.time}
                                                onChange={(e) => setReminderForm((prev) => ({ ...prev, time: e.target.value }))}
                                            />
                                        </label>

                                        <label className="pt-reminder-form-wide">
                                            Note (optional)
                                            <textarea
                                                value={reminderForm.description}
                                                onChange={(e) => setReminderForm((prev) => ({ ...prev, description: e.target.value }))}
                                                placeholder="Any extra detail"
                                                maxLength={180}
                                                rows={2}
                                            />
                                        </label>
                                    </div>

                                    <div className="pt-reminder-form-actions">
                                        <button type="button" className="pt-reminder-cancel-btn" onClick={() => setShowReminderForm(false)}>Cancel</button>
                                        <button type="submit" className="pt-reminder-save-btn" disabled={reminderSaving}>
                                            {reminderSaving ? 'Saving…' : 'Create reminder'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {remindersLoading ? (
                                <div className="db-loading-state">Loading schedule...</div>
                            ) : (
                                <div className="db-card-container">
                                    <div className="db-list-stack">
                                        {reminders.filter((r) => r.enabled !== false).map((reminder) => (
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
                    )}

                    {activeTab === 'exercises' && (
                        <section className="db-section">
                            <div className="db-section-header">
                                <div>
                                    <h3>All Brain Training Modules</h3>
                                    <p>Browse through available memory and focus sessions.</p>
                                </div>
                            </div>

                            <div className="db-exercises-grid">
                                {groupedGames.map((category) => (
                                    <div className="db-exercise-category-card" key={category.id}>
                                        <div className="db-category-heading">
                                            <span className="db-category-emoji">{category.icon}</span>
                                            <div>
                                                <h4>{category.title}</h4>
                                                <p>{category.description}</p>
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
                                                                <strong>{game.title}</strong>
                                                                <span className={`db-status-pill ${game.playable ? 'active' : 'upcoming'}`}>
                                                                    {game.playable ? 'Ready' : 'Coming Soon'}
                                                                </span>
                                                            </div>
                                                            <p>{game.description}</p>
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
                                                        {game.playable ? 'Play' : 'Locked'}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {activeTab === 'wellness' && (
                        <section className="db-section">
                            <div className="db-section-header">
                                <div>
                                    <h3>Daily Care Overview</h3>
                                    <p>Quick access shortcuts to your wellness tools.</p>
                                </div>
                            </div>

                            <div className="db-quick-links-grid">
                                <button
                                    className="db-shortcut-card"
                                    onClick={() => handleFeatureClick('Medicine Reminders')}
                                >
                                    <span className="db-shortcut-icon">💊</span>
                                    <div>
                                        <strong>Medicine Log</strong>
                                        <small>Review scheduled prescriptions.</small>
                                    </div>
                                    <span className="db-arrow">→</span>
                                </button>

                                <button
                                    className="db-shortcut-card"
                                    onClick={() => handleFeatureClick('Hydration')}
                                >
                                    <span className="db-shortcut-icon">💧</span>
                                    <div>
                                        <strong>Hydration Tracker</strong>
                                        <small>Monitor daily water intake.</small>
                                    </div>
                                    <span className="db-arrow">→</span>
                                </button>

                                <button
                                    className="db-shortcut-card"
                                    onClick={() => handleFeatureClick('Daily Activities')}
                                >
                                    <span className="db-shortcut-icon">📅</span>
                                    <div>
                                        <strong>Routine Calendar</strong>
                                        <small>Check upcoming daily events.</small>
                                    </div>
                                    <span className="db-arrow">→</span>
                                </button>

                                <button
                                    className="db-shortcut-card"
                                    onClick={() => handleFeatureClick('Appointments')}
                                >
                                    <span className="db-shortcut-icon">🏥</span>
                                    <div>
                                        <strong>Appointments</strong>
                                        <small>View scheduled clinical visits.</small>
                                    </div>
                                    <span className="db-arrow">→</span>
                                </button>
                            </div>
                        </section>
                    )}

                    {activeTab === 'settings' && (
                        <section className="db-section">
                            <div className="db-section-header">
                                <div>
                                    <h3>Account Preferences</h3>
                                    <p>Manage your patient session and configurations.</p>
                                </div>
                            </div>

                            <div className="db-card-container" style={{ padding: '2rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '400px' }}>
                                    <div>
                                        <strong style={{ display: 'block', fontSize: '0.875rem', color: 'var(--db-navy-text)' }}>Full Name</strong>
                                        <span style={{ fontSize: '0.95rem', color: 'var(--db-slate-text)' }}>{patientName}</span>
                                    </div>
                                    <div>
                                        <strong style={{ display: 'block', fontSize: '0.875rem', color: 'var(--db-navy-text)' }}>Patient ID</strong>
                                        <span style={{ fontSize: '0.95rem', color: 'var(--db-slate-text)' }}>{patient.id || patient.patient_id}</span>
                                    </div>
                                    <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--db-border-color)' }}>
                                        <button className="db-btn db-btn-secondary" onClick={handleSignOut}>
                                            Sign Out of Session
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}
                </main>

                <footer className="db-footer">
                    <span>NeuroPlay Platform</span>
                    <span>Take your time. Consistency is key.</span>
                </footer>
            </div>
        </div>
    );
}

function ReminderRow({ reminder, onToggle, onDelete }) {
    const time = formatReminderTime(reminder);

    return (
        <div className={`db-row-item ${reminder.completed ? 'completed' : ''}`}>
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
                        {reminder.type === 'custom' ? 'Custom' : 'Standard'}
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
                </div>
            </div>

            <div className="pt-reminder-row-end">
                <div className="db-row-status-text">
                    {reminder.completed ? 'Done' : 'Pending'}
                </div>

                {reminder.type === 'custom' && onDelete && (
                    <button
                        type="button"
                        className="pt-reminder-delete-btn"
                        onClick={() => onDelete(reminder)}
                        aria-label={`Delete ${reminder.title}`}
                    >
                        Delete
                    </button>
                )}
            </div>
        </div>
    );
}