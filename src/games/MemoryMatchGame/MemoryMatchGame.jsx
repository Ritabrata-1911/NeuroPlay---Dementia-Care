import React, { useState, useEffect, useRef } from 'react';
import './MemoryMatchGame.css';

// -----------------------------------------------------------------------------
// CARD DATA
// -----------------------------------------------------------------------------

const BASE_OBJECTS = [
    { id: 'apple', symbol: '🍎', name: 'Apple' },
    { id: 'flower', symbol: '🌸', name: 'Flower' },
    { id: 'house', symbol: '🏠', name: 'House' },
    { id: 'cup', symbol: '☕', name: 'Cup' },
    { id: 'dog', symbol: '🐶', name: 'Dog' },
    { id: 'car', symbol: '🚗', name: 'Car' },
    { id: 'sun', symbol: '☀️', name: 'Sun' },
    { id: 'tree', symbol: '🌳', name: 'Tree' },
    { id: 'star', symbol: '⭐', name: 'Star' },
    { id: 'gift', symbol: '🎁', name: 'Gift' },
];

// -----------------------------------------------------------------------------
// GAME CONFIGURATION
// -----------------------------------------------------------------------------

const GAME_NAME = 'Card Match';
const MAX_ROUNDS = 30;
const ROUNDS_PER_CHECKPOINT = 3;

// -----------------------------------------------------------------------------
// DIFFICULTY CONFIGURATION
// -----------------------------------------------------------------------------

const DIFFICULTY_CONFIG = {
    easy: {
        label: 'Easy',
        pairs: 3,
        columns: 3,
        hints: 3,
    },
    medium: {
        label: 'Medium',
        pairs: 6,
        columns: 4,
        hints: 4,
    },
    hard: {
        label: 'Hard',
        pairs: 10,
        columns: 5,
        hints: 5,
    },
};

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

// Performance threshold.
// A round is considered good when the number of moves
// is no more than 1.5 times the number of pairs.
const GOOD_PERFORMANCE_MULTIPLIER = 1.5;

const MATCH_MESSAGES = [
    'Great match!',
    'Excellent!',
    'Wonderful!',
    'Nicely done!',
];

const MISMATCH_MESSAGES = [
    'Good try! Keep going.',
    'Almost there — try again!',
];

// -----------------------------------------------------------------------------
// HELPER FUNCTIONS
// -----------------------------------------------------------------------------

function shuffle(array) {
    const arr = [...array];

    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr;
}

function buildDeck(difficulty) {
    const config = DIFFICULTY_CONFIG[difficulty];

    const objects = BASE_OBJECTS.slice(0, config.pairs);

    const doubled = objects.flatMap((obj) => [
        {
            ...obj,
            uid: `${obj.id}-a`,
        },
        {
            ...obj,
            uid: `${obj.id}-b`,
        },
    ]);

    return shuffle(doubled).map((card, index) => ({
        ...card,
        index,
        isFlipped: false,
        isMatched: false,
    }));
}

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;

    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatPercentage(value) {
    return `${Number(value || 0).toFixed(1)}%`;
}

function getNextDifficulty(currentDifficulty, isGood) {
    const currentIndex =
        DIFFICULTY_ORDER.indexOf(currentDifficulty);

    if (isGood) {
        return DIFFICULTY_ORDER[
            Math.min(
                currentIndex + 1,
                DIFFICULTY_ORDER.length - 1
            )
        ];
    }

    return DIFFICULTY_ORDER[
        Math.max(currentIndex - 1, 0)
    ];
}

function isGoodRound(moves, pairs) {
    const maximumGoodMoves = Math.ceil(
        pairs * GOOD_PERFORMANCE_MULTIPLIER
    );

    return moves <= maximumGoodMoves;
}

// -----------------------------------------------------------------------------
// ANALYTICS CALCULATION
// -----------------------------------------------------------------------------

