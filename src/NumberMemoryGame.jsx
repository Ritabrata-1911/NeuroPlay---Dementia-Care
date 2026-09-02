import React, { useState, useEffect, useRef } from 'react';
import './NumberMemoryGame.css';

// ---------------------------------------------------------------------------
// DIFFICULTY CONFIG
// ---------------------------------------------------------------------------
const DIFFICULTY_CONFIG = {
    easy: {
        label: 'Easy',
        digits: 4,
        observationTime: 9,
        rounds: 3,
        questionTypes: ['full'],
    },
    medium: {
        label: 'Medium',
        digits: 5,
        observationTime: 9,
        rounds: 4,
        questionTypes: ['full', 'first', 'last', 'missing'],
    },
    hard: {
        label: 'Hard',
        digits: 6,
        observationTime: 7,
        rounds: 5,
        questionTypes: ['full', 'missing', 'position', 'first', 'last'],
    },
};

const CORRECT_MESSAGES = ['Excellent! You remembered the number!', 'Wonderful memory!', 'Great job!'];
const INCORRECT_MESSAGES = ["Good try! Let's continue.", "That's okay — keep going!", 'Nice effort!'];

const HINTS = [
    'Try remembering the first two digits.',
    'Think about the middle digits.',
    'Take a moment and recall the sequence.',
    'Picture the number as a group of two, then the rest.',
];

// ---------------------------------------------------------------------------
// NUMBER GENERATION — always unique digits, no accidental repeats/leading zero
// ---------------------------------------------------------------------------
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function generateUniqueDigitNumber(digitCount, avoid) {
    let attempt;
    do {
        const pool = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        const selected = pool.slice(0, digitCount);
        // Never start with 0 — it would visually shorten the number
        if (selected[0] === 0) {
            const swapIndex = selected.findIndex((d, i) => i > 0 && d !== 0);
            if (swapIndex > -1) {
                [selected[0], selected[swapIndex]] = [selected[swapIndex], selected[0]];
            }
        }
        attempt = selected.join('');
    } while (attempt === avoid);
    return attempt;
}

// Build 4 multiple-choice options: the correct digit + up to 3 other digits
// actually present in the number, padded with random extras if needed.
function buildDigitOptions(numberStr, correctDigit) {
    const otherDigits = numberStr
        .split('')
        .filter((d) => d !== correctDigit);
    const uniqueOthers = [...new Set(otherDigits)];
    let distractors = shuffle(uniqueOthers).slice(0, 3);

    while (distractors.length < 3) {
        const candidate = String(Math.floor(Math.random() * 10));
        if (candidate !== correctDigit && !distractors.includes(candidate)) {
            distractors.push(candidate);
        }
    }

    return shuffle([correctDigit, ...distractors]);
}

