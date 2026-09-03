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

const CORRECT_MESSAGES = [
    'Excellent! You remembered the number!',
    'Wonderful memory!',
    'Great job!',
];

const INCORRECT_MESSAGES = [
    "Good try! Let's continue.",
    "That's okay — keep going!",
    'Nice effort!',
];

const HINTS = [
    'Try remembering the first two digits.',
    'Think about the middle digits.',
    'Take a moment and recall the sequence.',
    'Picture the number as a group of two, then the rest.',
];

// ---------------------------------------------------------------------------
// NUMBER GENERATION
// Always unique digits and never starts with zero.
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

        // Never start with 0.
        if (selected[0] === 0) {
            const swapIndex = selected.findIndex(
                (d, i) => i > 0 && d !== 0
            );

            if (swapIndex > -1) {
                [selected[0], selected[swapIndex]] = [
                    selected[swapIndex],
                    selected[0],
                ];
            }
        }

        attempt = selected.join('');
    } while (attempt === avoid);

    return attempt;
}

// ---------------------------------------------------------------------------
// MULTIPLE CHOICE OPTIONS
// ---------------------------------------------------------------------------
function buildDigitOptions(numberStr, correctDigit) {
    const otherDigits = numberStr
        .split('')
        .filter((d) => d !== correctDigit);

    const uniqueOthers = [...new Set(otherDigits)];

    let distractors = shuffle(uniqueOthers).slice(0, 3);

    while (distractors.length < 3) {
        const candidate = String(Math.floor(Math.random() * 10));

        if (
            candidate !== correctDigit &&
            !distractors.includes(candidate)
        ) {
            distractors.push(candidate);
        }
    }

    return shuffle([correctDigit, ...distractors]);
}

// ---------------------------------------------------------------------------
// QUESTION BUILDER
// ---------------------------------------------------------------------------
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
            const blankIndex = Math.floor(
                Math.random() * numberStr.length
            );

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
            const posIndex = Math.floor(
                Math.random() * numberStr.length
            );

            const correct = numberStr[posIndex];

            const ordinal =
                [
                    'first',
                    'second',
                    'third',
                    'fourth',
                    'fifth',
                    'sixth',
                ][posIndex] || `${posIndex + 1}th`;

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

// ---------------------------------------------------------------------------
// TIME FORMATTER
// ---------------------------------------------------------------------------
function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;

    return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// SAVE GAME PERFORMANCE
