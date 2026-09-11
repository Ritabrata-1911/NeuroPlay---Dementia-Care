import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import jsPDF from 'jspdf';
import './SettingsPanel.css';

// ─── Storage keys ────────────────────────────────────────────────────────────
const STORAGE = {
    FONT_SIZE: 'neuroplay_font_size',
    THEME: 'neuroplay_theme',
    HIGH_CONTRAST: 'neuroplay_high_contrast',
    CODE_EXPIRY: 'neuroplay_notif_code',
    REMINDER_ALERTS: 'neuroplay_notif_reminders',
    NOTIFY_CHANNEL: 'neuroplay_notif_channel',
    QUIET_HOURS: 'neuroplay_quiet_hours',
    QUIET_FROM: 'neuroplay_quiet_from',
    QUIET_TO: 'neuroplay_quiet_to',
};

const read = (key, fallback) => { try { const v = localStorage.getItem(key); return v !== null ? v : fallback; } catch { return fallback; } };
const write = (key, val) => { try { localStorage.setItem(key, String(val)); } catch { /* no-op */ } };
const readBool = (key, fb) => read(key, String(fb)) === 'true';

// ─── Font-size levels ────────────────────────────────────────────────────────
const FONT_LEVELS = [
    { key: 'default', label: 'Default', hint: '16px — standard', size: '' },
    { key: 'large', label: 'Large', hint: '18px — easier read', size: '18px' },
    { key: 'xlarge', label: 'X-Large', hint: '20px — maximum', size: '20px' },
];

// ─── Theme options ────────────────────────────────────────────────────────────
const THEMES = [
    { key: 'light', label: '☀️ Light', hint: 'Default cream & green' },
    { key: 'warm', label: '🌿 Warm', hint: 'Softer amber tones' },
    { key: 'dark', label: '🌙 Dark', hint: 'Low-light friendly' },
];

function applyTheme(theme) {
    const root = document.documentElement;
    root.removeAttribute('data-theme');
    if (theme !== 'light') root.setAttribute('data-theme', theme);
}

// ─── Notification helpers ─────────────────────────────────────────────────────
async function requestBrowserPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission !== 'default') return Notification.permission;
    return Notification.requestPermission();
}

function fireBrowserNotif(title, body) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
    }
}

function fireInAppToast(message) {
    window.dispatchEvent(new CustomEvent('neuroplay:toast', { detail: { message } }));
}

function isInQuietHours(from, to) {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const [fH, fM] = from.split(':').map(Number);
    const [tH, tM] = to.split(':').map(Number);
    const f = fH * 60 + fM, t2 = tH * 60 + tM;
    return f <= t2 ? (mins >= f && mins < t2) : (mins >= f || mins < t2);
}

function dispatchNotification(title, body, ctx) {
    if (ctx.quietHours && isInQuietHours(ctx.quietFrom, ctx.quietTo)) return;
    if (ctx.channel === 'inapp' || ctx.channel === 'both') {
        fireInAppToast(`${title} — ${body}`);
        fireBrowserNotif(title, body);
    }
    if (ctx.channel === 'email' || ctx.channel === 'both') {
        fireInAppToast(`📧 Email queued: ${title}`);
    }
}

