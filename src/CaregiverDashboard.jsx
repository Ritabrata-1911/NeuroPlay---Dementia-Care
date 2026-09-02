import React, { useState, useEffect } from 'react';
import { supabase } from './SupabaseClient';
import AddPatientForm from './AddPatientForm';
import CodeCountdown from './CodeCountdown';
import SettingsPanel from './SettingsPanel';
import './CaregiverDashboard.css';

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

const formatJoinedDate = (isoString) => {
    if (!isoString) return null;

    const d = new Date(isoString);

    if (Number.isNaN(d.getTime())) return null;

    return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

const formatSessionDate = (isoString) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';

    return 'Good evening';
};

const PROFILE_FIELDS = [
    { key: 'full_name', label: 'Full name' },
    { key: 'phone_number', label: 'Phone number' },
    { key: 'alt_phone', label: 'Alternate phone' },
    { key: 'dob', label: 'Date of birth' },
    { key: 'gender', label: 'Gender' },
    { key: 'area', label: 'Area' },
    { key: 'address', label: 'Address' },
    { key: 'country', label: 'Country' },
    { key: 'relationship', label: 'Relationship to patient' },
    { key: 'experience', label: 'Years of experience' },
    { key: 'emergency_name', label: 'Emergency contact' },
    { key: 'emergency_phone', label: 'Emergency contact phone' },
];

const SIDEBAR_LINKS = [
    { key: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { key: 'patients', icon: '🧑‍🤝‍🧑', label: 'Patients' },
    { key: 'reports', icon: '📊', label: 'Reports' },
    { key: 'resources', icon: '📘', label: 'Resources' },
    { key: 'settings', icon: '⚙️', label: 'Settings' },
];

const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
});

// ---------------------------------------------------------------------------
// REPORTS — SAMPLE DATA
//
// The games (MemoryMatchGame, NumberMemoryGame, PictureRecallGame) don't
// write session results to Supabase yet. This block stands in for that
// table so the Reports UI has something real to render.
//
// Once a `game_sessions` table exists (suggested shape: patient_id, game,
// score, accuracy, duration_seconds, played_at), replace
// `getSampleSessionsForPatient(patientId)` with a supabase query like:
//
//   const { data } = await supabase
//     .from('game_sessions')
//     .select('*')
//     .eq('patient_id', patientId)
//     .order('played_at', { ascending: false });
//
// and the rest of renderReports() below needs no other changes — it already
// reads from a flat array of session objects with these same field names.
// ---------------------------------------------------------------------------