// Frontend-only for now.
// Later this function can be replaced with an API call.
// ---------------------------------------------------------------------------
function handleGameComplete(record) {
    try {
        const key = 'neuroplay_game_sessions';

        const existing = JSON.parse(
            localStorage.getItem(key) || '[]'
        );

        existing.push(record);

        localStorage.setItem(
            key,
            JSON.stringify(existing)
        );

        // Tell other parts of the app that a new game session exists.
        window.dispatchEvent(
            new Event('neuroplay-game-session-added')
        );

        console.log(
            'Number Memory analytics saved:',
            record
        );
    } catch (error) {
        console.error(
            'Could not save Number Memory analytics:',
            error
        );
    }
}

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------
export default function NumberMemoryGame({ patient, onHome }) {
    const [screen, setScreen] = useState('intro');
    // intro | observing | recall | feedback | results

    const [difficulty, setDifficulty] = useState('easy');

    const [currentRound, setCurrentRound] = useState(1);

    const [currentNumber, setCurrentNumber] = useState('');

    const [currentQuestion, setCurrentQuestion] =
        useState(null);

    const [remainingTime, setRemainingTime] = useState(
        DIFFICULTY_CONFIG.easy.observationTime
    );

    const [userAnswer, setUserAnswer] = useState('');

    const [selectedOption, setSelectedOption] =
        useState(null);

    const [score, setScore] = useState(0);

    const [correctAnswers, setCorrectAnswers] =
        useState(0);

    const [hintsUsed, setHintsUsed] = useState(0);

    const [showHint, setShowHint] = useState(false);

    const [hintText, setHintText] = useState('');

    const [feedbackMessage, setFeedbackMessage] =
        useState('');

    const [wasCorrect, setWasCorrect] =
        useState(false);

    const [isMuted, setIsMuted] = useState(false);

    const [startTimestamp, setStartTimestamp] =
        useState(null);

    const [completionTime, setCompletionTime] =
        useState(0);

    // -----------------------------------------------------------------------
    // REFS
    // -----------------------------------------------------------------------
    const timerRef = useRef(null);

    const inputRef = useRef(null);

    const roundStartTimestamp = useRef(null);

    const responseTimesRef = useRef([]);

    const scoreRef = useRef(0);

    const correctAnswersRef = useRef(0);

    const hintsUsedRef = useRef(0);

    const currentRoundRef = useRef(1);

    const gameStartedRef = useRef(false);

    const gameCompletedRef = useRef(false);

    const config = DIFFICULTY_CONFIG[difficulty];

    // -----------------------------------------------------------------------
    // KEEP REFS SYNCHRONIZED WITH STATE
    // -----------------------------------------------------------------------
    useEffect(() => {
        scoreRef.current = score;
    }, [score]);

    useEffect(() => {
        correctAnswersRef.current = correctAnswers;
    }, [correctAnswers]);

    useEffect(() => {
        hintsUsedRef.current = hintsUsed;
    }, [hintsUsed]);

    useEffect(() => {
        currentRoundRef.current = currentRound;
    }, [currentRound]);

    // -----------------------------------------------------------------------
    // CLEANUP TIMER
    // -----------------------------------------------------------------------
    useEffect(() => {
        return () => {
            clearInterval(timerRef.current);
        };
    }, []);

    // -----------------------------------------------------------------------
    // ABANDONED GAME TRACKING
    // -----------------------------------------------------------------------
    useEffect(() => {
        return () => {
            if (
                gameStartedRef.current &&
                !gameCompletedRef.current
            ) {
                try {
                    const key = 'neuroplay_game_sessions';

                    const existing = JSON.parse(
                        localStorage.getItem(key) || '[]'
                    );

                    const totalRounds =
                        DIFFICULTY_CONFIG[difficulty].rounds;

                    const completedRounds =
                        Math.max(
                            0,
                            currentRoundRef.current - 1
                        );

                    const incorrectAnswers =
                        Math.max(
                            0,
                            completedRounds -
                                correctAnswersRef.current
                        );

                    const sessionDuration =
                        startTimestamp
                            ? Math.round(
                                (Date.now() -
                                    startTimestamp) /
                                    1000
                            )
                            : 0;

                    const abandonedRecord = {
                        patient_id:
                            patient?.id ||
                            patient?.patient_id ||
                            'unknown',

                        game: 'number_memory',

                        gameName: 'Number Memory',

                        difficulty,

                        rounds: totalRounds,

                        correct_answers:
                            correctAnswersRef.current,

                        incorrect_answers:
                            incorrectAnswers,

                        total_questions: totalRounds,

                        questions_completed:
                            completedRounds,

                        accuracy:
                            completedRounds > 0
                                ? Math.round(
                                    (correctAnswersRef.current /
                                        completedRounds) *
                                        100
                                )
                                : 0,

                        score: scoreRef.current,

                        hints_used:
                            hintsUsedRef.current,

                        completion_time:
                            sessionDuration,

                        session_duration:
                            sessionDuration,

                        completion_rate:
                            totalRounds > 0
                                ? Math.round(
                                    (completedRounds /
                                        totalRounds) *
                                        100
                                )
                                : 0,

                        mistake_rate:
                            completedRounds > 0
                                ? Math.round(
                                    (incorrectAnswers /
                                        completedRounds) *
                                        100
                                )
                                : 0,

                        hint_rate:
                            completedRounds > 0
                                ? Math.round(
                                    (hintsUsedRef.current /
                                        completedRounds) *
                                        100
                                )
                                : 0,

                        game_completed: false,

                        abandoned_game: true,

                        played_at:
                            new Date().toISOString(),
                    };

                    existing.push(abandonedRecord);

                    localStorage.setItem(
                        key,
                        JSON.stringify(existing)
                    );

                    window.dispatchEvent(
                        new Event(
                            'neuroplay-game-session-added'
                        )
                    );

                    console.log(
                        'Number Memory abandoned session saved:',
                        abandonedRecord
                    );
                } catch (error) {
                    console.error(
                        'Could not save abandoned Number Memory session:',
                        error
                    );
                }
            }
        };
    }, [difficulty, patient, startTimestamp]);

    // -----------------------------------------------------------------------
    // OBSERVATION TIMER
    // -----------------------------------------------------------------------
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

        return () => {
            clearInterval(timerRef.current);
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screen]);

    // -----------------------------------------------------------------------
    // FOCUS INPUT
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (
            screen === 'recall' &&
            currentQuestion?.type === 'full' &&
            inputRef.current
        ) {
            inputRef.current.focus();
        }
    }, [screen, currentQuestion]);

    // -----------------------------------------------------------------------
    // SPEECH
    // -----------------------------------------------------------------------
    function speak(text) {
        if (
            isMuted ||
            !('speechSynthesis' in window)
        ) {
            return;
        }

        window.speechSynthesis.cancel();

        const utterance =
            new SpeechSynthesisUtterance(text);

        utterance.rate = 0.9;

        window.speechSynthesis.speak(
            utterance
        );
    }

    // -----------------------------------------------------------------------
    // DIFFICULTY CHANGE
    // -----------------------------------------------------------------------
    function handleDifficultyChange(nextDifficulty) {
        setDifficulty(nextDifficulty);
    }

    // -----------------------------------------------------------------------
    // START ROUND
    // -----------------------------------------------------------------------
    function startRound(
        roundNumber,
        diff,
        previousNumber
    ) {
        clearInterval(timerRef.current);

        const diffConfig =
            DIFFICULTY_CONFIG[diff];

        const number =
            generateUniqueDigitNumber(
                diffConfig.digits,
                previousNumber
            );

        const type =
            diffConfig.questionTypes[
                Math.floor(
                    Math.random() *
                        diffConfig.questionTypes.length
                )
            ];

        const question =
            buildQuestion(
                number,
                type
            );

        setCurrentNumber(number);

        setCurrentQuestion(question);

        setRemainingTime(
            diffConfig.observationTime
        );

        setUserAnswer('');

        setSelectedOption(null);

        setShowHint(false);

        setHintText('');

        setFeedbackMessage('');

        setCurrentRound(
            roundNumber
        );

        currentRoundRef.current =
            roundNumber;

        roundStartTimestamp.current =
            Date.now();

        setScreen('observing');
    }

    // -----------------------------------------------------------------------
    // START GAME
    // -----------------------------------------------------------------------
    function startGame() {
        clearInterval(timerRef.current);

        setScore(0);
        scoreRef.current = 0;

        setCorrectAnswers(0);
        correctAnswersRef.current = 0;

        setHintsUsed(0);
        hintsUsedRef.current = 0;

        setCompletionTime(0);

        responseTimesRef.current = [];

        gameCompletedRef.current = false;

        gameStartedRef.current = true;

        const now = Date.now();

        setStartTimestamp(now);

        startRound(
            1,
            difficulty,
            null
        );

        speak(
            'Look carefully at the number and remember it.'
        );
    }

    // -----------------------------------------------------------------------
    // MOVE TO RECALL
    // -----------------------------------------------------------------------
    function goToRecall() {
        if (
            roundStartTimestamp.current
        ) {
            const responseTime =
                Math.round(
                    (Date.now() -
                        roundStartTimestamp.current) /
                        1000
                );

            responseTimesRef.current.push(
                responseTime
            );
        }

        setScreen('recall');

        setTimeout(() => {
            if (
                currentQuestion?.type === 'full'
            ) {
                inputRef.current?.focus();
            }
        }, 100);
    }

    // -----------------------------------------------------------------------
    // HINT
    // -----------------------------------------------------------------------
    function useHint() {
        if (showHint) {
            return;
        }

        const randomHint =
            HINTS[
                Math.floor(
                    Math.random() *
                        HINTS.length
                )
            ];

        setHintText(randomHint);

        setShowHint(true);

        setHintsUsed((prev) => {
            const next = prev + 1;

            hintsUsedRef.current =
                next;

            return next;
        });

        setScore((prev) => {
            const next = Math.max(
                0,
                prev - 2
            );

            scoreRef.current =
                next;

            return next;
        });

        speak(randomHint);
    }

    // -----------------------------------------------------------------------
    // FULL NUMBER ANSWER
    // -----------------------------------------------------------------------
    function submitFullAnswer() {
        if (!userAnswer.trim()) {
            return;
        }

        evaluateAnswer(
            userAnswer.trim()
        );
    }

    // -----------------------------------------------------------------------
    // MULTIPLE CHOICE
    // -----------------------------------------------------------------------
    function selectOption(option) {
        if (selectedOption !== null) {
            return;
        }

        setSelectedOption(option);

        evaluateAnswer(option);
    }

    // -----------------------------------------------------------------------
    // EVALUATE ANSWER
    // -----------------------------------------------------------------------
    function evaluateAnswer(answer) {
        if (!currentQuestion) {
            return;
        }

        const isCorrect =
            answer ===
            currentQuestion.correctAnswer;

        setWasCorrect(
            isCorrect
        );

        if (isCorrect) {
            const points =
                currentQuestion.type ===
                'full'
                    ? 10
                    : 5;

            setScore((prev) => {
                const next =
                    prev + points;

                scoreRef.current =
                    next;

                return next;
            });

            setCorrectAnswers(
                (prev) => {
                    const next =
                        prev + 1;

                    correctAnswersRef.current =
                        next;

                    return next;
                }
            );

            setFeedbackMessage(
                CORRECT_MESSAGES[
                    Math.floor(
                        Math.random() *
                            CORRECT_MESSAGES.length
                    )
                ]
            );

            speak(
                'Excellent! That is correct.'
            );
        } else {
            setFeedbackMessage(
                INCORRECT_MESSAGES[
                    Math.floor(
                        Math.random() *
                            INCORRECT_MESSAGES.length
                    )
                ]
            );

            speak(
                "That's okay. Keep going."
            );
        }

        setScreen('feedback');
    }

    // -----------------------------------------------------------------------
    // NEXT ROUND
    // -----------------------------------------------------------------------
    function goToNextRound() {
        if (
            currentRound <
            config.rounds
        ) {
            startRound(
                currentRound + 1,
                difficulty,
                currentNumber
            );
        } else {
            finishGame();
        }
    }

    // -----------------------------------------------------------------------
    // FINISH GAME
    // -----------------------------------------------------------------------
    function finishGame() {
        clearInterval(timerRef.current);

        gameCompletedRef.current =
            true;

        const endTime =
            startTimestamp
                ? Math.round(
                    (Date.now() -
                        startTimestamp) /
                        1000
                )
                : 0;

        const finalCorrectAnswers =
            correctAnswersRef.current;

        const finalScore =
            scoreRef.current;

        const finalHintsUsed =
            hintsUsedRef.current;

        const totalQuestions =
            config.rounds;

        const finalIncorrectAnswers =
            Math.max(
                0,
                totalQuestions -
                    finalCorrectAnswers
            );

        const finalAccuracy =
            totalQuestions > 0
                ? Math.round(
                    (finalCorrectAnswers /
                        totalQuestions) *
                        100
                )
                : 0;

        const questionsCompleted =
            totalQuestions;

        const completionRate =
            totalQuestions > 0
                ? Math.round(
                    (questionsCompleted /
                        totalQuestions) *
                        100
                )
                : 0;

        const mistakeRate =
            totalQuestions > 0
                ? Math.round(
                    (finalIncorrectAnswers /
                        totalQuestions) *
                        100
                )
                : 0;

        const hintRate =
            totalQuestions > 0
                ? Math.round(
                    (finalHintsUsed /
                        totalQuestions) *
                        100
                )
                : 0;

        const responseTimes =
            responseTimesRef.current;

        const averageResponseTime =
            responseTimes.length > 0
                ? Math.round(
                    responseTimes.reduce(
                        (sum, time) =>
                            sum + time,
                        0
                    ) /
                        responseTimes.length
                )
                : 0;

        setCompletionTime(
            endTime
        );

        setScreen('results');

        const gameRecord = {
            // ---------------------------------------------------------------
            // PATIENT
            // ---------------------------------------------------------------
            patient_id:
                patient?.id ||
                patient?.patient_id ||
                'unknown',

            // ---------------------------------------------------------------
            // GAME
            // ---------------------------------------------------------------
            game: 'number_memory',

            gameName: 'Number Memory',

            difficulty,

            difficulty_level:
                difficulty,

            // ---------------------------------------------------------------
            // QUESTIONS / ROUNDS
            // ---------------------------------------------------------------
            rounds:
                totalQuestions,

            total_questions:
                totalQuestions,

            questions_completed:
                questionsCompleted,

            correct_answers:
                finalCorrectAnswers,

            incorrect_answers:
                finalIncorrectAnswers,

            // ---------------------------------------------------------------
            // PERFORMANCE
            // ---------------------------------------------------------------
            accuracy:
                finalAccuracy,

            score:
                finalScore,

            mistake_rate:
                mistakeRate,

            // ---------------------------------------------------------------
            // HINTS
            // ---------------------------------------------------------------
            hints_used:
                finalHintsUsed,

            hint_rate:
                hintRate,

            // ---------------------------------------------------------------
            // TIME
            // ---------------------------------------------------------------
            completion_time:
                endTime,

            session_duration:
                endTime,

            average_response_time:
                averageResponseTime,

            question_response_times:
                responseTimes,

            // ---------------------------------------------------------------
            // COMPLETION
            // ---------------------------------------------------------------
            completion_rate:
                completionRate,

            game_completed:
                true,

            abandoned_game:
                false,

            assistance_required:
                finalHintsUsed > 0,

            // ---------------------------------------------------------------
            // TIMESTAMP
            // ---------------------------------------------------------------
            played_at:
                new Date().toISOString(),

            timestamp:
                new Date().toISOString(),
        };

        handleGameComplete(
            gameRecord
        );
    }

    // -----------------------------------------------------------------------
    // PLAY AGAIN
    // -----------------------------------------------------------------------
    function playAgain() {
        startGame();
    }

    // -----------------------------------------------------------------------
    // CHANGE DIFFICULTY
    // -----------------------------------------------------------------------
    function changeDifficulty() {
        clearInterval(
            timerRef.current
        );

        gameStartedRef.current =
            false;

        setScreen('intro');
    }

    // -----------------------------------------------------------------------
    // HOME
    // -----------------------------------------------------------------------
    function handleHome() {
        clearInterval(
            timerRef.current
        );

        if (
            'speechSynthesis' in window
        ) {
            window.speechSynthesis.cancel();
        }

        if (onHome) {
            onHome();
        }
    }

    // -----------------------------------------------------------------------
    // CURRENT ACCURACY
    // -----------------------------------------------------------------------
    const accuracy =
        config.rounds > 0
            ? Math.round(
                (correctAnswers /
                    config.rounds) *
                    100
            )
            : 0;

    // -----------------------------------------------------------------------
    // PERFORMANCE MESSAGE
    // -----------------------------------------------------------------------
    let performanceMessage =
        "Good try! Let's try another round.";

    if (accuracy >= 90) {
        performanceMessage =
            'Excellent memory! Wonderful work.';
    } else if (accuracy >= 70) {
        performanceMessage =
            'Great job! You remembered many numbers.';
    } else if (accuracy >= 50) {
        performanceMessage =
            'Good effort! Keep practicing.';
    }

    // =========================================================================
    // INTRO SCREEN
    // =========================================================================
    if (screen === 'intro') {
        return (
            <div className="nm-container">
                <header className="nm-header">
                    <div className="nm-brand">
                        <div className="nm-brand-icon">
                            🧠
                        </div>

                        <div>
                            <h1>NeuroPlay</h1>
                            <span>
                                Cognitive Wellness
                            </span>
                        </div>
                    </div>

                    <button
                        className="nm-sound-btn"
                        onClick={() =>
                            setIsMuted(
                                !isMuted
                            )
                        }
                        aria-label={
                            isMuted
                                ? 'Turn sound on'
                                : 'Mute sound'
                        }
                    >
                        {isMuted
                            ? '🔇'
                            : '🔊'}
                    </button>
                </header>

                <main className="nm-main">
                    <div className="nm-intro-card">
                        <div className="nm-game-icon">
                            🔢
                        </div>

                        <h2>
                            Number Memory
                        </h2>

                        <p className="nm-subtitle">
                            Remember numbers
                            and strengthen
                            your memory.
                        </p>

                        <div className="nm-section">
                            <h3>
                                Choose
                                Difficulty
                            </h3>

                            <div className="nm-difficulty-grid">
                                {Object.entries(
                                    DIFFICULTY_CONFIG
                                ).map(
                                    ([
                                        key,
                                        value,
                                    ]) => (
                                        <button
                                            key={
                                                key
                                            }
                                            className={`nm-difficulty-btn ${
                                                difficulty ===
                                                key
                                                    ? 'active'
                                                    : ''
                                            }`}
                                            onClick={() =>
                                                handleDifficultyChange(
                                                    key
                                                )
                                            }
                                        >
                                            <strong>
                                                {
                                                    value.label
                                                }
                                            </strong>

                                            <span>
                                                {
                                                    value.digits
                                                }{' '}
                                                digits
                                            </span>
                                        </button>
                                    )
                                )}
                            </div>
                        </div>

                        <div className="nm-info-box">
                            <h3>
                                How to Play
                            </h3>

                            <ul>
                                <li>
                                    Look carefully
                                    at the number.
                                </li>

                                <li>
                                    Try to remember
                                    the digits.
                                </li>

                                <li>
                                    After the timer
                                    ends, answer
                                    the question.
                                </li>

                                <li>
                                    Take your time.
                                    There is no
                                    need to rush.
                                </li>
                            </ul>
                        </div>

                        <div className="nm-button-group">
                            <button
                                className="nm-primary-btn"
                                onClick={
                                    startGame
                                }
                            >
                                Start Game
                            </button>

                            <button
                                className="nm-secondary-btn"
                                onClick={() =>
                                    speak(
                                        'Look carefully at the number. Try to remember all the digits. When the timer ends, answer the question.'
                                    )
                                }
                            >
                                🔊 Read
                                Instructions
                            </button>

                            <button
                                className="nm-home-btn"
                                onClick={
                                    handleHome
                                }
                            >
                                ← Home
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // =========================================================================
    // OBSERVING SCREEN
    // =========================================================================
    if (screen === 'observing') {
        const progress =
            config.observationTime > 0
                ? Math.round(
                    ((config.observationTime -
                        remainingTime) /
                        config.observationTime) *
                        100
                )
                : 0;

        return (
            <div className="nm-container">
                <header className="nm-header">
                    <div className="nm-brand">
                        <div className="nm-brand-icon">
                            🧠
                        </div>

                        <div>
                            <h1>NeuroPlay</h1>
                            <span>
                                Number Memory
                            </span>
                        </div>
                    </div>

                    <div className="nm-header-actions">
                        <button
                            className="nm-sound-btn"
                            onClick={() =>
                                setIsMuted(
                                    !isMuted
                                )
                            }
                        >
                            {isMuted
                                ? '🔇'
                                : '🔊'}
                        </button>
                    </div>
                </header>

                <main className="nm-main">
                    <div className="nm-game-card">
                        <div className="nm-progress-header">
                            <div>
                                Round{' '}
                                <strong>
                                    {
                                        currentRound
                                    }
                                </strong>{' '}
                                of{' '}
                                <strong>
                                    {
                                        config.rounds
                                    }
                                </strong>
                            </div>

                            <div>
                                Score:{' '}
                                <strong>
                                    {score}
                                </strong>
                            </div>
                        </div>

                        <div className="nm-number-area">
                            <p className="nm-instruction-text">
                                Remember this
                                number
                            </p>

                            <div className="nm-number-display">
                                {
                                    currentNumber
                                }
                            </div>

                            <div className="nm-timer">
                                <span>
                                    ⏱️
                                </span>

                                <strong>
                                    {
                                        remainingTime
                                    }
                                </strong>

                                <span>
                                    seconds
                                </span>
                            </div>
                        </div>

                        <div className="nm-progress-track">
                            <div
                                className="nm-progress-fill"
                                style={{
                                    width: `${progress}%`,
                                }}
                            />
                        </div>

                        <p className="nm-gentle-text">
                            Take your time and
                            look carefully.
                        </p>
                    </div>
                </main>
            </div>
        );
    }

    // =========================================================================
    // RECALL SCREEN
    // =========================================================================
    if (screen === 'recall') {
        const isFullQuestion =
            currentQuestion?.type ===
            'full';

        return (
            <div className="nm-container">
                <header className="nm-header">
                    <div className="nm-brand">
                        <div className="nm-brand-icon">
                            🧠
                        </div>

                        <div>
                            <h1>NeuroPlay</h1>
                            <span>
                                Number Memory
                            </span>
                        </div>
                    </div>

                    <button
                        className="nm-sound-btn"
                        onClick={() =>
                            setIsMuted(
                                !isMuted
                            )
                        }
                    >
                        {isMuted
                            ? '🔇'
                            : '🔊'}
                    </button>
                </header>

                <main className="nm-main">
                    <div className="nm-game-card nm-recall-card">
                        <div className="nm-round-badge">
                            Round{' '}
                            {currentRound} of{' '}
                            {config.rounds}
                        </div>

                        <h2 className="nm-question">
                            {
                                currentQuestion?.prompt
                            }
                        </h2>

                        {currentQuestion?.display && (
                            <div className="nm-missing-display">
                                {
                                    currentQuestion.display
                                }
                            </div>
                        )}

                        {isFullQuestion ? (
                            <div className="nm-answer-area">
                                <input
                                    ref={
                                        inputRef
                                    }
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={
                                        config.digits
                                    }
                                    value={
                                        userAnswer
                                    }
                                    onChange={(
                                        e
                                    ) => {
                                        const value =
                                            e.target.value.replace(
                                                /\D/g,
                                                ''
                                            );

                                        setUserAnswer(
                                            value
                                        );
                                    }}
                                    onKeyDown={(
                                        e
                                    ) => {
                                        if (
                                            e.key ===
                                            'Enter'
                                        ) {
                                            submitFullAnswer();
                                        }
                                    }}
                                    className="nm-number-input"
                                    placeholder="Enter the number"
                                    aria-label="Enter the number you remember"
                                />

                                <button
                                    className="nm-primary-btn"
                                    onClick={
                                        submitFullAnswer
                                    }
                                    disabled={
                                        !userAnswer.trim()
                                    }
                                >
                                    Submit Answer
                                </button>
                            </div>
                        ) : (
                            <div className="nm-options-grid">
                                {currentQuestion?.options?.map(
                                    (
                                        option
                                    ) => (
                                        <button
                                            key={
                                                option
                                            }
                                            className={`nm-option-btn ${
                                                selectedOption ===
                                                option
                                                    ? 'selected'
                                                    : ''
                                            }`}
                                            onClick={() =>
                                                selectOption(
                                                    option
                                                )
                                            }
                                            disabled={
                                                selectedOption !==
                                                null
                                            }
                                        >
                                            {
                                                option
                                            }
                                        </button>
                                    )
                                )}
                            </div>
                        )}

                        <div className="nm-hint-area">
                            {!showHint ? (
                                <button
                                    className="nm-hint-btn"
                                    onClick={
                                        useHint
                                    }
                                >
                                    💡 Need a
                                    hint?
                                </button>
                            ) : (
                                <div className="nm-hint-box">
                                    <strong>
                                        Hint
                                    </strong>

                                    <p>
                                        {
                                            hintText
                                        }
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // =========================================================================
    // FEEDBACK SCREEN
    // =========================================================================
    if (screen === 'feedback') {
        return (
            <div className="nm-container">
                <header className="nm-header">
                    <div className="nm-brand">
                        <div className="nm-brand-icon">
                            🧠
                        </div>

                        <div>
                            <h1>NeuroPlay</h1>
                            <span>
                                Number Memory
                            </span>
                        </div>
                    </div>

                    <button
                        className="nm-sound-btn"
                        onClick={() =>
                            setIsMuted(
                                !isMuted
                            )
                        }
                    >
                        {isMuted
                            ? '🔇'
                            : '🔊'}
                    </button>
                </header>

                <main className="nm-main">
                    <div className="nm-game-card nm-feedback-card">
                        <div
                            className={`nm-feedback-icon ${
                                wasCorrect
                                    ? 'correct'
                                    : 'incorrect'
                            }`}
                        >
                            {wasCorrect
                                ? '✓'
                                : '💙'}
                        </div>

                        <h2>
                            {wasCorrect
                                ? 'Well Done!'
                                : 'Good Effort!'}
                        </h2>

                        <p className="nm-feedback-message">
                            {
                                feedbackMessage
                            }
                        </p>

                        <div className="nm-answer-review">
                            <div>
                                <span>
                                    Correct
                                    answer
                                </span>

                                <strong>
                                    {
                                        currentQuestion?.correctAnswer
                                    }
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Your
                                    answer
                                </span>

                                <strong>
                                    {currentQuestion?.type ===
                                    'full'
                                        ? userAnswer
                                        : selectedOption}
                                </strong>
                            </div>
                        </div>

                        <button
                            className="nm-primary-btn"
                            onClick={
                                goToNextRound
                            }
                        >
                            {currentRound <
                            config.rounds
                                ? 'Next Round →'
                                : 'See Results'}
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    // =========================================================================
    // RESULTS SCREEN
    // =========================================================================
    if (screen === 'results') {
        return (
            <div className="nm-container">
                <header className="nm-header">
                    <div className="nm-brand">
                        <div className="nm-brand-icon">
                            🧠
                        </div>

                        <div>
                            <h1>NeuroPlay</h1>
                            <span>
                                Number Memory
                            </span>
                        </div>
                    </div>

                    <button
                        className="nm-sound-btn"
                        onClick={() =>
                            setIsMuted(
                                !isMuted
                            )
                        }
                    >
                        {isMuted
                            ? '🔇'
                            : '🔊'}
                    </button>
                </header>

                <main className="nm-main">
                    <div className="nm-game-card nm-results-card">
                        <div className="nm-results-icon">
                            🧠
                        </div>

                        <h2>
                            Game Complete!
                        </h2>

                        <p className="nm-performance-message">
                            {
                                performanceMessage
                            }
                        </p>

                        <div className="nm-score-circle">
                            <strong>
                                {accuracy}%
                            </strong>

                            <span>
                                Accuracy
                            </span>
                        </div>

                        <div className="nm-results-grid">
                            <div className="nm-result-item">
                                <strong>
                                    {score}
                                </strong>

                                <span>
                                    Score
                                </span>
                            </div>

                            <div className="nm-result-item">
                                <strong>
                                    {
                                        correctAnswers
                                    }
                                    /
                                    {
                                        config.rounds
                                    }
                                </strong>

                                <span>
                                    Correct
                                </span>
                            </div>

                            <div className="nm-result-item">
                                <strong>
                                    {
                                        hintsUsed
                                    }
                                </strong>

                                <span>
                                    Hints
                                </span>
                            </div>

                            <div className="nm-result-item">
                                <strong>
                                    {formatTime(
                                        completionTime
                                    )}
                                </strong>

                                <span>
                                    Time
                                </span>
                            </div>
                        </div>

                        <div className="nm-button-group">
                            <button
                                className="nm-primary-btn"
                                onClick={
                                    playAgain
                                }
                            >
                                Play Again
                            </button>

                            <button
                                className="nm-secondary-btn"
                                onClick={
                                    changeDifficulty
                                }
                            >
                                Change
                                Difficulty
                            </button>

                            <button
                                className="nm-home-btn"
                                onClick={
                                    handleHome
                                }
                            >
                                ← Home
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return null;
}