import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import './SettingsPanel.css';

// NOTE: Notification toggles below are still local React state only.
// Nothing is persisted to Supabase yet — flip those into real writes
// (e.g. a `caregiver_settings` table or `user_metadata` update) once
// the backend side is ready. Marked with `// TODO: persist`.
//
// "Larger text" and "Delete account" ARE functional (see comments
// on each below) — Larger text works entirely client-side, and
// Delete account has its confirmation flow wired up with a clearly
// marked spot for the real backend call to be dropped in later.

const LARGE_TEXT_STORAGE_KEY = 'neuroplay_large_text';

export default function SettingsPanel({ onBack, patients = [], user, caregiverName }) {
    // --- Notifications ---
    const [codeExpiryAlerts, setCodeExpiryAlerts] = useState(true);
    const [reminderAlerts, setReminderAlerts] = useState(true);
    const [notifyChannel, setNotifyChannel] = useState('inapp'); // 'inapp' | 'email' | 'both'

    // --- Appearance ---
    // Functional: toggling this scales the root font-size, and since the
    // rest of the app is built with rem units, it scales the whole
    // dashboard's text. Preference is remembered via localStorage so it
    // survives a refresh (this is just a browser-side preference, not a
    // backend call).
    const [largeText, setLargeText] = useState(() => {
        try {
            return localStorage.getItem(LARGE_TEXT_STORAGE_KEY) === 'true';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        document.documentElement.style.fontSize = largeText ? '18px' : '';
        try {
            localStorage.setItem(LARGE_TEXT_STORAGE_KEY, String(largeText));
        } catch {
            // localStorage unavailable — the toggle still works for this session.
        }
    }, [largeText]);

    // --- Privacy & data ---
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteRequestNote, setDeleteRequestNote] = useState('');

    const [savedNote, setSavedNote] = useState('');

    const handleSaveAll = () => {
        // TODO: persist — replace with a real Supabase write, e.g.
        // await supabase.from('caregiver_settings').upsert({ ... })
        setSavedNote('Saved locally for this session (not yet connected to your account).');
        setTimeout(() => setSavedNote(''), 3500);
    };

    // Functional: builds a real PDF client-side from data already loaded
    // in the dashboard (no new backend calls — just formats what's
    // already been fetched). Requires the `jspdf` package:
    //   npm install jspdf
    const handleExportData = () => {
        try {
            const doc = new jsPDF();
            const marginX = 14;
            let y = 20;

            doc.setFontSize(16);
            doc.text('NeuroPlay — My Data Export', marginX, y);
            y += 8;

            doc.setFontSize(10);
            doc.setTextColor(120);
            doc.text(`Generated ${new Date().toLocaleString()}`, marginX, y);
            y += 12;

            doc.setTextColor(20);
            doc.setFontSize(13);
            doc.text('Caregiver', marginX, y);
            y += 7;
            doc.setFontSize(10);
            doc.text(`Name: ${caregiverName || 'N/A'}`, marginX, y); y += 5;
            doc.text(`Email: ${user?.email || 'N/A'}`, marginX, y); y += 12;

            doc.setFontSize(13);
            doc.text(`Patients (${patients.length})`, marginX, y);
            y += 7;
            doc.setFontSize(10);

            if (!patients || patients.length === 0) {
                doc.text('No patients on file.', marginX, y);
                y += 6;
            } else {
                patients.forEach((p, i) => {
                    if (y > 275) {
                        doc.addPage();
                        y = 20;
                    }
                    const addedDate = p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A';
                    doc.text(
                        `${i + 1}. ${p.full_name || 'Unnamed'}   |   Patient ID: ${p.patient_id || 'N/A'}   |   Added: ${addedDate}`,
                        marginX,
                        y
                    );
                    y += 6;
                });
            }

            doc.save(`neuroplay-data-export-${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (err) {
            console.error('Export failed:', err);
            alert('Something went wrong generating the PDF export.');
        }
    };

    const handleDeleteAccount = async () => {
        setDeleting(true);

        // -----------------------------------------------------------------
        // TODO: backend hook — wire this up to your real account-deletion
        // flow once it exists. This is the spot for it. For example:
        //
        //   const { error } = await supabase.functions.invoke(
        //       'delete-caregiver-account',
        //       { body: { userId: user?.id } }
        //   );
        //   if (error) {
        //       throw error;
        //   }
        //   await supabase.auth.signOut();
        //   window.location.href = '/';
        //
        // Nothing above is called yet — this function currently only
        // simulates the request so the confirm/cancel UI flow is ready
        // to have that call dropped straight in.
        // -----------------------------------------------------------------
        await new Promise((resolve) => setTimeout(resolve, 1200));

        setDeleting(false);
        setShowDeleteConfirm(false);
        setDeleteRequestNote('Delete request received. (Not yet connected to a backend — no data was actually deleted.)');
        setTimeout(() => setDeleteRequestNote(''), 5000);
    };

    return (
        <div className="settings-page">

            {/* NOTIFICATIONS */}
            <section className="settings-card">
                <h2>Notifications</h2>

                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">Login code expiry alerts</p>
                        <p className="settings-row-hint">Get notified when a patient's login code is about to expire.</p>
                    </div>
                    <label className="settings-toggle">
                        <input
                            type="checkbox"
                            checked={codeExpiryAlerts}
                            onChange={(e) => setCodeExpiryAlerts(e.target.checked)}
                        />
                        <span className="settings-toggle-slider" />
                    </label>
                </div>

                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">Medicine & activity reminders</p>
                        <p className="settings-row-hint">Alerts for scheduled patient reminders.</p>
                    </div>
                    <label className="settings-toggle">
                        <input
                            type="checkbox"
                            checked={reminderAlerts}
                            onChange={(e) => setReminderAlerts(e.target.checked)}
                        />
                        <span className="settings-toggle-slider" />
                    </label>
                </div>

                <div className="settings-row settings-row-column">
                    <div>
                        <p className="settings-row-label">Notify me via</p>
                        <p className="settings-row-hint">Choose how you'd like to receive alerts.</p>
                    </div>
                    <div className="settings-pill-group">
                        {[
                            { key: 'inapp', label: 'In-app only' },
                            { key: 'email', label: 'Email only' },
                            { key: 'both', label: 'Both' },
                        ].map(opt => (
                            <button
                                key={opt.key}
                                className={`settings-pill ${notifyChannel === opt.key ? 'settings-pill-active' : ''}`}
                                onClick={() => setNotifyChannel(opt.key)}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* APPEARANCE */}
            <section className="settings-card">
                <h2>Appearance</h2>

                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">Larger text</p>
                        <p className="settings-row-hint">Increase text size across the dashboard for easier reading.</p>
                    </div>
                    <label className="settings-toggle">
                        <input
                            type="checkbox"
                            checked={largeText}
                            onChange={(e) => setLargeText(e.target.checked)}
                        />
                        <span className="settings-toggle-slider" />
                    </label>
                </div>
            </section>

            {/* PRIVACY & DATA */}
            <section className="settings-card">
                <h2>Privacy & Data</h2>

                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">Export my data</p>
                        <p className="settings-row-hint">Download a PDF copy of your patient list and account info.</p>
                    </div>
                    <button className="settings-btn-outline" onClick={handleExportData}>Export</button>
                </div>

                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">Delete account</p>
                        <p className="settings-row-hint">Permanently remove your caregiver account and data.</p>
                    </div>
                    <button className="settings-btn-danger" onClick={() => setShowDeleteConfirm(true)}>Delete Account</button>
                </div>

                {deleteRequestNote && (
                    <p className="settings-row-hint" style={{ color: 'var(--db-error-red, #e11d48)', marginTop: '0.75rem' }}>
                        {deleteRequestNote}
                    </p>
                )}
            </section>

            {/* SUPPORT */}
            <section className="settings-card">
                <h2>Support</h2>
                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">Need help?</p>
                        <p className="settings-row-hint">Reach out and we'll get back to you.</p>
                    </div>
                    <button
                        className="settings-btn-outline"
                        onClick={() => alert('Support chat is coming soon. For now, use the Emergency Help Line on the main site.')}
                    >
                        Contact Support
                    </button>
                </div>
                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">App version</p>
                        <p className="settings-row-hint">NeuroPlay Caregiver Dashboard</p>
                    </div>
                    <span className="settings-version-tag">v1.0.0</span>
                </div>
            </section>

            <div className="settings-save-bar">
                {savedNote && <span className="settings-saved-note">{savedNote}</span>}
                <button className="settings-btn-save" onClick={handleSaveAll}>Save Changes</button>
            </div>

            {showDeleteConfirm && (
                <div className="modal-overlay" onClick={() => !deleting && setShowDeleteConfirm(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => !deleting && setShowDeleteConfirm(false)}>✕</button>
                        <h2 style={{ marginTop: 0 }}>Delete your account?</h2>
                        <p style={{ color: '#64748b' }}>
                            This will permanently remove your caregiver account and all associated data.
                            This action cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                            <button
                                className="settings-btn-outline"
                                style={{ flex: 1 }}
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                className="settings-btn-danger"
                                style={{ flex: 1, opacity: deleting ? 0.7 : 1 }}
                                onClick={handleDeleteAccount}
                                disabled={deleting}
                            >
                                {deleting ? 'Deleting…' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}