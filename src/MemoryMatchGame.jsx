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

const MAX_ROUNDS = 20;

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

// -----------------------------------------------------------------------------
// ADAPTIVE DIFFICULTY FUNCTIONS
// -----------------------------------------------------------------------------

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
// COMPONENT
// -----------------------------------------------------------------------------

export default function MemoryMatchGame({ patient, onHome }) {
    // -------------------------------------------------------------------------
    // GAME SETUP
    // -------------------------------------------------------------------------

    const [totalRounds, setTotalRounds] = useState('');
    const [roundInputError, setRoundInputError] = useState('');
    const [gameStarted, setGameStarted] = useState(false);

    // -------------------------------------------------------------------------
    // ROUND / DIFFICULTY
    // -------------------------------------------------------------------------

    const [currentRound, setCurrentRound] = useState(1);
    const [difficulty, setDifficulty] = useState('easy');

    // -------------------------------------------------------------------------
    // CARD GAME STATE
    // -------------------------------------------------------------------------

    const [cards, setCards] = useState(() =>
        buildDeck('easy')
    );

    const [flippedIndices, setFlippedIndices] = useState([]);
    const [isChecking, setIsChecking] = useState(false);

    const [moves, setMoves] = useState(0);
    const [matches, setMatches] = useState(0);

    const [hintsRemaining, setHintsRemaining] = useState(
        DIFFICULTY_CONFIG.easy.hints
    );

    const [hintHighlight, setHintHighlight] = useState([]);

    const [message, setMessage] = useState(
        'Find all the matching pairs.'
    );

    // -------------------------------------------------------------------------
    // TIMER
    // -------------------------------------------------------------------------

    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    // -------------------------------------------------------------------------
    // ROUND / GAME COMPLETION
    // -------------------------------------------------------------------------

    const [roundComplete, setRoundComplete] = useState(false);
    const [roundResult, setRoundResult] = useState(null);

    const [gameComplete, setGameComplete] = useState(false);
    const [finalStats, setFinalStats] = useState(null);

    // -------------------------------------------------------------------------
    // ROUND HISTORY
    // -------------------------------------------------------------------------

    const [roundHistory, setRoundHistory] = useState([]);

    const timerRef = useRef(null);
    const nextRoundTimerRef = useRef(null);

    const config = DIFFICULTY_CONFIG[difficulty];

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
                setElapsedSeconds((prev) => prev + 1);
            }, 1000);
        }

        return () => {
            clearInterval(timerRef.current);
        };
    }, [gameStarted, gameComplete, roundComplete]);

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------

    useEffect(() => {
        return () => {
            clearInterval(timerRef.current);
            clearTimeout(nextRoundTimerRef.current);
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
                prevCards.map((card, idx) => {
                    if (idx !== i1 && idx !== i2) {
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
                })
            );

            if (isMatch) {
                setMatches((prev) => prev + 1);

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

        return () => clearTimeout(timeout);
    }, [flippedIndices]);

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
            config.hints - hintsRemaining;

        const roundGood = isGoodRound(
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

        const roundScore = Math.max(
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
            hintsUsed,
            completionTime: elapsedSeconds,
            score: roundScore,
            good: roundGood,
            nextDifficulty,
        };

        const finalHistory = [
            ...roundHistory,
            roundStats,
        ];

        setRoundHistory(finalHistory);

        // ---------------------------------------------------------------------
        // FINAL ROUND
        // ---------------------------------------------------------------------

        if (
            currentRound >=
            Number(totalRounds)
        ) {
            const totalScore =
                finalHistory.reduce(
                    (sum, round) =>
                        sum + round.score,
                    0
                );

            const totalMoves =
                finalHistory.reduce(
                    (sum, round) =>
                        sum + round.moves,
                    0
                );

            const totalHints =
                finalHistory.reduce(
                    (sum, round) =>
                        sum + round.hintsUsed,
                    0
                );

            const totalTime =
                finalHistory.reduce(
                    (sum, round) =>
                        sum +
                        round.completionTime,
                    0
                );

            const goodRounds =
                finalHistory.filter(
                    (round) => round.good
                ).length;

            const overallStats = {
                totalRounds:
                    Number(totalRounds),

                totalScore,

                totalMoves,

                totalHints,

                totalTime,

                goodRounds,

                averageScore:
                    finalHistory.length > 0
                        ? Math.round(
                              totalScore /
                                  finalHistory.length
                          )
                        : 0,
            };

            setFinalStats(overallStats);

            setRoundResult(roundStats);

            setRoundComplete(true);

            setGameComplete(true);

            setMessage(
                'Wonderful! You completed all the rounds.'
            );

            const analytics = {
                userId:
                    patient?.id ||
                    patient?.full_name ||
                    'unknown',

                gameName: 'Memory Match',

                totalRounds:
                    Number(totalRounds),

                completedRounds:
                    finalHistory.length,

                roundHistory:
                    finalHistory,

                totalScore,

                totalMoves,

                totalHints,

                totalTime,

                goodRounds,

                completed: true,

                timestamp:
                    new Date().toISOString(),
            };

            console.log(
                'Memory Match analytics:',
                analytics
            );

            return;
        }

        // ---------------------------------------------------------------------
        // CURRENT ROUND COMPLETED
        // ---------------------------------------------------------------------

        setRoundResult(roundStats);

        setRoundComplete(true);

        if (roundGood) {
            if (difficulty === 'hard') {
                setMessage(
                    'Excellent performance! You are already at the hardest level.'
                );
            } else {
                setMessage(
                    `Great job! The next round will be ${DIFFICULTY_CONFIG[nextDifficulty].label}.`
                );
            }
        } else {
            if (difficulty === 'easy') {
                setMessage(
                    'Good effort! We will keep the next round at Easy.'
                );
            } else {
                setMessage(
                    `Keep practicing! The next round will be ${DIFFICULTY_CONFIG[nextDifficulty].label}.`
                );
            }
        }

        nextRoundTimerRef.current =
            setTimeout(() => {
                startNextRound(
                    nextDifficulty
                );
            }, 2500);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matches]);

    // -------------------------------------------------------------------------
    // START GAME
    // -------------------------------------------------------------------------

    function handleStartGame() {
        const rounds = Number(totalRounds);

        if (
            totalRounds === '' ||
            !Number.isInteger(rounds)
        ) {
            setRoundInputError(
                'Please enter a valid number of rounds.'
            );
            return;
        }

        if (rounds < 1) {
            setRoundInputError(
                'Number of rounds cannot be less than 1.'
            );
            return;
        }

        if (rounds > MAX_ROUNDS) {
            setRoundInputError(
                'Number of rounds cannot be greater than 20.'
            );
            return;
        }

        setRoundInputError('');

        clearInterval(timerRef.current);

        setGameStarted(true);

        setGameComplete(false);

        setRoundComplete(false);

        setCurrentRound(1);

        setDifficulty('easy');

        setRoundHistory([]);

        setFinalStats(null);

        setRoundResult(null);

        setCards(buildDeck('easy'));

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
    // START NEXT ROUND
    // -------------------------------------------------------------------------

    function startNextRound(nextDifficulty) {
        clearInterval(timerRef.current);

        const nextRound =
            currentRound + 1;

        setCurrentRound(nextRound);

        setDifficulty(nextDifficulty);

        setCards(
            buildDeck(nextDifficulty)
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

        const card = cards[index];

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
                          isFlipped: true,
                      }
                    : c
            )
        );

        setFlippedIndices((prev) => [
            ...prev,
            index,
        ]);

        // One move = two selected cards.
        if (flippedIndices.length === 1) {
            setMoves((prev) => prev + 1);
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
            event.key === 'Enter' ||
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
            flippedIndices.length > 0
        ) {
            return;
        }

        const unmatched =
            cards.filter(
                (c) => !c.isMatched
            );

        if (unmatched.length === 0) {
            return;
        }

        const targetId =
            unmatched[0].id;

        const idxs = cards.reduce(
            (acc, c, i) => {
                if (
                    c.id === targetId &&
                    !c.isMatched
                ) {
                    acc.push(i);
                }

                return acc;
            },
            []
        );

        setHintHighlight(idxs);

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
        clearInterval(timerRef.current);

        clearTimeout(
            nextRoundTimerRef.current
        );

        setGameStarted(false);

        setTotalRounds('');

        setRoundInputError('');

        setCurrentRound(1);

        setDifficulty('easy');

        setCards(buildDeck('easy'));

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
                    <h1>Memory Match</h1>

                    <p>
                        Find all the matching pairs
                    </p>
                </header>

                <div className="memory-round-setup">
                    <div className="memory-setup-card">
                        <h2>
                            Set Number of Rounds
                        </h2>

                        <p className="memory-setup-description">
                            The game starts at Easy
                            level. Your performance
                            will automatically adjust
                            the difficulty of each
                            following round.
                        </p>

                        <div className="memory-round-input-section">
                            <label htmlFor="round-count">
                                Number of Rounds
                            </label>

                            <input
                                id="round-count"
                                type="number"
                                min="1"
                                max="20"
                                value={totalRounds}
                                onChange={(e) => {
                                    setTotalRounds(
                                        e.target.value
                                    );

                                    setRoundInputError(
                                        ''
                                    );
                                }}
                                onKeyDown={(e) => {
                                    if (
                                        e.key ===
                                        'Enter'
                                    ) {
                                        handleStartGame();
                                    }
                                }}
                                className={
                                    roundInputError
                                        ? 'round-input invalid'
                                        : 'round-input'
                                }
                                placeholder="Enter 1–20"
                                aria-describedby={
                                    roundInputError
                                        ? 'round-error'
                                        : undefined
                                }
                            />

                            {roundInputError && (
                                <div
                                    id="round-error"
                                    className="round-error-alert"
                                    role="alert"
                                >
                                    ⚠️{' '}
                                    {
                                        roundInputError
                                    }
                                </div>
                            )}

                            <p className="round-limit-text">
                                Minimum: 1 round
                                &nbsp;|&nbsp;
                                Maximum: 20 rounds
                            </p>
                        </div>

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

                        <button
                            className="memory-start-btn"
                            onClick={
                                handleStartGame
                            }
                        >
                            ▶ Start Game
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
                <h1>Memory Match</h1>

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
                        {totalRounds}
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
                aria-label="Memory match game board"
            >
                {cards.map((card, index) => {
                    const isRevealed =
                        card.isFlipped ||
                        card.isMatched ||
                        hintHighlight.includes(
                            index
                        );

                    return (
                        <button
                            key={card.uid}
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
                            onKeyDown={(e) =>
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
                                          index + 1
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
                                            {card.name}
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
                })}
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
                        hintsRemaining <= 0 ||
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

            {/* ROUND RESULT */}

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

                            <div className="round-result-stats">
                                <div>
                                    <span>
                                        Moves
                                    </span>

                                    <strong>
                                        {
                                            roundResult.moves
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Hints
                                    </span>

                                    <strong>
                                        {
                                            roundResult.hintsUsed
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Score
                                    </span>

                                    <strong>
                                        {
                                            roundResult.score
                                        }
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

                            <p className="next-round-countdown">
                                Starting the next
                                round shortly...
                            </p>
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
                                Memory Match Complete!
                            </h2>

                            <p>
                                Wonderful work! You
                                completed all{' '}
                                {
                                    finalStats.totalRounds
                                }{' '}
                                rounds.
                            </p>

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

                                <div className="final-summary-item">
                                    <span>
                                        Total Moves
                                    </span>

                                    <strong>
                                        {
                                            finalStats.totalMoves
                                        }
                                    </strong>
                                </div>

                                <div className="final-summary-item">
                                    <span>
                                        Total Time
                                    </span>

                                    <strong>
                                        {formatTime(
                                            finalStats.totalTime
                                        )}
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