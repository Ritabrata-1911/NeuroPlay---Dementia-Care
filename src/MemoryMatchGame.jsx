import React, { useState, useEffect, useRef } from 'react';
import './MemoryMatchGame.css';

// ---- Difficulty configuration -------------------------------------------
// Object pool. Easy uses the first 3 objects (3 pairs / 6 cards).
// Medium uses all 6 base objects (6 pairs / 12 cards).
// Hard extends the pool with 4 more objects (10 pairs / 20 cards).
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

const DIFFICULTY_CONFIG = {
    easy: { label: 'Easy', pairs: 3, columns: 3, hints: 3 },
    medium: { label: 'Medium', pairs: 6, columns: 4, hints: 4 },
    hard: { label: 'Hard', pairs: 10, columns: 5, hints: 5 },
};

const MATCH_MESSAGES = ['Great match!', 'Excellent!', 'Wonderful!', 'Nicely done!'];
const MISMATCH_MESSAGES = ['Good try! Keep going.', 'Almost there — try again!'];

// ---- Helpers --------------------------------------------------------------
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
        { ...obj, uid: `${obj.id}-a` },
        { ...obj, uid: `${obj.id}-b` },
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

// ---- Component --------------------------------------------------------------
export default function MemoryMatchGame({ patient, onHome }) {
    const [difficulty, setDifficulty] = useState('easy');
    const [cards, setCards] = useState(() => buildDeck('easy'));
    const [flippedIndices, setFlippedIndices] = useState([]);
    const [isChecking, setIsChecking] = useState(false);
    const [moves, setMoves] = useState(0);
    const [matches, setMatches] = useState(0);
    const [hintsRemaining, setHintsRemaining] = useState(DIFFICULTY_CONFIG.easy.hints);
    const [hintHighlight, setHintHighlight] = useState([]);
    const [message, setMessage] = useState('Tap two cards to find a matching pair.');
    const [gameComplete, setGameComplete] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [finalStats, setFinalStats] = useState(null);

    const config = DIFFICULTY_CONFIG[difficulty];
    const timerRef = useRef(null);

    // Reset the whole game whenever the difficulty changes
    useEffect(() => {
        resetGame(difficulty);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [difficulty]);

    // Elapsed-time ticker (informational only — not a countdown / no time pressure)
    useEffect(() => {
        if (hasStarted && !gameComplete) {
            timerRef.current = setInterval(() => {
                setElapsedSeconds((prev) => prev + 1);
            }, 1000);
        }
        return () => clearInterval(timerRef.current);
    }, [hasStarted, gameComplete]);

    // Resolve a pair once two cards are flipped
    useEffect(() => {
        if (flippedIndices.length !== 2) return;

        setIsChecking(true);
        setMoves((prev) => prev + 1);

        const [i1, i2] = flippedIndices;
        const isMatch = cards[i1].id === cards[i2].id;

        const timeout = setTimeout(() => {
            setCards((prevCards) =>
                prevCards.map((card, idx) => {
                    if (idx !== i1 && idx !== i2) return card;
                    return isMatch
                        ? { ...card, isMatched: true, isFlipped: true }
                        : { ...card, isFlipped: false };
                })
            );

            if (isMatch) {
                setMatches((prev) => prev + 1);
                setMessage(MATCH_MESSAGES[Math.floor(Math.random() * MATCH_MESSAGES.length)]);
            } else {
                setMessage(MISMATCH_MESSAGES[Math.floor(Math.random() * MISMATCH_MESSAGES.length)]);
            }

            setFlippedIndices([]);
            setIsChecking(false);
        }, 900);

        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flippedIndices]);

    // Detect game completion
    useEffect(() => {
        if (matches > 0 && matches === config.pairs && !gameComplete) {
            const hintsUsed = config.hints - hintsRemaining;
            const movePenalty = Math.max(0, moves - config.pairs) * 5;
            const hintPenalty = hintsUsed * 20;
            const score = Math.max(0, config.pairs * 100 - movePenalty - hintPenalty);

            const stats = { moves, hintsUsed, completionTime: elapsedSeconds, score };
            setFinalStats(stats);
            setGameComplete(true);
            setMessage('Well done! You completed the game.');

            // Analytics record — ready to send to a backend later (e.g. Supabase).
            // Not sent anywhere yet, just prepared here.
            const analytics = {
                userId: patient?.id || patient?.full_name || 'unknown',
                gameName: 'Memory Match',
                difficulty,
                moves,
                matches,
                hintsUsed,
                completionTime: elapsedSeconds,
                score,
                completed: true,
                timestamp: new Date().toISOString(),
            };
            console.log('Memory Match analytics:', analytics);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matches]);

    function resetGame(nextDifficulty) {
        const diff = nextDifficulty || difficulty;
        clearInterval(timerRef.current);
        setCards(buildDeck(diff));
        setFlippedIndices([]);
        setIsChecking(false);
        setMoves(0);
        setMatches(0);
        setHintsRemaining(DIFFICULTY_CONFIG[diff].hints);
        setHintHighlight([]);
        setMessage('Tap two cards to find a matching pair.');
        setGameComplete(false);
        setHasStarted(false);
        setElapsedSeconds(0);
        setFinalStats(null);
    }

    function handleCardClick(index) {
        if (isChecking || gameComplete) return;
        const card = cards[index];
        if (!card || card.isFlipped || card.isMatched) return;
        if (flippedIndices.length === 2) return;

        if (!hasStarted) setHasStarted(true);

        setCards((prev) =>
            prev.map((c, i) => (i === index ? { ...c, isFlipped: true } : c))
        );
        setFlippedIndices((prev) => [...prev, index]);
    }

    function handleCardKeyDown(event, index) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleCardClick(index);
        }
    }

    function useHint() {
        if (hintsRemaining <= 0 || isChecking || gameComplete || flippedIndices.length > 0) return;

        const unmatched = cards.filter((c) => !c.isMatched);
        if (unmatched.length === 0) return;

        const targetId = unmatched[0].id;
        const idxs = cards.reduce((acc, c, i) => {
            if (c.id === targetId && !c.isMatched) acc.push(i);
            return acc;
        }, []);

        setHintHighlight(idxs);
        setHintsRemaining((prev) => prev - 1);
        setMessage("Here's a hint — watch closely!");

        setTimeout(() => setHintHighlight([]), 1500);
    }

    function handleDifficultyChange(nextDifficulty) {
        if (nextDifficulty === difficulty) {
            resetGame(nextDifficulty);
        } else {
            setDifficulty(nextDifficulty);
        }
    }

    return (
        <div className="memory-game-container">
            <header className="memory-game-header">
                <h1>Memory Match</h1>
                <p>Find all the matching pairs</p>
            </header>

            <div className="memory-difficulty-selector">
                {Object.keys(DIFFICULTY_CONFIG).map((key) => (
                    <button
                        key={key}
                        className={`memory-diff-btn ${difficulty === key ? 'active-diff' : ''}`}
                        onClick={() => handleDifficultyChange(key)}
                    >
                        {DIFFICULTY_CONFIG[key].label}
                    </button>
                ))}
            </div>

            <div className="memory-stats-bar">
                <div className="memory-stat">
                    <span className="stat-label">Moves</span>
                    <span className="stat-value">{moves}</span>
                </div>
                <div className="memory-stat">
                    <span className="stat-label">Matches</span>
                    <span className="stat-value">{matches}/{config.pairs}</span>
                </div>
                <div className="memory-stat">
                    <span className="stat-label">Level</span>
                    <span className="stat-value">{config.label}</span>
                </div>
                <div className="memory-stat">
                    <span className="stat-label">Time</span>
                    <span className="stat-value">{formatTime(elapsedSeconds)}</span>
                </div>
                <div className="memory-stat">
                    <span className="stat-label">Hints left</span>
                    <span className="stat-value">{hintsRemaining}</span>
                </div>
            </div>

            <p className="memory-message" aria-live="polite">{message}</p>

            <div
                className={`memory-board cols-${config.columns}`}
                role="group"
                aria-label="Memory match game board"
            >
                {cards.map((card, index) => {
                    const isRevealed =
                        card.isFlipped || card.isMatched || hintHighlight.includes(index);
                    return (
                        <button
                            key={card.uid}
                            type="button"
                            className={`memory-card ${isRevealed ? 'flipped' : ''} ${
                                card.isMatched ? 'matched' : ''
                            } ${hintHighlight.includes(index) ? 'hint-active' : ''}`}
                            onClick={() => handleCardClick(index)}
                            onKeyDown={(e) => handleCardKeyDown(e, index)}
                            aria-label={
                                isRevealed
                                    ? `${card.name} card${card.isMatched ? ', matched' : ''}`
                                    : `Hidden card ${index + 1}. Press to flip.`
                            }
                            disabled={gameComplete}
                        >
                            <span className="memory-card-inner">
                                {isRevealed ? (
                                    <>
                                        <span className="memory-card-symbol" aria-hidden="true">
                                            {card.symbol}
                                        </span>
                                        <span className="memory-card-name">{card.name}</span>
                                    </>
                                ) : (
                                    <span className="memory-card-back" aria-hidden="true">?</span>
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="memory-controls">
                <button className="memory-control-btn restart-btn" onClick={() => resetGame(difficulty)}>
                    🔄 Restart Game
                </button>
                <button
                    className="memory-control-btn hint-btn"
                    onClick={useHint}
                    disabled={hintsRemaining <= 0 || gameComplete}
                >
                    💡 Hint ({hintsRemaining})
                </button>
                <button className="memory-control-btn home-btn" onClick={onHome}>
                    🏠 Home
                </button>
            </div>

            {gameComplete && finalStats && (
                <div className="memory-complete-overlay" role="dialog" aria-live="assertive">
                    <div className="memory-complete-card">
                        <h2>🎉 Wonderful! You found all the pairs!</h2>
                        <p>You completed {config.label} mode.</p>
                        <ul className="memory-complete-stats">
                            <li><strong>Moves:</strong> {finalStats.moves}</li>
                            <li><strong>Hints used:</strong> {finalStats.hintsUsed}</li>
                            <li><strong>Time:</strong> {formatTime(finalStats.completionTime)}</li>
                            <li><strong>Score:</strong> {finalStats.score}</li>
                        </ul>
                        <div className="memory-complete-actions">
                            <button className="memory-control-btn restart-btn" onClick={() => resetGame(difficulty)}>
                                Play Again
                            </button>
                            <button className="memory-control-btn home-btn" onClick={onHome}>
                                Back to Home
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}