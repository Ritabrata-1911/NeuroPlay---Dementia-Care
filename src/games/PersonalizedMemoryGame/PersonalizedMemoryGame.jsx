/**
 * PersonalizedMemoryGame — NeuroPlay
 *
 * Drop this folder into  src/games/PersonalizedMemoryGame/
 * The game is mounted from PatientDashboard ("picture-memory" game id)
 * and the Caregiver photo-management panel is embedded in CaregiverDashboard
 * under the "patients" view → "Manage Memories" button.
 *
 * Analytics are written to game_sessions (existing shared table).
 * Photos are stored in the patient-memories bucket + patient_photos table.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../SupabaseClient';
import './PersonalizedMemoryGame.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const GAME_NAME = 'picture_memory';
const MAX_ATTEMPTS = 3;
const QUESTIONS_PER_SESSION = 7;
const DIFFICULTY_LABELS = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

// ─── Question Engine ──────────────────────────────────────────────────────────
const QUESTION_TEMPLATES = {
    person: { q: () => 'Who is this person?', field: 'personName' },
    relationship: { q: (m) => `What is ${m.personName}'s relationship with you?`, field: 'relationship' },
    occasion: { q: () => 'What was the occasion when this photograph was taken?', field: 'occasion' },
    location: { q: () => 'Where was this photograph taken?', field: 'location' },
    year: { q: () => 'Do you remember when this photograph was taken?', field: 'year' },
    significance: { q: () => 'Why is this photograph special to you?', field: 'significance' },
    context: { q: () => 'What do you remember about this moment?', field: 'context' },
};

function buildHints(type, m) {
    const hints = [];
    if (type === 'person') {
        hints.push(m.relationship ? `This person is a member of your ${m.relationship.toLowerCase().includes('friend') ? 'circle' : 'family'}.` : 'Think carefully about who this might be.');
        hints.push(m.relationship ? `This person is your ${m.relationship}.` : 'Look closely at the photograph.');
        hints.push(`The answer is ${m.personName}.`);
    } else if (type === 'relationship') {
        hints.push(m.occasion ? `Think about the occasion — ${m.occasion}.` : 'Think about how this person fits into your life.');
        hints.push(m.personName ? `${m.personName} is someone very close to you.` : 'Look at how close they seem.');
        hints.push(`The answer is ${m.relationship}.`);
    } else if (type === 'occasion') {
        hints.push(m.location ? `This was taken in ${m.location}.` : 'Think about what event might bring everyone together like this.');
        hints.push(m.year ? `This was around ${m.year}.` : 'Look at the clothing and setting for clues.');
        hints.push(`The answer is ${m.occasion}.`);
    } else if (type === 'location') {
        hints.push(m.occasion ? `This photograph was taken at ${m.occasion}.` : 'Look at the background for clues.');
        hints.push(m.year ? `This was around ${m.year}.` : 'Think about where this special occasion happened.');
        hints.push(`The answer is ${m.location}.`);
    } else if (type === 'year') {
        hints.push(m.occasion ? `This was taken at ${m.occasion}.` : 'Think about when this memory happened.');
        hints.push(`Think about when ${m.personName ? m.personName + ' ' : ''}was involved in this moment.`);
        hints.push(`The answer is ${m.year}.`);
    } else {
        hints.push(m.personName ? `Think about ${m.personName} and what this moment meant.` : 'Reflect on why this memory was preserved.');
        hints.push('Look closely at the expressions and setting in the photograph.');
        hints.push(`The answer is: ${m.significance || m.context}.`);
    }
    return hints;
}

function generateQuestionsForPhoto(photo, usedTypes, difficulty) {
    const m = photo.metadata || {};
    const available = Object.entries(QUESTION_TEMPLATES).filter(([key, tpl]) => {
        const val = m[tpl.field];
        if (!val || String(val).trim() === '') return false;
        if (usedTypes.has(key)) return false;
        // Easy: skip deep reflection types
        if (difficulty === 1 && ['significance', 'context'].includes(key)) return false;
        // Medium: skip free-form context
        if (difficulty === 2 && key === 'context') return false;
        return true;
    });
    if (available.length === 0) return null;
    const [key, tpl] = available[Math.floor(Math.random() * available.length)];
    return {
        id: `${photo.id}_${key}_${Date.now()}`,
        photoId: photo.id,
        photoUrl: photo.url,
        type: key,
        question: tpl.q(m),
        answer: String(m[tpl.field]),
        hints: buildHints(key, m),
        meta: m,
    };
}

function buildSessionQuestions(photos, difficulty) {
    const questions = [];
    const usedTypesByPhoto = {};
    photos.forEach((p) => { usedTypesByPhoto[p.id] = new Set(); });
    let attempts = 0;
    while (questions.length < QUESTIONS_PER_SESSION && attempts < 80) {
        attempts++;
        const photo = photos[Math.floor(Math.random() * photos.length)];
        const q = generateQuestionsForPhoto(photo, usedTypesByPhoto[photo.id], difficulty);
        if (q) { questions.push(q); usedTypesByPhoto[photo.id].add(q.type); }
    }
    return questions;
}

// ─── Answer Evaluation ────────────────────────────────────────────────────────
function normalizeAnswer(str) {
    return String(str)
        .toLowerCase().trim()
        .replace(/[^\w\s]/g, '')
        .replace(/\b(my|the|a|an|your|our|their)\b/g, '')
        .replace(/\s+/g, ' ').trim();
}

function evaluateAnswer(userAnswer, correctAnswer) {
    if (!userAnswer || !userAnswer.trim()) return false;
    const u = normalizeAnswer(userAnswer);
    const c = normalizeAnswer(correctAnswer);
    if (u === c) return true;
    if (u.includes(c) || c.includes(u)) return true;
    const uWords = u.split(' ').filter(Boolean);
    const cWords = c.split(' ').filter(Boolean);
    const overlap = uWords.filter((w) => cWords.includes(w));
    return overlap.length > 0 && overlap.length / Math.max(uWords.length, cWords.length) >= 0.6;
}

// ─── Analytics ────────────────────────────────────────────────────────────────
function computeSessionAnalytics(results, startTime, difficulty) {
    const total = results.length;
    const correct = results.filter((r) => r.correct).length;
    const incorrect = total - correct;
    const totalAttempts = results.reduce((s, r) => s + r.attempts, 0);
    const incorrectAttempts = results.reduce((s, r) => s + (r.attempts - (r.correct ? 1 : 0)), 0);
    const hintsUsed = results.filter((r) => r.hintsUsed > 0).length;
    const completionTime = (Date.now() - startTime) / 1000;
    const avgResponseTime = total ? results.reduce((s, r) => s + r.responseTime, 0) / total / 1000 : 0;
    return {
        game_name: GAME_NAME,
        difficulty_level: difficulty,
        accuracy: total ? +(correct / total).toFixed(4) : 0,
        mistake_rate: totalAttempts ? +(incorrectAttempts / totalAttempts).toFixed(4) : 0,
        hint_rate: total ? +(hintsUsed / total).toFixed(4) : 0,
        completion_time: +completionTime.toFixed(2),
        average_response_time: +avgResponseTime.toFixed(2),
        attempts: totalAttempts,
        correct_answers: correct,
        incorrect_answers: incorrect,
        raw_metadata: {
            session_id: `sess_${Date.now()}`,
            question_analytics: results.map((r) => ({
                question_id: r.id,
                question_type: r.type,
                attempts: r.attempts,
                correct: r.correct,
                hints_used: r.hintsUsed,
                response_time: Math.round(r.responseTime / 1000),
            })),
        },
    };
}

function computeNextDifficulty(history, current) {
    if (history.length < 2) return current;
    const recent = history.slice(-3);
    const avgAcc = recent.reduce((s, h) => s + h.accuracy, 0) / recent.length;
    const avgHint = recent.reduce((s, h) => s + h.hint_rate, 0) / recent.length;
    if (avgAcc >= 0.85 && avgHint <= 0.25) return Math.min(3, current + 1);
    if (avgAcc <= 0.50 || avgHint >= 0.60) return Math.max(1, current - 1);
    return current;
}

// ─── GAME — patient-facing ────────────────────────────────────────────────────
export default function PersonalizedMemoryGame({ patient, onHome }) {
    const patientId = patient?.id || patient?.patient_id;

    const [photos, setPhotos] = useState([]);
    const [photosLoading, setPhotosLoading] = useState(true);
    const [difficulty, setDifficulty] = useState(() => {
        try { return parseInt(localStorage.getItem(`pmg_diff_${patientId}`) || '1'); } catch { return 1; }
    });
    const [history, setHistory] = useState(() => {
        try { return JSON.parse(localStorage.getItem(`pmg_hist_${patientId}`) || '[]'); } catch { return []; }
    });

    const [phase, setPhase] = useState('loading'); // loading | empty | intro | question | complete
    const [questions, setQuestions] = useState([]);
    const [qIndex, setQIndex] = useState(0);
    const [results, setResults] = useState([]);
    const [answer, setAnswer] = useState('');
    const [attempts, setAttempts] = useState(0);
    const [hintsUsed, setHintsUsed] = useState(0);
    const [feedback, setFeedback] = useState(null);
    const [questionStart, setQuestionStart] = useState(Date.now());
    const [sessionStart] = useState(Date.now());
    const [sessionAnalytics, setSessionAnalytics] = useState(null);
    const [answerError, setAnswerError] = useState('');
    const inputRef = useRef();

    const currentQ = questions[qIndex];

    // Load photos
    useEffect(() => {
        if (!patientId) return;
        let active = true;
        setPhotosLoading(true);
        supabase
            .from('patient_photos')
            .select('id, url, metadata')
            .eq('patient_id', patientId)
            .then(({ data, error }) => {
                if (!active) return;
                if (!error && data && data.length > 0) {
                    setPhotos(data);
                    setPhase('intro');
                } else {
                    setPhase('empty');
                }
                setPhotosLoading(false);
            });
        return () => { active = false; };
    }, [patientId]);

    const startGame = useCallback(() => {
        const qs = buildSessionQuestions(photos, difficulty);
        setQuestions(qs);
        setQIndex(0);
        setResults([]);
        setAnswer('');
        setAttempts(0);
        setHintsUsed(0);
        setFeedback(null);
        setAnswerError('');
        setQuestionStart(Date.now());
        setPhase('question');
        setTimeout(() => inputRef.current?.focus(), 150);
    }, [photos, difficulty]);

    const submitAnswer = () => {
        if (!answer.trim()) {
            setAnswerError('Please type your answer before submitting.');
            return;
        }
        setAnswerError('');
        const correct = evaluateAnswer(answer, currentQ.answer);
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (correct) {
            const msg = newAttempts === 1 ? 'Excellent! You remembered!' : newAttempts === 2 ? 'Good job! Well recalled.' : 'Well done! You got it.';
            setFeedback({ type: 'correct', msg });
            setTimeout(() => advanceQuestion(true, newAttempts, hintsUsed), 1800);
        } else if (newAttempts >= MAX_ATTEMPTS) {
            setFeedback({ type: 'revealed', msg: "That's okay — let's remember this together.", reveal: currentQ.answer });
            setTimeout(() => advanceQuestion(false, newAttempts, hintsUsed), 2800);
        } else {
            const hintText = currentQ.hints[Math.min(newAttempts - 1, currentQ.hints.length - 2)] || "Take your time and think back...";
            setHintsUsed((h) => h + 1);
            setFeedback({ type: 'hint', msg: "That's okay! Here's a little hint.", hint: hintText });
        }
        setAnswer('');
    };

    const showHint = () => {
        if (feedback) return; // already showing hint or feedback
        const hintText = currentQ.hints[Math.min(attempts, currentQ.hints.length - 2)] || "Take your time and think back...";
        setHintsUsed((h) => h + 1);
        setFeedback({
            type: 'hint', msg: "Here's a hint to help you:", hint: hintText
        });
    };

    const dismissHint = () => {
        setFeedback(null);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const advanceQuestion = useCallback(async (correct, att, hints) => {
        const result = {
            id: currentQ.id,
            type: currentQ.type,
            correct,
            attempts: att,
            hintsUsed: hints,
            responseTime: Date.now() - questionStart,
        };
        const newResults = [...results, result];
        setResults(newResults);
        setFeedback(null);
        setAttempts(0);
        setHintsUsed(0);
        setAnswerError('');

        if (qIndex + 1 >= questions.length) {
            const analytics = computeSessionAnalytics(newResults, sessionStart, difficulty);
            setSessionAnalytics(analytics);

            // Write to game_sessions
            await supabase.from('game_sessions').insert([{ ...analytics, patient_id: patientId }]);

            // Update difficulty
            const nextHist = [...history, { accuracy: analytics.accuracy, hint_rate: analytics.hint_rate, difficulty_level: difficulty }];
            const nextDiff = computeNextDifficulty(nextHist, difficulty);
            setHistory(nextHist);
            setDifficulty(nextDiff);
            try {
                localStorage.setItem(`pmg_hist_${patientId}`, JSON.stringify(nextHist.slice(-10)));
                localStorage.setItem(`pmg_diff_${patientId}`, String(nextDiff));
            } catch { /* localStorage unavailable */ }

            setPhase('complete');
        } else {
            setQIndex((i) => i + 1);
            setQuestionStart(Date.now());
            setAnswer('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [currentQ, results, qIndex, questions.length, sessionStart, difficulty, history, patientId]);

    // ── Loading ──
    if (photosLoading || phase === 'loading') {
        return (
            <div className="pmg-shell pmg-center">
                <div className="pmg-spinner" />
                <p className="pmg-muted">Loading your memories…</p>
            </div>
        );
    }

    // ── Empty ──
    if (phase === 'empty') {
        return (
            <div className="pmg-shell pmg-center">
                <div className="pmg-empty-icon">🏔️</div>
                <h2 className="pmg-empty-title">No photographs yet</h2>
                <p className="pmg-muted">Ask your caregiver to add some meaningful photographs to get started.</p>
                <button className="pmg-btn pmg-btn-outline" onClick={onHome}>← Back to dashboard</button>
            </div>
        );
    }

    // ── Intro ──
    if (phase === 'intro') {
        return (
            <div className="pmg-shell pmg-center">
                <div className="pmg-intro-card">
                    <div className="pmg-intro-icon">🌿</div>
                    <h2 className="pmg-intro-title">Let's take a walk down memory lane</h2>
                    <p className="pmg-intro-body">
                        You'll see some familiar photographs. Take your time and see what you remember.
                        Every memory matters — there's no rush.
                    </p>
                    <div className="pmg-intro-stats">
                        <div className="pmg-intro-stat">
                            <span className="pmg-intro-stat-val">{Math.min(QUESTIONS_PER_SESSION, photos.length * 4)}</span>
                            <span className="pmg-intro-stat-label">memories to explore</span>
                        </div>
                        <div className="pmg-intro-stat">
                            <span className="pmg-intro-stat-val">{DIFFICULTY_LABELS[difficulty]}</span>
                            <span className="pmg-intro-stat-label">level</span>
                        </div>
                        <div className="pmg-intro-stat">
                            <span className="pmg-intro-stat-val">{MAX_ATTEMPTS}</span>
                            <span className="pmg-intro-stat-label">attempts each</span>
                        </div>
                    </div>
                    <button className="pmg-btn pmg-btn-primary pmg-full-width" onClick={startGame}>
                        Begin the journey →
                    </button>
                    <button className="pmg-btn-ghost" onClick={onHome}>Not now</button>
                </div>
            </div>
        );
    }

    // ── Question ──
    if (phase === 'question' && currentQ) {
        const progress = (qIndex / questions.length) * 100;
        return (
            <div className="pmg-shell pmg-question-shell">
                {/* Topbar */}
                <div className="pmg-topbar">
                    <button className="pmg-close-btn" onClick={onHome} aria-label="Exit game">✕</button>
                    <div className="pmg-progress-wrap">
                        <div className="pmg-progress-label">
                            <span>Memory {qIndex + 1} of {questions.length}</span>
                            <span className="pmg-diff-badge">{DIFFICULTY_LABELS[difficulty]}</span>
                        </div>
                        <div className="pmg-progress-track">
                            <div className="pmg-progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                </div>

                <div className="pmg-question-body">
                    {/* Photo */}
                    <div className="pmg-photo-frame">
                        <img
                            src={currentQ.photoUrl}
                            alt="Memory photograph"
                            className="pmg-photo"
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <span className="pmg-photo-type-badge">{currentQ.type}</span>
                    </div>

                    {/* Question card */}
                    <div className="pmg-question-card">
                        <p className="pmg-question-text">{currentQ.question}</p>
                    </div>

                    {/* Attempt dots */}
                    <div className="pmg-attempts-row">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className={`pmg-attempt-dot ${i <= attempts ? (feedback?.type === 'correct' ? 'dot-correct' : 'dot-used') : 'dot-empty'}`}
                            />
                        ))}
                        <span className="pmg-attempts-label">attempt {Math.min(attempts + 1, MAX_ATTEMPTS)} of {MAX_ATTEMPTS}</span>
                    </div>

                    {/* Feedback */}
                    {feedback && (
                        <div className={`pmg-feedback pmg-feedback-${feedback.type}`}>
                            <p className="pmg-feedback-msg">{feedback.msg}</p>
                            {feedback.hint && <p className="pmg-feedback-hint">{feedback.hint}</p>}
                            {feedback.reveal && (
                                <p className="pmg-feedback-reveal">The answer is: <strong>{feedback.reveal}</strong></p>
                            )}
                        </div>
                    )}

                    {/* Input area — visible when no feedback, or when feedback is just a hint (player can still retry) */}
                    {(!feedback || feedback.type === 'hint') && (
                        <div className="pmg-input-area">
                            {answerError && <p className="pmg-answer-error">{answerError}</p>}
                            <input
                                ref={inputRef}
                                className="pmg-answer-input"
                                value={answer}
                                onChange={(e) => { setAnswer(e.target.value); setAnswerError(''); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') submitAnswer(); }}
                                placeholder="Type your answer here…"
                                aria-label="Your answer"
                            />
                            <div className="pmg-action-row">
                                {feedback?.type === 'hint' ? (
                                    <>
                                        <button
                                            className="pmg-btn pmg-btn-hint"
                                            onClick={dismissHint}
                                        >
                                            ✏️ Try again
                                        </button>
                                        <button
                                            className={`pmg-btn pmg-btn-primary pmg-btn-submit ${!answer.trim() ? 'pmg-btn-disabled' : ''}`}
                                            onClick={submitAnswer}
                                        >
                                            Submit answer →
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            className="pmg-btn pmg-btn-hint"
                                            onClick={showHint}
                                            disabled={attempts >= MAX_ATTEMPTS - 1}
                                        >
                                            💡 Hint
                                        </button>
                                        <button
                                            className={`pmg-btn pmg-btn-primary pmg-btn-submit ${!answer.trim() ? 'pmg-btn-disabled' : ''}`}
                                            onClick={submitAnswer}
                                        >
                                            Submit answer →
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── Complete ──
    if (phase === 'complete' && sessionAnalytics) {
        const pct = Math.round(sessionAnalytics.accuracy * 100);
        const nextDiff = computeNextDifficulty(
            [...history, { accuracy: sessionAnalytics.accuracy, hint_rate: sessionAnalytics.hint_rate }],
            difficulty
        );
        const totalHints = sessionAnalytics.raw_metadata.question_analytics.reduce((s, q) => s + q.hints_used, 0);
        const mins = Math.floor(sessionAnalytics.completion_time / 60);
        const secs = Math.round(sessionAnalytics.completion_time % 60);

        return (
            <div className="pmg-shell pmg-center">
                <div className="pmg-complete-card">
                    <div className="pmg-complete-icon">{pct >= 80 ? '🌟' : pct >= 60 ? '🌿' : '💚'}</div>
                    <h2 className="pmg-complete-title">Session complete!</h2>
                    <p className="pmg-complete-subtitle">
                        You're doing wonderfully — every memory explored matters.
                    </p>

                    <div className="pmg-complete-stats">
                        <div className="pmg-complete-stat">
                            <span className="pmg-complete-stat-val" style={{ color: 'var(--pmg-teal)' }}>
                                {sessionAnalytics.correct_answers} / {questions.length}
                            </span>
                            <span className="pmg-complete-stat-label">Memories recalled</span>
                        </div>
                        <div className="pmg-complete-stat">
                            <span className="pmg-complete-stat-val" style={{ color: pct >= 80 ? 'var(--pmg-teal)' : 'var(--pmg-earth)' }}>
                                {pct}%
                            </span>
                            <span className="pmg-complete-stat-label">Accuracy</span>
                        </div>
                        <div className="pmg-complete-stat">
                            <span className="pmg-complete-stat-val" style={{ color: 'var(--pmg-earth)' }}>{totalHints}</span>
                            <span className="pmg-complete-stat-label">Hints used</span>
                        </div>
                        <div className="pmg-complete-stat">
                            <span className="pmg-complete-stat-val" style={{ color: 'var(--pmg-teal)' }}>{mins}m {secs}s</span>
                            <span className="pmg-complete-stat-label">Time taken</span>
                        </div>
                    </div>

                    <div className="pmg-complete-note">
                        Next session level: <strong>{DIFFICULTY_LABELS[nextDiff]}</strong>
                    </div>

                    <div className="pmg-complete-quote">
                        "Every memory revisited is a gift to the mind. Well done today."
                    </div>

                    <div className="pmg-complete-actions">
                        <button className="pmg-btn pmg-btn-primary" onClick={startGame}>Play again</button>
                        <button className="pmg-btn pmg-btn-outline" onClick={onHome}>Return home</button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}