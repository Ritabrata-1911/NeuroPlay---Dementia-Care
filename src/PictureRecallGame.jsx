import React, { useEffect, useMemo, useRef, useState } from 'react';
import './PictureRecallGame.css';
import { selectObjects } from './neObjects';
import { checkAnswer } from './answerMatch';
import { computeSessionMetrics, saveGameSession } from './sessionStore';

/*
|--------------------------------------------------------------------------
| Object Recognition Game — North-East India
|--------------------------------------------------------------------------
| The user is shown ONE culturally relevant object from the North-Eastern
| states and identifies it by typing OR speaking. Up to 3 attempts per
| object, with a progressive hint after each wrong try. A session is 5-10
| objects; performance metrics are saved to the backend at the end.
|
| Props:
|   patient             { id, full_name, ... }  used to tag saved sessions
|   onHome              () => void              back to the app home screen
|   questionsPerSession optional 5-10 override for the number of objects
|--------------------------------------------------------------------------
*/

const MAX_ATTEMPTS = 3;
const AUTO_ADVANCE_MS = 3200;
// Real photos live at /public/images/ne-objects/<id>.jpg. Change this if your
// app serves static assets from a different path. Missing images fall back to
// a labelled emoji card, so the game runs before any photos are added.
const IMAGE_BASE = '/images/ne-objects/';

const DIFFICULTY_CONFIG = {
    easy: { label: 'Easy', questionCount: 5, blurb: '5 familiar objects' },
    medium: { label: 'Medium', questionCount: 7, blurb: '7 objects' },
    hard: { label: 'Hard', questionCount: 9, blurb: '9 tricky objects' },
};

