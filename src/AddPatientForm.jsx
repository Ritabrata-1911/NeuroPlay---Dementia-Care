import React, { useState } from 'react';
import { supabase } from './SupabaseClient';
import './CaregiverAuth.css'; // Reusing your existing form styles

export default function AddPatientForm({ onBack, user }) {
    const [loading, setLoading] = useState(false);
    const [successData, setSuccessData] = useState(null);
    const [formData, setFormData] = useState({
        full_name: '', date_of_birth: '', gender: '', phone: '', address: '', 
        city: '', state: '', pin_code: '', emergency_contact_name: '', 
        emergency_contact_phone: '', emergency_contact_relationship: '', 
        medication_info: '', medical_notes: '', important_notes: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
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
            alert("Error creating patient: " + error.message);
            setLoading(false);
            return;
        }

        // 2. Set success state to show generated credentials
        setSuccessData(data);
        setLoading(false);
    };

    if (successData) {
        return (
            <div className="auth-wrapper" style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center' }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
                <h2 style={{ color: '#1a365d' }}>Patient Added Successfully</h2>
                <h3 style={{ color: '#4a5568', marginBottom: '2rem' }}>{successData.full_name}</h3>
                
                <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '16px', marginBottom: '2rem', border: '2px solid #e2e8f0' }}>
                    <p style={{ color: '#64748b', fontWeight: 'bold', margin: '0 0 0.5rem' }}>Patient ID (Permanent)</p>
                    <p style={{ fontSize: '1.5rem', color: '#1a365d', fontWeight: 'bold', margin: '0 0 2rem' }}>{successData.patient_id}</p>
                    
                    <p style={{ color: '#64748b', fontWeight: 'bold', margin: '0 0 0.5rem' }}>Patient Login Code</p>
                    <div style={{ background: '#2F8B61', color: 'white', fontSize: '2.5rem', padding: '1rem', borderRadius: '12px', letterSpacing: '4px', fontWeight: 'bold' }}>
                        {successData.login_code}
                    </div>
                </div>

                <p style={{ color: '#e53e3e', fontWeight: '600', marginBottom: '2rem' }}>
                    Important: Give this 6-character code to the patient. The patient can use it to access NeuroPlay.
                </p>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <button className="btn-secondary" onClick={() => navigator.clipboard.writeText(successData.login_code)}>📋 Copy Code</button>
                    <button className="btn-primary" style={{ width: 'auto' }} onClick={onBack}>✓ Done</button>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-wrapper" style={{ maxWidth: '800px', margin: '2rem auto' }}>
            <div className="auth-header" style={{ textAlign: 'left', marginBottom: '2rem' }}>
                <h2>👤 Add New Patient</h2>
                <p className="auth-subtitle">Register a patient and generate their unique login credentials.</p>
            </div>

            <form onSubmit={handleSubmit}>
                <h3 className="section-title">Basic Details</h3>
                <div className="form-grid">
                    <div className="form-group full-width">
                        <label>Full Name <span className="required">*</span></label>
                        <input type="text" name="full_name" className="form-input" onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Date of Birth <span className="required">*</span></label>
                        <input type="date" name="date_of_birth" className="form-input" onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Gender</label>
                        <select name="gender" className="form-select" onChange={handleChange}>
                            <option value="">Select...</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                            <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Phone Number</label>
                        <input type="tel" name="phone" className="form-input" onChange={handleChange} />
                    </div>
                    <div className="form-group full-width">
                        <label>Address</label>
                        <input type="text" name="address" className="form-input" onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label>City</label>
                        <input type="text" name="city" className="form-input" onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label>PIN Code</label>
                        <input type="text" name="pin_code" className="form-input" onChange={handleChange} />
                    </div>
                </div>

                <h3 className="section-title">Care & Emergency Details</h3>
                <div className="form-grid">
                    <div className="form-group">
                        <label>Emergency Contact Name <span className="required">*</span></label>
                        <input type="text" name="emergency_contact_name" className="form-input" onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Emergency Contact Phone <span className="required">*</span></label>
                        <input type="tel" name="emergency_contact_phone" className="form-input" onChange={handleChange} required />
                    </div>
                    <div className="form-group full-width">
                        <label>Relationship with Emergency Contact</label>
                        <input type="text" name="emergency_contact_relationship" className="form-input" onChange={handleChange} />
                    </div>
                    <div className="form-group full-width">
                        <label>Current Medication Information</label>
                        <textarea name="medication_info" className="form-textarea" rows="2" onChange={handleChange}></textarea>
                    </div>
                    <div className="form-group full-width">
                        <label>Important Medical Notes</label>
                        <textarea name="medical_notes" className="form-textarea" rows="2" onChange={handleChange}></textarea>
                    </div>
                </div>

                <div className="btn-group" style={{ marginTop: '3rem' }}>
                    <button type="button" className="btn-secondary" onClick={onBack} disabled={loading}>[ CANCEL ]</button>
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'CREATING...' : '[ CREATE PATIENT ]'}
                    </button>
                </div>
            </form>
        </div>
    );
}