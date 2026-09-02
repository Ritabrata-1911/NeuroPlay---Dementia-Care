// src/CaregiverAuth.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './SupabaseClient';
import './CaregiverAuth.css';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const today = new Date();
const CURRENT_YEAR = today.getFullYear();
const CURRENT_MONTH = today.getMonth() + 1; // 1-12
const CURRENT_DAY = today.getDate();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;
const PIN_REGEX = /^\d{6}$/;
const DIGIT_ONLY_FIELDS = ['phone', 'altPhone', 'emergencyPhone', 'pin'];

const daysInMonth = (year, month) => {
    if (!month) return 31;
    const y = year || CURRENT_YEAR;
    return new Date(y, month, 0).getDate();
};

const maxMonthForYear = (year) => (Number(year) === CURRENT_YEAR ? CURRENT_MONTH : 12);

const maxDayForYearMonth = (year, month) => {
    const total = daysInMonth(Number(year), Number(month));
    if (Number(year) === CURRENT_YEAR && Number(month) === CURRENT_MONTH) {
        return Math.min(total, CURRENT_DAY);
    }
    return total;
};

const calculateAge = (dobString) => {
    if (!dobString) return null;
    const dob = new Date(dobString);
    if (Number.isNaN(dob.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
        age--;
    }
    return age;
};

// Copy shown on the brand panel, keyed by the current view
const BRAND_COPY = {
    login: {
        heading: 'Welcome back',
        body: "Sign in to monitor your patient's progress and manage their care.",
    },
    'forgot-password': {
        heading: 'Reset password',
        body: "We will send you a secure link to reset your password.",
    },
    'reset-password': {
        heading: 'Choose a new password',
        body: "Create a new password for your NeuroPlay caregiver account.",
    },
    'register-1': {
        heading: 'Caregiver Portal',
        body: "Monitor your patient's progress, get real-time alerts, and access caregiver resources — all in one place.",
    },
    'register-2': {
        heading: 'Almost there',
        body: 'A few more details so we can set up alerts and emergency contacts correctly.',
    },
    success: {
        heading: 'You are all set',
        body: 'Your account is ready. Sign in to start monitoring your patient\u2019s care.',
    },
};

export default function CaregiverAuth({ onBackToHome, onLoginSuccess }) {
    const [view, setView] = useState('login'); // 'login', 'forgot-password', 'reset-password', 'register-1', 'register-2', 'success'
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({});
    const [showAgeAlert, setShowAgeAlert] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [authError, setAuthError] = useState(null);
    const [authSuccessMessage, setAuthSuccessMessage] = useState(null);
    const [needsEmailVerification, setNeedsEmailVerification] = useState(false);

    const [formData, setFormData] = useState({
        email: '', password: '', confirmPassword: '',
        fullName: '', dob: '', gender: '', phone: '', altPhone: '',
        address: '', city: '', state: '', pin: '', country: '',
        relationship: '', experience: '', emergencyName: '', emergencyPhone: '',
        confirmInfo: false
    });

    // Separate day/month/year selects for DOB — lets us jump straight to a year
    // (no slow native-calendar scrolling) and structurally blocks future dates.
    const [dobParts, setDobParts] = useState({ day: '', month: '', year: '' });

    // Detect when Supabase sends the user back to the app after clicking
    // the password-reset link in their email.
    useEffect(() => {
        const {
            data: { subscription }
        } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setAuthError(null);
                setAuthSuccessMessage(null);
                setFormData(prev => ({
                    ...prev,
                    password: '',
                    confirmPassword: ''
                }));
                setView('reset-password');
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        const { day, month, year } = dobParts;
        if (day && month && year) {
            const mm = String(month).padStart(2, '0');
            const dd = String(day).padStart(2, '0');
            setFormData(prev => ({ ...prev, dob: `${year}-${mm}-${dd}` }));
        } else {
            setFormData(prev => ({ ...prev, dob: '' }));
        }
    }, [dobParts]);

    const yearOptions = [];
    for (let y = CURRENT_YEAR; y >= CURRENT_YEAR - 100; y--) yearOptions.push(y);

    const monthOptions = Array.from(
        { length: dobParts.year ? maxMonthForYear(dobParts.year) : 12 },
        (_, i) => i + 1
    );

    const dayOptions = Array.from(
        { length: maxDayForYearMonth(dobParts.year || CURRENT_YEAR, dobParts.month || 12) },
        (_, i) => i + 1
    );

    const handleDobPartChange = (part, value) => {
        setDobParts(prev => {
            const updated = { ...prev, [part]: value };
            // If the year just became "this year", clamp month/day so they can't stay in the future
            if (Number(updated.year) === CURRENT_YEAR && Number(updated.month) > CURRENT_MONTH) {
                updated.month = String(CURRENT_MONTH);
            }
            const maxDay = updated.year && updated.month
                ? maxDayForYearMonth(updated.year, updated.month)
                : 31;
            if (updated.day && Number(updated.day) > maxDay) {
                updated.day = String(maxDay);
            }
            return updated;
        });
        if (errors.dob) setErrors(prev => ({ ...prev, dob: null }));
        if (authError) setAuthError(null);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let newValue = type === 'checkbox' ? checked : value;

        if (DIGIT_ONLY_FIELDS.includes(name) && typeof newValue === 'string') {
            newValue = newValue.replace(/\D/g, '');
        }

        setFormData(prev => ({
            ...prev,
            [name]: newValue
        }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
        if (authError) setAuthError(null);
    };

    const getPasswordStrength = (pass) => {
        if (!pass) return '';
        const hasLower = /[a-z]/.test(pass);
        const hasUpper = /[A-Z]/.test(pass);
        const hasNumber = /[0-9]/.test(pass);
        const hasSpecial = /[^A-Za-z0-9]/.test(pass);
        const hasLetter = hasLower || hasUpper;

        const meetsMin = pass.length >= 6 && hasLetter && hasNumber && hasSpecial;
        if (!meetsMin) return 'Weak';

        let score = 0;
        if (pass.length >= 10) score++;
        if (hasLower && hasUpper) score++;
        if (pass.length >= 14) score++;

        return score >= 2 ? 'Strong' : 'Medium';
    };

    const validateStep1 = () => {
        let newErrors = {};

        if (!formData.email) {
            newErrors.email = "Email is required.";
        } else if (!EMAIL_REGEX.test(formData.email)) {
            newErrors.email = "Please enter a valid email address (e.g. name@example.com).";
        }

        const hasLetter = /[a-zA-Z]/.test(formData.password);
        const hasNumber = /[0-9]/.test(formData.password);
        const hasSpecial = /[^A-Za-z0-9]/.test(formData.password);

        if (!formData.password) {
            newErrors.password = "Password is required.";
        } else if (formData.password.length < 6 || !hasLetter || !hasNumber || !hasSpecial) {
            newErrors.password = "Password must be at least 6 characters and include a letter, a number, and a special character.";
        }

        if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match.";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep2 = () => {
        let newErrors = {};
        const requiredFields = ['fullName', 'dob', 'phone', 'pin', 'relationship', 'emergencyName', 'emergencyPhone'];
        requiredFields.forEach(field => {
            if (!formData[field]) newErrors[field] = "This field is required.";
        });

        let underage = false;
        if (formData.dob) {
            const age = calculateAge(formData.dob);
            if (age !== null && age < 18) {
                newErrors.dob = "You must be at least 18 years old to register as a caregiver.";
                underage = true;
            }
        }

        if (formData.phone && !PHONE_REGEX.test(formData.phone)) {
            newErrors.phone = "Enter a valid 10-digit phone number.";
        }
        if (formData.altPhone && !PHONE_REGEX.test(formData.altPhone)) {
            newErrors.altPhone = "Enter a valid 10-digit phone number.";
        }
        if (formData.emergencyPhone && !PHONE_REGEX.test(formData.emergencyPhone)) {
            newErrors.emergencyPhone = "Enter a valid 10-digit phone number.";
        }

        if (formData.pin && !PIN_REGEX.test(formData.pin)) {
            newErrors.pin = "Enter a valid 6-digit PIN code.";
        }

        if (!formData.confirmInfo) newErrors.confirmInfo = "You must confirm the information is correct.";

        setErrors(newErrors);
        if (underage) setShowAgeAlert(true);

        return Object.keys(newErrors).length === 0;
    };

    const handleNext = async (e) => {
        e.preventDefault();
        if (!validateStep1()) return;

        setIsLoading(true);
        setAuthError(null);

        const trimmedEmail = formData.email.toLowerCase().trim();

        // Test if the email already exists using a preliminary signup check
        const { data, error } = await supabase.auth.signUp({
            email: trimmedEmail,
            password: formData.password,
            options: {
                data: { role: 'temp_check' }
            }
        });

        setIsLoading(false);

        if (error) {
            setAuthError(error.message);
        } else if (data?.user && data.user.identities && data.user.identities.length === 0) {
            setAuthError("An account with this email already exists. Please log in instead.");
        } else {
            setAuthError(null);
            setView('register-2');
        }
    };

    const handleCreateAccount = async (e) => {
        e.preventDefault();
        if (!validateStep2()) return;

        setIsLoading(true);
        setAuthError(null);

        const userArea = `${formData.city}, ${formData.state}`.trim();
        const trimmedEmail = formData.email.toLowerCase().trim();

        // Finalize or update user details with full profile metadata
        const { data, error } = await supabase.auth.signUp({
            email: trimmedEmail,
            password: formData.password,
            options: {
                data: {
                    full_name: formData.fullName,
                    role: 'caregiver',
                    phone_number: formData.phone,
                    alt_phone: formData.altPhone,
                    dob: formData.dob,
                    gender: formData.gender,
                    area: userArea,
                    address: formData.address,
                    pin: formData.pin,
                    country: formData.country,
                    relationship: formData.relationship,
                    experience: formData.experience,
                    emergency_name: formData.emergencyName,
                    emergency_phone: formData.emergencyPhone
                }
            }
        });

        setIsLoading(false);

        if (error) {
            setAuthError(error.message);
        } else {
            setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));

            if (data.user && !data.session) {
                setNeedsEmailVerification(true);
            }
            setView('success');
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();

        if (!EMAIL_REGEX.test(formData.email)) {
            setAuthError("Please enter a valid email address.");
            return;
        }

        setIsLoading(true);
        setAuthError(null);

        const { data, error } = await supabase.auth.signInWithPassword({
            email: formData.email.toLowerCase().trim(),
            password: formData.password
        });

        setIsLoading(false);

        if (error) {
            setAuthError(error.message);
        } else {
            setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));

            if (onLoginSuccess) {
                onLoginSuccess(data.session);
            } else {
                alert(`Welcome back, ${data.user.email}!`);
            }
        }
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();

        const email = formData.email.toLowerCase().trim();

        if (!EMAIL_REGEX.test(email)) {
            setAuthError("Please enter a valid email address.");
            return;
        }

        setIsLoading(true);
        setAuthError(null);
        setAuthSuccessMessage(null);

        // Supabase sends the password-reset email.
        // The user will be returned to this app after clicking the link.
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin
        });

        setIsLoading(false);

        if (error) {
            setAuthError(error.message);
            return;
        }

        setAuthSuccessMessage(
            "Password reset instructions have been sent to your email. Please check your inbox and click the reset link."
        );
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();

        const password = formData.password;
        const confirmPassword = formData.confirmPassword;

        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[^A-Za-z0-9]/.test(password);

        if (
            password.length < 6 ||
            !hasLetter ||
            !hasNumber ||
            !hasSpecial
        ) {
            setAuthError(
                "Password must be at least 6 characters and include a letter, a number, and a special character."
            );
            return;
        }

        if (password !== confirmPassword) {
            setAuthError("Passwords do not match.");
            return;
        }

        setIsLoading(true);
        setAuthError(null);
        setAuthSuccessMessage(null);

        const { error } = await supabase.auth.updateUser({
            password
        });

        setIsLoading(false);

        if (error) {
            setAuthError(error.message);
            return;
        }

        // Clear the temporary password values.
        setFormData(prev => ({
            ...prev,
            password: '',
            confirmPassword: ''
        }));

        // End the recovery session and return to login.
        await supabase.auth.signOut();

        setAuthSuccessMessage(
            "Your password has been reset successfully. You can now log in with your new password."
        );
        setView('login');
    };

    const brand = BRAND_COPY[view] || BRAND_COPY.login;
    const isRegistering = view === 'register-1' || view === 'register-2';

    return (
        <div className="auth-shell">
            <button className="auth-back-btn" onClick={onBackToHome}>
                ← Back to Home
            </button>

            <div className="auth-card">
                <aside className="auth-brand-panel">
                    <div className="auth-brand-mark">
                        <span role="img" aria-label="brain">🧠</span>
                        <span>NeuroPlay</span>
                    </div>

                    <h1 className="auth-brand-heading">{brand.heading}</h1>
                    <p className="auth-brand-copy">{brand.body}</p>

                    {!isRegistering && view !== 'success' && view !== 'forgot-password' && (
                        <ul className="auth-brand-list">
                            <li>Real-time activity dashboards</li>
                            <li>Medication &amp; appointment reminders</li>
                            <li>24/7 caregiver support resources</li>
                        </ul>
                    )}

                    {isRegistering && (
                        <div className="progress-indicator">
                            <div className={`progress-step ${view === 'register-1' ? 'active' : 'done'}`}>
                                <span className="progress-circle">{view === 'register-1' ? '1' : '✓'}</span>
                                <span>Account</span>
                            </div>
                            <div className="progress-line" />
                            <div className={`progress-step ${view === 'register-2' ? 'active' : ''}`}>
                                <span className="progress-circle">2</span>
                                <span>Details</span>
                            </div>
                        </div>
                    )}
                </aside>

                <div className="auth-form-panel">
                    {authError && (
                        <div className="auth-error-banner">
                            ⚠️ {authError}
                        </div>
                    )}

                    {authSuccessMessage && (
                        <div className="auth-success-banner" style={{ background: '#e6f4ea', color: '#137333', padding: '10px', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                            ✅ {authSuccessMessage}
                        </div>
                    )}

                    {showAgeAlert && (
                        <div className="modal-overlay" onClick={() => setShowAgeAlert(false)}>
                            <div
                                className="modal-content"
                                style={{ maxWidth: '400px', textAlign: 'center' }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button className="modal-close-btn" onClick={() => setShowAgeAlert(false)}>✕</button>
                                <div className="modal-body">
                                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚠️</div>
                                    <h2>Age Restriction</h2>
                                    <p>You must be at least 18 years old to register as a caregiver on NeuroPlay.</p>
                                    <button
                                        className="btn-primary"
                                        style={{ marginTop: '1rem' }}
                                        onClick={() => setShowAgeAlert(false)}
                                    >
                                        Okay
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {view === 'login' && (
                        <form onSubmit={handleLogin}>
                            <h2 className="form-title">Caregiver login</h2>

                            <div className="form-group">
                                <label>Email</label>
                                <input type="email" name="email" value={formData.email} onChange={handleChange} className="form-input" required placeholder="you@example.com" />
                            </div>

                            <div className="form-group">
                                <label>Password</label>
                                <div className="input-wrapper">
                                    <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} className="form-input" required placeholder="Enter your password" />
                                    <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                        {showPassword ? '👁️‍🗨️' : '👁️'}
                                    </button>
                                </div>
                            </div>

                            <button type="submit" className="btn-primary" disabled={isLoading}>
                                {isLoading ? 'Logging in…' : 'Log in'}
                            </button>

                            <div className="auth-links">
                                <button type="button" className="auth-link" onClick={() => { setView('forgot-password'); setAuthError(null); setAuthSuccessMessage(null); }}>Forgot password?</button>
                                <button type="button" className="auth-link" onClick={() => setView('register-1')}>Create an account</button>
                            </div>
                        </form>
                    )}

                    {view === 'forgot-password' && (
                        <form onSubmit={handleForgotPassword}>
                            <h2 className="form-title">Reset password</h2>
                            <p className="form-subtitle">Enter your registered email address and we'll send you a link to reset your password.</p>

                            <div className="form-group">
                                <label>Email</label>
                                <input type="email" name="email" value={formData.email} onChange={handleChange} className="form-input" required placeholder="you@example.com" />
                            </div>

                            <button type="submit" className="btn-primary" disabled={isLoading}>
                                {isLoading ? 'Sending link…' : 'Send password reset email'}
                            </button>

                            <div className="auth-links auth-links-center" style={{ marginTop: '1rem' }}>
                                <button type="button" className="auth-link" onClick={() => { setView('login'); setAuthError(null); setAuthSuccessMessage(null); }}>← Back to login</button>
                            </div>
                        </form>
                    )}

                    {view === 'reset-password' && (
                        <form onSubmit={handleResetPassword}>
                            <h2 className="form-title">Create a new password</h2>
                            <p className="form-subtitle">
                                Enter a new password for your caregiver account.
                            </p>

                            <div className="form-group">
                                <label htmlFor="reset-password">
                                    New password <span className="required">*</span>
                                </label>

                                <div className="input-wrapper">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        id="reset-password"
                                        name="password"
                                        className="form-input"
                                        placeholder="Create a new password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                    />

                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? '👁️‍🗨️' : '👁️'}
                                    </button>
                                </div>

                                <span className="field-hint">
                                    Min 6 characters, with at least one letter, one number, and one special character.
                                </span>
                            </div>

                            <div className="form-group">
                                <label htmlFor="reset-confirm-password">
                                    Confirm new password <span className="required">*</span>
                                </label>

                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="reset-confirm-password"
                                    name="confirmPassword"
                                    className="form-input"
                                    placeholder="Re-enter your new password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Updating password…' : 'Update password'}
                            </button>

                            <div className="auth-links auth-links-center" style={{ marginTop: '1rem' }}>
                                <button
                                    type="button"
                                    className="auth-link"
                                    onClick={() => {
                                        setView('login');
                                        setAuthError(null);
                                        setAuthSuccessMessage(null);
                                        setFormData(prev => ({
                                            ...prev,
                                            password: '',
                                            confirmPassword: ''
                                        }));
                                    }}
                                >
                                    ← Back to login
                                </button>
                            </div>
                        </form>
                    )}

                    {view === 'register-1' && (
                        <form onSubmit={handleNext}>
                            <h2 className="form-title">Account credentials</h2>

                            <div className="form-group">
                                <label htmlFor="email">Email ID <span className="required">*</span></label>
                                <input type="email" id="email" name="email" className="form-input" placeholder="Enter your email address" value={formData.email} onChange={handleChange} required />
                                {errors.email && <span className="error-message">{errors.email}</span>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">Password <span className="required">*</span></label>
                                <div className="input-wrapper">
                                    <input type={showPassword ? "text" : "password"} id="password" name="password" className="form-input" placeholder="Create a password" value={formData.password} onChange={handleChange} required />
                                    <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                        {showPassword ? '👁️‍🗨️' : '👁️'}
                                    </button>
                                </div>
                                <span className="field-hint">
                                    Min 6 characters, with at least one letter, one number, and one special character.
                                </span>
                                {formData.password && (
                                    <span className={`password-strength strength-${getPasswordStrength(formData.password).toLowerCase()}`}>
                                        Strength: {getPasswordStrength(formData.password)}
                                    </span>
                                )}
                                {errors.password && <span className="error-message">{errors.password}</span>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="confirmPassword">Confirm password <span className="required">*</span></label>
                                <input type={showPassword ? "text" : "password"} id="confirmPassword" name="confirmPassword" className="form-input" placeholder="Re-enter your password" value={formData.confirmPassword} onChange={handleChange} required />
                                {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
                            </div>

                            <button type="submit" className="btn-primary" style={{ marginTop: '1.5rem' }} disabled={isLoading}>
                                {isLoading ? 'Checking...' : 'Next →'}
                            </button>

                            <div className="auth-links auth-links-center">
                                <button type="button" className="auth-link" onClick={() => setView('login')}>Already have an account? Log in</button>
                            </div>
                        </form>
                    )}

                    {view === 'register-2' && (
                        <form onSubmit={handleCreateAccount}>
                            <h2 className="form-title">Caregiver details</h2>
                            <p className="form-subtitle">Tell us a little about yourself.</p>

                            <h3 className="section-title"><span className="section-badge section-badge-blue">1</span>Personal information</h3>
                            <div className="form-grid">
                                <div className="form-group full-width">
                                    <label>Full name <span className="required">*</span></label>
                                    <input type="text" name="fullName" className="form-input" value={formData.fullName} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Date of birth <span className="required">*</span></label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <select
                                            className="form-select"
                                            value={dobParts.day}
                                            onChange={(e) => handleDobPartChange('day', e.target.value)}
                                            aria-label="Day of birth"
                                        >
                                            <option value="">Day</option>
                                            {dayOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                        <select
                                            className="form-select"
                                            value={dobParts.month}
                                            onChange={(e) => handleDobPartChange('month', e.target.value)}
                                            aria-label="Month of birth"
                                        >
                                            <option value="">Month</option>
                                            {monthOptions.map(m => <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>)}
                                        </select>
                                        <select
                                            className="form-select"
                                            value={dobParts.year}
                                            onChange={(e) => handleDobPartChange('year', e.target.value)}
                                            aria-label="Year of birth"
                                        >
                                            <option value="">Year</option>
                                            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                    {errors.dob && <span className="error-message">{errors.dob}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Gender</label>
                                    <select name="gender" className="form-select" value={formData.gender} onChange={handleChange}>
                                        <option value="">Select...</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                        <option value="Prefer not to say">Prefer not to say</option>
                                    </select>
                                </div>
                            </div>

                            <h3 className="section-title"><span className="section-badge section-badge-green">2</span>Contact information</h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Phone number <span className="required">*</span></label>
                                    <input type="tel" name="phone" className="form-input" value={formData.phone} onChange={handleChange} maxLength={10} inputMode="numeric" required />
                                    {errors.phone && <span className="error-message">{errors.phone}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Alternate phone (optional)</label>
                                    <input type="tel" name="altPhone" className="form-input" value={formData.altPhone} onChange={handleChange} maxLength={10} inputMode="numeric" />
                                    {errors.altPhone && <span className="error-message">{errors.altPhone}</span>}
                                </div>
                                <div className="form-group full-width">
                                    <label>House/street address</label>
                                    <textarea name="address" className="form-textarea" rows="2" value={formData.address} onChange={handleChange}></textarea>
                                </div>
                                <div className="form-group">
                                    <label>City</label>
                                    <input type="text" name="city" className="form-input" value={formData.city} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label>State</label>
                                    <input type="text" name="state" className="form-input" value={formData.state} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label>PIN code <span className="required">*</span></label>
                                    <input type="text" name="pin" className="form-input" value={formData.pin} onChange={handleChange} maxLength={6} inputMode="numeric" required />
                                    {errors.pin && <span className="error-message">{errors.pin}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Country</label>
                                    <input type="text" name="country" className="form-input" value={formData.country} onChange={handleChange} />
                                </div>
                            </div>

                            <h3 className="section-title"><span className="section-badge section-badge-navy">3</span>Caregiver information</h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Relationship to patient <span className="required">*</span></label>
                                    <select name="relationship" className="form-select" value={formData.relationship} onChange={handleChange} required>
                                        <option value="">Select...</option>
                                        <option value="Family Member">Family Member</option>
                                        <option value="Professional Caregiver">Professional Caregiver</option>
                                        <option value="Nurse">Nurse</option>
                                        <option value="Doctor">Doctor</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Years of experience</label>
                                    <input type="number" name="experience" className="form-input" min="0" value={formData.experience} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label>Emergency contact name <span className="required">*</span></label>
                                    <input type="text" name="emergencyName" className="form-input" value={formData.emergencyName} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Emergency contact phone <span className="required">*</span></label>
                                    <input type="tel" name="emergencyPhone" className="form-input" value={formData.emergencyPhone} onChange={handleChange} maxLength={10} inputMode="numeric" required />
                                    {errors.emergencyPhone && <span className="error-message">{errors.emergencyPhone}</span>}
                                </div>
                            </div>

                            <div className="checkbox-group">
                                <input type="checkbox" id="confirmInfo" name="confirmInfo" checked={formData.confirmInfo} onChange={handleChange} />
                                <label htmlFor="confirmInfo">I confirm that the information provided is correct. <span className="required">*</span></label>
                            </div>
                            {errors.confirmInfo && <span className="error-message" style={{ display: 'block', marginTop: '-1rem', marginBottom: '1rem' }}>{errors.confirmInfo}</span>}

                            <div className="btn-group">
                                <button type="button" className="btn-secondary" onClick={() => setView('register-1')} disabled={isLoading}>← Back</button>
                                <button type="submit" className="btn-primary" disabled={isLoading}>
                                    {isLoading ? 'Creating account…' : 'Create account'}
                                </button>
                            </div>
                        </form>
                    )}

                    {view === 'success' && (
                        <div className="success-screen">
                            <div className="success-icon">🎉</div>
                            <h2 className="form-title">Account created</h2>
                            {needsEmailVerification ? (
                                <p className="form-subtitle">Please check your inbox to verify your email address before logging in.</p>
                            ) : (
                                <p className="form-subtitle">Welcome to NeuroPlay. Your caregiver account is ready.</p>
                            )}
                            <button
                                className="btn-primary"
                                style={{ marginTop: '1.5rem' }}
                                onClick={() => {
                                    setView('login');
                                    setNeedsEmailVerification(false);
                                    setAuthSuccessMessage(null);
                                }}
                            >
                                Proceed to Log in
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}