function buildQuestion(numberStr, type) {
    switch (type) {
        case 'first': {
            const correct = numberStr[0];
            return {
                type,
                prompt: 'What was the first digit?',
                options: buildDigitOptions(numberStr, correct),
                correctAnswer: correct,
            };
        }
        case 'last': {
            const correct = numberStr[numberStr.length - 1];
            return {
                type,
                prompt: 'What was the last digit?',
                options: buildDigitOptions(numberStr, correct),
                correctAnswer: correct,
            };
        }
        case 'missing': {
            const blankIndex = Math.floor(Math.random() * numberStr.length);
            const correct = numberStr[blankIndex];
            const display = numberStr
                .split('')
                .map((d, i) => (i === blankIndex ? '_' : d))
                .join(' ');
            return {
                type,
                prompt: 'What digit was missing?',
                display,
                options: buildDigitOptions(numberStr, correct),
                correctAnswer: correct,
            };
        }
        case 'position': {
            const posIndex = Math.floor(Math.random() * numberStr.length);
            const correct = numberStr[posIndex];
            const ordinal = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'][posIndex] || `${posIndex + 1}th`;
            return {
                type,
                prompt: `Which digit was in the ${ordinal} position?`,
                options: buildDigitOptions(numberStr, correct),
                correctAnswer: correct,
            };
        }
        case 'full':
        default:
            return {
                type: 'full',
                prompt: 'What was the number?',
                correctAnswer: numberStr,
            };
    }
}

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// Ready for a backend later — call this from wherever the result is sent.
function handleGameComplete(record) {
    // Not sent anywhere yet, just prepared so a future API call can drop in here.
    console.log('Number Memory analytics:', record);
}

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------
export default function NumberMemoryGame({ patient, onHome }) {
    const [screen, setScreen] = useState('intro'); // intro | observing | recall | feedback | results
    const [difficulty, setDifficulty] = useState('easy');
    const [currentRound, setCurrentRound] = useState(1);
    const [currentNumber, setCurrentNumber] = useState('');
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [remainingTime, setRemainingTime] = useState(DIFFICULTY_CONFIG.easy.observationTime);
    const [userAnswer, setUserAnswer] = useState('');
    const [selectedOption, setSelectedOption] = useState(null);
    const [score, setScore] = useState(0);
    const [correctAnswers, setCorrectAnswers] = useState(0);
    const [hintsUsed, setHintsUsed] = useState(0);
    const [showHint, setShowHint] = useState(false);
    const [hintText, setHintText] = useState('');
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [wasCorrect, setWasCorrect] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [startTimestamp, setStartTimestamp] = useState(null);
    const [completionTime, setCompletionTime] = useState(0);

    const timerRef = useRef(null);
    const config = DIFFICULTY_CONFIG[difficulty];
    const inputRef = useRef(null);

    useEffect(() => {
        return () => clearInterval(timerRef.current);
    }, []);

    // Observation countdown — self-stopping, only runs on the observing screen
    useEffect(() => {
        if (screen !== 'observing') {
            clearInterval(timerRef.current);
            return;
        }
        timerRef.current = setInterval(() => {
            setRemainingTime((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    goToRecall();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timerRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screen]);

    // Auto-focus the numeric input on the recall screen (full-number questions)
    useEffect(() => {
        if (screen === 'recall' && currentQuestion?.type === 'full' && inputRef.current) {
            inputRef.current.focus();
        }
    }, [screen, currentQuestion]);

    function speak(text) {
        if (isMuted || !('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }

    function handleDifficultyChange(nextDifficulty) {
        setDifficulty(nextDifficulty);
    }

    function startRound(roundNumber, diff, previousNumber) {
        clearInterval(timerRef.current);
        const diffConfig = DIFFICULTY_CONFIG[diff];
        const number = generateUniqueDigitNumber(diffConfig.digits, previousNumber);
        const type = diffConfig.questionTypes[Math.floor(Math.random() * diffConfig.questionTypes.length)];
        const question = buildQuestion(number, type);

        setCurrentNumber(number);
        setCurrentQuestion(question);
        setRemainingTime(diffConfig.observationTime);
        setUserAnswer('');
        setSelectedOption(null);
        setShowHint(false);
        setHintText('');
        setFeedbackMessage('');
        setCurrentRound(roundNumber);
        setScreen('observing');
    }

    function startGame() {
        setScore(0);
        setCorrectAnswers(0);
        setHintsUsed(0);
        setCompletionTime(0);
        setStartTimestamp(Date.now());
        startRound(1, difficulty, null);
    }

    function goToRecall() {
        setScreen('recall');
    }

    function useHint() {
        if (showHint) return;
        setHintText(HINTS[Math.floor(Math.random() * HINTS.length)]);
        setShowHint(true);
        setHintsUsed((prev) => prev + 1);
        setScore((prev) => Math.max(0, prev - 2));
    }

    function submitFullAnswer() {
        if (!userAnswer.trim()) return; // ignore empty submissions
        evaluateAnswer(userAnswer.trim());
    }

    function selectOption(option) {
        if (selectedOption !== null) return; // prevent double answering
        setSelectedOption(option);
        evaluateAnswer(option);
    }

    function evaluateAnswer(answer) {
        const isCorrect = answer === currentQuestion.correctAnswer;
        setWasCorrect(isCorrect);

        if (isCorrect) {
            const points = currentQuestion.type === 'full' ? 10 : 5;
            setScore((prev) => prev + points);
            setCorrectAnswers((prev) => prev + 1);
            setFeedbackMessage(CORRECT_MESSAGES[Math.floor(Math.random() * CORRECT_MESSAGES.length)]);
        } else {
            setFeedbackMessage(INCORRECT_MESSAGES[Math.floor(Math.random() * INCORRECT_MESSAGES.length)]);
        }

        setScreen('feedback');
    }

    function goToNextRound() {
        if (currentRound < config.rounds) {
            startRound(currentRound + 1, difficulty, currentNumber);
        } else {
            finishGame();
        }
    }

    function finishGame() {
        const endTime = startTimestamp ? Math.round((Date.now() - startTimestamp) / 1000) : 0;
        setCompletionTime(endTime);
        setScreen('results');

        const accuracy = Math.round((correctAnswers / config.rounds) * 100);

        handleGameComplete({
            userId: patient?.id || patient?.full_name || 'unknown',
            gameName: 'Number Memory',
            difficulty,
            rounds: config.rounds,
            correctAnswers,
            totalQuestions: config.rounds,
            accuracy,
            score,
            hintsUsed,
            completionTime: endTime,
            completed: true,
            timestamp: new Date().toISOString(),
        });
    }

    function playAgain() {
        startGame();
    }

    function changeDifficulty() {
        clearInterval(timerRef.current);
        setScreen('intro');
    }

    // ---- Derived results values ----
    const accuracy = config.rounds > 0 ? Math.round((correctAnswers / config.rounds) * 100) : 0;
    let performanceMessage = "Good try! Let's try another round.";
    if (accuracy >= 90) performanceMessage = 'Excellent memory! Wonderful work.';
    else if (accuracy >= 70) performanceMessage = 'Great job! You remembered many numbers.';
    else if (accuracy >= 50) performanceMessage = 'Good effort! Keep practicing.';

    // ------------------------------------------------------------------
    // SCREEN: INTRO
    // ------------------------------------------------------------------
    if (screen === 'intro') {
        return (
            <div className="nm-container">
                <header className="nm-header">
                    <h1>🧠 NeuroPlay</h1>
                    <h2>🔢 Number Memory</h2>
                    <p>Remember the number and recall it after it disappears.</p>
                </header>

                <div className="nm-difficulty-selector">
                    {Object.keys(DIFFICULTY_CONFIG).map((key) => (
                        <button
                            key={key}
                            className={`nm-diff-btn ${difficulty === key ? 'active-diff' : ''}`}
                            onClick={() => handleDifficultyChange(key)}
                        >
                            {DIFFICULTY_CONFIG[key].label}
                        </button>
                    ))}
                </div>

                <p className="nm-instruction">
                    Look carefully at the number. Try to remember every digit. Take your time.
                </p>

                <div className="nm-intro-actions">
                    <button className="nm-primary-btn" onClick={startGame}>
                        ▶️ Start Game
                    </button>
                    <button
                        className="nm-secondary-btn"
                        onClick={() =>
                            speak(
                                'Look carefully at the number and try to remember every digit. When it disappears, you will be asked to recall it. Take your time.'
                            )
                        }
                    >
                        🔊 Read Instructions
                    </button>
                    <button className="nm-secondary-btn" onClick={onHome}>
                        🏠 Home
                    </button>
                </div>

                <button className="nm-mute-toggle" onClick={() => setIsMuted((prev) => !prev)} aria-pressed={isMuted}>
                    {isMuted ? '🔇 Sound Off' : '🔊 Sound On'}
                </button>
            </div>
        );
    }

    // ------------------------------------------------------------------
    // SCREEN: OBSERVING
    // ------------------------------------------------------------------
    if (screen === 'observing') {
        return (
            <div className="nm-container">
                <div className="nm-progress-header">
                    <span>Number Memory</span>
                    <span>Round {currentRound} / {config.rounds}</span>
                    <span>Score: {score}</span>
                </div>

                <p className="nm-remember-label">Remember this number</p>

                <div className="nm-number-display" aria-label={`Number to remember: ${currentNumber.split('').join(' ')}`}>
                    {currentNumber.split('').map((digit, i) => (
                        <span key={i} className="nm-digit">{digit}</span>
                    ))}
                </div>

                <p className="nm-timer-text">Time remaining: {remainingTime} seconds</p>

                <div className="nm-progress-track">
                    <div
                        className="nm-progress-fill"
                        style={{ width: `${(remainingTime / config.observationTime) * 100}%` }}
                    />
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------------
    // SCREEN: RECALL
    // ------------------------------------------------------------------
    if (screen === 'recall') {
        return (
            <div className="nm-container">
                <div className="nm-progress-header">
                    <span>Number Memory</span>
                    <span>Round {currentRound} / {config.rounds}</span>
                    <span>Score: {score}</span>
                </div>

                {currentQuestion.type === 'full' ? (
                    <>
                        <p className="nm-question-text">What was the number?</p>
                        <form
                            className="nm-answer-form"
                            onSubmit={(e) => {
                                e.preventDefault();
                                submitFullAnswer();
                            }}
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="nm-answer-input"
                                value={userAnswer}
                                onChange={(e) => setUserAnswer(e.target.value.replace(/[^0-9]/g, ''))}
                                aria-label="Enter the number you remember"
                                maxLength={config.digits}
                            />
                            <button type="submit" className="nm-primary-btn" disabled={!userAnswer.trim()}>
                                Submit
                            </button>
                        </form>
                    </>
                ) : (
                    <>
                        <p className="nm-question-text">{currentQuestion.prompt}</p>
                        {currentQuestion.display && (
                            <div className="nm-number-display nm-number-display-small">
                                {currentQuestion.display.split(' ').map((ch, i) => (
                                    <span key={i} className="nm-digit">{ch}</span>
                                ))}
                            </div>
                        )}
                        <div className="nm-options-grid">
                            {currentQuestion.options.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    className="nm-option-btn"
                                    onClick={() => selectOption(option)}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {showHint && <p className="nm-hint-text">💡 {hintText}</p>}

                <div className="nm-recall-actions">
                    <button className="nm-secondary-btn" onClick={useHint} disabled={showHint}>
                        💡 Hint
                    </button>
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------------
    // SCREEN: FEEDBACK
    // ------------------------------------------------------------------
    if (screen === 'feedback') {
        return (
            <div className="nm-container">
                <div className="nm-feedback-card">
                    <span className="nm-feedback-icon" aria-hidden="true">{wasCorrect ? '🎉' : '🙂'}</span>
                    <p className="nm-feedback-message" aria-live="polite">{feedbackMessage}</p>
                    {!wasCorrect && (
                        <p className="nm-feedback-reveal">The number was: {currentNumber.split('').join(' ')}</p>
                    )}
                    <button className="nm-primary-btn" onClick={goToNextRound}>
                        {currentRound < config.rounds ? 'Next Round' : 'See Results'}
                    </button>
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------------
    // SCREEN: RESULTS
    // ------------------------------------------------------------------
    return (
        <div className="nm-container">
            <div className="nm-results-card">
                <h2>🎉 Great Work!</h2>
                <p className="nm-results-subtitle">You completed Number Memory.</p>

                <div className="nm-results-score">
                    <span className="nm-score-value">Score: {score}</span>
                    <span className="nm-score-correct">Correct: {correctAnswers} / {config.rounds}</span>
                    <span className="nm-score-accuracy">Accuracy: {accuracy}%</span>
                </div>

                <p className="nm-performance-message">{performanceMessage}</p>

                <ul className="nm-results-stats">
                    <li><strong>Difficulty:</strong> {config.label}</li>
                    <li><strong>Hints used:</strong> {hintsUsed}</li>
                    <li><strong>Completion time:</strong> {formatTime(completionTime)}</li>
                </ul>

                <div className="nm-results-actions">
                    <button className="nm-primary-btn" onClick={playAgain}>
                        Play Again
                    </button>
                    <button className="nm-secondary-btn" onClick={changeDifficulty}>
                        Change Difficulty
                    </button>
                    <button className="nm-secondary-btn" onClick={onHome}>
                        Back to Games
                    </button>
                </div>
            </div>
        </div>
    );
}