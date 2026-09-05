import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from './SupabaseClient';
import './App.css';
import './CaregiverAuth.css';

export default function PatientLogin({ onBackToHome, onLoginSuccess }) {
    const { t } = useTranslation();
    const [loginCode, setLoginCode] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCodeChange = (e) => {
        // Case-insensitive Normalization: Convert to uppercase, remove spaces/special chars, restrict to 6 chars
        const normalizedCode = e.target.value
            .replace(/[^a-zA-Z0-9]/g, '')
            .toUpperCase()
            .slice(0, 6);

        setLoginCode(normalizedCode);
        setErrorMsg('');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        if (loginCode.length !== 6) {
            setErrorMsg(t('patientLogin.errors.incomplete'));
            setLoading(false);
            return;
        }

        // Call the secure RPC to validate, burn the code, and return patient data
        const { data, error } = await supabase.rpc('redeem_patient_code', {
            p_code: loginCode
        });

        // 👇 DIAGNOSTIC LOG ADDED HERE 👇
        if (error) {
            console.error("Detailed DB Error:", error);
        }

        // The RPC returns an array of rows. We expect exactly 1 if successful.
        if (error || !data || data.length === 0) {
            setErrorMsg(t('patientLogin.errors.invalidOrExpired'));
            setLoading(false);
            return;
        }

        const patientData = data[0];

        // Create secure patient session
        const patientSession = {
            role: 'patient',
            id: patientData.id,
            patient_id: patientData.patient_id,
            full_name: patientData.full_name,
            caregiver_id: patientData.caregiver_id,
            timestamp: new Date().getTime()
        };

        sessionStorage.setItem('neuroplay_patient_session', JSON.stringify(patientSession));

        setLoading(false);
        onLoginSuccess(patientData);
    };

    return (
        <div className="auth-page-container">
            <div className="auth-shell">
                <button className="auth-back-btn" onClick={onBackToHome}>
                    ← {t('patientLogin.backToHome')}
                </button>

                <div className="auth-card">
                    {/* Brand / context panel */}
                    <aside className="auth-brand-panel">
                        <div className="auth-brand-mark">
                            <span role="img" aria-label="brain">🧠</span>
                            <span>{t('brand')}</span>
                        </div>

                        <h1 className="auth-brand-heading">{t('patientLogin.brandHeading')}</h1>
                        <p className="auth-brand-copy">
                            {t('patientLogin.brandCopy')}
                        </p>

                        <ul className="auth-brand-list">
                            <li>{t('patientLogin.brandList.0')}</li>
                            <li>{t('patientLogin.brandList.1')}</li>
                            <li>{t('patientLogin.brandList.2')}</li>
                        </ul>
                    </aside>

                    {/* Form panel */}
                    <div className="auth-form-panel">
                        {errorMsg && (
                            <div className="auth-error-banner">
                                ⚠️ {errorMsg}
                            </div>
                        )}

                        <form onSubmit={handleLogin}>
                            <h2 className="form-title">{t('patientLogin.formTitle')}</h2>
                            <p className="form-subtitle">{t('patientLogin.formSubtitle')}</p>

                            <div className="form-group">
                                <label htmlFor="loginCode">{t('patientLogin.loginCodeLabel')}</label>
                                <input
                                    id="loginCode"
                                    type="text"
                                    name="loginCode"
                                    value={loginCode}
                                    onChange={handleCodeChange}
                                    placeholder={t('patientLogin.loginCodePlaceholder')}
                                    className="form-input"
                                    autoComplete="off"
                                    style={{
                                        fontSize: '1.6rem',
                                        textAlign: 'center',
                                        letterSpacing: '6px',
                                        fontWeight: 700,
                                        color: 'var(--primary-blue)',
                                        padding: '1rem',
                                    }}
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn-primary btn-patient"
                                style={{ marginTop: '0.5rem' }}
                                disabled={loading}
                            >
                                {loading ? t('patientLogin.submitting') : t('patientLogin.submit')}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}