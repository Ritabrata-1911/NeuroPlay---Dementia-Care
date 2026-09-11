import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from './SupabaseClient';
import './App.css';
import './CaregiverAuth.css';

export default function PatientLogin({ onBackToHome, onLoginSuccess }) {
    const { t } = useTranslation();
    const [loginCode, setLoginCode] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef(null);

    // Auto-focus the real input on mount so typing works immediately
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Split into 6 chars for the visual boxes
    const codeChars = loginCode.split('').concat(Array(6).fill('')).slice(0, 6);

    const handleCodeChange = (e) => {
        const normalizedCode = e.target.value
            .replace(/[^a-zA-Z0-9]/g, '')
            .toUpperCase()
            .slice(0, 6);
        setLoginCode(normalizedCode);
        setErrorMsg('');
    };

    // Clicking anywhere on the digit track focuses the hidden input
    const focusInput = () => {
        inputRef.current?.focus();
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

        const { data, error } = await supabase.rpc('redeem_patient_code', {
            p_code: loginCode
        });

        if (error) {
            console.error("Detailed DB Error:", error);
        }

        if (error || !data || data.length === 0) {
            setErrorMsg(t('patientLogin.errors.invalidOrExpired'));
            setLoading(false);
            return;
        }

        const patientData = data[0];

        const patientSession = {
            role: 'patient',
            id: patientData.id,
            patient_id: patientData.patient_id,
            full_name: patientData.full_name,
            caregiver_id: patientData.caregiver_id,
            timestamp: new Date().getTime()
        };

        // Store session data persistently so it survives browser close/reopen
        // and page refreshes. Only a manual sign-out clears this.
        localStorage.setItem('neuroplay_patient_session', JSON.stringify(patientSession));

        // Tab-scoped flag: controls whether App.jsx auto-redirects to the
        // dashboard on startup. Dies when this tab/browser is closed, so new
        // tabs land on the home page first instead of jumping straight in.
        // The AUTH SCREEN GUARD still uses localStorage, so clicking
        // "Patient Login" from the home page skips code re-entry.
        sessionStorage.setItem('neuroplay_patient_active', 'true');

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
                    {/* Brand panel */}
                    <aside className="auth-brand-panel">
                        <div className="auth-brand-orb auth-brand-orb-1" aria-hidden="true" />
                        <div className="auth-brand-orb auth-brand-orb-2" aria-hidden="true" />
                        <div className="auth-brand-orb auth-brand-orb-3" aria-hidden="true" />

                        <div className="auth-brand-mark">
                            <div className="auth-brand-brain-wrap" aria-hidden="true">
                                <span className="auth-brand-brain-icon" role="img" aria-label="brain">🧠</span>
                            </div>
                            <span>{t('brand')}</span>
                        </div>

                        <h1 className="auth-brand-heading">{t('patientLogin.brandHeading')}</h1>
                        <p className="auth-brand-copy">{t('patientLogin.brandCopy')}</p>

                        <div className="auth-brand-divider" />

                        <ul className="auth-brand-list">
                            <li>{t('patientLogin.brandList.0')}</li>
                            <li>{t('patientLogin.brandList.1')}</li>
                            <li>{t('patientLogin.brandList.2')}</li>
                        </ul>
                    </aside>

                    {/* Form panel */}
                    <div className="auth-form-panel">
                        {errorMsg && (
                            <div className="auth-error-banner">⚠️ {errorMsg}</div>
                        )}

                        <form onSubmit={handleLogin}>
                            <h2 className="form-title">{t('patientLogin.formTitle')}</h2>
                            <p className="form-subtitle">{t('patientLogin.formSubtitle')}</p>

                            <div className="form-group">
                                <label htmlFor="loginCode">{t('patientLogin.loginCodeLabel')}</label>

                                <div
                                    className="code-input-shell"
                                    onClick={focusInput}
                                    style={{ position: 'relative', cursor: 'text' }}
                                >
                                    {/* Visual boxes — purely decorative */}
                                    <div
                                        className="code-input-track"
                                        aria-hidden="true"
                                    >
                                        {codeChars.map((ch, i) => (
                                            <div
                                                key={i}
                                                className={[
                                                    'code-digit-box',
                                                    ch ? 'filled' : '',
                                                    !ch && i === loginCode.length && isFocused ? 'empty-active' : '',
                                                ].filter(Boolean).join(' ')}
                                            >
                                                {ch}
                                            </div>
                                        ))}
                                    </div>

                                    {/* The REAL input — sits over the boxes, fully transparent */}
                                    <input
                                        ref={inputRef}
                                        id="loginCode"
                                        type="text"
                                        name="loginCode"
                                        value={loginCode}
                                        onChange={handleCodeChange}
                                        onFocus={() => setIsFocused(true)}
                                        onBlur={() => setIsFocused(false)}
                                        autoComplete="off"
                                        inputMode="text"
                                        maxLength={6}
                                        aria-label={t('patientLogin.loginCodeLabel')}
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            width: '100%',
                                            height: '100%',
                                            opacity: 0,
                                            cursor: 'text',
                                            fontSize: '1rem',
                                            zIndex: 2,
                                        }}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="btn-primary btn-patient"
                                style={{ marginTop: '1.25rem' }}
                                disabled={loading || loginCode.length < 6}
                            >
                                {loading ? t('patientLogin.submitting') : t('patientLogin.submit')}
                            </button>

                            <p style={{
                                marginTop: '1.25rem',
                                fontSize: '0.8rem',
                                textAlign: 'center',
                                color: 'var(--ca-mist)',
                                lineHeight: 1.5,
                            }}>
                                Don't have a code? Ask your caregiver to generate one from the dashboard.
                            </p>
                        </form>
                    </div>
                </div>

                <div className="auth-trust-row" aria-hidden="true">
                    <span className="auth-trust-chip">
                        <span className="auth-trust-chip-icon">🔒</span> Secure login
                    </span>
                    <span className="auth-trust-chip">
                        <span className="auth-trust-chip-icon">🧩</span> Fun &amp; friendly
                    </span>
                    <span className="auth-trust-chip">
                        <span className="auth-trust-chip-icon">✦</span> No password needed
                    </span>
                </div>
            </div>
        </div>
    );
}