function calculateAnalytics(history) {
    const attempts = history.reduce(
        (sum, round) => sum + round.attempts,
        0
    );

    const correctAnswers = history.reduce(
        (sum, round) => sum + round.correctAnswers,
        0
    );

    const incorrectAnswers = history.reduce(
        (sum, round) => sum + round.incorrectAnswers,
        0
    );

    const hintsUsed = history.reduce(
        (sum, round) => sum + round.hintsUsed,
        0
    );

    const completionTime = history.reduce(
        (sum, round) => sum + round.completionTime,
        0
    );

    const accuracy =
        attempts > 0
            ? (correctAnswers / attempts) * 100
            : 0;

    const mistakeRate =
        attempts > 0
            ? (incorrectAnswers / attempts) * 100
            : 0;

    const hintRate =
        attempts > 0
            ? (hintsUsed / attempts) * 100
            : 0;

    const averageResponseTime =
        attempts > 0
            ? completionTime / attempts
            : 0;

    const lastRound =
        history.length > 0
            ? history[history.length - 1]
            : null;

    return {
        accuracy,
        mistake_rate: mistakeRate,
        hint_rate: hintRate,
        completion_time: completionTime,
        average_response_time: averageResponseTime,
        difficulty_level:
            lastRound?.difficulty || 'easy',
        attempts,
        correct_answers: correctAnswers,
        incorrect_answers: incorrectAnswers,
        game_name: GAME_NAME,
    };
}

// -----------------------------------------------------------------------------
// COMPONENT
// -----------------------------------------------------------------------------

