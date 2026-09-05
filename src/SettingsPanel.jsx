import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import jsPDF from 'jspdf';
import './SettingsPanel.css';

const LARGE_TEXT_STORAGE_KEY = 'neuroplay_large_text';

export default function SettingsPanel({
    onBack,
    patients = [],
    user,
    caregiverName
}) {
    const { t } = useTranslation();

    // --- Notifications ---
    const [codeExpiryAlerts, setCodeExpiryAlerts] = useState(true);
    const [reminderAlerts, setReminderAlerts] = useState(true);
    const [notifyChannel, setNotifyChannel] = useState('inapp');

    // --- Appearance ---
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
            localStorage.setItem(
                LARGE_TEXT_STORAGE_KEY,
                String(largeText)
            );
        } catch {
            // localStorage unavailable — toggle still works for this session.
        }
    }, [largeText]);

    // --- Privacy & data ---
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteRequestNote, setDeleteRequestNote] = useState('');
    const [savedNote, setSavedNote] = useState('');

    const handleSaveAll = () => {
        setSavedNote(t('settingsPanel.notifications.savedLocally'));

        setTimeout(() => {
            setSavedNote('');
        }, 3500);
    };

    // --- Export data ---
    const handleExportData = () => {
        try {
            const doc = new jsPDF();
            const marginX = 14;
            let y = 20;

            doc.setFontSize(16);
            doc.text(
                t('settingsPanel.export.title'),
                marginX,
                y
            );
            y += 8;

            doc.setFontSize(10);
            doc.setTextColor(120);

            doc.text(
                `${t('settingsPanel.export.generated')} ${new Date().toLocaleString()} `,
                marginX,
                y
            );

            y += 12;

            doc.setTextColor(20);
            doc.setFontSize(13);

            doc.text(
                t('settingsPanel.export.caregiver'),
                marginX,
                y
            );

            y += 7;

            doc.setFontSize(10);

            doc.text(
                `${t('settingsPanel.export.name')}: ${caregiverName || t('settingsPanel.export.notAvailable')
                } `,
                marginX,
                y
            );

            y += 5;

            doc.text(
                `${t('settingsPanel.export.email')}: ${user?.email || t('settingsPanel.export.notAvailable')
                } `,
                marginX,
                y
            );

            y += 12;

            doc.setFontSize(13);

            doc.text(
                `${t('settingsPanel.export.patients')} (${patients.length})`,
                marginX,
                y
            );

            y += 7;

            doc.setFontSize(10);

            if (!patients || patients.length === 0) {
                doc.text(
                    t('settingsPanel.export.noPatients'),
                    marginX,
                    y
                );

                y += 6;
            } else {
                patients.forEach((p, i) => {
                    if (y > 275) {
                        doc.addPage();
                        y = 20;
                    }

                    const addedDate = p.created_at
                        ? new Date(p.created_at).toLocaleDateString()
                        : t('settingsPanel.export.notAvailable');

                    doc.text(
                        `${i + 1}. ${p.full_name ||
                        t('settingsPanel.export.unnamed')
                        }   | ${t('settingsPanel.export.patientId')
                        }: ${p.patient_id ||
                        t('settingsPanel.export.notAvailable')
                        }   | ${t('settingsPanel.export.added')
                        }: ${addedDate} `,
                        marginX,
                        y
                    );

                    y += 6;
                });
            }

            doc.save(
                `neuroplay - data -export -${new Date()
                    .toISOString()
                    .slice(0, 10)
                }.pdf`
            );
        } catch (err) {
            console.error('Export failed:', err);

            alert(
                t('settingsPanel.export.exportFailed')
            );
        }
    };

    // --- Delete account ---
    const handleDeleteAccount = async () => {
        setDeleting(true);

        // TODO: backend hook — connect your real account deletion
        // flow here when the backend is ready.

        await new Promise((resolve) =>
            setTimeout(resolve, 1200)
        );

        setDeleting(false);
        setShowDeleteConfirm(false);

        setDeleteRequestNote(
            t('settingsPanel.deleteRequest.received')
        );

        setTimeout(() => {
            setDeleteRequestNote('');
        }, 5000);
    };

    return (
        <div className="settings-page">

            {/* NOTIFICATIONS */}
            <section className="settings-card">
                <h2>
                    {t('settingsPanel.notifications.title')}
                </h2>

                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">
                            {t(
                                'settingsPanel.notifications.loginCodeExpiryAlerts'
                            )}
                        </p>

                        <p className="settings-row-hint">
                            {t(
                                'settingsPanel.notifications.loginCodeExpiryHint'
                            )}
                        </p>
                    </div>

                    <label className="settings-toggle">
                        <input
                            type="checkbox"
                            checked={codeExpiryAlerts}
                            onChange={(e) =>
                                setCodeExpiryAlerts(
                                    e.target.checked
                                )
                            }
                        />

                        <span className="settings-toggle-slider" />
                    </label>
                </div>

                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">
                            {t(
                                'settingsPanel.notifications.medicineActivityReminders'
                            )}
                        </p>

                        <p className="settings-row-hint">
                            {t(
                                'settingsPanel.notifications.medicineActivityHint'
                            )}
                        </p>
                    </div>

                    <label className="settings-toggle">
                        <input
                            type="checkbox"
                            checked={reminderAlerts}
                            onChange={(e) =>
                                setReminderAlerts(
                                    e.target.checked
                                )
                            }
                        />

                        <span className="settings-toggle-slider" />
                    </label>
                </div>

                <div className="settings-row settings-row-column">
                    <div>
                        <p className="settings-row-label">
                            {t(
                                'settingsPanel.notifications.notifyMeVia'
                            )}
                        </p>

                        <p className="settings-row-hint">
                            {t(
                                'settingsPanel.notifications.notifyMeViaHint'
                            )}
                        </p>
                    </div>

                    <div className="settings-pill-group">
                        {[
                            {
                                key: 'inapp',
                                label: t(
                                    'settingsPanel.notifications.inAppOnly'
                                )
                            },
                            {
                                key: 'email',
                                label: t(
                                    'settingsPanel.notifications.emailOnly'
                                )
                            },
                            {
                                key: 'both',
                                label: t(
                                    'settingsPanel.notifications.both'
                                )
                            }
                        ].map((opt) => (
                            <button
                                key={opt.key}
                                className={`settings - pill ${notifyChannel === opt.key
                                        ? 'settings-pill-active'
                                        : ''
                                    } `}
                                onClick={() =>
                                    setNotifyChannel(opt.key)
                                }
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* APPEARANCE */}
            <section className="settings-card">
                <h2>
                    {t('settingsPanel.appearance.title')}
                </h2>

                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">
                            {t(
                                'settingsPanel.appearance.largerText'
                            )}
                        </p>

                        <p className="settings-row-hint">
                            {t(
                                'settingsPanel.appearance.largerTextHint'
                            )}
                        </p>
                    </div>

                    <label className="settings-toggle">
                        <input
                            type="checkbox"
                            checked={largeText}
                            onChange={(e) =>
                                setLargeText(
                                    e.target.checked
                                )
                            }
                        />

                        <span className="settings-toggle-slider" />
                    </label>
                </div>
            </section>

            {/* PRIVACY & DATA */}
            <section className="settings-card">
                <h2>
                    {t('settingsPanel.privacyData.title')}
                </h2>

                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">
                            {t(
                                'settingsPanel.privacyData.exportMyData'
                            )}
                        </p>

                        <p className="settings-row-hint">
                            {t(
                                'settingsPanel.privacyData.exportHint'
                            )}
                        </p>
                    </div>

                    <button
                        className="settings-btn-outline"
                        onClick={handleExportData}
                    >
                        {t(
                            'settingsPanel.privacyData.export'
                        )}
                    </button>
                </div>

                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">
                            {t(
                                'settingsPanel.privacyData.deleteAccount'
                            )}
                        </p>

                        <p className="settings-row-hint">
                            {t(
                                'settingsPanel.privacyData.deleteHint'
                            )}
                        </p>
                    </div>

                    <button
                        className="settings-btn-danger"
                        onClick={() =>
                            setShowDeleteConfirm(true)
                        }
                    >
                        {t(
                            'settingsPanel.privacyData.deleteAccountButton'
                        )}
                    </button>
                </div>

                {deleteRequestNote && (
                    <p
                        className="settings-row-hint"
                        style={{
                            color:
                                'var(--db-error-red, #e11d48)',
                            marginTop: '0.75rem'
                        }}
                    >
                        {deleteRequestNote}
                    </p>
                )}
            </section>

            {/* SUPPORT */}
            <section className="settings-card">
                <h2>
                    {t('settingsPanel.support.title')}
                </h2>

                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">
                            {t(
                                'settingsPanel.support.needHelp'
                            )}
                        </p>

                        <p className="settings-row-hint">
                            {t(
                                'settingsPanel.support.needHelpHint'
                            )}
                        </p>
                    </div>

                    <button
                        className="settings-btn-outline"
                        onClick={() =>
                            alert(
                                t(
                                    'settingsPanel.support.supportComingSoon'
                                )
                            )
                        }
                    >
                        {t(
                            'settingsPanel.support.contactSupport'
                        )}
                    </button>
                </div>

                <div className="settings-row">
                    <div>
                        <p className="settings-row-label">
                            {t(
                                'settingsPanel.support.appVersion'
                            )}
                        </p>

                        <p className="settings-row-hint">
                            {t(
                                'settingsPanel.support.dashboardName'
                            )}
                        </p>
                    </div>

                    <span className="settings-version-tag">
                        v1.0.0
                    </span>
                </div>
            </section>

            {/* SAVE BAR */}
            <div className="settings-save-bar">
                {savedNote && (
                    <span className="settings-saved-note">
                        {savedNote}
                    </span>
                )}

                <button
                    className="settings-btn-save"
                    onClick={handleSaveAll}
                >
                    {t(
                        'settingsPanel.actions.saveChanges'
                    )}
                </button>
            </div>

            {/* DELETE CONFIRMATION MODAL */}
            {showDeleteConfirm && (
                <div
                    className="modal-overlay"
                    onClick={() =>
                        !deleting &&
                        setShowDeleteConfirm(false)
                    }
                >
                    <div
                        className="modal-content"
                        onClick={(e) =>
                            e.stopPropagation()
                        }
                    >
                        <button
                            className="modal-close-btn"
                            onClick={() =>
                                !deleting &&
                                setShowDeleteConfirm(false)
                            }
                        >
                            ✕
                        </button>

                        <h2 style={{ marginTop: 0 }}>
                            {t(
                                'settingsPanel.deleteConfirmation.title'
                            )}
                        </h2>

                        <p style={{ color: '#64748b' }}>
                            {t(
                                'settingsPanel.deleteConfirmation.message'
                            )}
                        </p>

                        <div
                            style={{
                                display: 'flex',
                                gap: '0.75rem',
                                marginTop: '1.5rem'
                            }}
                        >
                            <button
                                className="settings-btn-outline"
                                style={{ flex: 1 }}
                                onClick={() =>
                                    setShowDeleteConfirm(false)
                                }
                                disabled={deleting}
                            >
                                {t(
                                    'settingsPanel.actions.cancel'
                                )}
                            </button>

                            <button
                                className="settings-btn-danger"
                                style={{
                                    flex: 1,
                                    opacity: deleting
                                        ? 0.7
                                        : 1
                                }}
                                onClick={
                                    handleDeleteAccount
                                }
                                disabled={deleting}
                            >
                                {deleting
                                    ? t(
                                        'settingsPanel.actions.deleting'
                                    )
                                    : t(
                                        'settingsPanel.actions.yesDelete'
                                    )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}