const PRAISE = ['Well done!', 'Correct!', 'Excellent!', 'Very good!'];
const TRY_AGAIN = ['Not quite — try again.', 'Good try. Have another go.', 'Almost! One more try.'];

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
}
function formatTime(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function getSpeechRecognition() {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function suggestNextDifficulty(accuracy) {
    if (accuracy >= 90) return 'harder';
    if (accuracy < 50) return 'easier';
    return 'same';
}

export default function PictureRecallGame({ patient, onHome, questionsPerSession }) {
    const [screen, setScreen] = useState('intro'); // 'intro' | 'play' | 'results'
    const [difficulty, setDifficulty] = useState('easy');

    const [questions, setQuestions] = useState([]);
    const [index, setIndex] = useState(0);

    const [input, setInput] = useState('');
    const [attemptsUsed, setAttemptsUsed] = useState(0);
    const [hintsShown, setHintsShown] = useState(0);
    const [status, setStatus] = useState('idle'); // 'idle' | 'correct' | 'revealed'
    const [feedback, setFeedback] = useState('');
    const [lastCorrect, setLastCorrect] = useState(null);

    const [listening, setListening] = useState(false);
    const [voiceError, setVoiceError] = useState('');
    const [isMuted, setIsMuted] = useState(false);
    const [imgFailed, setImgFailed] = useState(false);

    const [metrics, setMetrics] = useState(null);
    const [saveState, setSaveState] = useState('idle'); // 'idle'|'saving'|'saved'|'error'
    const [storedIn, setStoredIn] = useState(null);

    const recordsRef = useRef([]);
    const finishedRef = useRef(false);
    const sessionStartRef = useRef(0);
    const questionStartRef = useRef(0);
    const recognitionRef = useRef(null);
    const advanceTimerRef = useRef(null);
    const inputRef = useRef(null);

    const current = questions[index] || null;
    const config = DIFFICULTY_CONFIG[difficulty];
    const voiceSupported = useMemo(() => Boolean(getSpeechRecognition()), []);

    function speak(text) {
        if (isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.9;
        u.pitch = 1;
        u.lang = 'en-IN';
        window.speechSynthesis.speak(u);
    }

    // Clean up timers, voice recognition and speech on unmount.
    useEffect(
        () => () => {
            clearTimeout(advanceTimerRef.current);
            try {
                recognitionRef.current && recognitionRef.current.stop();
            } catch (e) {
                /* ignore */
            }
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        },
        []
    );

    // Keep focus on the answer box while a question is open.
    useEffect(() => {
        if (screen === 'play' && status === 'idle' && inputRef.current) {
            inputRef.current.focus();
        }
    }, [screen, index, status]);

    function stopListening() {
        try {
            recognitionRef.current && recognitionRef.current.stop();
        } catch (e) {
            /* ignore */
        }
        setListening(false);
    }

    function startListening() {
        const SR = getSpeechRecognition();
        if (!SR) {
            setVoiceError('Voice input is not supported in this browser. Please type your answer.');
            return;
        }
        if (status !== 'idle') return;
        try {
            stopListening();
            const rec = new SR();
            rec.lang = 'en-IN';
            rec.interimResults = false;
            rec.maxAlternatives = 1;
            rec.continuous = false;
            rec.onresult = (ev) => {
                const transcript = (ev.results && ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript) || '';
                setInput(transcript);
                setVoiceError('');
            };
            rec.onerror = (ev) => {
                setListening(false);
                if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
                    setVoiceError('Microphone access is blocked. You can type your answer instead.');
                } else if (ev.error === 'no-speech') {
                    setVoiceError('I did not catch that. Tap the mic and speak, or type your answer.');
                }
            };
            rec.onend = () => setListening(false);
            recognitionRef.current = rec;
            setListening(true);
            setVoiceError('');
            rec.start();
        } catch (e) {
            setListening(false);
            setVoiceError('Could not start voice input. Please type your answer.');
        }
    }

    function resetQuestionState() {
        setInput('');
        setAttemptsUsed(0);
        setHintsShown(0);
        setStatus('idle');
        setFeedback('');
        setLastCorrect(null);
        setImgFailed(false);
        setVoiceError('');
    }

    function startGame() {
        clearTimeout(advanceTimerRef.current);
        stopListening();
        const count = clamp(questionsPerSession || config.questionCount, 5, 10);
        const chosen = selectObjects(difficulty, count);

        recordsRef.current = [];
        finishedRef.current = false;
        setQuestions(chosen);
        setIndex(0);
        resetQuestionState();
        setMetrics(null);
        setSaveState('idle');
        setStoredIn(null);

        const now = Date.now();
        sessionStartRef.current = now;
        questionStartRef.current = now;
        setScreen('play');
    }

    function recordResult(correct, attempts, hintsForQuestion, responseTimeMs, obj) {
        recordsRef.current = [
            ...recordsRef.current,
            {
                objectId: obj.id,
                name: obj.name,
                region: obj.region,
                category: obj.category,
                difficulty: obj.difficulty,
                attempts,
                hintsShown: hintsForQuestion,
                correct,
                responseTimeMs,
            },
        ];
    }

    function goNext() {
        clearTimeout(advanceTimerRef.current);
        stopListening();
        const next = index + 1;
        if (next < questions.length) {
            setIndex(next);
            resetQuestionState();
            questionStartRef.current = Date.now();
        } else {
            finishGame();
        }
    }

    function submitAnswer(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (status !== 'idle' || !current) return;

        const guess = input.trim();
        if (!guess) {
            setFeedback('Please type or say your answer, then press Check.');
            return;
        }
        stopListening();

        const { correct } = checkAnswer(guess, current.accepted);
        const attemptNo = attemptsUsed + 1;
        setAttemptsUsed(attemptNo);

        if (correct) {
            const responseTimeMs = Date.now() - questionStartRef.current;
            recordResult(true, attemptNo, hintsShown, responseTimeMs, current);
            setStatus('correct');
            setLastCorrect(true);
            const msg = randomItem(PRAISE);
            setFeedback(msg);
            speak(`${msg} It is a ${current.name}.`);
            return;
        }

        setLastCorrect(false);

        if (attemptNo < MAX_ATTEMPTS) {
            const newHints = attemptNo; // 1st wrong -> hint 1, 2nd wrong -> hint 2
            setHintsShown(newHints);
            const msg = randomItem(TRY_AGAIN);
            const hintText = newHints === 1 ? current.hint1 : current.hint2;
            setFeedback(msg);
            speak(`${msg} Here is a hint. ${hintText}`);
            if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.select();
            }
        } else {
            const responseTimeMs = Date.now() - questionStartRef.current;
            recordResult(false, attemptNo, hintsShown, responseTimeMs, current);
            setStatus('revealed');
            setFeedback(`The answer was ${current.name}.`);
            speak(`The answer was ${current.name}.`);
            advanceTimerRef.current = setTimeout(goNext, AUTO_ADVANCE_MS);
        }
    }

    async function finishGame() {
        if (finishedRef.current) return;
        finishedRef.current = true;
        clearTimeout(advanceTimerRef.current);
        stopListening();

        const sessionDurationMs = Date.now() - sessionStartRef.current;
        const row = computeSessionMetrics(recordsRef.current, {
            difficulty,
            sessionDurationMs,
            // patient_id must be the Supabase patient UUID (the shared table requires
            // it and RLS is enforced on it). We send patient.id ONLY — a name is not a
            // valid UUID and would be rejected.
            patientId: (patient && patient.id) || null,
            patientName: (patient && (patient.full_name || patient.name)) || null,
            gameName: 'object_recognition',
            gameTitle: 'Object Recognition (North-East India)',
        });

        setMetrics(row);
        setScreen('results');
        setSaveState('saving');
        try {
            const res = await saveGameSession(row);
            setStoredIn(res.storedIn);
            setSaveState('saved');
        } catch (err) {
            setSaveState('error');
        }
    }

    function playAgain() {
        startGame();
    }

    function backToIntro() {
        clearTimeout(advanceTimerRef.current);
        stopListening();
        finishedRef.current = false;
        setScreen('intro');
        resetQuestionState();
    }

    const imageSrc = current ? `${IMAGE_BASE}${current.id}.jpg` : '';
    const progressPct = questions.length ? Math.round(((index + 1) / questions.length) * 100) : 0;
    const resolved = status === 'correct' || status === 'revealed';

    /* ------------------------------------------------------------------ INTRO */
    if (screen === 'intro') {
        return (
            <div className="picture-recall-container">
                <header className="picture-recall-header">
                    <div className="pr-brain-icon">🧠</div>
                    <h1>NeuroPlay</h1>
                    <h2>Object Recognition</h2>
                    <p>
                        Look at each picture and tell us what the object is. Every object
                        comes from the culture and daily life of North-East India.
                    </p>
                </header>

                <section className="pr-instructions-card">
                    <div className="pr-instruction-item">
                        <span>🖼️</span>
                        <div>
                            <strong>1. Look</strong>
                            <p>A picture of one object is shown.</p>
                        </div>
                    </div>
                    <div className="pr-instruction-item">
                        <span>🗣️</span>
                        <div>
                            <strong>2. Answer</strong>
                            <p>Type the name, or tap the mic and say it.</p>
                        </div>
                    </div>
                    <div className="pr-instruction-item">
                        <span>💡</span>
                        <div>
                            <strong>3. Hints</strong>
                            <p>3 tries per object, with a hint after each miss.</p>
                        </div>
                    </div>
                </section>

                <div className="pr-section-title">Choose Difficulty</div>
                <div className="pr-difficulty-selector">
                    {Object.keys(DIFFICULTY_CONFIG).map((key) => (
                        <button
                            key={key}
                            className={`pr-diff-btn ${difficulty === key ? 'active-diff' : ''}`}
                            onClick={() => setDifficulty(key)}
                        >
                            <span>{DIFFICULTY_CONFIG[key].label}</span>
                            <small>{DIFFICULTY_CONFIG[key].blurb}</small>
                        </button>
                    ))}
                </div>

                <p className="pr-current-difficulty">
                    Current difficulty: <strong>{config.label}</strong>
                </p>

                <div className="pr-intro-actions">
                    <button className="pr-primary-btn" onClick={startGame}>
                        ▶️ Start Game
                    </button>
                    <button
                        className="pr-secondary-btn"
                        onClick={() =>
                            speak(
                                'Look at each picture and tell us what the object is. You can type the name, or tap the microphone and say it. You get three tries, with a hint after each miss.'
                            )
                        }
                    >
                        🔊 Read Instructions
                    </button>
                    <button className="pr-secondary-btn" onClick={onHome}>
                        🏠 Home
                    </button>
                </div>

                {!voiceSupported && (
                    <p className="pr-voice-note">
                        Voice input is not available in this browser — typing works everywhere.
                    </p>
                )}

                <button className="pr-mute-toggle" onClick={() => setIsMuted((p) => !p)}>
                    {isMuted ? '🔇 Sound Off' : '🔊 Sound On'}
                </button>
            </div>
        );
    }

    /* ------------------------------------------------------------------- PLAY */
    if (screen === 'play' && current) {
        return (
            <div className="picture-recall-container pr-play">
                <div className="pr-play-topbar">
                    <button className="pr-icon-btn" onClick={backToIntro} aria-label="Back to start">
                        ← Back
                    </button>
                    <div className="pr-progress-wrap">
                        <div className="pr-progress-text">
                            Object {index + 1} of {questions.length}
                        </div>
                        <div className="pr-progress-track">
                            <div className="pr-progress-fill" style={{ width: `${progressPct}%` }} />
                        </div>
                    </div>
                    <button
                        className="pr-icon-btn"
                        onClick={() => setIsMuted((p) => !p)}
                        aria-label="Toggle sound"
                    >
                        {isMuted ? '🔇' : '🔊'}
                    </button>
                </div>

                <div
                    className="pr-attempts"
                    aria-label={`${attemptsUsed} of ${MAX_ATTEMPTS} attempts used`}
                >
                    {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                        <span
                            key={i}
                            className={`pr-attempt-dot ${i < attemptsUsed ? 'used' : ''} ${status === 'correct' && i === attemptsUsed - 1 ? 'good' : ''
                                }`}
                        />
                    ))}
                </div>
                <div className="pr-object-stage">
                    {!imgFailed ? (
                        <img
                            className="pr-object-image"
                            src={imageSrc}
                            alt="Identify this object"
                            onError={() => setImgFailed(true)}
                        />
                    ) : (
                        <div className="pr-object-fallback" role="img" aria-label="Object to identify">
                            <span className="pr-fallback-emoji">{current.emoji}</span>
                            <span className="pr-fallback-note">Picture coming soon</span>
                        </div>
                    )}
                </div>

                <div className="pr-question-row">
                    <h2 className="pr-question">What is this object?</h2>
                    <button
                        className="pr-hear-btn"
                        onClick={() => speak('What is this object?')}
                        aria-label="Hear the question"
                    >
                        🔊
                    </button>
                </div>
                {!resolved && (
                    <form className="pr-answer-form" onSubmit={submitAnswer}>
                        <div className="pr-input-row">
                            <input
                                ref={inputRef}
                                className="pr-answer-input"
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Type the name here…"
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck={false}
                            />
                            {voiceSupported && (
                                <button
                                    type="button"
                                    className={`pr-voice-btn ${listening ? 'listening' : ''}`}
                                    onClick={listening ? stopListening : startListening}
                                    aria-label={listening ? 'Stop listening' : 'Speak your answer'}
                                >
                                    {listening ? '⏹️' : '🎤'}
                                </button>
                            )}
                        </div>
                        <button type="submit" className="pr-check-btn">
                            ✓ Check Answer
                        </button>
                    </form>
                )}
                {hintsShown > 0 && (
                    <div className="pr-hint-stack">
                        {hintsShown >= 1 && (
                            <p className="pr-hint-line">
                                <span className="pr-hint-icon">💡</span> {current.hint1}
                            </p>
                        )}
                        {hintsShown >= 2 && (
                            <p className="pr-hint-line">
                                <span className="pr-hint-icon">💡</span> {current.hint2}
                            </p>
                        )}
                    </div>
                )}

                {feedback && (
                    <div
                        className={`pr-feedback ${lastCorrect === true ? 'good' : lastCorrect === false ? 'bad' : ''
                            }`}
                        role="status"
                    >
                        {feedback}
                    </div>
                )}

                {voiceError && <div className="pr-voice-error">{voiceError}</div>}
                {resolved && (
                    <div className="pr-reveal">
                        <div className="pr-reveal-name">
                            {status === 'correct' ? '✅' : 'ℹ️'} {current.name}
                        </div>
                        <div className="pr-reveal-meta">
                            <span className="pr-tag pr-tag-region">{current.region}</span>
                            <span className="pr-tag pr-tag-category">{current.category}</span>
                        </div>
                        <p className="pr-object-fact">{current.fact}</p>
                        <button className="pr-primary-btn pr-next-btn" onClick={goNext}>
                            {index + 1 < questions.length ? 'Next Object →' : 'See Results →'}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    /* ---------------------------------------------------------------- RESULTS */
    if (screen === 'results' && metrics) {
        const suggestion = suggestNextDifficulty(metrics.accuracy);
        return (
            <div className="picture-recall-container pr-results">
                <header className="picture-recall-header">
                    <div className="pr-brain-icon">🎉</div>
                    <h1>Session Complete</h1>
                    <h2>
                        {config.label} · {metrics.total_questions} objects
                    </h2>
                </header>

                <div className="pr-score-hero">
                    <div className="pr-score-circle">
                        <span className="pr-score-pct">{metrics.accuracy}%</span>
                        <span className="pr-score-label">accuracy</span>
                    </div>
                    <p className="pr-score-line">
                        You correctly named <strong>{metrics.correct_answers}</strong> of{' '}
                        <strong>{metrics.total_questions}</strong> objects.
                    </p>
                </div>
                <div className="pr-stat-grid">
                    <div className="pr-stat">
                        <span className="pr-stat-value">{metrics.correct_answers}</span>
                        <span className="pr-stat-key">Correct</span>
                    </div>
                    <div className="pr-stat">
                        <span className="pr-stat-value">{metrics.incorrect_answers}</span>
                        <span className="pr-stat-key">Missed</span>
                    </div>
                    <div className="pr-stat">
                        <span className="pr-stat-value">{metrics.mistake_rate}%</span>
                        <span className="pr-stat-key">Mistake rate</span>
                    </div>
                    <div className="pr-stat">
                        <span className="pr-stat-value">{metrics.hint_rate}%</span>
                        <span className="pr-stat-key">Needed a hint</span>
                    </div>
                    <div className="pr-stat">
                        <span className="pr-stat-value">{metrics.hints_used}</span>
                        <span className="pr-stat-key">Hints used</span>
                    </div>
                    <div className="pr-stat">
                        <span className="pr-stat-value">{formatTime(metrics.completion_time)}</span>
                        <span className="pr-stat-key">Total time</span>
                    </div>
                    <div className="pr-stat">
                        <span className="pr-stat-value">{metrics.average_response_time}s</span>
                        <span className="pr-stat-key">Avg / object</span>
                    </div>
                    <div className="pr-stat">
                        <span className="pr-stat-value">{metrics.attempts}</span>
                        <span className="pr-stat-key">Total tries</span>
                    </div>
                </div>
                <div className={`pr-saving-note pr-save-${saveState}`}>
                    {saveState === 'saving' && '💾 Saving your results…'}
                    {saveState === 'saved' &&
                        (storedIn === 'supabase'
                            ? '✅ Results saved to your history.'
                            : '✅ Results saved on this device.')}
                    {saveState === 'error' && '⚠️ Could not save results this time.'}
                </div>

                {suggestion !== 'same' && (
                    <p className="pr-suggestion">
                        {suggestion === 'harder'
                            ? '👏 That looked easy for you — try a harder level next time.'
                            : '🌱 Nicely done. An easier level might feel more comfortable next time.'}
                    </p>
                )}

                <div className="pr-intro-actions">
                    <button className="pr-primary-btn" onClick={playAgain}>
                        🔁 Play Again
                    </button>
                    <button className="pr-secondary-btn" onClick={backToIntro}>
                        🎚️ Change Difficulty
                    </button>
                    <button className="pr-secondary-btn" onClick={onHome}>
                        🏠 Home
                    </button>
                </div>
            </div>
        );
    }

    /* Fallback — should rarely show (e.g. between state transitions). */
    return (
        <div className="picture-recall-container">
            <p className="pr-loading">Loading…</p>
            <button className="pr-secondary-btn" onClick={backToIntro}>
                🏠 Back to start
            </button>
        </div>
    );
}