import React, { useEffect, useRef, useState } from 'react';
import './ReminderAlarms.css';

/*
 * Shared reminder-alarm + status logic — used by PatientDashboard
 * (full alarm: sound + banner) and CaregiverDashboard (status colors
 * only, no sound — see useStatusTick). Frontend-only: no schema
 * changes, works off the `time` ('HH:MM') field ReminderService
 * already reads/writes.
 *
 * Status model (three states the UI actually shows):
 *   completed — reminder is checked off today               → green
 *   missed    — time has passed and it's still not done      → red
 *   pending   — not done yet, but the time hasn't arrived     → amber
 *   (no badge/tint at all if the reminder has no time set)
 */

const CHECK_INTERVAL_MS = 15000; // check every 15s
const FIRED_KEY_PREFIX = 'neuroplay_alarm_fired_';

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function parseTimeToday(timeStr) {
    if (!timeStr) return null;
    const [h, m] = String(timeStr).split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
}

// Two short rising beeps, synthesized with the Web Audio API — no
// audio file to ship or go missing.
function playAlarmTone() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        [0, 0.32].forEach((offset, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.value = i === 0 ? 740 : 880;

            gain.gain.setValueAtTime(0.0001, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.32, now + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.26);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + offset);
            osc.stop(now + offset + 0.28);
        });

        setTimeout(() => ctx.close(), 1200);
    } catch (err) {
        console.error('Unable to play reminder alarm tone:', err);
    }
}

// Forces the calling component to re-render every `intervalMs`, with
// no side effects otherwise. Used so status badges/row tints flip
// from "pending" to "missed" live, right at the deadline, without
// needing any other state to change first.
export function useStatusTick(intervalMs = 20000) {
    const [, setTick] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setTick((n) => n + 1), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
}

// completed → green, missed → red, pending → amber, 'none' → no badge/tint.
export function getReminderStatus(reminder, now = new Date()) {
    if (!reminder || reminder.enabled === false) return 'none';
    if (reminder.completed) return 'completed';
    if (!reminder.time) return 'none'; // no deadline set — nothing to flag

    const due = parseTimeToday(reminder.time);
    if (!due) return 'none';

    return now.getTime() >= due.getTime() ? 'missed' : 'pending';
}

const STATUS_LABEL = {
    completed: 'Completed',
    missed: 'Missed',
    pending: 'Pending',
    none: null,
};

export function ReminderStatusBadge({ reminder }) {
    useStatusTick();
    const status = getReminderStatus(reminder);
    const label = STATUS_LABEL[status];
    if (!label) return null;

    return (
        <span className={`reminder-status-badge reminder-status-${status}`}>
            {label}
        </span>
    );
}

// Extra className to put on a reminder's row/card for the "slight
// colour" tint — combine with whatever classes the row already has.
export function getReminderRowClassName(reminder) {
    const status = getReminderStatus(reminder);
    if (status === 'none') return '';
    return `reminder-row-tint reminder-row-tint-${status}`;
}

// Polls every CHECK_INTERVAL_MS for reminders whose time has passed
// and haven't been marked completed today. Fires the alarm tone once
// per reminder per browser session/day and adds it to `activeAlerts`
// for the caller to render a banner from. Intended for the PATIENT
// dashboard only — the caregiver dashboard should use useStatusTick +
// getReminderStatus directly for colors, without the sound/banner.
export function useReminderAlarms(reminders) {
    useStatusTick();

    const [activeAlerts, setActiveAlerts] = useState([]);
    const firedRef = useRef(new Set());

    useEffect(() => {
        function check() {
            const now = new Date();
            const date = todayStr();

            (reminders || []).forEach((reminder) => {
                if (!reminder?.id || !reminder?.time || reminder.completed || reminder.enabled === false) {
                    return;
                }

                const due = parseTimeToday(reminder.time);
                if (!due || now.getTime() < due.getTime()) return;

                const storageKey = `${FIRED_KEY_PREFIX}${reminder.id}_${date}`;

                let alreadyFired = firedRef.current.has(storageKey);
                if (!alreadyFired) {
                    try {
                        alreadyFired = sessionStorage.getItem(storageKey) === '1';
                    } catch {
                        alreadyFired = false;
                    }
                }

                if (alreadyFired) return;

                firedRef.current.add(storageKey);
                try {
                    sessionStorage.setItem(storageKey, '1');
                } catch {
                    // sessionStorage unavailable — alarm still fires for this load.
                }

                playAlarmTone();
                setActiveAlerts((prev) =>
                    prev.some((r) => r.id === reminder.id) ? prev : [...prev, reminder]
                );
            });
        }

        check();
        const interval = setInterval(check, CHECK_INTERVAL_MS);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reminders]);

    const dismissAlert = (reminderId) => {
        setActiveAlerts((prev) => prev.filter((r) => r.id !== reminderId));
    };

    return { activeAlerts, dismissAlert };
}

// Fixed banner stack — PATIENT DASHBOARD ONLY. Drop once near the top
// of the layout and pass onComplete for a "Mark done" shortcut.
export function ReminderAlarmBanner({ alerts, onDismiss, onComplete }) {
    if (!alerts || alerts.length === 0) return null;

    return (
        <div className="reminder-alarm-stack" role="alert" aria-live="assertive">
            {alerts.map((reminder) => (
                <div key={reminder.id} className="reminder-alarm-card">
                    <span className="reminder-alarm-icon">⏰</span>
                    <div className="reminder-alarm-body">
                        <strong>{reminder.title}</strong>
                        <span>
                            {reminder.time ? `Was due at ${reminder.time}` : 'This reminder is due'}
                        </span>
                    </div>
                    <div className="reminder-alarm-actions">
                        {onComplete && (
                            <button
                                type="button"
                                className="reminder-alarm-complete-btn"
                                onClick={() => {
                                    onComplete(reminder);
                                    onDismiss(reminder.id);
                                }}
                            >
                                Mark done
                            </button>
                        )}
                        <button
                            type="button"
                            className="reminder-alarm-dismiss-btn"
                            onClick={() => onDismiss(reminder.id)}
                            aria-label={`Dismiss reminder for ${reminder.title}`}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}