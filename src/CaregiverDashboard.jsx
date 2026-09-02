import React, { useState, useEffect } from 'react';
import { supabase } from './SupabaseClient'; // Ensure you have your initialized Supabase client
import AddPatientForm from './AddPatientForm';
import './CaregiverDashboard.css';

export default function CaregiverDashboard() {
    const [view, setView] = useState('dashboard'); // 'dashboard', 'addPatient'
    const [user, setUser] = useState(null);
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUserAndPatients();
    }, []);

    const fetchUserAndPatients = async () => {
        setLoading(true);
        // 1. Get authenticated caregiver session
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        if (user) {
            // 2. Fetch patients. RLS ensures we only get this caregiver's patients.
            const { data, error } = await supabase
                .from('patients')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setPatients(data);
            }
        }
        setLoading(false);
    };

    const handleRegenerateCode = async (patientId) => {
        const confirm = window.confirm("Are you sure? Regenerating the code will make the previous patient login code invalid.");
        if (!confirm) return;

        // Generate a new 6-character uppercase code in React (or ideally via RPC call to Supabase)
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let newCode = '';
        for (let i = 0; i < 6; i++) {
            newCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Update in Supabase. The Permanent ID remains completely unchanged.
        const { error } = await supabase
            .from('patients')
            .update({ login_code: newCode })
            .eq('id', patientId);

        if (!error) {
            fetchUserAndPatients(); // Refresh the list
        } else {
            alert("Failed to regenerate code. Please try again.");
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/'; // Redirect to home
    };

    if (loading) return <div style={{ padding: '3rem', textAlign: 'center' }}>Loading dashboard...</div>;

    if (view === 'addPatient') {
        return <AddPatientForm onBack={() => { setView('dashboard'); fetchUserAndPatients(); }} user={user} />;
    }

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="header-title">
                    <h1>🧠 NeuroPlay</h1>
                    <p className="header-subtitle">Welcome, Caregiver 👋 | Manage your patients and monitor cognitive well-being.</p>
                </div>
                <div className="header-actions">
                    <button>Profile</button>
                    <button onClick={handleLogout}>Logout</button>
                </div>
            </header>

            <div className="stats-grid">
                <div className="stat-card primary-action" onClick={() => setView('addPatient')}>
                    <h2>+ ADD PATIENT</h2>
                    <p style={{ margin: '0.5rem 0 0', opacity: 0.9 }}>Register a patient & generate credentials</p>
                </div>
                
                <div className="stat-card">
                    <h3>👥 My Patients</h3>
                    <p className="stat-value">{patients.length}</p>
                </div>

                <div className="stat-card">
                    <h3>📈 Patient Progress</h3>
                    <p className="stat-placeholder">Coming soon: Cognitive performance trends</p>
                </div>

                <div className="stat-card">
                    <h3>🔔 Alerts</h3>
                    <p className="stat-placeholder">Coming soon: Medicine & activity reminders</p>
                </div>
            </div>

            <h2 className="section-title">My Patients</h2>
            
            {patients.length === 0 ? (
                <div className="empty-state">
                    <p>You haven't added any patients yet.</p>
                    <button className="nav-btn" style={{ background: '#2F8B61' }} onClick={() => setView('addPatient')}>
                        + Add Your First Patient
                    </button>
                </div>
            ) : (
                <div className="patients-grid">
                    {patients.map(patient => (
                        <div key={patient.id} className="patient-card">
                            <div className="patient-card-header">
                                <span className="patient-avatar" role="img" aria-label="patient">👴</span>
                                <h3>{patient.full_name}</h3>
                            </div>
                            
                            <div className="patient-credentials">
                                <div className="credential-row">
                                    <span className="credential-label">Patient ID:</span>
                                    <span className="credential-value">{patient.patient_id}</span>
                                </div>
                                <div className="credential-row">
                                    <span className="credential-label">Login Code:</span>
                                    <span className="credential-value code">{patient.login_code}</span>
                                </div>
                            </div>

                            <div className="patient-actions">
                                <button className="btn-outline" onClick={() => navigator.clipboard.writeText(patient.login_code)}>
                                    📋 Copy Code
                                </button>
                                <button className="btn-outline" onClick={() => alert('Future Feature: View detailed patient profile & stats.')}>
                                    👁️ View Patient
                                </button>
                                <button className="btn-outline btn-warning" onClick={() => handleRegenerateCode(patient.id)}>
                                    🔄 Regenerate Code
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}