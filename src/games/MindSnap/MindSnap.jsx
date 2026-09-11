import React, { useState, useEffect, useCallback, useRef } from 'react';
import './MindSnap.css';

// ============================================================
// MIND SNAP CONFIGURATION
// ============================================================

const MAX_ROUNDS = 20;
const MIN_ROUNDS = 3;
const DEFAULT_ROUNDS = 10;

const INITIAL_LEVEL = 1;


// ============================================================
// DIFFICULTY CONFIGURATION
// ============================================================

const LEVEL_CONFIG = {
    1: {
        rows: 3,
        columns: 3,
        sequenceLength: 3,
        displayTime: 1100,
        gapTime: 350
    },

    2: {
        rows: 3,
        columns: 3,
        sequenceLength: 4,
        displayTime: 1000,
        gapTime: 300
    },

    3: {
        rows: 4,
        columns: 4,
        sequenceLength: 4,
        displayTime: 950,
        gapTime: 300
    },

    4: {
        rows: 4,
        columns: 4,
        sequenceLength: 5,
        displayTime: 900,
        gapTime: 275
    },

    5: {
        rows: 5,
        columns: 5,
        sequenceLength: 5,
        displayTime: 850,
        gapTime: 250
    },

    6: {
        rows: 5,
        columns: 5,
        sequenceLength: 6,
        displayTime: 800,
        gapTime: 225
    }
};


// ============================================================
// UTILITY FUNCTIONS
// ============================================================

const generateSequence = (totalCells, sequenceLength) => {
    const sequence = [];

    while (sequence.length < sequenceLength) {

        const randomCell =
            Math.floor(Math.random() * totalCells);

        if (
            sequence.length === 0 ||
            sequence[sequence.length - 1] !== randomCell
        ) {
            sequence.push(randomCell);
        }
    }

    return sequence;
};

const formatTime = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
};


// ============================================================
// MAIN COMPONENT
// ============================================================

