import React, { useEffect, useState } from 'react';
import { supabase } from './SupabaseClient';
import './PatientDashboard.css';
import MemoryMatchGame from './MemoryMatchGame';
import PictureRecallGame from './PictureRecallGame';
import NumberMemoryGame from './NumberMemoryGame';

export default function PatientDashboard({ onLogout }) {
    const [patient, setPatient] = useState(null);
    const [activeGame, setActiveGame] = useState(null);

    /*
     * Load the patient's session.
     */
    useEffect(() => {
        const sessionData = sessionStorage.getItem(
            'neuroplay_patient_session'
        );

        if (sessionData) {
            try {
                setPatient(JSON.parse(sessionData));
            } catch (error) {
                console.error(
                    'Invalid patient session:',
                    error
                );

                sessionStorage.removeItem(
                    'neuroplay_patient_session'
                );

                onLogout();
            }
        } else {
            onLogout();
        }
    }, [onLogout]);

    /*
     * ---------------------------------------------------------
     * PATIENT ONLINE PRESENCE
     * ---------------------------------------------------------
     *
     * This is frontend-only.
     *
     * While this dashboard is open, the patient is marked
     * ONLINE in Supabase Realtime Presence.
     *
     * When the patient:
     * - logs out
     * - closes the tab
     * - closes the browser
     * - loses the connection
     *
     * Supabase removes the presence automatically.
     *
     * The caregiver dashboard listens to the same channel.
     */
    useEffect(() => {
        if (!patient?.id) return;

        const channelName =
            `neuroplay-patient-presence-${patient.id}`;

        const presenceChannel = supabase.channel(
            channelName,
            {
                config: {
                    presence: {
                        key: `patient-${patient.id}`
                    }
                }
            }
        );

        presenceChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                const { error } =
                    await presenceChannel.track({
                        patient_id: patient.id,
                        patient_id_string: String(
                            patient.id
                        ),
                        full_name: patient.full_name,
                        online_at:
                            new Date().toISOString()
                    });

                if (error) {
                    console.error(
                        'Failed to track patient presence:',
                        error
                    );
                }
            }
        });

        /*
         * Cleanup when patient leaves dashboard.
         */
        return () => {
            supabase.removeChannel(
                presenceChannel
            );
        };
    }, [patient?.id, patient?.full_name]);

    const handleSignOut = async () => {
        /*
         * Removing the Realtime channel causes the patient's
         * presence to disappear immediately.
         */
        sessionStorage.removeItem(
            'neuroplay_patient_session'
        );

        onLogout();
    };

    const handleFeatureClick = (featureName) => {
        alert(`${featureName} is coming soon!`);
    };

    if (!patient) return null;

    if (activeGame === 'memoryMatch') {
        return (
            <MemoryMatchGame
                patient={patient}
                onHome={() => setActiveGame(null)}
            />
        );
    }

    if (activeGame === 'pictureRecall') {
        return (
            <PictureRecallGame
                patient={patient}
                onHome={() => setActiveGame(null)}
            />
        );
    }

    if (activeGame === 'numberMemory') {
        return (
            <NumberMemoryGame
                patient={patient}
                onHome={() => setActiveGame(null)}
            />
        );
    }

    return (
        <div className="patient-dashboard-container">
            <header className="patient-header">
                <div className="patient-header-left">
                    <h1>🧠 NeuroPlay</h1>

                    <h2>
                        Hello, {patient.full_name} 👋
                    </h2>

                    <p>
                        Let's keep your mind active today.
                    </p>
                </div>

                <button
                    className="patient-logout-btn"
                    onClick={handleSignOut}
                >
                    Logout
                </button>
            </header>

            <main className="patient-main-content">
                <h3 className="section-heading">
                    🧩 Cognitive Games
                </h3>

                <div className="patient-games-grid">
                    <div className="patient-game-card">
                        <div className="game-icon">
                            🧠
                        </div>

                        <h4>Memory Match</h4>

                        <p>Test your memory</p>

                        <button
                            onClick={() =>
                                setActiveGame(
                                    'memoryMatch'
                                )
                            }
                        >
                            PLAY
                        </button>
                    </div>

                    <div className="patient-game-card">
                        <div className="game-icon">
                            🔢
                        </div>

                        <h4>Number Memory</h4>

                        <p>Remember the number</p>

                        <button
                            onClick={() =>
                                setActiveGame(
                                    'numberMemory'
                                )
                            }
                        >
                            PLAY
                        </button>
                    </div>

                    <div className="patient-game-card">
                        <div className="game-icon">
                            🎯
                        </div>

                        <h4>
                            Attention Challenge
                        </h4>

                        <p>
                            Improve focus and
                            concentration
                        </p>

                        <button
                            onClick={() =>
                                handleFeatureClick(
                                    'Attention Challenge'
                                )
                            }
                        >
                            PLAY
                        </button>
                    </div>

                    <div className="patient-game-card">
                        <div className="game-icon">
                            🖼️
                        </div>

                        <h4>Object Recognition</h4>

                        <p>
                            Identify familiar objects
                        </p>

                        <button
                            onClick={() =>
                                setActiveGame(
                                    'pictureRecall'
                                )
                            }
                        >
                            PLAY
                        </button>
                    </div>
                </div>

                <h3
                    className="section-heading"
                    style={{ marginTop: '4rem' }}
                >
                    Daily Overview
                </h3>

                <div className="patient-features-grid">
                    <div className="patient-feature-card disabled-card">
                        <span className="feature-icon">
                            💊
                        </span>

                        <div className="feature-text">
                            <h4>
                                Medicine Reminders
                            </h4>

                            <p>
                                Your medicine reminders
                                will appear here soon.
                            </p>
                        </div>
                    </div>

                    <div className="patient-feature-card disabled-card">
                        <span className="feature-icon">
                            💧
                        </span>

                        <div className="feature-text">
                            <h4>Hydration</h4>

                            <p>
                                Stay hydrated throughout
                                the day.
                            </p>
                        </div>
                    </div>

                    <div className="patient-feature-card disabled-card">
                        <span className="feature-icon">
                            📅
                        </span>

                        <div className="feature-text">
                            <h4>Daily Activities</h4>

                            <p>
                                Your daily activities
                                will appear here soon.
                            </p>
                        </div>
                    </div>

                    <div className="patient-feature-card disabled-card">
                        <span className="feature-icon">
                            🏥
                        </span>

                        <div className="feature-text">
                            <h4>Appointments</h4>

                            <p>
                                Your upcoming medical
                                appointments will
                                appear here.
                            </p>
                        </div>
                    </div>

                    <div
                        className="patient-feature-card disabled-card"
                        style={{
                            gridColumn: '1 / -1'
                        }}
                    >
                        <span className="feature-icon">
                            📈
                        </span>

                        <div className="feature-text">
                            <h4>My Progress</h4>

                            <p>
                                Progress tracking will
                                be available soon.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}