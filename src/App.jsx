import React, { useState, useEffect } from 'react';
import './App.css';
import CaregiverAuth from './CaregiverAuth';
import CaregiverDashboard from './CaregiverDashboard';
import PatientLogin from './PatientLogin';
import PatientDashboard from './PatientDashboard';
import { supabase } from './SupabaseClient';

// ============================================================
// BREATHING CONSTANTS
// ============================================================

const breathingPhases = [
    'inhale',
    'hold1',
    'exhale',
    'hold2'
];

const breathingPhaseLabels = {
    inhale: 'Inhale',
    hold1: 'Hold',
    exhale: 'Exhale',
    hold2: 'Hold'
};

function App() {
    const [currentScreen, setCurrentScreen] = useState('home');
    const [activeModal, setActiveModal] = useState(null);

    // ============================================================
    // PASSWORD RECOVERY STATE
    // ============================================================

    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

    // ============================================================
    // CAREGIVER MANUAL STATE
    // ============================================================

    const [activeManualTab, setActiveManualTab] = useState('guide');

    // ============================================================
    // BREATHING EXERCISE STATE
    // ============================================================

    const [breathingPhaseIndex, setBreathingPhaseIndex] = useState(0);

    const [breathingTimer, setBreathingTimer] = useState(4);

    const [isBreathingActive, setIsBreathingActive] = useState(false);

    // Total seconds elapsed during the current breathing session
    const [breathingElapsed, setBreathingElapsed] = useState(0);

    // Used when the caregiver clicks a phase to preview it
    const [isPreviewingPhase, setIsPreviewingPhase] = useState(false);

    // Session length in minutes
    const [sessionLength, setSessionLength] = useState(2);

    // Remaining session time
    const [sessionSecondsLeft, setSessionSecondsLeft] = useState(2 * 60);

    const breathingPhase =
        breathingPhases[breathingPhaseIndex];

    const breathingPhaseLabel =
        breathingPhaseLabels[breathingPhase];

    // Show a breathing phase if the exercise is running
    // OR the user is previewing a phase
    const isShowingPhase =
        isBreathingActive || isPreviewingPhase;

    // ============================================================
    // BREATHING CIRCLE STYLES
    // ============================================================

    const breathingCircleStyles = {
        inhale: {
            transform: 'scale(1.15)',
            backgroundColor: '#ebf8ff',
            borderColor: '#2F70B5',
            borderStyle: 'solid',
            boxShadow:
                '0 0 20px rgba(47, 112, 181, 0.3)'
        },

        hold1: {
            transform: 'scale(1.15)',
            backgroundColor: '#e6fffa',
            borderColor: '#2F8B61',
            borderStyle: 'dashed',
            boxShadow:
                '0 0 30px rgba(47, 139, 97, 0.55)'
        },

        exhale: {
            transform: 'scale(0.95)',
            backgroundColor: '#f0f4f8',
            borderColor: '#718096',
            borderStyle: 'solid',
            boxShadow: 'none'
        },

        hold2: {
            transform: 'scale(0.95)',
            backgroundColor: '#e6fffa',
            borderColor: '#2F8B61',
            borderStyle: 'dashed',
            boxShadow:
                '0 0 30px rgba(47, 139, 97, 0.55)'
        }
    };

    // ============================================================
    // PASSWORD RECOVERY DETECTION
    // ============================================================

    useEffect(() => {
        let mounted = true;

        const checkPasswordRecovery = async () => {
            const hash = window.location.hash;

            if (
                hash.includes('access_token=') &&
                hash.includes('type=recovery')
            ) {
                if (mounted) {
                    setIsPasswordRecovery(true);
                    setCurrentScreen('caregiverAuth');
                }
            }

            const {
                data: { session }
            } = await supabase.auth.getSession();

            if (!mounted) return;

            if (
                session &&
                hash.includes('type=recovery')
            ) {
                setIsPasswordRecovery(true);
                setCurrentScreen('caregiverAuth');
            }
        };

        checkPasswordRecovery();

        const {
            data: { subscription }
        } = supabase.auth.onAuthStateChange((event) => {
            if (!mounted) return;

            if (event === 'PASSWORD_RECOVERY') {
                setIsPasswordRecovery(true);
                setCurrentScreen('caregiverAuth');
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // ============================================================
    // BREATHING TIMER
    //
    // 0 - 3 seconds   = Inhale
    // 4 - 7 seconds   = Hold
    // 8 - 11 seconds  = Exhale
    // 12 - 15 seconds = Hold
    //
    // Then the cycle repeats.
    // ============================================================

    useEffect(() => {
        if (!isBreathingActive) {
            return;
        }

        const interval = setInterval(() => {
            setBreathingElapsed((previousElapsed) => {
                return previousElapsed + 1;
            });
        }, 1000);

        return () => {
            clearInterval(interval);
        };
    }, [isBreathingActive]);

    // ============================================================
    // UPDATE BREATHING PHASE FROM ELAPSED TIME
    // ============================================================

    useEffect(() => {
        if (!isBreathingActive) {
            return;
        }

        const totalSessionSeconds =
            sessionLength * 60;

        // --------------------------------------------------------
        // SESSION FINISHED
        // --------------------------------------------------------

        if (
            breathingElapsed >=
            totalSessionSeconds
        ) {
            setIsBreathingActive(false);

            setBreathingElapsed(0);

            setBreathingPhaseIndex(0);

            setBreathingTimer(4);

            setSessionSecondsLeft(
                totalSessionSeconds
            );

            return;
        }

        // --------------------------------------------------------
        // DETERMINE CURRENT PHASE
        // --------------------------------------------------------

        const phaseIndex =
            Math.floor(
                breathingElapsed / 4
            ) % breathingPhases.length;

        // --------------------------------------------------------
        // DETERMINE COUNTDOWN
        // --------------------------------------------------------

        const positionInsidePhase =
            breathingElapsed % 4;

        const timer =
            4 - positionInsidePhase;

        setBreathingPhaseIndex(
            phaseIndex
        );

        setBreathingTimer(timer);

        // --------------------------------------------------------
        // UPDATE SESSION COUNTDOWN
        // --------------------------------------------------------

        setSessionSecondsLeft(
            totalSessionSeconds -
                breathingElapsed
        );
    }, [
        breathingElapsed,
        isBreathingActive,
        sessionLength
    ]);

    // ============================================================
    // START / STOP BREATHING
    // ============================================================

    const toggleBreathing = () => {
        if (isBreathingActive) {
            // ----------------------------------------------------
            // STOP EXERCISE
            // ----------------------------------------------------

            setIsBreathingActive(false);

            setBreathingElapsed(0);

            setBreathingPhaseIndex(0);

            setBreathingTimer(4);

            setSessionSecondsLeft(
                sessionLength * 60
            );
        } else {
            // ----------------------------------------------------
            // START EXERCISE FROM BEGINNING
            // ----------------------------------------------------

            setIsPreviewingPhase(false);

            setBreathingElapsed(0);

            setBreathingPhaseIndex(0);

            setBreathingTimer(4);

            setSessionSecondsLeft(
                sessionLength * 60
            );

            setIsBreathingActive(true);
        }
    };

    // ============================================================
    // SESSION LENGTH
    // ============================================================

    const selectSessionLength = (minutes) => {
        if (isBreathingActive) {
            return;
        }

        setSessionLength(minutes);

        setSessionSecondsLeft(
            minutes * 60
        );

        setBreathingElapsed(0);

        setBreathingPhaseIndex(0);

        setBreathingTimer(4);
    };

    // ============================================================
    // PREVIEW A BREATHING PHASE
    // ============================================================

    const jumpToPhase = (idx) => {
        if (isBreathingActive) {
            return;
        }

        setIsPreviewingPhase(true);

        setBreathingPhaseIndex(idx);

        setBreathingTimer(4);
    };

    // ============================================================
    // FORMAT SESSION TIME
    // ============================================================

    const formatTime = (totalSeconds) => {
        const m = Math.floor(
            totalSeconds / 60
        );

        const s =
            totalSeconds % 60;

        return `${m}:${s
            .toString()
            .padStart(2, '0')}`;
    };

    // ============================================================
    // BREATHING EXERCISE
    // ============================================================

    const renderBreathingExercise = () => (
        <div className="tab-content breathing-section">

            <h3>
                Caregiver Box Breathing Exercise
            </h3>

            <p>
                Follow the 4-4-4-4 pattern — inhale,
                hold, exhale, hold — to reset your
                stress levels during challenging moments.
            </p>

            {/* ----------------------------------------------------
                SESSION LENGTH
            ---------------------------------------------------- */}

            <div className="session-length-selector">

                <button
                    className={`session-btn ${
                        sessionLength === 2
                            ? 'active-session'
                            : ''
                    }`}
                    onClick={() =>
                        selectSessionLength(2)
                    }
                    disabled={isBreathingActive}
                >
                    2 min
                </button>

                <button
                    className={`session-btn ${
                        sessionLength === 5
                            ? 'active-session'
                            : ''
                    }`}
                    onClick={() =>
                        selectSessionLength(5)
                    }
                    disabled={isBreathingActive}
                >
                    5 min
                </button>

            </div>

            {/* ----------------------------------------------------
                PHASE STEPS
            ---------------------------------------------------- */}

            <div className="phase-steps">

                {breathingPhases.map(
                    (phase, index) => (
                        <button
                            key={phase}
                            type="button"
                            className={`phase-step ${
                                isShowingPhase &&
                                breathingPhaseIndex ===
                                    index
                                    ? 'active-step'
                                    : ''
                            }`}
                            onClick={() =>
                                jumpToPhase(index)
                            }
                            aria-pressed={
                                isShowingPhase &&
                                breathingPhaseIndex ===
                                    index
                            }
                        >

                            <span className="phase-step-num">
                                {index + 1}
                            </span>

                            <span className="phase-step-label">
                                {
                                    breathingPhaseLabels[
                                        phase
                                    ]
                                }
                            </span>

                        </button>
                    )
                )}

            </div>

            {/* ----------------------------------------------------
                BREATHING CIRCLE
            ---------------------------------------------------- */}

            <div className="breathing-circle-container">

                <div
                    className={`breathing-circle ${
                        isShowingPhase
                            ? breathingPhase
                            : ''
                    }`}
                    style={
                        isShowingPhase
                            ? breathingCircleStyles[
                                  breathingPhase
                              ]
                            : undefined
                    }
                >

                    <span className="phase-text">
                        {isShowingPhase
                            ? breathingPhaseLabel
                            : 'Ready'}
                    </span>

                    <span className="timer-text">
                        {isShowingPhase
                            ? `${breathingTimer}s`
                            : '4s'}
                    </span>

                </div>

            </div>

            {/* ----------------------------------------------------
                HOLD MESSAGE
            ---------------------------------------------------- */}

            {isShowingPhase &&
                (
                    breathingPhase ===
                        'hold1' ||
                    breathingPhase ===
                        'hold2'
                ) && (
                    <p className="hold-cue">
                        ⏸ HOLD YOUR BREATH ⏸
                    </p>
                )}

            {/* ----------------------------------------------------
                SESSION TIME
            ---------------------------------------------------- */}

            {isBreathingActive && (
                <p className="session-remaining">
                    ⏱ Session time left:{' '}
                    {formatTime(
                        sessionSecondsLeft
                    )}
                </p>
            )}

            {/* ----------------------------------------------------
                START / STOP BUTTON
            ---------------------------------------------------- */}

            <button
                className="breathing-toggle-btn"
                onClick={toggleBreathing}
            >
                {isBreathingActive
                    ? '⏹️ Stop Exercise'
                    : '▶️ Start Breathing Exercise'}
            </button>

            {/* ----------------------------------------------------
                PREVIEW MESSAGE
            ---------------------------------------------------- */}

            {isPreviewingPhase &&
                !isBreathingActive && (
                    <p className="preview-hint">
                        Previewing the "
                        {breathingPhaseLabel}"
                        phase. Press Start to run
                        the real timer.
                    </p>
                )}

        </div>
    );

    // ============================================================
    // CAREGIVER DASHBOARD
    // ============================================================

    if (
        currentScreen ===
        'caregiverDashboard'
    ) {
        return <CaregiverDashboard />;
    }

    // ============================================================
    // PATIENT DASHBOARD
    // ============================================================

    if (
        currentScreen ===
        'patientDashboard'
    ) {
        return (
            <PatientDashboard
                onLogout={() =>
                    setCurrentScreen('home')
                }
            />
        );
    }

    // ============================================================
    // CAREGIVER AUTH
    // ============================================================

    if (
        currentScreen ===
        'caregiverAuth'
    ) {
        return (
            <div className="auth-page-container">

                <CaregiverAuth
                    onBackToHome={() => {
                        setIsPasswordRecovery(false);
                        setCurrentScreen('home');
                    }}
                    onLoginSuccess={() => {
                        setIsPasswordRecovery(false);
                        setCurrentScreen(
                            'caregiverDashboard'
                        );
                    }}
                    startInResetPassword={
                        isPasswordRecovery
                    }
                />

            </div>
        );
    }

    // ============================================================
    // PATIENT AUTH
    // ============================================================

    if (
        currentScreen ===
        'patientAuth'
    ) {
        return (
            <PatientLogin
                onBackToHome={() =>
                    setCurrentScreen('home')
                }
                onLoginSuccess={() =>
                    setCurrentScreen(
                        'patientDashboard'
                    )
                }
            />
        );
    }

    // ============================================================
    // MAIN WEBSITE
    // ============================================================

    return (
        <div className="app-container">

            {/* ====================================================
                NAVIGATION
            ==================================================== */}

            <header className="navbar">

                <div className="nav-links">

                    <a
                        href="#home"
                        className={
                            currentScreen ===
                            'home'
                                ? 'active-link'
                                : ''
                        }
                        onClick={(e) => {
                            e.preventDefault();
                            setCurrentScreen(
                                'home'
                            );
                        }}
                    >
                        Home
                    </a>

                    <a
                        href="#how-it-works"
                        className={
                            currentScreen ===
                            'how-it-works'
                                ? 'active-link'
                                : ''
                        }
                        onClick={(e) => {
                            e.preventDefault();
                            setCurrentScreen(
                                'how-it-works'
                            );
                        }}
                    >
                        How It Works
                    </a>

                    <a
                        href="#about"
                        className={
                            currentScreen ===
                            'about'
                                ? 'active-link'
                                : ''
                        }
                        onClick={(e) => {
                            e.preventDefault();
                            setCurrentScreen(
                                'about'
                            );
                        }}
                    >
                        About Us
                    </a>

                    <a
                        href="#resources"
                        className={
                            currentScreen ===
                            'resources'
                                ? 'active-link'
                                : ''
                        }
                        onClick={(e) => {
                            e.preventDefault();
                            setCurrentScreen(
                                'resources'
                            );
                        }}
                    >
                        Resources
                    </a>

                    <button
                        className="nav-btn"
                        onClick={() =>
                            setCurrentScreen(
                                'contact'
                            )
                        }
                    >
                        Contact Us
                    </button>

                </div>

            </header>

            {/* ====================================================
                HOME PAGE
            ==================================================== */}

            {currentScreen === 'home' && (
                <section className="hero-section">

                    <div className="brand-header">

                        <div className="logo-title">

                            <span
                                className="brain-icon"
                                role="img"
                                aria-label="brain"
                            >
                                🧠
                            </span>

                            <h1>
                                NeuroPlay
                            </h1>

                        </div>

                        <p className="tagline">
                            AI-Powered Cognitive Gaming
                            & Dementia Assistance for
                            NER
                        </p>

                    </div>

                    <div className="card-grid">

                        {/* PATIENT LOGIN */}

                        <div
                            className="login-card patient-card"
                            onClick={() =>
                                setCurrentScreen(
                                    'patientAuth'
                                )
                            }
                            style={{
                                cursor: 'pointer',
                                zIndex: 10
                            }}
                        >

                            <div
                                className="avatar"
                                role="img"
                                aria-label="patient"
                            >
                                👴
                            </div>

                            <h3>
                                PATIENT LOGIN
                            </h3>

                        </div>

                        {/* CAREGIVER LOGIN */}

                        <div
                            className="login-card caregiver-card"
                            onClick={() =>
                                setCurrentScreen(
                                    'caregiverAuth'
                                )
                            }
                            style={{
                                cursor: 'pointer',
                                zIndex: 10
                            }}
                        >

                            <div
                                className="avatar"
                                role="img"
                                aria-label="caregiver"
                            >
                                👩‍⚕️
                            </div>

                            <h3>
                                CAREGIVER LOGIN
                            </h3>

                        </div>

                    </div>

                </section>
            )}

            {/* ====================================================
                HOW IT WORKS
            ==================================================== */}

            {currentScreen ===
                'how-it-works' && (
                <main className="page-content how-it-works-page">

                    <div className="about-header">

                        <h1>
                            How NeuroPlay Works
                        </h1>

                        <p className="about-subtitle">
                            A seamless three-step
                            platform designed for
                            early cognitive tracking
                            and rural dementia care
                            in the North Eastern
                            Region.
                        </p>

                    </div>

                    <div className="steps-path">

                        <div className="step-item step-blue">

                            <div className="step-marker">
                                <span
                                    role="img"
                                    aria-label="game controller"
                                >
                                    🎮
                                </span>
                            </div>

                            <div className="step-body">

                                <span className="step-index">
                                    Step 1
                                </span>

                                <h2>
                                    Adaptive Cognitive
                                    Games
                                </h2>

                                <p>
                                    Patients engage in
                                    localized memory
                                    puzzles, visual
                                    pattern recognition,
                                    and daily routine
                                    recall games crafted
                                    to slow cognitive
                                    decline.
                                </p>

                            </div>

                        </div>

                        <div className="step-item step-green">

                            <div className="step-marker">
                                <span
                                    role="img"
                                    aria-label="speaking head"
                                >
                                    🗣️
                                </span>
                            </div>

                            <div className="step-body">

                                <span className="step-index">
                                    Step 2
                                </span>

                                <h2>
                                    Local Dialect Voice
                                    Prompts
                                </h2>

                                <p>
                                    Automated daily
                                    reminders for
                                    medication,
                                    hydration, and
                                    exercise are
                                    delivered in
                                    Assamese, Bodo,
                                    Khasi, Mizo, and
                                    Manipuri, using
                                    natural phonetic
                                    scripts and
                                    regional accents.
                                </p>

                            </div>

                        </div>

                        <div className="step-item step-navy">

                            <div className="step-marker">
                                <span
                                    role="img"
                                    aria-label="bar chart"
                                >
                                    📊
                                </span>
                            </div>

                            <div className="step-body">

                                <span className="step-index">
                                    Step 3
                                </span>

                                <h2>
                                    Real-Time Caregiver
                                    Sync
                                </h2>

                                <p>
                                    Caregivers monitor
                                    performance trends
                                    via secure
                                    dashboards,
                                    updated in real time
                                    as patients complete
                                    games and
                                    activities.
                                </p>

                            </div>

                        </div>

                    </div>

                    <div
                        style={{
                            textAlign: 'center',
                            marginTop: '40px'
                        }}
                    >
                        <button
                            className="back-btn"
                            onClick={() =>
                                setCurrentScreen(
                                    'home'
                                )
                            }
                        >
                            Back to Home
                        </button>
                    </div>

                </main>
            )}

            {/* ====================================================
                ABOUT US
            ==================================================== */}

            {currentScreen === 'about' && (
                <main className="page-content about-page">

                    <div className="about-header">

                        <h1>
                            About NeuroPlay
                        </h1>

                        <p className="about-subtitle">
                            Empowering families and
                            caregivers in the North
                            Eastern Region with
                            cognitive digital health
                            tools.
                        </p>

                        <span className="coverage-badge">
                            Built for all 8 North
                            Eastern States
                        </span>

                    </div>

                    <div className="about-mission-layout">

                        <div className="about-mission-statement">

                            <span
                                className="about-mission-icon"
                                role="img"
                                aria-label="target"
                            >
                                🎯
                            </span>

                            <h2>
                                Our Mission
                            </h2>

                            <p>
                                To bridge healthcare
                                barriers in remote NER
                                areas through AI-driven
                                cognitive gaming and
                                routine management —
                                built for families who
                                don't have a neurologist
                                down the road.
                            </p>

                        </div>

                        <div className="about-feature-list">

                            <div className="about-feature-row">

                                <span
                                    className="about-feature-icon"
                                    role="img"
                                    aria-label="handshake"
                                >
                                    🤝
                                </span>

                                <div>

                                    <h3>
                                        Caregiver Support
                                    </h3>

                                    <p>
                                        Equipping
                                        caregivers with
                                        real-time
                                        analytics
                                        dashboards,
                                        automated
                                        alerts, and
                                        offline data
                                        synchronization.
                                    </p>

                                </div>

                            </div>

                            <div className="about-feature-row">

                                <span
                                    className="about-feature-icon"
                                    role="img"
                                    aria-label="puzzle piece"
                                >
                                    🧩
                                </span>

                                <div>

                                    <h3>
                                        Cultural &
                                        Accessible First
                                    </h3>

                                    <p>
                                        Designed with
                                        regional themes
                                        and accessible
                                        tools for
                                        families across
                                        the North
                                        Eastern Region.
                                    </p>

                                </div>

                            </div>

                        </div>

                    </div>

                    <div
                        style={{
                            textAlign: 'center',
                            marginTop: '40px'
                        }}
                    >
                        <button
                            className="back-btn"
                            onClick={() =>
                                setCurrentScreen(
                                    'home'
                                )
                            }
                        >
                            Back to Home
                        </button>
                    </div>

                </main>
            )}

            {/* ====================================================
                RESOURCES
            ==================================================== */}

            {currentScreen === 'resources' && (
                <main className="page-content resources-page">

                    <div className="resources-header">

                        <h1>
                            Dementia Care & NER
                            Support Resources
                        </h1>

                        <p className="resources-subtitle">
                            Empowering rural and remote
                            families across the North
                            Eastern Region with cognitive
                            guides, audio tools, and
                            offline support packs.
                        </p>

                    </div>

                    <div className="resources-grid">

                        {/* DIRECTORY */}

                        <div className="resource-card">

                            <div className="resource-icon">
                                🩺
                            </div>

                            <h3>
                                NER Dementia &
                                Neurological Care
                                Directory
                            </h3>

                            <p>
                                Access emergency
                                neurological helplines,
                                medical centers, and
                                tele-consultation points
                                across the 8 North
                                Eastern States.
                            </p>

                            <button
                                className="resource-link-btn"
                                onClick={() =>
                                    setActiveModal(
                                        'directory'
                                    )
                                }
                            >
                                View Medical Directory
                            </button>

                        </div>

                        {/* CAREGIVER MANUAL */}

                        <div className="resource-card">

                            <div className="resource-icon">
                                📘
                            </div>

                            <h3>
                                Caregiver Manual &
                                Stress Relief
                            </h3>

                            <p>
                                Step-by-step guides for
                                continuous patient
                                monitoring, managing
                                memory decline anxiety,
                                and caregiver well-being
                                routines.
                            </p>

                            <button
                                className="resource-link-btn"
                                onClick={() =>
                                    setActiveModal(
                                        'manual'
                                    )
                                }
                            >
                                Read Caregiver Guide
                            </button>

                        </div>

                        {/* TIPS */}

                        <div className="resource-card">

                            <div className="resource-icon">
                                📚
                            </div>

                            <h3>
                                Dementia Care Tips &
                                Articles
                            </h3>

                            <p>
                                Practical,
                                easy-to-follow guidance
                                on nutrition, exercise,
                                sleep, home safety, and
                                everyday communication
                                for dementia patients.
                            </p>

                            <button
                                className="resource-link-btn"
                                onClick={() =>
                                    setActiveModal(
                                        'tips'
                                    )
                                }
                            >
                                Explore Care Tips
                            </button>

                        </div>

                        {/* SUPPORT */}

                        <div className="resource-card">

                            <div className="resource-icon">
                                🤝
                            </div>

                            <h3>
                                Support Groups &
                                Community
                            </h3>

                            <p>
                                Connect with caregiver
                                support networks, NGOs,
                                and community programs
                                working on dementia care
                                across the North Eastern
                                Region.
                            </p>

                            <button
                                className="resource-link-btn"
                                onClick={() =>
                                    setActiveModal(
                                        'support'
                                    )
                                }
                            >
                                Find Support Groups
                            </button>

                        </div>

                    </div>

                    <div
                        style={{
                            textAlign: 'center',
                            marginTop: '40px'
                        }}
                    >
                        <button
                            className="back-btn"
                            onClick={() =>
                                setCurrentScreen(
                                    'home'
                                )
                            }
                        >
                            Back to Home
                        </button>
                    </div>

                </main>
            )}

            {/* ====================================================
                MODALS
            ==================================================== */}

            {activeModal && (
                <div
                    className="modal-overlay"
                    onClick={() =>
                        setActiveModal(null)
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
                            onClick={() => {
                                if (
                                    'speechSynthesis' in
                                    window
                                ) {
                                    window.speechSynthesis.cancel();
                                }

                                setActiveModal(null);
                            }}
                        >
                            ✕
                        </button>

                        {/* ====================================================
                            DIRECTORY MODAL
                            RESTORED FROM FIRST VERSION
                        ==================================================== */}

                        {activeModal ===
                            'directory' && (
                            <div className="modal-body directory-modal-body">

                                <h2>
                                    🩺 North-Eastern
                                    Region (NER)
                                    Neurological Care
                                    Directory
                                </h2>

                                <p className="directory-subtext">
                                    Verified emergency
                                    lines, neurology
                                    departments, and
                                    memory clinics
                                    across all 8
                                    Northeastern States:
                                </p>

                                <div className="directory-scroll-box">

                                    <div className="state-dir-block">

                                        <h3>
                                            🟢 Assam
                                        </h3>

                                        <ul>

                                            <li>
                                                <strong>
                                                    Gauhati Medical
                                                    College &
                                                    Hospital
                                                    (GMCH),
                                                    Guwahati:
                                                </strong>{' '}
                                                Dept of
                                                Neurology &
                                                Memory Clinic |
                                                Ph:
                                                0361-3582043 /
                                                0361-2452244
                                            </li>

                                            <li>
                                                <strong>
                                                    Assam Medical
                                                    College (AMC),
                                                    Dibrugarh:
                                                </strong>{' '}
                                                Department of
                                                Neurology &
                                                Geriatric Care
                                            </li>

                                            <li>
                                                <strong>
                                                    Silchar Medical
                                                    College &
                                                    Hospital (SMCH),
                                                    Silchar:
                                                </strong>{' '}
                                                General Medicine
                                                & Neurology OPD
                                            </li>

                                        </ul>

                                    </div>

                                    <div className="state-dir-block">

                                        <h3>
                                            🟢 Meghalaya
                                        </h3>

                                        <ul>

                                            <li>
                                                <strong>
                                                    NEIGRIHMS,
                                                    Shillong:
                                                </strong>{' '}
                                                Advanced
                                                Tertiary Care
                                                Hospital &
                                                Neurology Dept |
                                                Emergency: +91
                                                364 2530000,
                                                Enquiry: +91
                                                364 2530002
                                            </li>

                                            <li>
                                                <strong>
                                                    Civil Hospital
                                                    Shillong:
                                                </strong>{' '}
                                                General Neurology
                                                & Senior Citizen
                                                Health Support
                                            </li>

                                        </ul>

                                    </div>

                                    <div className="state-dir-block">

                                        <h3>
                                            🟢 Manipur
                                        </h3>

                                        <ul>

                                            <li>
                                                <strong>
                                                    Regional
                                                    Institute of
                                                    Medical
                                                    Sciences (RIMS),
                                                    Imphal:
                                                </strong>{' '}
                                                Centre of
                                                Excellence /
                                                Dept of Neurology
                                                | Ph:
                                                0385-2414539 /
                                                Telemedicine Hub
                                            </li>

                                            <li>
                                                <strong>
                                                    Jawaharlal Nehru
                                                    Institute of
                                                    Medical Sciences
                                                    (JNIMS), Imphal:
                                                </strong>{' '}
                                                Neurology &
                                                Psychiatry
                                                Outpatient Care
                                            </li>

                                        </ul>

                                    </div>

                                    <div className="state-dir-block">

                                        <h3>
                                            🟢 Tripura
                                        </h3>

                                        <ul>

                                            <li>
                                                <strong>
                                                    Agartala
                                                    Government
                                                    Medical College
                                                    (AGMC) & GBP
                                                    Hospital,
                                                    Agartala:
                                                </strong>{' '}
                                                Dedicated
                                                Neurological
                                                Clinic &
                                                Emergency Care
                                            </li>

                                        </ul>

                                    </div>

                                    <div className="state-dir-block">

                                        <h3>
                                            🟢 Mizoram
                                        </h3>

                                        <ul>

                                            <li>
                                                <strong>
                                                    Zoram Medical
                                                    College (ZMC),
                                                    Falkawn, Aizawl:
                                                </strong>{' '}
                                                State Referral
                                                Hospital & Dept
                                                of Medicine
                                            </li>

                                        </ul>

                                    </div>

                                    <div className="state-dir-block">

                                        <h3>
                                            🟢 Nagaland
                                        </h3>

                                        <ul>

                                            <li>
                                                <strong>
                                                    Kohima Naga
                                                    Hospital
                                                    Authority,
                                                    Kohima:
                                                </strong>{' '}
                                                Regional Health
                                                Center & Emergency
                                                Support
                                            </li>

                                        </ul>

                                    </div>

                                    <div className="state-dir-block">

                                        <h3>
                                            🟢 Arunachal Pradesh
                                            & Sikkim
                                        </h3>

                                        <ul>

                                            <li>
                                                <strong>
                                                    Tomo Riba
                                                    Institute of
                                                    Health and
                                                    Medical
                                                    Sciences
                                                    (TRIHMS),
                                                    Naharlagun (AP):
                                                </strong>{' '}
                                                Specialized
                                                Consultation
                                            </li>

                                            <li>
                                                <strong>
                                                    Sir Thutob
                                                    Namgyal
                                                    Memorial (STNM)
                                                    Hospital,
                                                    Gangtok (Sikkim):
                                                </strong>{' '}
                                                Neurology &
                                                Geriatric Care
                                                Unit
                                            </li>

                                        </ul>

                                    </div>

                                    <div className="state-dir-block emergency-highlight-block">

                                        <h3>
                                            🚨 Pan-NER
                                            Emergency
                                            Helplines
                                        </h3>

                                        <ul>

                                            <li>
                                                <strong>
                                                    Tele-MANAS
                                                    Mental Health
                                                    Support
                                                    Helpline:
                                                </strong>{' '}
                                                14416 (Free
                                                24/7
                                                psychological
                                                & cognitive
                                                distress
                                                support)
                                            </li>

                                            <li>
                                                <strong>
                                                    National
                                                    Emergency
                                                    Response
                                                    Service:
                                                </strong>{' '}
                                                112
                                            </li>

                                        </ul>

                                    </div>

                                </div>

                            </div>
                        )}

                        {/* ====================================================
                            MANUAL MODAL
                            ONLY ADDED THE ABOUT DEMENTIA TAB FROM FIRST VERSION
                        ==================================================== */}

                        {activeModal ===
                            'manual' && (
                            <div className="modal-body manual-modal-body">

                                <h2>
                                    📘 Caregiver Manual &
                                    Stress Relief
                                </h2>

                                <p className="modal-subtitle">
                                    Comprehensive
                                    strategies,
                                    de-escalation
                                    protocols, and
                                    well-being tools for
                                    dementia caregivers
                                    in NER.
                                </p>

                                <div className="manual-tabs">

                                    <button
                                        className={`tab-btn ${
                                            activeManualTab ===
                                            'guide'
                                                ? 'active-tab'
                                                : ''
                                        }`}
                                        onClick={() =>
                                            setActiveManualTab(
                                                'guide'
                                            )
                                        }
                                    >
                                        📖 Monitoring Guide
                                    </button>

                                    <button
                                        className={`tab-btn ${
                                            activeManualTab ===
                                            'deescalation'
                                                ? 'active-tab'
                                                : ''
                                        }`}
                                        onClick={() =>
                                            setActiveManualTab(
                                                'deescalation'
                                            )
                                        }
                                    >
                                        🕊️ Managing Anxiety
                                    </button>

                                    <button
                                        className={`tab-btn ${
                                            activeManualTab ===
                                            'breathing'
                                                ? 'active-tab'
                                                : ''
                                        }`}
                                        onClick={() =>
                                            setActiveManualTab(
                                                'breathing'
                                            )
                                        }
                                    >
                                        🧘 Caregiver
                                        Breathing Tool
                                    </button>

                                    {/* ADDED FROM FIRST VERSION */}

                                    <button
                                        className={`tab-btn ${
                                            activeManualTab ===
                                            'dementia'
                                                ? 'active-tab'
                                                : ''
                                        }`}
                                        onClick={() =>
                                            setActiveManualTab(
                                                'dementia'
                                            )
                                        }
                                    >
                                        🧠 About Dementia
                                    </button>

                                </div>

                                <div className="guide-scroll-container">

                                    {/* EXISTING LATEST VERSION - GUIDE */}

                                    {activeManualTab ===
                                        'guide' && (
                                        <div className="tab-content">

                                            <h3>
                                                1. Daily Routine
                                                & Schedule
                                                Synchronization
                                            </h3>

                                            <p>
                                                Maintain
                                                consistent
                                                mealtime and
                                                activity
                                                schedules.
                                            </p>

                                        </div>
                                    )}

                                    {/* EXISTING LATEST VERSION - DEESCALATION */}

                                    {activeManualTab ===
                                        'deescalation' && (
                                        <div className="tab-content">

                                            <h3>
                                                1. Managing
                                                Sundowning &
                                                Agitation
                                            </h3>

                                            <p>
                                                Reduce
                                                ambient
                                                sensory
                                                stimuli and
                                                initiate calm
                                                background
                                                audio.
                                            </p>

                                        </div>
                                    )}

                                    {/* EXISTING LATEST VERSION - BREATHING */}

                                    {activeManualTab ===
                                        'breathing' &&
                                        renderBreathingExercise()}

                                    {/* ADDED FROM FIRST VERSION - ABOUT DEMENTIA */}

                                    {activeManualTab ===
                                        'dementia' && (
                                        <div className="tab-content">

                                            <h3>
                                                What Is Dementia?
                                            </h3>

                                            <p>
                                                Dementia is an
                                                umbrella term for
                                                a decline in
                                                memory, thinking,
                                                and reasoning
                                                skills severe
                                                enough to
                                                interfere with
                                                daily life. It is
                                                caused by damage
                                                to brain cells and
                                                is progressive,
                                                meaning symptoms
                                                generally worsen
                                                over time.
                                                Alzheimer's
                                                disease is the
                                                most common form,
                                                accounting for a
                                                majority of cases.
                                            </p>

                                            <h3>
                                                Common Early Signs
                                            </h3>

                                            <p>
                                                Frequent memory
                                                lapses, difficulty
                                                finding words,
                                                confusion about
                                                time or place,
                                                trouble planning
                                                familiar tasks,
                                                and noticeable
                                                changes in mood or
                                                personality are
                                                often among the
                                                first signs
                                                families notice.
                                            </p>

                                            <h3>
                                                The Three Broad
                                                Stages
                                            </h3>

                                            <p>
                                                <strong>
                                                    Early stage:
                                                </strong>{' '}
                                                Mild forgetfulness
                                                and occasional
                                                confusion; the
                                                person is usually
                                                still independent.
                                                <strong>
                                                    {' '}
                                                    Middle stage:
                                                </strong>{' '}
                                                Memory gaps grow,
                                                help is needed with
                                                daily tasks, and
                                                wandering or
                                                repeating
                                                questions is
                                                common.
                                                <strong>
                                                    {' '}
                                                    Late stage:
                                                </strong>{' '}
                                                Significant loss
                                                of ability to
                                                communicate and
                                                carry out basic
                                                activities;
                                                full-time care is
                                                typically required.
                                            </p>

                                            <h3>
                                                Why Early Detection
                                                Matters
                                            </h3>

                                            <p>
                                                There is currently
                                                no cure, but early
                                                diagnosis allows
                                                families to plan
                                                care, start
                                                supportive
                                                therapies, adjust
                                                routines, and
                                                access medications
                                                that can slow
                                                symptom progression
                                                in some cases.
                                            </p>

                                            <h3>
                                                Supporting a Person
                                                with Dementia
                                            </h3>

                                            <p>
                                                Consistent
                                                routines, a calm
                                                and well-lit
                                                environment,
                                                patience during
                                                communication, and
                                                regular cognitive
                                                engagement (such as
                                                memory games and
                                                social interaction)
                                                can meaningfully
                                                improve quality of
                                                life for both
                                                patients and
                                                caregivers.
                                            </p>

                                        </div>
                                    )}

                                </div>

                            </div>
                        )}

                        {/* ====================================================
                            TIPS MODAL
                            RESTORED FROM FIRST VERSION
                        ==================================================== */}

                        {activeModal ===
                            'tips' && (
                            <div className="modal-body directory-modal-body">

                                <h2>
                                    📚 Dementia Care Tips
                                    & Articles
                                </h2>

                                <p className="directory-subtext">
                                    Practical guidance families
                                    and caregivers can apply at
                                    home:
                                </p>

                                <div className="directory-scroll-box">

                                    <div className="state-dir-block">

                                        <h3>
                                            🥗 Nutrition & Diet
                                        </h3>

                                        <p>
                                            Offer small,
                                            frequent meals
                                            with familiar
                                            regional foods.
                                            Keep water visible
                                            and accessible
                                            throughout the day,
                                            as thirst cues are
                                            often forgotten.
                                            Limit sugary and
                                            heavily processed
                                            snacks, and favor
                                            finger foods if
                                            using utensils
                                            becomes difficult.
                                        </p>

                                    </div>

                                    <div className="state-dir-block">

                                        <h3>
                                            🚶 Physical Activity
                                        </h3>

                                        <p>
                                            Short daily walks,
                                            light stretching, or
                                            simple household
                                            chores help maintain
                                            mobility and improve
                                            mood. Aim for gentle,
                                            consistent movement
                                            rather than intense
                                            exercise, and always
                                            supervise outdoor
                                            activity.
                                        </p>

                                    </div>

                                    <div className="state-dir-block">

                                        <h3>
                                            😴 Sleep & Sundowning
                                        </h3>

                                        <p>
                                            Keep a consistent
                                            bedtime routine,
                                            limit caffeine after
                                            noon, and use dim,
                                            warm lighting in the
                                            evening. If confusion
                                            or agitation
                                            increases at dusk,
                                            calm music and a
                                            familiar face nearby
                                            can help ease the
                                            transition.
                                        </p>

                                    </div>

                                    <div className="state-dir-block">

                                        <h3>
                                            🏠 Home Safety
                                        </h3>

                                        <p>
                                            Remove loose rugs and
                                            clutter, install grab
                                            bars near the
                                            bathroom, label rooms
                                            clearly, and keep
                                            sharp objects,
                                            medicines, and
                                            cleaning supplies
                                            locked away or out of
                                            reach.
                                        </p>

                                    </div>

                                    <div className="state-dir-block">

                                        <h3>
                                            💬 Communication
                                        </h3>

                                        <p>
                                            Use short, simple
                                            sentences and
                                            maintain eye contact.
                                            Give the person time
                                            to respond, avoid
                                            quizzing their memory,
                                            and focus on the
                                            feeling behind their
                                            words rather than
                                            correcting every
                                            detail.
                                        </p>

                                    </div>

                                </div>

                            </div>
                        )}

                        {/* ====================================================
                            SUPPORT MODAL
                            RESTORED FROM FIRST VERSION
                        ==================================================== */}

                        {activeModal ===
                            'support' && (
                            <div className="modal-body directory-modal-body">

                                <h2>
                                    🤝 Support Groups &
                                    Community
                                </h2>

                                <p className="directory-subtext">
                                    Caregivers don't have to
                                    manage alone — these are
                                    the kinds of support worth
                                    seeking out in the NER:
                                </p>

                                <div className="directory-scroll-box">

                                    <div className="state-dir-block">

                                        <h3>
                                            🧑‍🤝‍🧑 Local
                                            Caregiver Support
                                            Groups
                                        </h3>

                                        <p>
                                            Many district
                                            hospitals and NGOs
                                            run periodic
                                            caregiver meet-ups
                                            where families
                                            share coping
                                            strategies and
                                            practical advice.
                                            Ask your nearest
                                            medical center (see
                                            the Care Directory)
                                            whether one
                                            operates in your
                                            area.
                                        </p>

                                    </div>

                                    <div className="state-dir-block">

                                        <h3>
                                            🏢 National &
                                            Regional Dementia
                                            Organizations
                                        </h3>

                                        <p>
                                            Bodies such as the
                                            Alzheimer's and
                                            Related Disorders
                                            Society of India
                                            (ARDSI) run chapters
                                            and helplines across
                                            India, offering
                                            counseling, day-care
                                            referrals, and
                                            caregiver training
                                            resources.
                                        </p>

                                    </div>

                                    <div className="state-dir-block">

                                        <h3>
                                            💻 Online Communities
                                        </h3>

                                        <p>
                                            Moderated online
                                            forums and social
                                            media groups for
                                            dementia caregivers
                                            can offer round-the-
                                            clock peer support,
                                            especially useful
                                            for families in
                                            remote areas with
                                            limited access to
                                            in-person groups.
                                        </p>

                                    </div>

                                    <div className="state-dir-block emergency-highlight-block">

                                        <h3>
                                            🕊️ Mental Health
                                            Support for
                                            Caregivers
                                        </h3>

                                        <p>
                                            Caregiver burnout is
                                            common and real. The
                                            Tele-MANAS helpline
                                            (14416) offers free,
                                            confidential
                                            psychological
                                            support for
                                            caregivers as well
                                            as patients, 24/7.
                                        </p>

                                    </div>

                                </div>

                            </div>
                        )}

                        {/* ====================================================
                            QUICK CALM MODAL
                        ==================================================== */}

                        {activeModal ===
                            'quickCalm' && (
                            <div className="modal-body quick-calm-modal-body">

                                <h2>
                                    🧘 Quick Calm
                                </h2>

                                <p className="modal-subtitle">
                                    A short guided
                                    breathing pause,
                                    whenever you need it.
                                </p>

                                {renderBreathingExercise()}

                            </div>
                        )}

                    </div>

                </div>
            )}

            {/* ====================================================
                FLOATING QUICK CALM BUTTON
            ==================================================== */}

            <button
                className="quick-calm-fab"
                onClick={() =>
                    setActiveModal(
                        'quickCalm'
                    )
                }
                aria-label="Open quick calm breathing exercise"
            >
                🧘 Quick Calm
            </button>

            {/* ====================================================
                EMERGENCY BANNER
            ==================================================== */}

            <div className="emergency-banner">

                <span>
                    🚨 Emergency Help Line
                    (NER Priority Support) 🚨
                </span>

                <button className="help-btn">
                    Click for Help
                </button>

            </div>

        </div>
    );
}

export default App;