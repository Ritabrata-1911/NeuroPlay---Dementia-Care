import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './App.css';
import CaregiverAuth from './CaregiverAuth';
import CaregiverDashboard from './CaregiverDashboard';
import PatientLogin from './PatientLogin';
import PatientDashboard from './PatientDashboard';
import { supabase } from './SupabaseClient';
import LanguageSwitcher from './LanguageSwitcher';

// ============================================================
// HERO BACKDROP — layered tea-garden hills, bamboo, marigold sun
// Pure inline SVG, no image assets required.
// ============================================================

function HeroBackdrop() {
    return (
        <svg
            viewBox="0 0 1400 520"
            preserveAspectRatio="xMidYMax slice"
            aria-hidden="true"
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                zIndex: 0,
                pointerEvents: 'none'
            }}
        >
            {/* drifting clouds */}
            <g className="cloud cloud-a">
                <ellipse cx="0" cy="0" rx="55" ry="18" fill="#FFFFFF" opacity="0.85" />
                <ellipse cx="-38" cy="7" rx="36" ry="14" fill="#FFFFFF" opacity="0.8" />
                <ellipse cx="40" cy="8" rx="32" ry="13" fill="#FFFFFF" opacity="0.8" />
            </g>
            <g className="cloud cloud-b">
                <ellipse cx="0" cy="0" rx="42" ry="14" fill="#FFFFFF" opacity="0.75" />
                <ellipse cx="-28" cy="5" rx="26" ry="11" fill="#FFFFFF" opacity="0.7" />
                <ellipse cx="30" cy="6" rx="24" ry="10" fill="#FFFFFF" opacity="0.7" />
            </g>
            <g className="cloud cloud-c">
                <ellipse cx="0" cy="0" rx="48" ry="16" fill="#FFFFFF" opacity="0.7" />
                <ellipse cx="-32" cy="6" rx="28" ry="12" fill="#FFFFFF" opacity="0.65" />
                <ellipse cx="34" cy="7" rx="26" ry="11" fill="#FFFFFF" opacity="0.65" />
            </g>

            {/* birds — each flies its own slow loop across the sky, wings flapping */}
            <g className="bird bird-a">
                <path
                    className="bird-wings"
                    d="M-16,0 Q0,-16 16,0 Q0,-7 -16,0 Z"
                    fill="#2C4A3E"
                    opacity="0.7"
                />
            </g>
            <g className="bird bird-b">
                <path
                    className="bird-wings"
                    d="M-13,0 Q0,-13 13,0 Q0,-6 -13,0 Z"
                    fill="#2C4A3E"
                    opacity="0.6"
                />
            </g>
            <g className="bird bird-c">
                <path
                    className="bird-wings"
                    d="M-11,0 Q0,-11 11,0 Q0,-5 -11,0 Z"
                    fill="#2C4A3E"
                    opacity="0.55"
                />
            </g>
        </svg>
    );
}

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
    inhale: 'breathing.phases.inhale',
    hold1: 'breathing.phases.hold',
    exhale: 'breathing.phases.exhale',
    hold2: 'breathing.phases.hold'
};