export default function MindSnap({ patient, onHome }) {

    // ========================================================
    // GAME STATE
    // ========================================================

    const [gameState, setGameState] =
        useState('ready');


    // ========================================================
    // ROUND SETTINGS
    // ========================================================

    const [roundInput, setRoundInput] =
        useState(String(DEFAULT_ROUNDS));

    // FIX: derive button label directly from roundInput, not selectedRounds
    const [selectedRounds, setSelectedRounds] =
        useState(DEFAULT_ROUNDS);

    const [roundError, setRoundError] =
        useState('');


    // ========================================================
    // ROUND TRACKING
    // ========================================================

    const [round, setRound] =
        useState(0);


    // ========================================================
    // DIFFICULTY
    // ========================================================

    const [level, setLevel] =
        useState(INITIAL_LEVEL);


    // ========================================================
    // CURRENT SEQUENCE
    // ========================================================

    const [targetSequence, setTargetSequence] =
        useState([]);

    const [displayIndex, setDisplayIndex] =
        useState(-1);


    // ========================================================
    // PATIENT ANSWER
    // ========================================================

    const [patientSequence, setPatientSequence] =
        useState([]);


    // ========================================================
    // FEEDBACK
    // ========================================================

    const [feedbackMsg, setFeedbackMsg] =
        useState('');

    const [wrongCell, setWrongCell] =
        useState(null);

    const [roundCorrect, setRoundCorrect] =
        useState(false);


    // ========================================================
    // SCORE / STATISTICS
    // ========================================================

    const [score, setScore] =
        useState(0);

    const [correctRounds, setCorrectRounds] =
        useState(0);

    const [incorrectRounds, setIncorrectRounds] =
        useState(0);

    // Extended stats
    const [totalResponseTimes, setTotalResponseTimes] =
        useState([]);

    const [roundStartTime, setRoundStartTime] =
        useState(null);

    const [gameStartTime, setGameStartTime] =
        useState(null);

    const [hintsUsed] =
        useState(0); // placeholder — hints not implemented yet

    const [finalStats, setFinalStats] =
        useState(null);


    // ========================================================
    // TIMER REFERENCE
    // ========================================================

    const timerRef = useRef(null);
    const answerStartTimeRef = useRef(null);


    // ========================================================
    // CLEANUP
    // ========================================================

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);


    // ========================================================
    // CLEAR TIMER
    // ========================================================

    const clearGameTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };


    // ========================================================
    // VALIDATE ROUND INPUT
    // ========================================================

    const validateRoundInput = (value) => {

        if (value.trim() === '') {
            return 'Please enter the number of rounds.';
        }

        const number = Number(value);

        if (!Number.isFinite(number)) {
            return 'Please enter a valid number of rounds.';
        }

        if (!Number.isInteger(number)) {
            return 'The number of rounds must be a whole number.';
        }

        if (number < MIN_ROUNDS) {
            return `The minimum number of rounds is ${MIN_ROUNDS}.`;
        }

        if (number > MAX_ROUNDS) {
            return `The maximum number of rounds is ${MAX_ROUNDS}.`;
        }

        return '';
    };


    // ========================================================
    // HANDLE ROUND INPUT  —  FIX: also update selectedRounds
    // ========================================================

    const handleRoundInputChange = (event) => {

        const value = event.target.value;

        setRoundInput(value);

        const error = validateRoundInput(value);
        setRoundError(error);

        // Keep selectedRounds in sync so the button label is live
        if (!error) {
            const parsed = Number(value);
            if (Number.isInteger(parsed)) {
                setSelectedRounds(parsed);
            }
        }
    };


    // ========================================================
    // START GAME
    // ========================================================

    const handleStartGame = () => {

        const error = validateRoundInput(roundInput);

        if (error) {
            setRoundError(error);
            return;
        }

        const numberOfRounds = Number(roundInput);

        if (
            numberOfRounds < MIN_ROUNDS ||
            numberOfRounds > MAX_ROUNDS ||
            !Number.isInteger(numberOfRounds)
        ) {
            setRoundError(
                `Please enter a whole number between ${MIN_ROUNDS} and ${MAX_ROUNDS}.`
            );
            return;
        }

        setRoundError('');
        setSelectedRounds(numberOfRounds);

        clearGameTimer();

        const firstLevel = INITIAL_LEVEL;
        const config = LEVEL_CONFIG[firstLevel];
        const totalCells = config.rows * config.columns;
        const newSequence = generateSequence(totalCells, config.sequenceLength);

        // Reset all game statistics
        setRound(0);
        setLevel(firstLevel);
        setScore(0);
        setCorrectRounds(0);
        setIncorrectRounds(0);
        setTotalResponseTimes([]);
        setFinalStats(null);

        const now = Date.now();
        setGameStartTime(now);
        setRoundStartTime(now);

        setTargetSequence(newSequence);
        setPatientSequence([]);
        setDisplayIndex(-1);
        setWrongCell(null);
        setFeedbackMsg('');
        setRoundCorrect(false);
        setGameState('memorize');
    };


    // ========================================================
    // CREATE NEW ROUND
    // ========================================================

    const createNewRound = useCallback((currentLevel) => {

        const config = LEVEL_CONFIG[currentLevel];
        const totalCells = config.rows * config.columns;
        const newSequence = generateSequence(totalCells, config.sequenceLength);

        setTargetSequence(newSequence);
        setPatientSequence([]);
        setDisplayIndex(-1);
        setWrongCell(null);
        setFeedbackMsg('');
        setRoundCorrect(false);
        setRoundStartTime(Date.now());
        setGameState('memorize');

    }, []);


    // ========================================================
    // DISPLAY SEQUENCE
    // ========================================================

    useEffect(() => {

        if (gameState !== 'memorize') return;
        if (targetSequence.length === 0) return;

        const config = LEVEL_CONFIG[level];
        let currentIndex = 0;

        setDisplayIndex(0);

        const showNextBox = () => {

            currentIndex++;

            if (currentIndex < targetSequence.length) {

                setDisplayIndex(currentIndex);

                timerRef.current = setTimeout(
                    showNextBox,
                    config.displayTime + config.gapTime
                );

            } else {

                timerRef.current = setTimeout(() => {

                    setDisplayIndex(-1);
                    setPatientSequence([]);
                    answerStartTimeRef.current = Date.now();
                    setGameState('answer');

                }, config.displayTime);
            }
        };

        timerRef.current = setTimeout(
            showNextBox,
            config.displayTime + config.gapTime
        );

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };

    }, [gameState, targetSequence, level]);


    // ========================================================
    // BUILD FINAL STATS
    // ========================================================

    const buildFinalStats = useCallback((
        finalCorrect,
        finalIncorrect,
        finalScore,
        finalLevel,
        rounds,
        responseTimes,
        startTime
    ) => {

        const completionTime = Date.now() - startTime;
        const totalAnswered = finalCorrect + finalIncorrect;
        const accuracy = rounds > 0
            ? Math.round((finalCorrect / rounds) * 100)
            : 0;
        const mistakeRate = rounds > 0
            ? Math.round((finalIncorrect / rounds) * 100)
            : 0;
        const hintRate = 0; // no hints implemented
        const avgResponseTime = responseTimes.length > 0
            ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
            : 0;

        return {
            game_name: 'Mind Snap',
            accuracy,
            mistake_rate: mistakeRate,
            hint_rate: hintRate,
            completion_time: completionTime,
            average_response_time: avgResponseTime,
            difficulty_level: finalLevel,
            attempts: rounds,
            correct_answers: finalCorrect,
            incorrect_answers: finalIncorrect,
            final_score: finalScore,
        };

    }, []);


    // ========================================================
    // MOVE TO NEXT ROUND
    // ========================================================

    const moveToNextRound = useCallback((
        nextRound,
        nextLevel,
        currentCorrect,
        currentIncorrect,
        currentScore,
        currentResponseTimes,
        start,
        rounds
    ) => {

        if (nextRound >= rounds) {

            const stats = buildFinalStats(
                currentCorrect,
                currentIncorrect,
                currentScore,
                nextLevel,
                rounds,
                currentResponseTimes,
                start
            );

            setFinalStats(stats);
            setRound(nextRound);
            setGameState('gameOver');
            return;
        }

        setRound(nextRound);
        clearGameTimer();

        timerRef.current = setTimeout(() => {
            createNewRound(nextLevel);
        }, 400);

    }, [buildFinalStats, createNewRound]);


    // ========================================================
    // HANDLE CELL CLICK
    // ========================================================

    const handleCellClick = (index) => {

        if (gameState !== 'answer') return;

        const responseTime = answerStartTimeRef.current
            ? Date.now() - answerStartTimeRef.current
            : 0;

        const currentPosition = patientSequence.length;
        const expectedCell = targetSequence[currentPosition];

        // ====================================================
        // WRONG ANSWER
        // ====================================================

        if (index !== expectedCell) {

            setWrongCell(index);
            setRoundCorrect(false);
            setGameState('evaluating');

            setFeedbackMsg(
                `Good try. Box ${currentPosition + 1} was not correct.`
            );

            const newIncorrect = incorrectRounds + 1;
            setIncorrectRounds(newIncorrect);

            const newResponseTimes = [...totalResponseTimes, responseTime];
            setTotalResponseTimes(newResponseTimes);

            const newLevel = Math.max(1, level - 1);
            setLevel(newLevel);

            const nextRound = round + 1;

            timerRef.current = setTimeout(() => {
                moveToNextRound(
                    nextRound,
                    newLevel,
                    correctRounds,
                    newIncorrect,
                    score,
                    newResponseTimes,
                    gameStartTime,
                    selectedRounds
                );
            }, 1800);

            return;
        }

        // ====================================================
        // CORRECT ANSWER
        // ====================================================

        const newSequence = [...patientSequence, index];
        setPatientSequence(newSequence);

        // ====================================================
        // COMPLETE SEQUENCE
        // ====================================================

        if (newSequence.length === targetSequence.length) {

            setRoundCorrect(true);
            setGameState('evaluating');

            const points = targetSequence.length * level;
            const newScore = score + points;
            setScore(newScore);

            const newCorrect = correctRounds + 1;
            setCorrectRounds(newCorrect);

            const newResponseTimes = [...totalResponseTimes, responseTime];
            setTotalResponseTimes(newResponseTimes);

            setFeedbackMsg(
                `Excellent! You remembered all ${targetSequence.length} boxes in the correct order.`
            );

            const newLevel = Math.min(
                Object.keys(LEVEL_CONFIG).length,
                level + 1
            );
            setLevel(newLevel);

            const nextRound = round + 1;

            timerRef.current = setTimeout(() => {
                moveToNextRound(
                    nextRound,
                    newLevel,
                    newCorrect,
                    incorrectRounds,
                    newScore,
                    newResponseTimes,
                    gameStartTime,
                    selectedRounds
                );
            }, 1600);
        }
    };


    // ========================================================
    // RESET GAME
    // ========================================================

    const resetGame = () => {

        clearGameTimer();

        setRoundInput(String(DEFAULT_ROUNDS));
        setSelectedRounds(DEFAULT_ROUNDS);
        setRoundError('');
        setRound(0);
        setLevel(INITIAL_LEVEL);
        setScore(0);
        setCorrectRounds(0);
        setIncorrectRounds(0);
        setTotalResponseTimes([]);
        setGameStartTime(null);
        setRoundStartTime(null);
        setFinalStats(null);
        setTargetSequence([]);
        setPatientSequence([]);
        setDisplayIndex(-1);
        setWrongCell(null);
        setFeedbackMsg('');
        setRoundCorrect(false);
        setGameState('ready');
    };


    // ========================================================
    // GET DISPLAYED ROUND
    // ========================================================

    const getDisplayedRound = () => {
        if (gameState === 'ready') return 0;
        return Math.min(round + 1, selectedRounds);
    };


    // ========================================================
    // PARSE VALID ROUND COUNT FOR BUTTON LABEL
    // ========================================================

    const getButtonRoundCount = () => {
        const n = Number(roundInput);
        if (
            Number.isInteger(n) &&
            n >= MIN_ROUNDS &&
            n <= MAX_ROUNDS &&
            !roundError
        ) {
            return n;
        }
        return selectedRounds;
    };


    // ========================================================
    // START SCREEN
    // ========================================================

    const renderStartScreen = () => (

        <div className="ms-card ms-start-card">

            <div className="ms-back-bar">
                <button
                    type="button"
                    className="ms-back-btn"
                    onClick={onHome}
                >
                    ← Back to Dashboard
                </button>
            </div>

            <div className="ms-icon-lg">🧠</div>

            <h2>Welcome to Mind Snap</h2>

            <p className="ms-instruction">
                Watch the colored boxes light up one at a time.
                <br />
                Each box will show a number.
                <br />
                Remember the order and repeat the sequence!
            </p>

            {/* HOW TO PLAY */}
            <div className="ms-how-to-play">

                <div className="ms-how-step">
                    <span className="ms-step-number">1</span>
                    <span>Watch the numbered boxes.</span>
                </div>

                <div className="ms-how-step">
                    <span className="ms-step-number">2</span>
                    <span>Remember their order.</span>
                </div>

                <div className="ms-how-step">
                    <span className="ms-step-number">3</span>
                    <span>Click them in the same order.</span>
                </div>

            </div>

            {/* ROUND SELECTION */}
            <div className="ms-round-selection">

                <h3>Choose Number of Rounds</h3>

                <p>Enter a whole number between {MIN_ROUNDS} and {MAX_ROUNDS}.</p>

                <div className="ms-round-input-wrapper">

                    <label
                        htmlFor="mindSnapRounds"
                        className="ms-round-input-label"
                    >
                        Number of rounds
                    </label>

                    <input
                        id="mindSnapRounds"
                        type="number"
                        min={MIN_ROUNDS}
                        max={MAX_ROUNDS}
                        step="1"
                        value={roundInput}
                        onChange={handleRoundInputChange}
                        className={`ms-round-input ${roundError ? 'input-error' : ''}`}
                        aria-invalid={Boolean(roundError)}
                        aria-describedby={roundError ? 'round-error-message' : undefined}
                    />

                </div>

                {/* VALIDATION ALERT */}
                {roundError && (
                    <div
                        id="round-error-message"
                        className="ms-round-error"
                        role="alert"
                    >
                        <span className="ms-error-icon">!</span>
                        <span>{roundError}</span>
                    </div>
                )}

                {!roundError && (
                    <div className="ms-round-valid">
                        <span>✓</span>
                        <span>
                            You can choose {MIN_ROUNDS} to {MAX_ROUNDS} rounds.
                        </span>
                    </div>
                )}

            </div>

            {/* ADAPTIVE DIFFICULTY */}
            <div className="ms-round-info">
                <strong>📈 Adaptive Difficulty</strong>
                <span>
                    The game automatically adjusts the difficulty according to your performance.
                </span>
            </div>

            {/* START BUTTON — label reads from live input */}
            <button
                type="button"
                className="ms-primary-btn ms-start-button"
                onClick={handleStartGame}
                disabled={Boolean(roundError)}
            >
                START {getButtonRoundCount()} ROUNDS
            </button>

        </div>
    );


    // ========================================================
    // GAME OVER SCREEN  —  all 10 stats
    // ========================================================

    const renderGameOverScreen = () => {

        const stats = finalStats || {};
        const accuracy = stats.accuracy ?? 0;
        const completionSecs = stats.completion_time
            ? (stats.completion_time / 1000).toFixed(1)
            : '—';
        const avgResp = stats.average_response_time
            ? `${(stats.average_response_time / 1000).toFixed(2)}s`
            : '—';

        let resultIcon = '🌟';
        if (accuracy >= 80) resultIcon = '🎉';
        else if (accuracy >= 50) resultIcon = '👏';

        return (

            <div className="ms-card ms-game-over-card">

                <div className="ms-icon-lg">{resultIcon}</div>

                <h2>Mind Snap Complete!</h2>

                <p className="ms-instruction">
                    Well done!
                    <br />
                    You completed <strong> {selectedRounds} </strong> rounds.
                </p>

                {/* STATISTICS — all 10 required fields */}
                <div className="ms-stats">

                    {/* 1. game_name */}
                    <div className="ms-stat-item ms-stat-full">
                        <span className="ms-stat-icon">🧠</span>
                        <div>
                            <span className="ms-stat-label">Game</span>
                            <strong>{stats.game_name || 'Mind Snap'}</strong>
                        </div>
                    </div>

                    {/* 2. accuracy */}
                    <div className="ms-stat-item">
                        <span className="ms-stat-icon">🎯</span>
                        <div>
                            <span className="ms-stat-label">Accuracy</span>
                            <strong>{accuracy}%</strong>
                        </div>
                    </div>

                    {/* 3. mistake_rate */}
                    <div className="ms-stat-item">
                        <span className="ms-stat-icon">❌</span>
                        <div>
                            <span className="ms-stat-label">Mistake Rate</span>
                            <strong>{stats.mistake_rate ?? 0}%</strong>
                        </div>
                    </div>

                    {/* 4. hint_rate */}
                    <div className="ms-stat-item">
                        <span className="ms-stat-icon">💡</span>
                        <div>
                            <span className="ms-stat-label">Hint Rate</span>
                            <strong>{stats.hint_rate ?? 0}%</strong>
                        </div>
                    </div>

                    {/* 5. completion_time */}
                    <div className="ms-stat-item">
                        <span className="ms-stat-icon">⏱️</span>
                        <div>
                            <span className="ms-stat-label">Completion Time</span>
                            <strong>{completionSecs}s</strong>
                        </div>
                    </div>

                    {/* 6. average_response_time */}
                    <div className="ms-stat-item">
                        <span className="ms-stat-icon">⚡</span>
                        <div>
                            <span className="ms-stat-label">Avg Response Time</span>
                            <strong>{avgResp}</strong>
                        </div>
                    </div>

                    {/* 7. difficulty_level */}
                    <div className="ms-stat-item">
                        <span className="ms-stat-icon">⭐</span>
                        <div>
                            <span className="ms-stat-label">Difficulty Level</span>
                            <strong>{stats.difficulty_level ?? level}</strong>
                        </div>
                    </div>

                    {/* 8. attempts */}
                    <div className="ms-stat-item">
                        <span className="ms-stat-icon">🔄</span>
                        <div>
                            <span className="ms-stat-label">Attempts</span>
                            <strong>{stats.attempts ?? selectedRounds}</strong>
                        </div>
                    </div>

                    {/* 9. correct_answers */}
                    <div className="ms-stat-item">
                        <span className="ms-stat-icon">✅</span>
                        <div>
                            <span className="ms-stat-label">Correct Answers</span>
                            <strong>{stats.correct_answers ?? correctRounds}</strong>
                        </div>
                    </div>

                    {/* 10. incorrect_answers */}
                    <div className="ms-stat-item">
                        <span className="ms-stat-icon">🚫</span>
                        <div>
                            <span className="ms-stat-label">Incorrect Answers</span>
                            <strong>{stats.incorrect_answers ?? incorrectRounds}</strong>
                        </div>
                    </div>

                    {/* Bonus: Final Score */}
                    <div className="ms-stat-item ms-stat-full">
                        <span className="ms-stat-icon">🏆</span>
                        <div>
                            <span className="ms-stat-label">Final Score</span>
                            <strong>{stats.final_score ?? score}</strong>
                        </div>
                    </div>

                </div>

                {/* BUTTONS */}
                <div className="ms-game-over-buttons">

                    <button
                        type="button"
                        className="ms-primary-btn"
                        onClick={resetGame}
                    >
                        PLAY AGAIN
                    </button>

                    <button
                        type="button"
                        className="ms-secondary-btn"
                        onClick={onHome}
                    >
                        BACK TO DASHBOARD
                    </button>

                </div>

            </div>
        );
    };


    // ========================================================
    // ACTIVE GAME
    // ========================================================

    const renderActiveGame = () => {

        const config = LEVEL_CONFIG[level];
        const totalCells = config.rows * config.columns;
        const gridArray = Array.from({ length: totalCells }, (_, i) => i);

        return (

            <div className="ms-card ms-game-card">

                {/* TOP BAR */}
                <div className="ms-top-bar">

                    <div className="ms-round-board">
                        🔄 Round {getDisplayedRound()} / {selectedRounds}
                    </div>

                    <div className="ms-level-board">
                        ⭐ Level {level}
                    </div>

                    <div className="ms-score-board">
                        🏆 {score}
                    </div>

                </div>

                {/* BACK BUTTON */}
                <div className="ms-back-bar">
                    <button
                        type="button"
                        className="ms-back-btn"
                        onClick={onHome}
                    >
                        ← Back to Dashboard
                    </button>
                </div>

                {/* FEEDBACK AREA */}
                <div className="ms-feedback-area">

                    {gameState === 'memorize' && (
                        <>
                            <div className="ms-phase-title">
                                👀 WATCH THE SEQUENCE
                            </div>
                            <p className="ms-feedback-text">
                                Remember the numbered boxes in order.
                            </p>
                            <div className="ms-sequence-progress">
                                {displayIndex >= 0
                                    ? `Showing ${displayIndex + 1} of ${targetSequence.length}`
                                    : 'Get ready...'}
                            </div>
                        </>
                    )}

                    {gameState === 'answer' && (
                        <>
                            <div className="ms-phase-title ms-answer-title">
                                🧠 YOUR TURN
                            </div>
                            <p className="ms-feedback-text">
                                Click the boxes in the same order.
                            </p>
                            <div className="ms-selection-progress">
                                Your sequence:
                                <strong>
                                    {patientSequence.length === 0
                                        ? ' —'
                                        : ` ${patientSequence.map((_, i) => i + 1).join(' → ')}`}
                                </strong>
                            </div>
                        </>
                    )}

                    {gameState === 'evaluating' && (
                        <div
                            className={
                                roundCorrect
                                    ? 'ms-result-message ms-success-message'
                                    : 'ms-result-message ms-error-message'
                            }
                        >
                            <span className="ms-result-icon">
                                {roundCorrect ? '✓' : '✕'}
                            </span>
                            <span>{feedbackMsg}</span>
                        </div>
                    )}

                </div>

                {/* GRID */}
                <div className="ms-grid-wrapper">
                    <div
                        className="ms-grid"
                        style={{
                            gridTemplateColumns: `repeat(${config.columns}, 1fr)`
                        }}
                    >
                        {gridArray.map((index) => {

                            const targetPosition =
                                targetSequence.indexOf(index);

                            const isCurrentHighlighted =
                                gameState === 'memorize' &&
                                targetSequence[displayIndex] === index;

                            const selectedPosition =
                                patientSequence.indexOf(index);

                            const isSelected = selectedPosition !== -1;
                            const isWrong = wrongCell === index;
                            const isInteractive = gameState === 'answer';

                            return (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => handleCellClick(index)}
                                    disabled={!isInteractive}
                                    className={`
                                        ms-cell
                                        ${isCurrentHighlighted ? 'highlighted' : ''}
                                        ${isSelected ? 'selected' : ''}
                                        ${isWrong ? 'wrong' : ''}
                                        ${isInteractive ? 'interactive' : ''}
                                    `}
                                >
                                    {isCurrentHighlighted && (
                                        <span className="ms-display-number">
                                            {targetPosition + 1}
                                        </span>
                                    )}

                                    {isSelected && gameState !== 'memorize' && (
                                        <span className="ms-selected-number">
                                            {selectedPosition + 1}
                                        </span>
                                    )}

                                    {isWrong && (
                                        <span className="ms-wrong-symbol">✕</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* HELPER TEXT */}
                {gameState === 'memorize' && (
                    <div className="ms-helper-text">
                        <span>💡</span>
                        Watch carefully — the numbers show the order.
                    </div>
                )}

                {gameState === 'answer' && (
                    <div className="ms-helper-text">
                        <span>💡</span>
                        Start with box 1, then box 2, then box 3...
                    </div>
                )}

            </div>
        );
    };


    // ========================================================
    // MAIN RENDER
    // ========================================================

    return (

        <div className="mindsnap-container">

            <header className="ms-header">

                <h1>🧠 NeuroPlay</h1>
                <h2>Mind Snap</h2>
                <p className="ms-header-subtitle">Visual Sequence Memory</p>

            </header>

            {gameState === 'ready' && renderStartScreen()}

            {(
                gameState === 'memorize' ||
                gameState === 'answer' ||
                gameState === 'evaluating'
            ) && renderActiveGame()}

            {gameState === 'gameOver' && renderGameOverScreen()}

        </div>
    );
}