export default function MemoryMatchGame({ patient, onHome }) {
    // -------------------------------------------------------------------------
    // GAME STATE
    // -------------------------------------------------------------------------

    const [gameStarted, setGameStarted] = useState(false);

    const [currentRound, setCurrentRound] = useState(1);

    const [difficulty, setDifficulty] =
        useState('easy');

    // -------------------------------------------------------------------------
    // CARD GAME STATE
    // -------------------------------------------------------------------------

    const [cards, setCards] = useState(() =>
        buildDeck('easy')
    );

    const [flippedIndices, setFlippedIndices] =
        useState([]);

    const [isChecking, setIsChecking] =
        useState(false);

    const [moves, setMoves] = useState(0);

    const [matches, setMatches] = useState(0);

    const [hintsRemaining, setHintsRemaining] =
        useState(DIFFICULTY_CONFIG.easy.hints);

    const [hintHighlight, setHintHighlight] =
        useState([]);

    const [message, setMessage] = useState(
        'Find all the matching pairs.'
    );

    // -------------------------------------------------------------------------
    // TIMER
    // -------------------------------------------------------------------------

    const [elapsedSeconds, setElapsedSeconds] =
        useState(0);

    // -------------------------------------------------------------------------
    // COMPLETION / CHECKPOINT STATE
    // -------------------------------------------------------------------------

    const [roundComplete, setRoundComplete] =
        useState(false);

    const [roundResult, setRoundResult] =
        useState(null);

    const [gameComplete, setGameComplete] =
        useState(false);

    const [finalStats, setFinalStats] =
        useState(null);

    // -------------------------------------------------------------------------
    // ROUND HISTORY
    // -------------------------------------------------------------------------

    const [roundHistory, setRoundHistory] =
        useState([]);

    const timerRef = useRef(null);

    const config =
        DIFFICULTY_CONFIG[difficulty];

    // -------------------------------------------------------------------------
    // TIMER
    // -------------------------------------------------------------------------

    useEffect(() => {
        if (
            gameStarted &&
            !gameComplete &&
            !roundComplete
        ) {
            timerRef.current = setInterval(() => {
                setElapsedSeconds(
                    (prev) => prev + 1
                );
            }, 1000);
        }

        return () => {
            clearInterval(timerRef.current);
        };
    }, [
        gameStarted,
        gameComplete,
        roundComplete,
    ]);

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------

    useEffect(() => {
        return () => {
            clearInterval(timerRef.current);
        };
    }, []);

    // -------------------------------------------------------------------------
    // RESOLVE TWO FLIPPED CARDS
    // -------------------------------------------------------------------------

    useEffect(() => {
        if (flippedIndices.length !== 2) {
            return;
        }

        setIsChecking(true);

        const [i1, i2] = flippedIndices;

        const isMatch =
            cards[i1].id === cards[i2].id;

        const timeout = setTimeout(() => {
            setCards((prevCards) =>
                prevCards.map(
                    (card, idx) => {
                        if (
                            idx !== i1 &&
                            idx !== i2
                        ) {
                            return card;
                        }

                        return isMatch
                            ? {
                                  ...card,
                                  isMatched: true,
                                  isFlipped: true,
                              }
                            : {
                                  ...card,
                                  isFlipped: false,
                              };
                    }
                )
            );

            if (isMatch) {
                setMatches(
                    (prev) => prev + 1
                );

                setMessage(
                    MATCH_MESSAGES[
                        Math.floor(
                            Math.random() *
                                MATCH_MESSAGES.length
                        )
                    ]
                );
            } else {
                setMessage(
                    MISMATCH_MESSAGES[
                        Math.floor(
                            Math.random() *
                                MISMATCH_MESSAGES.length
                        )
                    ]
                );
            }

            setFlippedIndices([]);

            setIsChecking(false);
        }, 900);

        return () =>
            clearTimeout(timeout);
    }, [flippedIndices, cards]);

    // -------------------------------------------------------------------------
    // CHECK ROUND COMPLETION
    // -------------------------------------------------------------------------

    useEffect(() => {
        if (
            !gameStarted ||
            matches === 0 ||
            matches !== config.pairs ||
            roundComplete ||
            gameComplete
        ) {
            return;
        }

        clearInterval(timerRef.current);

        const hintsUsed =
            config.hints -
            hintsRemaining;

        const correctAnswers = matches;

        const incorrectAnswers =
            Math.max(
                0,
                moves - correctAnswers
            );

        const attempts = moves;

        const roundGood =
            isGoodRound(
                moves,
                config.pairs
            );

        const movePenalty =
            Math.max(
                0,
                moves - config.pairs
            ) * 5;

        const hintPenalty =
            hintsUsed * 20;

        const roundScore =
            Math.max(
                0,
                config.pairs * 100 -
                    movePenalty -
                    hintPenalty
            );

        const nextDifficulty =
            getNextDifficulty(
                difficulty,
                roundGood
            );

        const roundStats = {
            round: currentRound,

            difficulty,

            moves,

            attempts,

            matches,

            hintsUsed,

            correctAnswers,

            incorrectAnswers,

            completionTime:
                elapsedSeconds,

            averageResponseTime:
                attempts > 0
                    ? elapsedSeconds /
                      attempts
                    : 0,

            accuracy:
                attempts > 0
                    ? (
                          correctAnswers /
                          attempts
                      ) * 100
                    : 0,

            mistakeRate:
                attempts > 0
                    ? (
                          incorrectAnswers /
                          attempts
                      ) * 100
                    : 0,

            hintRate:
                attempts > 0
                    ? (hintsUsed /
                          attempts) *
                      100
                    : 0,

            score: roundScore,

            good: roundGood,

            nextDifficulty,
        };

        const finalHistory = [
            ...roundHistory,
            roundStats,
        ];

        setRoundHistory(
            finalHistory
        );

        // ---------------------------------------------------------------------
        // FINAL ROUND - ROUND 30
        // ---------------------------------------------------------------------

        if (
            currentRound >=
            MAX_ROUNDS
        ) {
            const analytics =
                calculateAnalytics(
                    finalHistory
                );

            const totalScore =
                finalHistory.reduce(
                    (sum, round) =>
                        sum + round.score,
                    0
                );

            const goodRounds =
                finalHistory.filter(
                    (round) => round.good
                ).length;

            const overallStats = {
                ...analytics,

                totalRounds:
                    finalHistory.length,

                totalScore,

                goodRounds,

                averageScore:
                    finalHistory.length >
                    0
                        ? Math.round(
                              totalScore /
                                  finalHistory.length
                          )
                        : 0,

                roundHistory:
                    finalHistory,
            };

            setFinalStats(
                overallStats
            );

            setRoundResult(
                roundStats
            );

            setRoundComplete(
                true
            );

            setGameComplete(
                true
            );

            setMessage(
                'Wonderful! You completed all 30 rounds.'
            );

            const backendAnalytics = {
                userId:
                    patient?.id ||
                    patient?.full_name ||
                    'unknown',

                ...analytics,

                total_rounds:
                    MAX_ROUNDS,

                completed_rounds:
                    finalHistory.length,

                round_history:
                    finalHistory,

                total_score:
                    totalScore,

                good_rounds:
                    goodRounds,

                completed: true,

                timestamp:
                    new Date().toISOString(),
            };

            console.log(
                'Card Match analytics:',
                backendAnalytics
            );

            return;
        }

        // ---------------------------------------------------------------------
        // ROUND CHECKPOINT
        // ---------------------------------------------------------------------

        setRoundResult(
            roundStats
        );

        setRoundComplete(
            true
        );

        const analytics =
            calculateAnalytics(
                finalHistory
            );

        const checkpointAnalytics = {
            userId:
                patient?.id ||
                patient?.full_name ||
                'unknown',

            ...analytics,

            completed_rounds:
                finalHistory.length,

            round_history:
                finalHistory,

            completed: false,

            timestamp:
                new Date().toISOString(),
        };

        console.log(
            'Card Match checkpoint analytics:',
            checkpointAnalytics
        );
    }, [
        matches,
        gameStarted,
        config.pairs,
        config.hints,
        hintsRemaining,
        moves,
        currentRound,
        difficulty,
        elapsedSeconds,
        roundComplete,
        gameComplete,
        roundHistory,
        patient,
    ]);

    // -------------------------------------------------------------------------
    // START GAME
    // -------------------------------------------------------------------------

    function handleStartGame() {
        clearInterval(
            timerRef.current
        );

        setGameStarted(true);

        setGameComplete(false);

        setRoundComplete(false);

        setCurrentRound(1);

        setDifficulty('easy');

        setRoundHistory([]);

        setFinalStats(null);

        setRoundResult(null);

        setCards(
            buildDeck('easy')
        );

        setFlippedIndices([]);

        setIsChecking(false);

        setMoves(0);

        setMatches(0);

        setHintsRemaining(
            DIFFICULTY_CONFIG.easy.hints
        );

        setHintHighlight([]);

        setMessage(
            'Round 1 — Find all the matching pairs.'
        );

        setElapsedSeconds(0);
    }

    // -------------------------------------------------------------------------
    // CONTINUE TO NEXT ROUND
    // -------------------------------------------------------------------------

    function continueToNextRound() {
        const nextDifficulty =
            roundResult?.nextDifficulty ||
            difficulty;

        const nextRound =
            currentRound + 1;

        clearInterval(
            timerRef.current
        );

        setCurrentRound(
            nextRound
        );

        setDifficulty(
            nextDifficulty
        );

        setCards(
            buildDeck(
                nextDifficulty
            )
        );

        setFlippedIndices([]);

        setIsChecking(false);

        setMoves(0);

        setMatches(0);

        setHintsRemaining(
            DIFFICULTY_CONFIG[
                nextDifficulty
            ].hints
        );

        setHintHighlight([]);

        setElapsedSeconds(0);

        setRoundComplete(false);

        setRoundResult(null);

        setMessage(
            `Round ${nextRound} — ${DIFFICULTY_CONFIG[nextDifficulty].label} level.`
        );
    }

    // -------------------------------------------------------------------------
    // CARD CLICK
    // -------------------------------------------------------------------------

    function handleCardClick(index) {
        if (
            isChecking ||
            gameComplete ||
            roundComplete
        ) {
            return;
        }

        const card =
            cards[index];

        if (!card) {
            return;
        }

        if (
            card.isFlipped ||
            card.isMatched
        ) {
            return;
        }

        if (
            flippedIndices.length === 2
        ) {
            return;
        }

        setCards((prev) =>
            prev.map((c, i) =>
                i === index
                    ? {
                          ...c,
                          isFlipped:
                              true,
                      }
                    : c
            )
        );

        setFlippedIndices(
            (prev) => [
                ...prev,
                index,
            ]
        );

        // One move/attempt = two selected cards.
        if (
            flippedIndices.length ===
            1
        ) {
            setMoves(
                (prev) => prev + 1
            );
        }
    }

    // -------------------------------------------------------------------------
    // KEYBOARD ACCESSIBILITY
    // -------------------------------------------------------------------------

    function handleCardKeyDown(
        event,
        index
    ) {
        if (
            event.key ===
                'Enter' ||
            event.key === ' '
        ) {
            event.preventDefault();

            handleCardClick(index);
        }
    }

    // -------------------------------------------------------------------------
    // HINT
    // -------------------------------------------------------------------------

    function useHint() {
        if (
            hintsRemaining <= 0 ||
            isChecking ||
            gameComplete ||
            roundComplete ||
            flippedIndices.length >
                0
        ) {
            return;
        }

        const unmatched =
            cards.filter(
                (c) => !c.isMatched
            );

        if (
            unmatched.length === 0
        ) {
            return;
        }

        const targetId =
            unmatched[0].id;

        const idxs =
            cards.reduce(
                (acc, c, i) => {
                    if (
                        c.id ===
                            targetId &&
                        !c.isMatched
                    ) {
                        acc.push(i);
                    }

                    return acc;
                },
                []
            );

        setHintHighlight(
            idxs
        );

        setHintsRemaining(
            (prev) => prev - 1
        );

        setMessage(
            "Here's a hint — watch closely!"
        );

        setTimeout(() => {
            setHintHighlight([]);
        }, 1500);
    }

    // -------------------------------------------------------------------------
    // RESTART ENTIRE GAME
    // -------------------------------------------------------------------------

    function restartEntireGame() {
        clearInterval(
            timerRef.current
        );

        setGameStarted(false);

        setCurrentRound(1);

        setDifficulty('easy');

        setCards(
            buildDeck('easy')
        );

        setFlippedIndices([]);

        setIsChecking(false);

        setMoves(0);

        setMatches(0);

        setHintsRemaining(
            DIFFICULTY_CONFIG.easy.hints
        );

        setHintHighlight([]);

        setMessage(
            'Find all the matching pairs.'
        );

        setElapsedSeconds(0);

        setRoundComplete(false);

        setRoundResult(null);

        setGameComplete(false);

        setFinalStats(null);

        setRoundHistory([]);
    }

    // -------------------------------------------------------------------------
    // SETUP SCREEN
    // -------------------------------------------------------------------------

    if (!gameStarted) {
        return (
            <div className="memory-game-container">
                <header className="memory-game-header">
                    <h1>Card Match</h1>

                    <p>
                        Find all the matching pairs
                    </p>
                </header>

                <div className="memory-round-setup">
                    <div className="memory-setup-card">
                        <h2>
                            Ready to Play?
                        </h2>

                        <p className="memory-setup-description">
                            The game starts at
                            Easy level.
                            Your performance
                            will automatically
                            adjust the
                            difficulty as you
                            progress.
                        </p>

                        <div className="memory-level-info">
                            <div className="level-info-item">
                                <span className="level-info-title">
                                    🟢 Easy
                                </span>

                                <span>
                                    3 pairs
                                </span>
                            </div>

                            <div className="level-info-item">
                                <span className="level-info-title">
                                    🟡 Medium
                                </span>

                                <span>
                                    6 pairs
                                </span>
                            </div>

                            <div className="level-info-item">
                                <span className="level-info-title">
                                    🔵 Hard
                                </span>

                                <span>
                                    10 pairs
                                </span>
                            </div>
                        </div>

                        <p className="round-limit-text">
                            The game has a maximum
                            of 30 rounds.
                            You can continue after
                            every 3 rounds.
                        </p>

                        <button
                            className="memory-start-btn"
                            onClick={
                                handleStartGame
                            }
                        >
                            ▶ Start
                        </button>

                        <button
                            className="memory-setup-home-btn"
                            onClick={onHome}
                        >
                            🏠 Back to Patient Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // MAIN GAME
    // -------------------------------------------------------------------------

    return (
        <div className="memory-game-container">
            <header className="memory-game-header">
                <h1>Card Match</h1>

                <p>
                    Find all the matching pairs
                </p>
            </header>

            {/* ROUND PROGRESS */}

            <div className="memory-round-progress">
                <div className="round-progress-item">
                    <span className="round-progress-label">
                        Round
                    </span>

                    <span className="round-progress-value">
                        {currentRound} /{' '}
                        {MAX_ROUNDS}
                    </span>
                </div>

                <div
                    className={`round-level-badge ${difficulty}`}
                >
                    {config.label} Level
                </div>
            </div>

            {/* STATS */}

            <div className="memory-stats-bar">
                <div className="memory-stat">
                    <span className="stat-label">
                        Moves
                    </span>

                    <span className="stat-value">
                        {moves}
                    </span>
                </div>

                <div className="memory-stat">
                    <span className="stat-label">
                        Matches
                    </span>

                    <span className="stat-value">
                        {matches}/
                        {config.pairs}
                    </span>
                </div>

                <div className="memory-stat">
                    <span className="stat-label">
                        Level
                    </span>

                    <span className="stat-value">
                        {config.label}
                    </span>
                </div>

                <div className="memory-stat">
                    <span className="stat-label">
                        Time
                    </span>

                    <span className="stat-value">
                        {formatTime(
                            elapsedSeconds
                        )}
                    </span>
                </div>

                <div className="memory-stat">
                    <span className="stat-label">
                        Hints left
                    </span>

                    <span className="stat-value">
                        {hintsRemaining}
                    </span>
                </div>
            </div>

            <p
                className="memory-message"
                aria-live="polite"
            >
                {message}
            </p>

            {/* BOARD */}

            <div
                className={`memory-board cols-${config.columns}`}
                role="group"
                aria-label="Card match game board"
            >
                {cards.map(
                    (card, index) => {
                        const isRevealed =
                            card.isFlipped ||
                            card.isMatched ||
                            hintHighlight.includes(
                                index
                            );

                        return (
                            <button
                                key={
                                    card.uid
                                }
                                type="button"
                                className={`
                                    memory-card
                                    ${
                                        isRevealed
                                            ? 'flipped'
                                            : ''
                                    }
                                    ${
                                        card.isMatched
                                            ? 'matched'
                                            : ''
                                    }
                                    ${
                                        hintHighlight.includes(
                                            index
                                        )
                                            ? 'hint-active'
                                            : ''
                                    }
                                `}
                                onClick={() =>
                                    handleCardClick(
                                        index
                                    )
                                }
                                onKeyDown={(
                                    e
                                ) =>
                                    handleCardKeyDown(
                                        e,
                                        index
                                    )
                                }
                                aria-label={
                                    isRevealed
                                        ? `${card.name} card${
                                              card.isMatched
                                                  ? ', matched'
                                                  : ''
                                          }`
                                        : `Hidden card ${
                                              index +
                                              1
                                          }. Press to flip.`
                                }
                                disabled={
                                    gameComplete ||
                                    roundComplete
                                }
                            >
                                <span className="memory-card-inner">
                                    {isRevealed ? (
                                        <>
                                            <span
                                                className="memory-card-symbol"
                                                aria-hidden="true"
                                            >
                                                {
                                                    card.symbol
                                                }
                                            </span>

                                            <span className="memory-card-name">
                                                {
                                                    card.name
                                                }
                                            </span>
                                        </>
                                    ) : (
                                        <span
                                            className="memory-card-back"
                                            aria-hidden="true"
                                        >
                                            ?
                                        </span>
                                    )}
                                </span>
                            </button>
                        );
                    }
                )}
            </div>

            {/* CONTROLS */}

            <div className="memory-controls">
                <button
                    className="memory-control-btn restart-btn"
                    onClick={
                        restartEntireGame
                    }
                >
                    🔄 Restart Game
                </button>

                <button
                    className="memory-control-btn hint-btn"
                    onClick={useHint}
                    disabled={
                        hintsRemaining <=
                            0 ||
                        gameComplete ||
                        roundComplete
                    }
                >
                    💡 Hint (
                    {hintsRemaining})
                </button>

                <button
                    className="memory-control-btn home-btn"
                    onClick={onHome}
                >
                    🏠 Patient Dashboard
                </button>
            </div>

            {/* ROUND CHECKPOINT / RESULT */}

            {roundComplete &&
                roundResult &&
                !gameComplete && (
                    <div
                        className="memory-round-overlay"
                        role="dialog"
                        aria-live="assertive"
                    >
                        <div className="memory-round-card">
                            <div
                                className={`round-result-icon ${
                                    roundResult.good
                                        ? 'good'
                                        : 'needs-practice'
                                }`}
                            >
                                {roundResult.good
                                    ? '🎉'
                                    : '💪'}
                            </div>

                            <h2>
                                Round{' '}
                                {
                                    roundResult.round
                                }{' '}
                                Complete!
                            </h2>

                            <p className="round-result-level">
                                {
                                    DIFFICULTY_CONFIG[
                                        roundResult
                                            .difficulty
                                    ].label
                                }{' '}
                                Level
                            </p>

                            <div className="round-result-status">
                                <strong>
                                    {roundResult.good
                                        ? 'Great Performance!'
                                        : 'Good Effort!'}
                                </strong>

                                <span>
                                    {roundResult.good
                                        ? 'You performed well in this round.'
                                        : 'Take your time and keep practicing.'}
                                </span>
                            </div>

                            {/* CHECKPOINT RESULTS */}

                            <div className="round-result-analytics">
                                <div>
                                    <span>
                                        Accuracy
                                    </span>

                                    <strong>
                                        {formatPercentage(
                                            roundResult.accuracy
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Mistake Rate
                                    </span>

                                    <strong>
                                        {formatPercentage(
                                            roundResult.mistakeRate
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Hint Rate
                                    </span>

                                    <strong>
                                        {formatPercentage(
                                            roundResult.hintRate
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Completion Time
                                    </span>

                                    <strong>
                                        {formatTime(
                                            roundResult.completionTime
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Avg. Response
                                    </span>

                                    <strong>
                                        {roundResult.averageResponseTime.toFixed(
                                            1
                                        )}
                                        s
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Difficulty
                                    </span>

                                    <strong>
                                        {
                                            DIFFICULTY_CONFIG[
                                                roundResult
                                                    .difficulty
                                            ].label
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Attempts
                                    </span>

                                    <strong>
                                        {
                                            roundResult.attempts
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Correct
                                    </span>

                                    <strong>
                                        {
                                            roundResult.correctAnswers
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Incorrect
                                    </span>

                                    <strong>
                                        {
                                            roundResult.incorrectAnswers
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Game
                                    </span>

                                    <strong>
                                        Card Match
                                    </strong>
                                </div>
                            </div>

                            <div className="next-level-message">
                                <span>
                                    Next Round
                                </span>

                                <strong>
                                    {
                                        DIFFICULTY_CONFIG[
                                            roundResult
                                                .nextDifficulty
                                        ].label
                                    }
                                </strong>
                            </div>

                            {/* CONTINUE AFTER EVERY 3 ROUNDS */}

                            <div className="checkpoint-message">
                                <strong>
                                    {roundResult.round %
                                        ROUNDS_PER_CHECKPOINT ===
                                    0
                                        ? `You have completed ${roundResult.round} rounds.`
                                        : 'Round complete.'}
                                </strong>

                                <span>
                                    Continue when you are
                                    ready for the next round.
                                </span>
                            </div>

                            <div className="round-checkpoint-actions">
                                <button
                                    className="memory-control-btn restart-btn"
                                    onClick={
                                        continueToNextRound
                                    }
                                >
                                    ▶ Continue
                                </button>

                                <button
                                    className="memory-control-btn home-btn"
                                    onClick={
                                        onHome
                                    }
                                >
                                    🏠 Back to Patient Dashboard
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            {/* FINAL RESULT */}

            {gameComplete &&
                finalStats && (
                    <div
                        className="memory-complete-overlay"
                        role="dialog"
                        aria-live="assertive"
                    >
                        <div className="memory-complete-card">
                            <div className="final-result-icon">
                                🎉
                            </div>

                            <h2>
                                Card Match Complete!
                            </h2>

                            <p>
                                Wonderful work! You
                                completed all 30
                                rounds.
                            </p>

                            {/* FINAL ANALYTICS */}

                            <div className="final-analytics-grid">
                                <div className="final-analytics-item">
                                    <span>
                                        Accuracy
                                    </span>

                                    <strong>
                                        {formatPercentage(
                                            finalStats.accuracy
                                        )}
                                    </strong>
                                </div>

                                <div className="final-analytics-item">
                                    <span>
                                        Mistake Rate
                                    </span>

                                    <strong>
                                        {formatPercentage(
                                            finalStats.mistake_rate
                                        )}
                                    </strong>
                                </div>

                                <div className="final-analytics-item">
                                    <span>
                                        Hint Rate
                                    </span>

                                    <strong>
                                        {formatPercentage(
                                            finalStats.hint_rate
                                        )}
                                    </strong>
                                </div>

                                <div className="final-analytics-item">
                                    <span>
                                        Completion Time
                                    </span>

                                    <strong>
                                        {formatTime(
                                            finalStats.completion_time
                                        )}
                                    </strong>
                                </div>

                                <div className="final-analytics-item">
                                    <span>
                                        Avg. Response
                                    </span>

                                    <strong>
                                        {finalStats.average_response_time.toFixed(
                                            1
                                        )}
                                        s
                                    </strong>
                                </div>

                                <div className="final-analytics-item">
                                    <span>
                                        Difficulty
                                    </span>

                                    <strong>
                                        {
                                            DIFFICULTY_CONFIG[
                                                finalStats.difficulty_level
                                            ].label
                                        }
                                    </strong>
                                </div>

                                <div className="final-analytics-item">
                                    <span>
                                        Attempts
                                    </span>

                                    <strong>
                                        {
                                            finalStats.attempts
                                        }
                                    </strong>
                                </div>

                                <div className="final-analytics-item">
                                    <span>
                                        Correct Answers
                                    </span>

                                    <strong>
                                        {
                                            finalStats.correct_answers
                                        }
                                    </strong>
                                </div>

                                <div className="final-analytics-item">
                                    <span>
                                        Incorrect Answers
                                    </span>

                                    <strong>
                                        {
                                            finalStats.incorrect_answers
                                        }
                                    </strong>
                                </div>

                                <div className="final-analytics-item">
                                    <span>
                                        Game Name
                                    </span>

                                    <strong>
                                        Card Match
                                    </strong>
                                </div>
                            </div>

                            <div className="final-result-summary">
                                <div className="final-summary-item">
                                    <span>
                                        Rounds
                                    </span>

                                    <strong>
                                        {
                                            finalStats.totalRounds
                                        }
                                    </strong>
                                </div>

                                <div className="final-summary-item">
                                    <span>
                                        Good Rounds
                                    </span>

                                    <strong>
                                        {
                                            finalStats.goodRounds
                                        }
                                    </strong>
                                </div>

                                <div className="final-summary-item">
                                    <span>
                                        Total Score
                                    </span>

                                    <strong>
                                        {
                                            finalStats.totalScore
                                        }
                                    </strong>
                                </div>

                                <div className="final-summary-item">
                                    <span>
                                        Average Score
                                    </span>

                                    <strong>
                                        {
                                            finalStats.averageScore
                                        }
                                    </strong>
                                </div>
                            </div>

                            <p className="final-result-message">
                                {finalStats.goodRounds ===
                                finalStats.totalRounds
                                    ? 'Excellent work! You performed well throughout the game.'
                                    : finalStats.goodRounds >
                                      finalStats.totalRounds /
                                          2
                                    ? 'Great job! You showed good memory performance across the rounds.'
                                    : 'Good effort! Keep practicing regularly to strengthen your memory skills.'}
                            </p>

                            <div className="memory-complete-actions">
                                <button
                                    className="memory-control-btn restart-btn"
                                    onClick={
                                        restartEntireGame
                                    }
                                >
                                    🔄 Play Again
                                </button>

                                <button
                                    className="memory-control-btn dashboard-btn"
                                    onClick={
                                        onHome
                                    }
                                >
                                    🏠 Back to Patient Dashboard
                                </button>
                            </div>
                        </div>
                    </div>
                )}
        </div>
    );
}