const GAME_META = {
    memory_match: { label: 'Memory Match', icon: '🧩' },
    number_memory: { label: 'Number Memory', icon: '🔢' },
    picture_recall: { label: 'Picture Recall', icon: '🖼️' },
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
    const [view, setView] = useState('dashboard');
    const [user, setUser] = useState(null);
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [reportsPatientId, setReportsPatientId] = useState(null);
    const [activeResourceModal, setActiveResourceModal] = useState(null);
    const [emergencyCardPatientId, setEmergencyCardPatientId] = useState(null);

    // --- Quick Calm breathing tool state (lives here so it stops cleanly on modal close) ---
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

    // --- Daily care checklist state (persists to localStorage, resets each calendar day) ---
    const todayKey = `neuroplay_checklist_${new Date().toISOString().slice(0, 10)}`;
    const CHECKLIST_ITEMS = [
        { key: 'medication', label: 'Medication given on schedule' },
        { key: 'hydration', label: 'Hydration check' },
        { key: 'activity', label: 'Cognitive activity completed' },
        { key: 'mood', label: 'Mood & behavior noted' },
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

    /*
     * FRONTEND-ONLY ONLINE STATUS
     *
     * Stores:
     * {
     *   patientId: true/false
     * }
     *
     * true  = patient dashboard is currently connected
     * false = patient dashboard is not connected
     */
    const [patientOnlineStatus, setPatientOnlineStatus] = useState({});

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

    /*
     * SUPABASE REALTIME PRESENCE
     *
     * Every patient gets their own presence channel.
     *
     * Example:
     * neuroplay-patient-presence-123
     *
     * If a patient is logged in, their PatientDashboard tracks
     * presence on that channel.
     *
     * The caregiver listens to the same channel.
     *
     * No database column is required.
     */
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

            /*
             * Initially assume everyone is offline.
             * Realtime Presence will immediately correct this
             * for patients who are currently logged in.
             */
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
        window.location.href = '/';
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

        if (key === 'patients' || key === 'settings' || key === 'reports' || key === 'resources') {
            setView(key);
            return;
        }
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="loading-spinner" />
                <p>Loading your dashboard…</p>
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

    const filteredPatients = patients.filter((p) =>
        (p.full_name || '')
            .toLowerCase()
            .includes(searchTerm.trim().toLowerCase())
    );

    /*
     * Shared sidebar
     */
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
                        className={`sidebar-link ${
                            link.key === activeKey
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

                        {link.label}
                    </button>
                ))}
            </nav>

            <div className="sidebar-help-card">
                <span className="sidebar-help-icon">
                    💬
                </span>

                <p>
                    Need a hand with the dashboard?
                </p>

                <button
                    onClick={() =>
                        alert(
                            'Support chat is coming soon. For now, use the Emergency Help Line on the main site.'
                        )
                    }
                >
                    Contact Support
                </button>
            </div>
        </aside>
    );

    /*
     * Shared page header (used by Reports & Resources too)
     */
    const renderPageHeader = (title, subtitle) => (
        <header className="dashboard-header">
            <div className="header-title">
                {subtitle && <p className="header-subtitle">{subtitle}</p>}
                <h1>{title}</h1>
            </div>

            <div className="header-actions">
                <button
                    className="header-icon-btn"
                    aria-label="Notifications"
                    onClick={() =>
                        alert('You have no new notifications.')
                    }
                >
                    🔔
                </button>

                <button
                    className="header-avatar-btn"
                    onClick={() => setShowProfileModal(true)}
                >
                    <span className="header-avatar-circle">
                        {caregiverInitial}
                    </span>
                    Profile
                </button>

                <button className="header-logout-btn" onClick={handleLogout}>
                    Logout
                </button>
            </div>
        </header>
    );

    /*
     * Profile modal
     */
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
                            ({ key, label }) => {
                                const value = meta[key];

                                if (!value) return null;

                                return (
                                    <div
                                        className="profile-detail-row"
                                        key={key}
                                    >
                                        <span className="profile-detail-label">
                                            {label}
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
                            No additional profile details are on
                            file for this account.
                        </p>
                    )}
                </div>
            </div>
        );
    };

    /*
     * PATIENTS VIEW
     */
    if (view === 'patients') {
        return (
            <div className="dashboard-shell">
                {renderSidebar('patients')}

                <div className="dashboard-main">
                    <header className="dashboard-header">
                        <div className="header-title">
                            <h1>My Patients</h1>
                        </div>

                        <div className="header-actions">
                            <button
                                className="header-icon-btn"
                                aria-label="Notifications"
                                onClick={() =>
                                    alert(
                                        'You have no new notifications.'
                                    )
                                }
                            >
                                🔔
                            </button>

                            <button
                                className="header-avatar-btn"
                                onClick={() =>
                                    setShowProfileModal(true)
                                }
                            >
                                <span className="header-avatar-circle">
                                    {caregiverInitial}
                                </span>

                                Profile
                            </button>

                            <button
                                className="header-logout-btn"
                                onClick={handleLogout}
                            >
                                Logout
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
                                    placeholder="Search patients by name..."
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
                                    All
                                </button>

                                <button
                                    className="filter-pill"
                                    onClick={() =>
                                        alert(
                                            'Custom filters are coming soon.'
                                        )
                                    }
                                >
                                    Needs Attention
                                </button>
                            </div>
                        </div>
                    </div>

                    {patients.length === 0 ? (
                        <div className="empty-state">
                            <p>
                                You haven't added any patients
                                yet.
                            </p>

                            <button
                                className="nav-btn"
                                onClick={() =>
                                    setView('addPatient')
                                }
                            >
                                + Add Your First Patient
                            </button>
                        </div>
                    ) : filteredPatients.length === 0 ? (
                        <div className="empty-state">
                            <p>
                                No patients match "{searchTerm}".
                            </p>

                            <button
                                className="nav-btn"
                                onClick={() =>
                                    setSearchTerm('')
                                }
                            >
                                Clear search
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
                                            {/* ONLINE / OFFLINE STATUS */}
                                            <span
                                                className={`patient-status-pill ${
                                                    isOnline
                                                        ? 'patient-status-online'
                                                        : 'patient-status-offline'
                                                }`}
                                            >
                                                <span className="status-dot">
                                                    ●
                                                </span>

                                                {isOnline
                                                    ? 'Online'
                                                    : 'Offline'}
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
                                                            Added{' '}
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
                                                        Patient ID:
                                                    </span>

                                                    <span className="credential-value">
                                                        {
                                                            patient.patient_id
                                                        }
                                                    </span>
                                                </div>

                                                <div className="credential-row">
                                                    <span className="credential-label">
                                                        Login Code:
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
                                                                'Expired/None'}
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
                                                                'No active code to copy. Please regenerate one.'
                                                            );
                                                        }
                                                    }}
                                                >
                                                    📋 Copy Code
                                                </button>

                                                <button
                                                    className="btn-outline"
                                                    onClick={() => {
                                                        setReportsPatientId(patient.id);
                                                        setView('reports');
                                                    }}
                                                >
                                                    👁️ View Patient
                                                </button>

                                                <button
                                                    className="btn-outline btn-warning"
                                                    onClick={() =>
                                                        handleRegenerateCode(
                                                            patient.id
                                                        )
                                                    }
                                                >
                                                    🔄 Regenerate Code
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
                                                    🗑️ Remove Patient
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }
                            )}
                        </div>
                    )}

                    <footer className="dashboard-footer">
                        NeuroPlay · Built for families across the
                        North Eastern Region
                    </footer>
                </div>

                {renderProfileModal()}
            </div>
        );
    }

    /*
     * REPORTS VIEW
     */
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
                    {renderPageHeader('Reports', 'Cognitive game performance')}

                    <div className="sample-data-note">
                        Sample data shown below — live game reporting is coming soon. Once game sessions are recorded, this page will reflect real activity automatically.
                    </div>

                    {patients.length === 0 ? (
                        <div className="empty-state">
                            <p>Add a patient to start seeing their game reports here.</p>
                            <button className="nav-btn" onClick={() => setView('addPatient')}>
                                + Add Your First Patient
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="stats-grid reports-stats-grid">
                                <div className="stat-card">
                                    <span className="stat-card-icon stat-icon-blue">🗓️</span>
                                    <h3>Sessions this week</h3>
                                    <p className="stat-value">{totalSessionsThisWeek}</p>
                                </div>
                                <div className="stat-card">
                                    <span className="stat-card-icon stat-icon-navy">🎯</span>
                                    <h3>Average accuracy</h3>
                                    <p className="stat-value">{avgAccuracy}%</p>
                                </div>
                                <div className="stat-card">
                                    <span className="stat-card-icon stat-icon-amber">🏆</span>
                                    <h3>Most played game</h3>
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
                                                <h3>{meta.label}</h3>
                                            </div>
                                            <div className="report-game-metrics">
                                                <div>
                                                    <span className="report-metric-value">{stat.count}</span>
                                                    <span className="report-metric-label">Sessions</span>
                                                </div>
                                                <div>
                                                    <span className="report-metric-value">{stat.bestScore}</span>
                                                    <span className="report-metric-label">Best score</span>
                                                </div>
                                                <div>
                                                    <span className="report-metric-value">{avg}%</span>
                                                    <span className="report-metric-label">Avg accuracy</span>
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
                                <h3 className="section-title">Recent activity</h3>
                                <table className="report-history-table">
                                    <thead>
                                        <tr>
                                            <th>Game</th>
                                            <th>Score</th>
                                            <th>Accuracy</th>
                                            <th>Duration</th>
                                            <th>Played</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentSessions.map((s) => (
                                            <tr key={s.id}>
                                                <td>
                                                    <span className="report-history-game">
                                                        {GAME_META[s.game].icon} {GAME_META[s.game].label}
                                                    </span>
                                                </td>
                                                <td>{s.score}</td>
                                                <td>{s.accuracy}%</td>
                                                <td>{Math.round(s.duration_seconds / 60)} min</td>
                                                <td>{formatSessionDate(s.played_at)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    <footer className="dashboard-footer">
                        NeuroPlay · Built for families across the North Eastern Region
                    </footer>
                </div>

                {renderProfileModal()}
            </div>
        );
    }

    /*
     * RESOURCES VIEW
     */
    if (view === 'resources') {
        // Cards only available once logged in — personalized or product-specific,
        // so they can't just live on the public marketing site.
        const toolCards = [
            {
                key: 'breathing',
                icon: '🧘',
                title: 'Quick Calm',
                desc: 'A guided box-breathing timer you can run right now, between patient check-ins.',
            },
            {
                key: 'emergencyCard',
                icon: '🪪',
                title: 'Emergency Contact Card',
                desc: 'A printable card with your patient\'s ID and emergency contact, filled in from your account.',
            },
            {
                key: 'reportsGuide',
                icon: '📈',
                title: 'Understanding Your Reports',
                desc: 'What score, accuracy, and session counts on the Reports tab actually mean.',
            },
            {
                key: 'faq',
                icon: '❓',
                title: 'NeuroPlay Help & FAQ',
                desc: 'How login codes work, adding a patient, and what online/offline status means.',
            },
            {
                key: 'glossary',
                icon: '🧠',
                title: 'Dementia Glossary',
                desc: 'Plain-language definitions for terms you\'ll see in care notes and reports.',
            },
        ];

        const referenceCards = [
            {
                key: 'directory',
                icon: '🩺',
                title: 'NER Medical Directory',
                desc: 'Emergency neurological helplines and memory clinics across the 8 North Eastern states.',
            },
            {
                key: 'manual',
                icon: '📘',
                title: 'Caregiver Manual & Stress Relief',
                desc: 'Monitoring guides and anxiety de-escalation steps for hard moments.',
            },
            {
                key: 'tips',
                icon: '📚',
                title: 'Dementia Care Tips',
                desc: 'Practical guidance on nutrition, sleep, home safety, and everyday communication.',
            },
            {
                key: 'support',
                icon: '🤝',
                title: 'Support Groups & Community',
                desc: 'Local caregiver networks, national organizations, and 24/7 mental health support.',
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
                                <h2>🧘 Quick Calm</h2>
                                <p className="resource-modal-lead">A short breathing pause, whenever you need it — inhale, hold, exhale, hold, each for 4 seconds.</p>
                                <div className="breathing-tool">
                                    <div className={`breathing-tool-circle ${breathingActive ? `phase-${breathingPhase}` : ''}`}>
                                        <span className="breathing-tool-label">{breathingActive ? BREATHING_LABELS[breathingPhase] : 'Ready'}</span>
                                        <span className="breathing-tool-timer">{breathingActive ? breathingTimer : '4s'}</span>
                                    </div>
                                    <button type="button" className="btn-primary" onClick={toggleBreathing}>
                                        {breathingActive ? 'Stop' : 'Start breathing'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeResourceModal === 'emergencyCard' && (
                            <div>
                                <h2>🪪 Emergency Contact Card</h2>
                                {patients.length === 0 ? (
                                    <p>Add a patient first to generate their emergency card.</p>
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
                                                <span role="img" aria-label="brain">🧠</span> NeuroPlay Emergency Card
                                            </div>
                                            <div className="emergency-card-row">
                                                <span>Patient</span>
                                                <strong>{emergencyPatient?.full_name || '—'}</strong>
                                            </div>
                                            <div className="emergency-card-row">
                                                <span>Patient ID</span>
                                                <strong>{emergencyPatient?.patient_id || '—'}</strong>
                                            </div>
                                            <div className="emergency-card-row">
                                                <span>Emergency contact</span>
                                                <strong>{meta.emergency_name || '—'}</strong>
                                            </div>
                                            <div className="emergency-card-row">
                                                <span>Emergency phone</span>
                                                <strong>{meta.emergency_phone || '—'}</strong>
                                            </div>
                                            <div className="emergency-card-row">
                                                <span>Caregiver</span>
                                                <strong>{caregiverName}</strong>
                                            </div>
                                            <div className="emergency-card-row">
                                                <span>Caregiver phone</span>
                                                <strong>{meta.phone_number || '—'}</strong>
                                            </div>
                                            <div className="emergency-card-footer">
                                                National Emergency Response Service: 112 · Tele-MANAS: 14416
                                            </div>
                                        </div>

                                        <button type="button" className="btn-primary" onClick={() => window.print()}>
                                            🖨️ Print card
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {activeResourceModal === 'reportsGuide' && (
                            <div>
                                <h2>📈 Understanding Your Reports</h2>
                                <div className="resource-modal-block">
                                    <h4>Sessions</h4>
                                    <p>How many times a patient has played a given game. More sessions generally mean more consistent engagement.</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>Score</h4>
                                    <p>A game-specific point total. Compare a patient's own scores over time rather than against other patients — the goal is their personal trend.</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>Accuracy</h4>
                                    <p>The share of correct responses in a session. A gradual dip across several sessions is worth mentioning at their next check-up; a single low session usually isn't.</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>What to watch for</h4>
                                    <p>Sudden drops, not gradual ones, matter most — they're more likely to reflect an off day (poor sleep, discomfort) than a real change.</p>
                                </div>
                            </div>
                        )}

                        {activeResourceModal === 'faq' && (
                            <div>
                                <h2>❓ NeuroPlay Help & FAQ</h2>
                                <div className="resource-modal-block">
                                    <h4>What is a login code?</h4>
                                    <p>A short code your patient enters on their device to open their own dashboard. Each code expires after a set time for security.</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>What if a code expires?</h4>
                                    <p>Use "Regenerate Code" on the patient's card in the Patients tab. This invalidates the old code immediately.</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>What does Online/Offline mean?</h4>
                                    <p>Online means that patient's dashboard is currently open on their device. It updates in real time as they log in or out.</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>How do I add a patient?</h4>
                                    <p>Select "Add Patient" from the dashboard overview. You'll get a Patient ID and login code to share with them.</p>
                                </div>
                            </div>
                        )}

                        {activeResourceModal === 'glossary' && (
                            <div>
                                <h2>🧠 Dementia Glossary</h2>
                                <div className="resource-modal-block">
                                    <h4>Sundowning</h4>
                                    <p>Increased confusion or agitation in the late afternoon and evening.</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>Cognitive decline</h4>
                                    <p>A gradual reduction in memory, reasoning, or thinking skills over time.</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>Caregiver burnout</h4>
                                    <p>Physical and emotional exhaustion from sustained caregiving, often with reduced patience or motivation.</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>Reminiscence therapy</h4>
                                    <p>Using familiar memories, photos, or music to support engagement and mood.</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>Validation approach</h4>
                                    <p>Responding to the emotion behind what someone says, rather than correcting the facts.</p>
                                </div>
                            </div>
                        )}

                        {activeResourceModal === 'directory' && (
                            <div>
                                <h2>🩺 NER Neurological Care Directory</h2>
                                <div className="resource-modal-block">
                                    <h4>Assam</h4>
                                    <p>Gauhati Medical College & Hospital, Guwahati — Neurology & Memory Clinic. Assam Medical College, Dibrugarh. Silchar Medical College & Hospital, Silchar.</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>Meghalaya</h4>
                                    <p>NEIGRIHMS, Shillong — Emergency: +91 364 2530000. Civil Hospital Shillong.</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>Manipur</h4>
                                    <p>RIMS, Imphal — Neurology dept & telemedicine hub. JNIMS, Imphal.</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>Tripura, Mizoram, Nagaland, Arunachal Pradesh & Sikkim</h4>
                                    <p>Agartala Government Medical College. Zoram Medical College, Aizawl. Kohima Naga Hospital Authority. TRIHMS, Naharlagun. STNM Hospital, Gangtok.</p>
                                </div>
                                <div className="resource-modal-block resource-modal-emergency">
                                    <h4>Emergency helplines</h4>
                                    <p>Tele-MANAS Mental Health Support: 14416 (free, 24/7). National Emergency Response Service: 112.</p>
                                </div>
                            </div>
                        )}

                        {activeResourceModal === 'manual' && (
                            <div>
                                <h2>📘 Caregiver Manual & Stress Relief</h2>
                                <div className="resource-modal-block">
                                    <h4>Daily routine</h4>
                                    <p>Keep mealtimes and activities consistent. Mornings tend to bring the most cognitive clarity — a good window for memory exercises and light movement.</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>Managing sundowning & agitation</h4>
                                    <p>Reduce noise and bright light in the late afternoon. Validate emotions rather than correcting facts, and redirect toward calm, familiar activities.</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>A quick breathing reset</h4>
                                    <p>Box breathing: inhale for 4 seconds, hold for 4, exhale for 4, hold for 4. Repeat for two to five minutes whenever things feel like too much.</p>
                                </div>
                            </div>
                        )}

                        {activeResourceModal === 'tips' && (
                            <div>
                                <h2>📚 Dementia Care Tips</h2>
                                <div className="resource-modal-block">
                                    <h4>Nutrition</h4>
                                    <p>Small, frequent meals with familiar foods. Keep water visible, since thirst cues are often forgotten.</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>Sleep</h4>
                                    <p>A consistent bedtime routine and dim evening lighting help. Calm music can ease dusk confusion.</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>Home safety</h4>
                                    <p>Remove loose rugs, add grab bars near the bathroom, and keep medicines and sharp objects out of reach.</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>Communication</h4>
                                    <p>Short, simple sentences. Give time to respond, and focus on the feeling behind the words rather than correcting every detail.</p>
                                </div>
                            </div>
                        )}

                        {activeResourceModal === 'support' && (
                            <div>
                                <h2>🤝 Support Groups & Community</h2>
                                <div className="resource-modal-block">
                                    <h4>Local groups</h4>
                                    <p>Many district hospitals and NGOs run caregiver meet-ups — ask your nearest medical center from the directory above.</p>
                                </div>
                                <div className="resource-modal-block">
                                    <h4>National organizations</h4>
                                    <p>ARDSI (Alzheimer's and Related Disorders Society of India) runs chapters and helplines with counseling and training resources.</p>
                                </div>
                                <div className="resource-modal-block resource-modal-emergency">
                                    <h4>Caregiver mental health</h4>
                                    <p>Burnout is common and real. Tele-MANAS (14416) offers free, confidential support for caregivers too, 24/7.</p>
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
                    {renderPageHeader('Resources', 'Tools for you, and reference material for everyone')}

                    <h3 className="section-title resources-section-heading">Tools for you</h3>
                    <div className="resources-dashboard-grid">
                        {toolCards.map((card) => (
                            <div key={card.key} className="resource-dash-card">
                                <span className="resource-dash-icon">{card.icon}</span>
                                <h3>{card.title}</h3>
                                <p>{card.desc}</p>
                                <button
                                    className="btn-outline"
                                    onClick={() => setActiveResourceModal(card.key)}
                                >
                                    Open
                                </button>
                            </div>
                        ))}

                        <div className="resource-dash-card checklist-card">
                            <span className="resource-dash-icon">✅</span>
                            <h3>Today's Care Checklist</h3>
                            <p>Resets automatically each day. Just for your own tracking — nothing is shared.</p>
                            <div className="checklist-items">
                                {CHECKLIST_ITEMS.map((item) => (
                                    <label key={item.key} className="checklist-row">
                                        <input
                                            type="checkbox"
                                            checked={!!checklistState[item.key]}
                                            onChange={() => toggleChecklistItem(item.key)}
                                        />
                                        <span className={checklistState[item.key] ? 'checklist-done' : ''}>
                                            {item.label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <h3 className="section-title resources-section-heading">General reference</h3>
                    <div className="resources-dashboard-grid">
                        {referenceCards.map((card) => (
                            <div key={card.key} className="resource-dash-card">
                                <span className="resource-dash-icon">{card.icon}</span>
                                <h3>{card.title}</h3>
                                <p>{card.desc}</p>
                                <button
                                    className="btn-outline"
                                    onClick={() => setActiveResourceModal(card.key)}
                                >
                                    Open
                                </button>
                            </div>
                        ))}
                    </div>

                    <footer className="dashboard-footer">
                        NeuroPlay · Built for families across the North Eastern Region
                    </footer>
                </div>

                {renderResourceModal()}
                {renderProfileModal()}
            </div>
        );
    }

    /*
     * SETTINGS VIEW
     */
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

    /*
     * MAIN DASHBOARD
     */
    return (
        <div className="dashboard-shell">
            {renderSidebar('dashboard')}

            <div className="dashboard-main">
                <header className="dashboard-header">
                    <div className="header-title">
                        <p className="header-subtitle">
                            {getGreeting()}, {caregiverName} 👋
                        </p>

                        <h1>Dashboard Overview</h1>
                    </div>

                    <div className="header-actions">
                        <button
                            className="header-icon-btn"
                            aria-label="Notifications"
                            onClick={() =>
                                alert(
                                    'You have no new notifications.'
                                )
                            }
                        >
                            🔔
                        </button>

                        <button
                            className="header-avatar-btn"
                            onClick={() =>
                                setShowProfileModal(true)
                            }
                        >
                            <span className="header-avatar-circle">
                                {caregiverInitial}
                            </span>

                            Profile
                        </button>

                        <button
                            className="header-logout-btn"
                            onClick={handleLogout}
                        >
                            Logout
                        </button>
                    </div>
                </header>

                <div className="page-status-strip">
                    <span className="sync-chip">
                        <span className="sync-dot" />
                        All data synced
                    </span>

                    <span className="page-status-date">
                        {todayLabel}
                    </span>
                </div>

                <div className="stats-grid">
                    <div
                        className="stat-card primary-action"
                        onClick={() =>
                            setView('addPatient')
                        }
                    >
                        <span className="stat-card-icon">
                            ➕
                        </span>

                        <h2>Add Patient</h2>

                        <p
                            style={{
                                margin: '0.5rem 0 0',
                                opacity: 0.9
                            }}
                        >
                            Register a patient & generate
                            credentials
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

                        <h3>My Patients</h3>

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

                        <h3>Patient Progress</h3>

                        <p className="stat-placeholder">
                            Cognitive performance trends
                        </p>
                    </div>

                    <div className="stat-card">
                        <span className="badge-beta">
                            Coming soon
                        </span>

                        <span className="stat-card-icon stat-icon-amber">
                            🔔
                        </span>

                        <h3>Alerts</h3>

                        <p className="stat-placeholder">
                            Medicine & activity reminders
                        </p>
                    </div>
                </div>

                <footer className="dashboard-footer">
                    NeuroPlay · Built for families across the
                    North Eastern Region
                </footer>
            </div>

            {renderProfileModal()}
        </div>
    );
}