import React, { useState } from 'react';
import { supabase } from './SupabaseClient';
import './App.css'; 

export default function PatientLogin({ onBackToHome, onLoginSuccess }) {
    const [loginCode, setLoginCode] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const handleInputChange = (e) => {
        // Case-insensitive Normalization: Convert to uppercase, remove spaces/special chars, restrict to 6 chars
        const normalizedCode = e.target.value
            .replace(/[^a-zA-Z0-9]/g, '')
            .toUpperCase()
            .slice(0, 6);
        
        setLoginCode(normalizedCode);
        setErrorMsg(''); // Clear error on typing
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        if (loginCode.length !== 6) {
            setErrorMsg("Please enter a complete 6-character code.");
            setLoading(false);
            return;
        }

        // Validate code in Supabase
        const { data, error } = await supabase
            .from('patients')
            .select('id, patient_id, full_name, caregiver_id')
            .eq('login_code', loginCode)
            .eq('is_active', true)
            .single();

        if (error || !data) {
            setErrorMsg("Invalid code. Please check your credentials or ask your caregiver.");
            setLoading(false);
            return;
        }

        // Establish proper Patient Session mechanism. 
        // Note: For custom 6-digit pin flows, you typically generate a secure JWT via Edge Functions.
        // For standard React implementation without custom backend routing, you establish local state backed by secure DB queries.
        
        // Mock Session Creation (Replace with proper Supabase custom auth token flow in production)
        const patientSession = {
            role: 'patient',
            id: data.id,
            patient_id: data.patient_id,
            full_name: data.full_name,
            caregiver_id: data.caregiver_id,
            timestamp: new Date().getTime()
        };
        
        // Temporarily stored securely in sessionStorage rather than localStorage to clear on browser close.
        sessionStorage.setItem('neuroplay_patient_session', JSON.stringify(patientSession));
        
        setLoading(false);
        onLoginSuccess(data); // Route to Patient Home Page
    };

    return (
        <div className="auth-page-container">
            <div className="auth-wrapper" style={{ maxWidth: '450px', textAlign: 'center' }}>
                <button className="auth-link" onClick={onBackToHome} style={{ float: 'left' }}>← Back</button>
                <div style={{ clear: 'both', marginBottom: '2rem' }}></div>
                
                <div className="avatar" style={{ fontSize: '4rem', marginBottom: '1rem' }} role="img" aria-label="patient">👴</div>
                <h2 style={{ color: '#1a365d', marginBottom: '0.5rem' }}>Patient Login</h2>
                <p style={{ color: '#64748b', marginBottom: '2rem' }}>Enter Your 6-Character Patient Code</p>

                <form onSubmit={handleLogin}>
                    <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '16px', border: '2px solid #e2e8f0', marginBottom: '2rem' }}>
                        <input 
                            type="text" 
                            value={loginCode} 
                            onChange={handleInputChange} 
                            placeholder="A7K92P"
                            style={{ 
                                width: '100%', 
                                fontSize: '2.5rem', 
                                textAlign: 'center', 
                                letterSpacing: '8px', 
                                border: 'none', 
                                background: 'transparent',
                                outline: 'none',
                                fontWeight: 'bold',
                                color: '#2F70B5'
                            }} 
                        />
                    </div>

                    {errorMsg && <p style={{ color: '#e53e3e', fontWeight: '600', marginBottom: '1.5rem' }}>{errorMsg}</p>}

                    <button 
                        type="submit" 
                        className="btn-primary" 
                        style={{ background: '#2F70B5' }}
                        disabled={loginCode.length !== 6 || loading}
                    >
                        {loading ? 'AUTHENTICATING...' : '[ LOGIN ]'}
                    </button>
                </form>
            </div>
        </div>
    );
}