function App() {
    // ============================================================
    // ROUTING
    //
    // currentScreen is now derived from the actual browser URL
    // (via react-router-dom) instead of being held in local state.
    // This means:
    //   - the URL bar always reflects the visible screen
    //   - refreshing the page reloads the SAME screen
    //   - the browser back/forward buttons move through YOUR
    //     app's history instead of skipping straight past it
    //
    // setCurrentScreen(screen) is kept as a wrapper around
    // navigate() so every existing call site below (there are
    // many) keeps working unchanged.
    // ============================================================

    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();

    const currentScreen =
        location.pathname === '/'
            ? 'home'
            : location.pathname.slice(1);

    const setCurrentScreen = (screen) => {
        navigate(screen === 'home' ? '/' : `/${screen}`);
    };

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
        t(breathingPhaseLabels[breathingPhase]);

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
    // AUTH SCREEN GUARD
    //
    // Problem this solves:
    // Logging in navigates from /caregiverAuth -> /caregiverDashboard,
    // which adds BOTH pages to browser history. If the user then
    // presses Back, the URL goes to /caregiverAuth again — but the
    // Supabase session is still valid (logging in doesn't get undone
    // by pressing Back). CaregiverAuth/PatientLogin don't check for
    // an existing session, so they'd just show the login form again,
    // even though the user is still actually logged in.
    //
    // Fix: whenever the URL lands on an auth screen, check if a
    // session already exists. If it does (and we're not in the
    // middle of a password-reset flow), skip straight past the login
    // form back to the dashboard. We use `replace` so this doesn't
    // add yet another history entry — it overwrites the auth-screen
    // entry, so Back won't get stuck flip-flopping between the two.
    // ============================================================

    useEffect(() => {
        let mounted = true;

        const guardAuthScreens = async () => {
            if (
                currentScreen === 'caregiverAuth' &&
                !isPasswordRecovery
            ) {
                const {
                    data: { session }
                } = await supabase.auth.getSession();

                if (mounted && session) {
                    navigate('/caregiverDashboard', {
                        replace: true
                    });
                }
            }

            if (currentScreen === 'patientAuth') {
                const storedSession = sessionStorage.getItem(
                    'neuroplay_patient_session'
                );

                if (mounted && storedSession) {
                    navigate('/patientDashboard', {
                        replace: true
                    });
                }
            }
        };

        guardAuthScreens();

        return () => {
            mounted = false;
        };
    }, [currentScreen, isPasswordRecovery]);

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
                {t('breathing.title')}
            </h3>

            <p>
                {t('breathing.description')}


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
                    {t('breathing.minutes2')}
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
                    {t('breathing.minutes5')}
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
                                {t(breathingPhaseLabels[phase])}
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
                            : t('breathing.ready')}
                    </span>

                    <span className="timer-text">
                        {isShowingPhase
                            ? `${breathingTimer}s`
                            : t('breathing.seconds4')}
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
                        ⏸ {t('breathing.holdCue')} ⏸
                    </p>
                )}

            {/* ----------------------------------------------------
                SESSION TIME
            ---------------------------------------------------- */}

            {isBreathingActive && (
                <p className="session-remaining">
                    ⏱ {t('breathing.sessionTimeLeft')}{' '}
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
                    ? `⏹️ ${t('breathing.stopExercise')}`
                    : `▶️ ${t('breathing.startExercise')}`}
            </button>

            {/* ----------------------------------------------------
                PREVIEW MESSAGE
            ---------------------------------------------------- */}

            {isPreviewingPhase &&
                !isBreathingActive && (
                    <p className="preview-hint">
                        {t('breathing.preview', {
                            phase: breathingPhaseLabel
                        })}
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
                        {t('nav.home')}
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
                        {t('nav.howItWorks')}
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
                        {t('nav.about')}
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
                        {t('nav.resources')}
                    </a>

                    <button
                        className="nav-btn"
                        onClick={() =>
                            setCurrentScreen(
                                'contact'
                            )
                        }
                    >
                        {t('nav.contact')}
                    </button>

                    <LanguageSwitcher />

                </div>

            </header>

            {/* ====================================================
                HOME PAGE
            ==================================================== */}

            {currentScreen === 'home' && (
                <section className="hero-section">

                    <HeroBackdrop />

                    <div className="brand-header">

                        <div className="logo-title">

                            <span
                                className="brain-icon"
                                role="img"
                                aria-label={t('aria.brain')}
                            >
                                🧠
                            </span>

                            <h1>
                                {t('brand')}
                            </h1>

                        </div>

                        <p className="tagline">
                            {t('hero.tagline')}
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
                                aria-label={t('aria.patient')}
                            >
                                👴
                            </div>

                            <h3>
                                {t('cards.patientLogin')}
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
                                aria-label={t('aria.caregiver')}
                            >
                                👩‍⚕️
                            </div>

                            <h3>
                                {t('cards.caregiverLogin')}
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
                            {t('howItWorks.title')}
                        </h1>

                        <p className="about-subtitle">
                            {t('howItWorks.subtitle')}





                        </p>

                    </div>

                    <div className="steps-path">

                        <div className="step-item step-blue">

                            <div className="step-marker">
                                <span
                                    role="img"
                                    aria-label={t('aria.gameController')}
                                >
                                    🎮
                                </span>
                            </div>

                            <div className="step-body">

                                <span className="step-index">
                                    {t('howItWorks.step1.label')}
                                </span>

                                <h2>
                                    {t('howItWorks.step1.title')}

                                </h2>

                                <p>
                                    {t('howItWorks.step1.text')}







                                </p>

                            </div>

                        </div>

                        <div className="step-item step-green">

                            <div className="step-marker">
                                <span
                                    role="img"
                                    aria-label={t('aria.speakingHead')}
                                >
                                    🗣️
                                </span>
                            </div>

                            <div className="step-body">

                                <span className="step-index">
                                    {t('howItWorks.step2.label')}
                                </span>

                                <h2>
                                    {t('howItWorks.step2.title')}

                                </h2>

                                <p>
                                    {t('howItWorks.step2.text')}











                                </p>

                            </div>

                        </div>

                        <div className="step-item step-navy">

                            <div className="step-marker">
                                <span
                                    role="img"
                                    aria-label={t('aria.barChart')}
                                >
                                    📊
                                </span>
                            </div>

                            <div className="step-body">

                                <span className="step-index">
                                    {t('howItWorks.step3.label')}
                                </span>

                                <h2>
                                    {t('howItWorks.step3.title')}

                                </h2>

                                <p>
                                    {t('howItWorks.step3.text')}







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
                            {t('common.backHome')}
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
                            {t('about.title')}
                        </h1>

                        <p className="about-subtitle">
                            {t('about.subtitle')}




                        </p>

                        <span className="coverage-badge">
                            {t('about.coverage')}

                        </span>

                    </div>

                    <div className="about-mission-layout">

                        <div className="about-mission-statement">

                            <span
                                className="about-mission-icon"
                                role="img"
                                aria-label={t('aria.target')}
                            >
                                🎯
                            </span>

                            <h2>
                                {t('about.mission.title')}
                            </h2>

                            <p>
                                {t('about.mission.text')}







                            </p>

                        </div>

                        <div className="about-feature-list">

                            <div className="about-feature-row">

                                <span
                                    className="about-feature-icon"
                                    role="img"
                                    aria-label={t('aria.handshake')}
                                >
                                    🤝
                                </span>

                                <div>

                                    <h3>
                                        {t('about.caregiverSupport.title')}
                                    </h3>

                                    <p>
                                        {t('about.caregiverSupport.text')}








                                    </p>

                                </div>

                            </div>

                            <div className="about-feature-row">

                                <span
                                    className="about-feature-icon"
                                    role="img"
                                    aria-label={t('aria.puzzlePiece')}
                                >
                                    🧩
                                </span>

                                <div>

                                    <h3>
                                        {t('about.cultural.title')}

                                    </h3>

                                    <p>
                                        {t('about.cultural.text')}






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
                            {t('common.backHome')}
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
                            {t('resources.title')}

                        </h1>

                        <p className="resources-subtitle">
                            {t('resources.subtitle')}




                        </p>

                    </div>

                    <div className="resources-grid">

                        {/* DIRECTORY */}

                        <div className="resource-card">

                            <div className="resource-icon">
                                🩺
                            </div>

                            <h3>
                                {t('resources.directory.title')}


                            </h3>

                            <p>
                                {t('resources.directory.text')}





                            </p>

                            <button
                                className="resource-link-btn"
                                onClick={() =>
                                    setActiveModal(
                                        'directory'
                                    )
                                }
                            >
                                {t('resources.directory.button')}
                            </button>

                        </div>

                        {/* CAREGIVER MANUAL */}

                        <div className="resource-card">

                            <div className="resource-icon">
                                📘
                            </div>

                            <h3>
                                {t('resources.manual.title')}

                            </h3>

                            <p>
                                {t('resources.manual.text')}





                            </p>

                            <button
                                className="resource-link-btn"
                                onClick={() =>
                                    setActiveModal(
                                        'manual'
                                    )
                                }
                            >
                                {t('resources.manual.button')}
                            </button>

                        </div>

                        {/* TIPS */}

                        <div className="resource-card">

                            <div className="resource-icon">
                                📚
                            </div>

                            <h3>
                                {t('resources.tips.title')}

                            </h3>

                            <p>
                                {t('resources.tips.text')}





                            </p>

                            <button
                                className="resource-link-btn"
                                onClick={() =>
                                    setActiveModal(
                                        'tips'
                                    )
                                }
                            >
                                {t('resources.tips.button')}
                            </button>

                        </div>

                        {/* SUPPORT */}

                        <div className="resource-card">

                            <div className="resource-icon">
                                🤝
                            </div>

                            <h3>
                                {t('resources.support.title')}

                            </h3>

                            <p>
                                {t('resources.support.text')}





                            </p>

                            <button
                                className="resource-link-btn"
                                onClick={() =>
                                    setActiveModal(
                                        'support'
                                    )
                                }
                            >
                                {t('resources.support.button')}
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
                            {t('common.backHome')}
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
                                    🩺 {t('directory.title')}



                                </h2>

                                <p className="directory-subtext">
                                    {t('directory.subtitle')}





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
                                                {t('directory.details.assam.gauhati')}





                                            </li>

                                            <li>
                                                <strong>
                                                    Assam Medical
                                                    College (AMC),
                                                    Dibrugarh:
                                                </strong>{' '}
                                                {t('directory.details.assam.amc')}


                                            </li>

                                            <li>
                                                <strong>
                                                    Silchar Medical
                                                    College &
                                                    Hospital (SMCH),
                                                    Silchar:
                                                </strong>{' '}
                                                {t('directory.details.assam.silchar')}

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
                                                {t('directory.details.meghalaya.neigrihms')}







                                            </li>

                                            <li>
                                                <strong>
                                                    Civil Hospital
                                                    Shillong:
                                                </strong>{' '}
                                                {t('directory.details.meghalaya.civil')}


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
                                                {t('directory.details.manipur.rims')}





                                            </li>

                                            <li>
                                                <strong>
                                                    Jawaharlal Nehru
                                                    Institute of
                                                    Medical Sciences
                                                    (JNIMS), Imphal:
                                                </strong>{' '}
                                                {t('directory.details.manipur.jnims')}


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
                                                {t('directory.details.tripura.agmc')}



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
                                                {t('directory.details.mizoram.zmc')}


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
                                                {t('directory.details.nagaland.kohima')}


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
                                                {t('directory.details.arunachal.sikkim.trihms')}

                                            </li>

                                            <li>
                                                <strong>
                                                    Sir Thutob
                                                    Namgyal
                                                    Memorial (STNM)
                                                    Hospital,
                                                    Gangtok (Sikkim):
                                                </strong>{' '}
                                                {t('directory.details.arunachal.sikkim.stnm')}


                                            </li>

                                        </ul>

                                    </div>

                                    <div className="state-dir-block emergency-highlight-block">

                                        <h3>
                                            🚨 {t('directory.emergency.title')}


                                        </h3>

                                        <ul>

                                            <li>
                                                <strong>
                                                    {t('directory.emergency.teleManas')}



                                                </strong>{' '}
                                                {t('directory.details.teleManasSupport')}





                                            </li>

                                            <li>
                                                <strong>
                                                    {t('directory.emergency.national')}



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
                                    📘 {t('manual.title')}

                                </h2>

                                <p className="modal-subtitle">
                                    {t('manual.subtitle')}






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
                                        📖 {t('manual.tabs.guide')}
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
                                        🕊️ {t('manual.tabs.deescalation')}
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
                                        🧘 {t('manual.tabs.breathing')}

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
                                        🧠 {t('manual.tabs.dementia')}
                                    </button>

                                </div>

                                <div className="guide-scroll-container">

                                    {/* EXISTING LATEST VERSION - GUIDE */}

                                    {activeManualTab ===
                                        'guide' && (
                                        <div className="tab-content">

                                            <h3>
                                                {t('manual.guide.title')}


                                            </h3>

                                            <p>
                                                {t('manual.guide.text')}




                                            </p>

                                        </div>
                                    )}

                                    {/* EXISTING LATEST VERSION - DEESCALATION */}

                                    {activeManualTab ===
                                        'deescalation' && (
                                        <div className="tab-content">

                                            <h3>
                                                {t('manual.deescalation.title')}


                                            </h3>

                                            <p>
                                                {t('manual.deescalation.text')}






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
                                                {t('dementia.whatIs.title')}
                                            </h3>

                                            <p>
                                                {t('dementia.whatIs.text')}



















                                            </p>

                                            <h3>
                                                {t('dementia.earlySigns.title')}
                                            </h3>

                                            <p>
                                                {t('dementia.earlySigns.text')}












                                            </p>

                                            <h3>
                                                {t('dementia.stages.title')}

                                            </h3>

                                            <p>
                                                <strong>
                                                    {t('dementia.stages.earlyLabel')}
                                                </strong>{' '}
                                                {t('dementia.stages.early')}




                                                <strong>
                                                    {' '}
                                                    {t('dementia.stages.middleLabel')}
                                                </strong>{' '}
                                                {t('dementia.stages.middle')}






                                                <strong>
                                                    {' '}
                                                    {t('dementia.stages.lateLabel')}
                                                </strong>{' '}
                                                {t('dementia.stages.late')}






                                            </p>

                                            <h3>
                                                {t('dementia.detection.title')}

                                            </h3>

                                            <p>
                                                {t('dementia.detection.text')}











                                            </p>

                                            <h3>
                                                {t('dementia.supporting.title')}

                                            </h3>

                                            <p>
                                                {t('dementia.supporting.text')}














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
                                    📚 {t('tips.title')}

                                </h2>

                                <p className="directory-subtext">
                                    {t('tips.subtitle')}


                                </p>

                                <div className="directory-scroll-box">

                                    <div className="state-dir-block">

                                        <h3>
                                            🥗 {t('tips.nutrition.title')}
                                        </h3>

                                        <p>
                                            {t('tips.nutrition.text')}














                                        </p>

                                    </div>

                                    <div className="state-dir-block">

                                        <h3>
                                            🚶 {t('tips.activity.title')}
                                        </h3>

                                        <p>
                                            {t('tips.activity.text')}










                                        </p>

                                    </div>

                                    <div className="state-dir-block">

                                        <h3>
                                            😴 {t('tips.sleep.title')}
                                        </h3>

                                        <p>
                                            {t('tips.sleep.text')}











                                        </p>

                                    </div>

                                    <div className="state-dir-block">

                                        <h3>
                                            🏠 {t('tips.safety.title')}
                                        </h3>

                                        <p>
                                            {t('tips.safety.text')}









                                        </p>

                                    </div>

                                    <div className="state-dir-block">

                                        <h3>
                                            💬 {t('tips.communication.title')}
                                        </h3>

                                        <p>
                                            {t('tips.communication.text')}










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
                                    🤝 {t('support.title')}

                                </h2>

                                <p className="directory-subtext">
                                    {t('support.subtitle')}



                                </p>

                                <div className="directory-scroll-box">

                                    <div className="state-dir-block">

                                        <h3>
                                            🧑‍🤝‍🧑 {t('support.local.title')}


                                        </h3>

                                        <p>
                                            {t('support.local.text')}













                                        </p>

                                    </div>

                                    <div className="state-dir-block">

                                        <h3>
                                            🏢 {t('support.organizations.title')}


                                        </h3>

                                        <p>
                                            {t('support.organizations.text')}










                                        </p>

                                    </div>

                                    <div className="state-dir-block">

                                        <h3>
                                            💻 {t('support.online.title')}
                                        </h3>

                                        <p>
                                            {t('support.online.text')}










                                        </p>

                                    </div>

                                    <div className="state-dir-block emergency-highlight-block">

                                        <h3>
                                            🕊️ {t('support.mentalHealth.title')}


                                        </h3>

                                        <p>
                                            {t('support.mentalHealth.text')}








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
                                    🧘 {t('quickCalm.title')}
                                </h2>

                                <p className="modal-subtitle">
                                    {t('quickCalm.subtitle')}


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
                aria-label={t('aria.quickCalm')}
            >
                🧘 {t('quickCalm.button')}
            </button>

            {/* ====================================================
                EMERGENCY BANNER
            ==================================================== */}

            <div className="emergency-banner">

                <span>
                    {t('emergency.banner')}
                </span>

                <button className="help-btn">
                    {t('emergency.button')}
                </button>

            </div>

        </div>
    );
}
export default App;