// ─── Tiny reusable pieces ────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }) {
    return (
        <label className="settings-toggle">
            <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
            <span className="settings-toggle-slider" />
        </label>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SettingsPanel({ onBack, patients = [], user, caregiverName }) {
    const { t } = useTranslation();

    // Notifications
    const [codeExpiryAlerts, setCodeExpiryAlerts] = useState(() => readBool(STORAGE.CODE_EXPIRY, true));
    const [reminderAlerts, setReminderAlerts] = useState(() => readBool(STORAGE.REMINDER_ALERTS, true));
    const [notifyChannel, setNotifyChannel] = useState(() => read(STORAGE.NOTIFY_CHANNEL, 'inapp'));
    const [quietHours, setQuietHours] = useState(() => readBool(STORAGE.QUIET_HOURS, false));
    const [quietFrom, setQuietFrom] = useState(() => read(STORAGE.QUIET_FROM, '22:00'));
    const [quietTo, setQuietTo] = useState(() => read(STORAGE.QUIET_TO, '07:00'));
    const [browserPerm, setBrowserPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');

    // Appearance
    const [fontLevel, setFontLevel] = useState(() => read(STORAGE.FONT_SIZE, 'default'));
    const [theme, setTheme] = useState(() => read(STORAGE.THEME, 'light'));
    const [highContrast, setHighContrast] = useState(() => readBool(STORAGE.HIGH_CONTRAST, false));

    // Privacy
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteNote, setDeleteNote] = useState('');

    // Save badge
    const [savedVisible, setSavedVisible] = useState(false);
    const savedTimer = useRef(null);

    // Apply font size
    useEffect(() => {
        const lv = FONT_LEVELS.find((l) => l.key === fontLevel) || FONT_LEVELS[0];
        document.documentElement.style.fontSize = lv.size;
        write(STORAGE.FONT_SIZE, fontLevel);
        write('neuroplay_large_text', fontLevel !== 'default' ? 'true' : 'false');
    }, [fontLevel]);

    // Apply theme
    useEffect(() => { applyTheme(theme); write(STORAGE.THEME, theme); }, [theme]);

    // Apply high contrast
    useEffect(() => {
        document.documentElement.toggleAttribute('data-high-contrast', highContrast);
        write(STORAGE.HIGH_CONTRAST, highContrast);
    }, [highContrast]);

    // Persist notification prefs
    useEffect(() => { write(STORAGE.CODE_EXPIRY, codeExpiryAlerts); }, [codeExpiryAlerts]);
    useEffect(() => { write(STORAGE.REMINDER_ALERTS, reminderAlerts); }, [reminderAlerts]);
    useEffect(() => { write(STORAGE.NOTIFY_CHANNEL, notifyChannel); }, [notifyChannel]);
    useEffect(() => { write(STORAGE.QUIET_HOURS, quietHours); }, [quietHours]);
    useEffect(() => { write(STORAGE.QUIET_FROM, quietFrom); }, [quietFrom]);
    useEffect(() => { write(STORAGE.QUIET_TO, quietTo); }, [quietTo]);

    // Request browser permission when inapp/both selected
    useEffect(() => {
        if ((notifyChannel === 'inapp' || notifyChannel === 'both') && browserPerm === 'default') {
            requestBrowserPermission().then(setBrowserPerm);
        }
    }, [notifyChannel]);

    // Expose global notify function for the rest of the app
    const notifCtx = { channel: notifyChannel, quietHours, quietFrom, quietTo };
    useEffect(() => {
        window.__neuroplayNotify = (title, body) => {
            const isCode = /code|login/i.test(title);
            const isRem = /reminder|medicine|activity/i.test(title);
            if (isCode && !codeExpiryAlerts) return;
            if (isRem && !reminderAlerts) return;
            dispatchNotification(title, body, notifCtx);
        };
        return () => { window.__neuroplayNotify = null; };
    }, [codeExpiryAlerts, reminderAlerts, notifyChannel, quietHours, quietFrom, quietTo]);

    const handleSaveAll = () => {
        if (savedTimer.current) clearTimeout(savedTimer.current);
        setSavedVisible(true);
        savedTimer.current = setTimeout(() => setSavedVisible(false), 2800);
        dispatchNotification('Settings saved', 'Your NeuroPlay preferences have been updated.', notifCtx);
    };

    const handleTestNotification = async () => {
        if (notifyChannel === 'inapp' || notifyChannel === 'both') {
            const perm = await requestBrowserPermission();
            setBrowserPerm(perm);
        }
        dispatchNotification('🔔 Test notification', 'Notifications are working correctly.', notifCtx);
    };

    const handleExportData = () => {
        try {
            const doc = new jsPDF();
            const mx = 14; let y = 20;
            doc.setFontSize(16); doc.text(t('settingsPanel.export.title'), mx, y); y += 8;
            doc.setFontSize(10); doc.setTextColor(120);
            doc.text(`${t('settingsPanel.export.generated')} ${new Date().toLocaleString()}`, mx, y); y += 12;
            doc.setTextColor(20); doc.setFontSize(13);
            doc.text(t('settingsPanel.export.caregiver'), mx, y); y += 7;
            doc.setFontSize(10);
            doc.text(`${t('settingsPanel.export.name')}: ${caregiverName || t('settingsPanel.export.notAvailable')}`, mx, y); y += 5;
            doc.text(`${t('settingsPanel.export.email')}: ${user?.email || t('settingsPanel.export.notAvailable')}`, mx, y); y += 12;
            doc.setFontSize(13);
            doc.text(`${t('settingsPanel.export.patients')} (${patients.length})`, mx, y); y += 7;
            doc.setFontSize(10);
            if (!patients.length) {
                doc.text(t('settingsPanel.export.noPatients'), mx, y);
            } else {
                patients.forEach((p, i) => {
                    if (y > 275) { doc.addPage(); y = 20; }
                    const d = p.created_at ? new Date(p.created_at).toLocaleDateString() : '—';
                    doc.text(`${i + 1}. ${p.full_name || '—'}   | ID: ${p.patient_id || '—'}   | Added: ${d}`, mx, y);
                    y += 6;
                });
            }
            doc.save(`neuroplay-export-${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (err) {
            console.error('Export failed:', err);
            alert(t('settingsPanel.export.exportFailed'));
        }
    };

    const handleDeleteAccount = async () => {
        setDeleting(true);
        await new Promise((res) => setTimeout(res, 1200));
        setDeleting(false);
        setShowDeleteConfirm(false);
        setDeleteNote(t('settingsPanel.deleteRequest.received'));
        setTimeout(() => setDeleteNote(''), 5000);
    };

    return (
        <div className="settings-page">

            {/* ── NOTIFICATIONS ───────────────────────────────────────── */}
            <section className="settings-card">
                <div className="settings-card-header">
                    <h2>{t('settingsPanel.notifications.title')}</h2>
                    {browserPerm === 'denied' && (
                        <span className="settings-permission-warn">
                            ⚠️ Browser notifications blocked — enable in your browser settings
                        </span>
                    )}
                </div>

                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">{t('settingsPanel.notifications.loginCodeExpiryAlerts')}</p>
                        <p className="settings-row-hint">{t('settingsPanel.notifications.loginCodeExpiryHint')}</p>
                    </div>
                    <Toggle checked={codeExpiryAlerts} onChange={(e) => setCodeExpiryAlerts(e.target.checked)} />
                </div>

                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">{t('settingsPanel.notifications.medicineActivityReminders')}</p>
                        <p className="settings-row-hint">{t('settingsPanel.notifications.medicineActivityHint')}</p>
                    </div>
                    <Toggle checked={reminderAlerts} onChange={(e) => setReminderAlerts(e.target.checked)} />
                </div>

                <div className="settings-row settings-row-column">
                    <div>
                        <p className="settings-row-label">{t('settingsPanel.notifications.notifyMeVia')}</p>
                        <p className="settings-row-hint">{t('settingsPanel.notifications.notifyMeViaHint')}</p>
                    </div>
                    <div className="settings-pill-group">
                        {[
                            { key: 'inapp', label: t('settingsPanel.notifications.inAppOnly') },
                            { key: 'email', label: t('settingsPanel.notifications.emailOnly') },
                            { key: 'both', label: t('settingsPanel.notifications.both') },
                        ].map((opt) => (
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

                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">🌙 Quiet hours</p>
                        <p className="settings-row-hint">Pause all notifications during these hours</p>
                    </div>
                    <Toggle checked={quietHours} onChange={(e) => setQuietHours(e.target.checked)} />
                </div>

                {quietHours && (
                    <div className="settings-quiet-row">
                        <span className="settings-row-hint">From</span>
                        <input type="time" className="settings-time-input" value={quietFrom} onChange={(e) => setQuietFrom(e.target.value)} />
                        <span className="settings-row-hint">to</span>
                        <input type="time" className="settings-time-input" value={quietTo} onChange={(e) => setQuietTo(e.target.value)} />
                    </div>
                )}

                <div className="settings-row settings-row-test">
                    <p className="settings-row-hint">Verify your notification settings are working</p>
                    <button className="settings-btn-outline settings-btn-test" onClick={handleTestNotification}>
                        🔔 Send test
                    </button>
                </div>
            </section>

            {/* ── APPEARANCE ──────────────────────────────────────────── */}
            <section className="settings-card">
                <div className="settings-card-header">
                    <h2>{t('settingsPanel.appearance.title')}</h2>
                </div>

                {/* Text size levels */}
                <div className="settings-row settings-row-column">
                    <div>
                        <p className="settings-row-label">Text size</p>
                        <p className="settings-row-hint">Adjust font size across the entire dashboard</p>
                    </div>
                    <div className="settings-level-group">
                        {FONT_LEVELS.map((lv) => (
                            <button
                                key={lv.key}
                                className={`settings-level-btn ${fontLevel === lv.key ? 'settings-level-btn--active' : ''}`}
                                onClick={() => setFontLevel(lv.key)}
                            >
                                <span className="settings-level-label">{lv.label}</span>
                                <span className="settings-level-hint">{lv.hint}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Color theme */}
                <div className="settings-row settings-row-column">
                    <div>
                        <p className="settings-row-label">Color theme</p>
                        <p className="settings-row-hint">Choose the overall look of your dashboard</p>
                    </div>
                    <div className="settings-theme-group">
                        {THEMES.map((th) => (
                            <button
                                key={th.key}
                                className={`settings-theme-btn ${theme === th.key ? 'settings-theme-btn--active' : ''}`}
                                onClick={() => setTheme(th.key)}
                            >
                                <span className="settings-theme-label">{th.label}</span>
                                <span className="settings-theme-hint">{th.hint}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* High contrast */}
                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">High contrast</p>
                        <p className="settings-row-hint">Strengthen borders and text for better visibility</p>
                    </div>
                    <Toggle checked={highContrast} onChange={(e) => setHighContrast(e.target.checked)} />
                </div>
            </section>

            {/* ── PRIVACY & DATA ───────────────────────────────────────── */}
            <section className="settings-card">
                <h2>{t('settingsPanel.privacyData.title')}</h2>

                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">{t('settingsPanel.privacyData.exportMyData')}</p>
                        <p className="settings-row-hint">{t('settingsPanel.privacyData.exportHint')}</p>
                    </div>
                    <button className="settings-btn-outline" onClick={handleExportData}>
                        {t('settingsPanel.privacyData.export')}
                    </button>
                </div>

                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">{t('settingsPanel.privacyData.deleteAccount')}</p>
                        <p className="settings-row-hint">{t('settingsPanel.privacyData.deleteHint')}</p>
                    </div>
                    <button className="settings-btn-danger" onClick={() => setShowDeleteConfirm(true)}>
                        {t('settingsPanel.privacyData.deleteAccountButton')}
                    </button>
                </div>

                {deleteNote && (
                    <p className="settings-row-hint" style={{ color: 'var(--db-error-red, #e11d48)', marginTop: '0.75rem' }}>
                        {deleteNote}
                    </p>
                )}
            </section>

            {/* ── SUPPORT ─────────────────────────────────────────────── */}
            <section className="settings-card">
                <h2>{t('settingsPanel.support.title')}</h2>

                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">{t('settingsPanel.support.needHelp')}</p>
                        <p className="settings-row-hint">{t('settingsPanel.support.needHelpHint')}</p>
                    </div>
                    <button className="settings-btn-outline" onClick={() => alert(t('settingsPanel.support.supportComingSoon'))}>
                        {t('settingsPanel.support.contactSupport')}
                    </button>
                </div>

                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">{t('settingsPanel.support.appVersion')}</p>
                        <p className="settings-row-hint">{t('settingsPanel.support.dashboardName')}</p>
                    </div>
                    <span className="settings-version-tag">v1.0.0</span>
                </div>
            </section>

            {/* ── SAVE BAR ────────────────────────────────────────────── */}
            <div className="settings-save-bar">
                <span className={`settings-saved-badge ${savedVisible ? 'settings-saved-badge--visible' : ''}`}>
                    ✓ Saved
                </span>
                <button className="settings-btn-save" onClick={handleSaveAll}>
                    {t('settingsPanel.actions.saveChanges')}
                </button>
            </div>

            {/* ── DELETE MODAL ─────────────────────────────────────────── */}
            {showDeleteConfirm && (
                <div className="modal-overlay" onClick={() => !deleting && setShowDeleteConfirm(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => !deleting && setShowDeleteConfirm(false)}>✕</button>
                        <h2 style={{ marginTop: 0 }}>{t('settingsPanel.deleteConfirmation.title')}</h2>
                        <p style={{ color: '#64748b' }}>{t('settingsPanel.deleteConfirmation.message')}</p>
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                            <button className="settings-btn-outline" style={{ flex: 1 }} onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                                {t('settingsPanel.actions.cancel')}
                            </button>
                            <button className="settings-btn-danger" style={{ flex: 1, opacity: deleting ? 0.7 : 1 }} onClick={handleDeleteAccount} disabled={deleting}>
                                {deleting ? t('settingsPanel.actions.deleting') : t('settingsPanel.actions.yesDelete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}