import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from './SupabaseClient';
import './CaregiverAuth.css'; // Reusing your existing form/shell styles
import './AddPatientForm.css'; // A few extra styles specific to this screen

const today = new Date();
const CURRENT_YEAR = today.getFullYear();
const CURRENT_MONTH = today.getMonth() + 1; // 1-12
const CURRENT_DAY = today.getDate();

// Fallback used if the 'auth.months' translation key is missing or misconfigured.
// Without this guard, i18next returns the key itself ("auth.months") when the
// key can't be resolved, and indexing into that string produces single letters
// instead of month names.
const FALLBACK_MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const PHONE_REGEX = /^\d{10}$/;
const PIN_REGEX = /^\d{6}$/;
const DIGIT_ONLY_FIELDS = ['phone', 'pin_code', 'emergency_contact_phone'];

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

export default function AddPatientForm({ onBack, user }) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [successData, setSuccessData] = useState(null);
    const [errors, setErrors] = useState({});

    const [formData, setFormData] = useState({
        full_name: '', date_of_birth: '', gender: '', phone: '', address: '',
        city: '', state: '', pin_code: '', emergency_contact_name: '',
        emergency_contact_phone: '', emergency_contact_relationship: '',
        medication_info: '', medical_notes: '', important_notes: ''
    });

    // Separate day/month/year selects for DOB — same pattern used in CaregiverAuth:
    // jump straight to a year instead of scrolling a native calendar, and
    // structurally block future dates.
    const [dobParts, setDobParts] = useState({ day: '', month: '', year: '' });

    useEffect(() => {
        const { day, month, year } = dobParts;
        if (day && month && year) {
            const mm = String(month).padStart(2, '0');
            const dd = String(day).padStart(2, '0');
            setFormData(prev => ({ ...prev, date_of_birth: `${year}-${mm}-${dd}` }));
        } else {
            setFormData(prev => ({ ...prev, date_of_birth: '' }));
        }
    }, [dobParts]);

    // Patients may be considerably older than caregivers, so allow a wider year range.
    const yearOptions = [];
    for (let y = CURRENT_YEAR; y >= CURRENT_YEAR - 110; y--) yearOptions.push(y);

    const monthOptions = Array.from(
        { length: dobParts.year ? maxMonthForYear(dobParts.year) : 12 },
        (_, i) => i + 1
    );

    const dayOptions = Array.from(
        { length: maxDayForYearMonth(dobParts.year || CURRENT_YEAR, dobParts.month || 12) },
        (_, i) => i + 1
    );

    // Guard against a missing/misconfigured 'auth.months' translation key: if it
    // doesn't resolve to a proper 12-item array, fall back to hardcoded names
    // instead of letting i18next's key-name fallback string leak into the UI.
    const translatedMonths = t('auth.months', { returnObjects: true });
    const monthNames = Array.isArray(translatedMonths) && translatedMonths.length === 12
        ? translatedMonths
        : FALLBACK_MONTH_NAMES;

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
        if (errors.date_of_birth) setErrors(prev => ({ ...prev, date_of_birth: null }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        let newValue = value;

        if (DIGIT_ONLY_FIELDS.includes(name)) {
            newValue = newValue.replace(/\D/g, '');
        }

        setFormData(prev => ({ ...prev, [name]: newValue }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
    };

    const validate = () => {
        const newErrors = {};

        if (!formData.full_name.trim()) newErrors.full_name = t('addPatient.errors.fullNameRequired');
        if (!formData.date_of_birth) newErrors.date_of_birth = t('addPatient.errors.dobRequired');

        if (formData.phone && !PHONE_REGEX.test(formData.phone)) {
            newErrors.phone = t('addPatient.errors.phoneInvalid');
        }

        if (formData.pin_code && !PIN_REGEX.test(formData.pin_code)) {
            newErrors.pin_code = t('addPatient.errors.pinInvalid');
        }

        if (!formData.emergency_contact_name.trim()) {
            newErrors.emergency_contact_name = t('addPatient.errors.emergencyNameRequired');
        }

        if (!formData.emergency_contact_phone) {
            newErrors.emergency_contact_phone = t('addPatient.errors.emergencyPhoneRequired');
        } else if (!PHONE_REGEX.test(formData.emergency_contact_phone)) {
            newErrors.emergency_contact_phone = t('addPatient.errors.phoneInvalid');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);

        // 1. Insert into Supabase. 
        // caregiver_id is explicitly set here to map relationship.
        // Database trigger auto-generates patient_id & login_code safely.
        const { data, error } = await supabase
            .from('patients')
            .insert({
                ...formData,
                caregiver_id: user.id
            })
            .select() // Return the created row to get the DB-generated ID and Code
            .single();

        if (error) {
            alert(t('addPatient.errors.createFailed') + " " + error.message);
            setLoading(false);
            return;
        }

        // 2. Set success state to show generated credentials
        setSuccessData(data);
        setLoading(false);
    };

    if (successData) {
        return (
            <div className="auth-shell">
                <div className="auth-card patient-success-card">
                    <div className="patient-success-body">
                        <div className="success-icon">🎉</div>
                        <h2 className="form-title">{t('addPatient.success.title')}</h2>
                        <p className="form-subtitle">{t('addPatient.success.subtitle', { name: successData.full_name })}</p>

                        <div className="credential-reveal">
                            <div className="credential-reveal-row">
                                <span className="credential-reveal-label">{t('addPatient.success.patientIdLabel')}</span>
                                <span className="credential-reveal-id">{successData.patient_id}</span>
                            </div>

                            <span className="credential-reveal-label">{t('addPatient.success.loginCodeLabel')}</span>
                            <div className="credential-reveal-code">{successData.login_code}</div>
                        </div>

                        <p className="credential-warning">
                            ⚠️ {t('addPatient.success.warning')}
                        </p>

                        <div className="btn-group">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => navigator.clipboard.writeText(successData.login_code)}
                            >
                                📋 {t('addPatient.success.copyCode')}
                            </button>
                            <button type="button" className="btn-primary" onClick={onBack}>
                                ✓ {t('addPatient.success.done')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-shell">
            <button className="auth-back-btn" onClick={onBack}>
                ← {t('addPatient.backToDashboard')}
            </button>

            <div className="auth-card">
                {/* Brand / context panel, matching CaregiverAuth */}
                <aside className="auth-brand-panel">
                    <div className="auth-brand-mark">
                        <span role="img" aria-label="brain">🧠</span>
                        <span>{t('brand')}</span>
                    </div>

                    <h1 className="auth-brand-heading">{t('addPatient.brandHeading')}</h1>
                    <p className="auth-brand-copy">
                        {t('addPatient.brandCopy')}
                    </p>

                    <ul className="auth-brand-list">
                        <li>{t('addPatient.brandList.0')}</li>
                        <li>{t('addPatient.brandList.1')}</li>
                        <li>{t('addPatient.brandList.2')}</li>
                    </ul>
                </aside>

                {/* Form panel */}
                <div className="auth-form-panel">
                    <form onSubmit={handleSubmit}>
                        <h2 className="form-title">{t('addPatient.formTitle')}</h2>
                        <p className="form-subtitle">{t('addPatient.formSubtitle')}</p>

                        <h3 className="section-title"><span className="section-badge section-badge-blue">1</span>{t('addPatient.section1')}</h3>
                        <div className="form-grid">
                            <div className="form-group full-width">
                                <label>{t('addPatient.fullName')} <span className="required">*</span></label>
                                <input
                                    type="text"
                                    name="full_name"
                                    className="form-input"
                                    value={formData.full_name}
                                    onChange={handleChange}
                                />
                                {errors.full_name && <span className="error-message">{errors.full_name}</span>}
                            </div>

                            <div className="form-group full-width">
                                <label>{t('addPatient.dob')} <span className="required">*</span></label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <select
                                        className="form-select"
                                        style={{ flex: '1 1 110px', minWidth: '110px' }}
                                        value={dobParts.day}
                                        onChange={(e) => handleDobPartChange('day', e.target.value)}
                                        aria-label="Day of birth"
                                    >
                                        <option value="">{t('addPatient.day')}</option>
                                        {dayOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                    <select
                                        className="form-select"
                                        style={{ flex: '1 1 140px', minWidth: '140px' }}
                                        value={dobParts.month}
                                        onChange={(e) => handleDobPartChange('month', e.target.value)}
                                        aria-label="Month of birth"
                                    >
                                        <option value="">{t('addPatient.month')}</option>
                                        {monthOptions.map(m => <option key={m} value={m}>{monthNames[m - 1]}</option>)}
                                    </select>
                                    <select
                                        className="form-select"
                                        style={{ flex: '1 1 110px', minWidth: '110px' }}
                                        value={dobParts.year}
                                        onChange={(e) => handleDobPartChange('year', e.target.value)}
                                        aria-label="Year of birth"
                                    >
                                        <option value="">{t('addPatient.year')}</option>
                                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                {errors.date_of_birth && <span className="error-message">{errors.date_of_birth}</span>}
                            </div>

                            <div className="form-group">
                                <label>{t('addPatient.gender')}</label>
                                <select name="gender" className="form-select" value={formData.gender} onChange={handleChange}>
                                    <option value="">{t('addPatient.selectOption')}</option>
                                    <option value="Male">{t('addPatient.male')}</option>
                                    <option value="Female">{t('addPatient.female')}</option>
                                    <option value="Other">{t('addPatient.other')}</option>
                                    <option value="Prefer not to say">{t('addPatient.preferNotToSay')}</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>{t('addPatient.phone')}</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    className="form-input"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    maxLength={10}
                                    inputMode="numeric"
                                    placeholder={t('addPatient.tenDigitPlaceholder')}
                                />
                                {errors.phone && <span className="error-message">{errors.phone}</span>}
                            </div>

                            <div className="form-group full-width">
                                <label>{t('addPatient.address')}</label>
                                <input type="text" name="address" className="form-input" value={formData.address} onChange={handleChange} />
                            </div>

                            <div className="form-group">
                                <label>{t('addPatient.city')}</label>
                                <input type="text" name="city" className="form-input" value={formData.city} onChange={handleChange} />
                            </div>

                            <div className="form-group">
                                <label>{t('addPatient.state')}</label>
                                <input type="text" name="state" className="form-input" value={formData.state} onChange={handleChange} />
                            </div>

                            <div className="form-group">
                                <label>{t('addPatient.pin')}</label>
                                <input
                                    type="text"
                                    name="pin_code"
                                    className="form-input"
                                    value={formData.pin_code}
                                    onChange={handleChange}
                                    maxLength={6}
                                    inputMode="numeric"
                                    placeholder={t('addPatient.sixDigitPlaceholder')}
                                />
                                {errors.pin_code && <span className="error-message">{errors.pin_code}</span>}
                            </div>
                        </div>

                        <h3 className="section-title"><span className="section-badge section-badge-green">2</span>{t('addPatient.section2')}</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>{t('addPatient.emergencyName')} <span className="required">*</span></label>
                                <input
                                    type="text"
                                    name="emergency_contact_name"
                                    className="form-input"
                                    value={formData.emergency_contact_name}
                                    onChange={handleChange}
                                />
                                {errors.emergency_contact_name && <span className="error-message">{errors.emergency_contact_name}</span>}
                            </div>

                            <div className="form-group">
                                <label>{t('addPatient.emergencyPhone')} <span className="required">*</span></label>
                                <input
                                    type="tel"
                                    name="emergency_contact_phone"
                                    className="form-input"
                                    value={formData.emergency_contact_phone}
                                    onChange={handleChange}
                                    maxLength={10}
                                    inputMode="numeric"
                                    placeholder={t('addPatient.tenDigitPlaceholder')}
                                />
                                {errors.emergency_contact_phone && <span className="error-message">{errors.emergency_contact_phone}</span>}
                            </div>

                            <div className="form-group full-width">
                                <label>{t('addPatient.emergencyRelationship')}</label>
                                <input
                                    type="text"
                                    name="emergency_contact_relationship"
                                    className="form-input"
                                    value={formData.emergency_contact_relationship}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="form-group full-width">
                                <label>{t('addPatient.medicationInfo')}</label>
                                <textarea
                                    name="medication_info"
                                    className="form-textarea"
                                    rows="2"
                                    value={formData.medication_info}
                                    onChange={handleChange}
                                ></textarea>
                            </div>

                            <div className="form-group full-width">
                                <label>{t('addPatient.medicalNotes')}</label>
                                <textarea
                                    name="medical_notes"
                                    className="form-textarea"
                                    rows="2"
                                    value={formData.medical_notes}
                                    onChange={handleChange}
                                ></textarea>
                            </div>

                            <div className="form-group full-width">
                                <label>{t('addPatient.importantNotes')}</label>
                                <textarea
                                    name="important_notes"
                                    className="form-textarea"
                                    rows="2"
                                    value={formData.important_notes}
                                    onChange={handleChange}
                                ></textarea>
                            </div>
                        </div>

                        <div className="btn-group" style={{ marginTop: '2.5rem' }}>
                            <button type="button" className="btn-secondary" onClick={onBack} disabled={loading}>
                                {t('addPatient.cancel')}
                            </button>
                            <button type="submit" className="btn-primary" disabled={loading}>
                                {loading ? t('addPatient.creating') : t('addPatient.createPatient')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}