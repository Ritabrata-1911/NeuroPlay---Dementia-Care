// src/CaregiverAuth.jsx
import React, { useState } from 'react';
import { supabase } from './SupabaseClient';
import './CaregiverAuth.css';

export default function CaregiverAuth({ onBackToHome, onLoginSuccess }) {
    const [view, setView] = useState('login'); // 'login', 'register-1', 'register-2', 'success'
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({});
    
    const [isLoading, setIsLoading] = useState(false);
    const [authError, setAuthError] = useState(null);
    const [needsEmailVerification, setNeedsEmailVerification] = useState(false);

    const [formData, setFormData] = useState({
        email: '', password: '', confirmPassword: '',
        fullName: '', dob: '', gender: '', phone: '', altPhone: '',
        address: '', city: '', state: '', pin: '', country: '',
        relationship: '', experience: '', emergencyName: '', emergencyPhone: '',
        confirmInfo: false
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
        if (authError) setAuthError(null);
    };

    const getPasswordStrength = (pass) => {
        if (!pass) return '';
        if (pass.length < 6) return 'Weak';
        if (pass.length >= 8 && /[A-Z]/.test(pass) && /[0-9]/.test(pass)) return 'Strong';
        return 'Medium';
    };

    const validateStep1 = () => {
        let newErrors = {};
        if (!formData.email.includes('@')) newErrors.email = "Please enter a valid email.";
        if (formData.password.length < 6) newErrors.password = "Password must be at least 6 characters.";
        if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match.";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep2 = () => {
        let newErrors = {};
        const requiredFields = ['fullName', 'dob', 'phone', 'relationship', 'emergencyName', 'emergencyPhone'];
        requiredFields.forEach(field => {
            if (!formData[field]) newErrors[field] = "This field is required.";
        });
        if (!formData.confirmInfo) newErrors.confirmInfo = "You must confirm the information is correct.";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = (e) => {
        e.preventDefault();
        if (validateStep1()) setView('register-2');
    };

    const handleCreateAccount = async (e) => {
        e.preventDefault();
        if (!validateStep2()) return;

        setIsLoading(true);
        setAuthError(null);

        const userArea = `${formData.city}, ${formData.state}`.trim();

        const { data, error } = await supabase.auth.signUp({
            email: formData.email.toLowerCase().trim(),
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
            // Clear passwords from memory for security
            setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));

            if (data.user && !data.session) {
                setNeedsEmailVerification(true);
            }
            setView('success');
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
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
            // Clear passwords from memory for security
            setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));

            if (onLoginSuccess) {
                onLoginSuccess(data.session);
            } else {
                alert(`Welcome back, ${data.user.email}!`);
            }
        }
    };

    return (
        <div className="auth-wrapper">
            <button className="auth-link" onClick={onBackToHome} style={{ marginBottom: '1rem' }}>
                ← Back to Home
            </button>

            {authError && (
                <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '5px', marginBottom: '1rem' }}>
                    ⚠️ {authError}
                </div>
            )}

            {/* LOGIN VIEW */}
            {view === 'login' && (
                <form onSubmit={handleLogin}>
                    <div className="auth-header">
                        <h2>👩‍⚕️ Caregiver Login</h2>
                        <p className="auth-subtitle">Welcome back to CareConnect</p>
                    </div>

                    <div className="form-group">
                        <label>Email</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="form-input" required placeholder="Enter Email" />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <div className="input-wrapper">
                            <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} className="form-input" required placeholder="Enter Password" />
                            <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? '👁️‍🗨️' : '👁️'}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="btn-primary" disabled={isLoading}>
                        {isLoading ? 'LOGGING IN...' : 'LOGIN'}
                    </button>

                    <div className="auth-links">
                        <button type="button" className="auth-link">Forgot Password?</button>
                        <button type="button" className="auth-link" onClick={() => setView('register-1')}>Don't have an account? Create Account</button>
                    </div>
                </form>
            )}

            {/* REGISTRATION STEP 1 */}
            {view === 'register-1' && (
                <form onSubmit={handleNext}>
                    <h2>Step 1: Account Credentials</h2>
                    
                    <div className="form-group">
                        <label htmlFor="email">Email ID <span className="required">*</span></label>
                        <input type="email" id="email" name="email" className="form-input" placeholder="Enter your email address" value={formData.email} onChange={handleChange} required />
                        {errors.email && <span className="error-message">{errors.email}</span>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password <span className="required">*</span></label>
                        <div className="input-wrapper">
                            <input type={showPassword ? "text" : "password"} id="password" name="password" className="form-input" placeholder="Create a password" value={formData.password} onChange={handleChange} required />
                            <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? '👁️‍🗨️' : '👁️'}
                            </button>
                        </div>
                        {formData.password && (
                            <span className={`password-strength strength-${getPasswordStrength(formData.password).toLowerCase()}`}>
                                Strength: {getPasswordStrength(formData.password)}
                            </span>
                        )}
                        {errors.password && <span className="error-message">{errors.password}</span>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password <span className="required">*</span></label>
                        <input type={showPassword ? "text" : "password"} id="confirmPassword" name="confirmPassword" className="form-input" placeholder="Re-enter your password" value={formData.confirmPassword} onChange={handleChange} required />
                        {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
                    </div>

                    <button type="submit" className="btn-primary" style={{ marginTop: '2rem' }}>NEXT →</button>

                    <div className="auth-links" style={{ justifyContent: 'center' }}>
                        <button type="button" className="auth-link" onClick={() => setView('login')}>Already have an account? Login</button>
                    </div>
                </form>
            )}

            {/* REGISTRATION STEP 2 */}
            {view === 'register-2' && (
                <form onSubmit={handleCreateAccount}>
                    <div className="auth-header">
                        <h2>Caregiver Details</h2>
                        <p className="auth-subtitle">Tell us a little about yourself.</p>
                    </div>

                    <h3 className="section-title">Personal Information</h3>
                    <div className="form-grid">
                        <div className="form-group full-width">
                            <label>Full Name <span className="required">*</span></label>
                            <input type="text" name="fullName" className="form-input" value={formData.fullName} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>Date of Birth <span className="required">*</span></label>
                            <input type="date" name="dob" className="form-input" value={formData.dob} onChange={handleChange} required />
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

                    <h3 className="section-title">Contact Information</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Phone Number <span className="required">*</span></label>
                            <input type="tel" name="phone" className="form-input" value={formData.phone} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>Alternate Phone (Optional)</label>
                            <input type="tel" name="altPhone" className="form-input" value={formData.altPhone} onChange={handleChange} />
                        </div>
                        <div className="form-group full-width">
                            <label>House/Street Address</label>
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
                            <label>PIN/ZIP Code</label>
                            <input type="text" name="pin" className="form-input" value={formData.pin} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label>Country</label>
                            <input type="text" name="country" className="form-input" value={formData.country} onChange={handleChange} />
                        </div>
                    </div>

                    <h3 className="section-title">Caregiver Information</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Relationship to Patient <span className="required">*</span></label>
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
                            <label>Years of Experience</label>
                            <input type="number" name="experience" className="form-input" min="0" value={formData.experience} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label>Emergency Contact Name <span className="required">*</span></label>
                            <input type="text" name="emergencyName" className="form-input" value={formData.emergencyName} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>Emergency Contact Phone <span className="required">*</span></label>
                            <input type="tel" name="emergencyPhone" className="form-input" value={formData.emergencyPhone} onChange={handleChange} required />
                        </div>
                    </div>

                    <div className="checkbox-group">
                        <input type="checkbox" id="confirmInfo" name="confirmInfo" checked={formData.confirmInfo} onChange={handleChange} />
                        <label htmlFor="confirmInfo">I confirm that the information provided is correct. <span className="required">*</span></label>
                    </div>
                    {errors.confirmInfo && <span className="error-message" style={{ display: 'block', marginTop: '-1rem', marginBottom: '1rem' }}>{errors.confirmInfo}</span>}

                    <div className="btn-group">
                        <button type="button" className="btn-secondary" onClick={() => setView('register-1')} disabled={isLoading}>← BACK</button>
                        <button type="submit" className="btn-primary" disabled={isLoading}>
                            {isLoading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
                        </button>
                    </div>
                </form>
            )}

            {/* SUCCESS SCREEN */}
            {view === 'success' && (
                <div className="success-screen">
                    <div className="success-icon">🎉</div>
                    <h2>Account Created Successfully!</h2>
                    {needsEmailVerification ? (
                        <p className="auth-subtitle">Please check your inbox to verify your email address before logging in.</p>
                    ) : (
                        <p className="auth-subtitle">Welcome to CareConnect. Your caregiver account is ready.</p>
                    )}
                    <button className="btn-primary" onClick={() => setView('login')} style={{ marginTop: '2rem' }}>
                        GO TO LOGIN
                    </button>
                </div>
            )}
        </div>
    );
}