import React, { useState, useEffect, useCallback, useRef } from 'react';
import './MindSnap.css';

// ============================================================
// MIND SNAP CONFIGURATION
// ============================================================

const MAX_ROUNDS = 30;
const MIN_ROUNDS = 1;
const DEFAULT_ROUNDS = 15;

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

        // Prevent the same box from appearing twice
        // consecutively.
        if (
            sequence.length === 0 ||
            sequence[sequence.length - 1] !== randomCell
        ) {
            sequence.push(randomCell);
        }
    }

    return sequence;
};


// ============================================================
// MAIN COMPONENT
// ============================================================

export default function MindSnap({ patient, onHome }) {

    // ========================================================
    // GAME STATE
    // ========================================================

    /*
        ready
        memorize
        answer
        evaluating
        gameOver
    */

    const [gameState, setGameState] =
        useState('ready');


    // ========================================================
    // ROUND SETTINGS
    // ========================================================

    // Number of rounds entered by the patient
    const [roundInput, setRoundInput] =
        useState(String(DEFAULT_ROUNDS));

    // Actual number of rounds selected
    const [selectedRounds, setSelectedRounds] =
        useState(DEFAULT_ROUNDS);

    // Validation message
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


    // ========================================================
    // TIMER REFERENCE
    // ========================================================

    const timerRef = useRef(null);


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

        // Empty input
        if (value.trim() === '') {

            return 'Please enter the number of rounds.';

        }


        // Convert to number
        const number = Number(value);


        // Must be a valid number
        if (!Number.isFinite(number)) {

            return 'Please enter a valid number of rounds.';

        }


        // Must be an integer
        if (!Number.isInteger(number)) {

            return 'The number of rounds must be a whole number.';

        }


        // Less than minimum
        if (number < MIN_ROUNDS) {

            return `The number of rounds cannot be less than ${MIN_ROUNDS}.`;

        }


        // Greater than maximum
        if (number > MAX_ROUNDS) {

            return `The maximum number of rounds is ${MAX_ROUNDS}.`;

        }


        // Valid
        return '';

    };


    // ========================================================
    // HANDLE ROUND INPUT
    // ========================================================

    const handleRoundInputChange = (event) => {

        const value = event.target.value;

        // Allow the user to type/delete freely
        setRoundInput(value);

        // Validate immediately
        const error = validateRoundInput(value);

        setRoundError(error);

    };


    // ========================================================
    // START GAME
    // ========================================================

    const handleStartGame = () => {

        const error =
            validateRoundInput(roundInput);

        // ----------------------------------------------------
        // INVALID INPUT
        // ----------------------------------------------------

        if (error) {

            setRoundError(error);

            return;

        }


        const numberOfRounds =
            Number(roundInput);


        // Extra safety check
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


        // ----------------------------------------------------
        // Valid input
        // ----------------------------------------------------

        setRoundError('');

        setSelectedRounds(numberOfRounds);

        clearGameTimer();

        const firstLevel =
            INITIAL_LEVEL;

        const config =
            LEVEL_CONFIG[firstLevel];

        const totalCells =
            config.rows * config.columns;

        const newSequence =
            generateSequence(
                totalCells,
                config.sequenceLength
            );


        // Reset game statistics
        setRound(0);

        setLevel(firstLevel);

        setScore(0);

        setCorrectRounds(0);

        setIncorrectRounds(0);

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

    const createNewRound = useCallback(() => {

        const config =
            LEVEL_CONFIG[level];

        const totalCells =
            config.rows * config.columns;

        const newSequence =
            generateSequence(
                totalCells,
                config.sequenceLength
            );


        setTargetSequence(newSequence);

        setPatientSequence([]);

        setDisplayIndex(-1);

        setWrongCell(null);

        setFeedbackMsg('');

        setRoundCorrect(false);

        setGameState('memorize');

    }, [level]);


    // ========================================================
    // DISPLAY SEQUENCE
    // ========================================================

    useEffect(() => {

        if (gameState !== 'memorize') {
            return;
        }

        if (targetSequence.length === 0) {
            return;
        }


        const config =
            LEVEL_CONFIG[level];

        let currentIndex = 0;


        // Show first box
        setDisplayIndex(0);


        const showNextBox = () => {

            currentIndex++;


            // ------------------------------------------------
            // More boxes remain
            // ------------------------------------------------

            if (
                currentIndex <
                targetSequence.length
            ) {

                setDisplayIndex(
                    currentIndex
                );

                timerRef.current =
                    setTimeout(
                        showNextBox,
                        config.displayTime +
                        config.gapTime
                    );

            }


            // ------------------------------------------------
            // Sequence completed
            // ------------------------------------------------

            else {

                timerRef.current =
                    setTimeout(() => {

                        setDisplayIndex(-1);

                        setPatientSequence([]);

                        setGameState('answer');

                    }, config.displayTime);

            }

        };


        timerRef.current =
            setTimeout(
                showNextBox,
                config.displayTime +
                config.gapTime
            );


        return () => {

            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }

        };

    }, [
        gameState,
        targetSequence,
        level
    ]);


    // ========================================================
    // MOVE TO NEXT ROUND
    // ========================================================

    const moveToNextRound = () => {

        const nextRound =
            round + 1;


        // ----------------------------------------------------
        // GAME COMPLETE
        // ----------------------------------------------------

        if (
            nextRound >=
            selectedRounds
        ) {

            setRound(nextRound);

            setGameState('gameOver');

            return;

        }


        // ----------------------------------------------------
        // NEXT ROUND
        // ----------------------------------------------------

        setRound(nextRound);

        clearGameTimer();


        timerRef.current =
            setTimeout(() => {

                createNewRound();

            }, 400);

    };


    // ========================================================
    // HANDLE CELL CLICK
    // ========================================================

    const handleCellClick = (index) => {

        if (gameState !== 'answer') {
            return;
        }


        const currentPosition =
            patientSequence.length;

        const expectedCell =
            targetSequence[currentPosition];


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


            setIncorrectRounds(
                previous => previous + 1
            );


            // Make next round easier
            setLevel(
                previous =>
                    Math.max(
                        1,
                        previous - 1
                    )
            );


            timerRef.current =
                setTimeout(() => {

                    moveToNextRound();

                }, 1800);


            return;
        }


        // ====================================================
        // CORRECT ANSWER
        // ====================================================

        const newSequence = [
            ...patientSequence,
            index
        ];


        setPatientSequence(newSequence);


        // ====================================================
        // COMPLETE SEQUENCE
        // ====================================================

        if (
            newSequence.length ===
            targetSequence.length
        ) {

            setRoundCorrect(true);

            setGameState('evaluating');


            // Score
            const points =
                targetSequence.length *
                level;


            setScore(
                previous =>
                    previous + points
            );


            setCorrectRounds(
                previous =>
                    previous + 1
            );


            setFeedbackMsg(
                `Excellent! You remembered all ${targetSequence.length} boxes in the correct order.`
            );


            // Increase difficulty
            setLevel(
                previous =>
                    Math.min(
                        Object.keys(
                            LEVEL_CONFIG
                        ).length,
                        previous + 1
                    )
            );


            timerRef.current =
                setTimeout(() => {

                    moveToNextRound();

                }, 1600);

        }

    };


    // ========================================================
    // RESET GAME
    // ========================================================

    const resetGame = () => {

        clearGameTimer();

        setRoundInput(
            String(DEFAULT_ROUNDS)
        );

        setSelectedRounds(
            DEFAULT_ROUNDS
        );

        setRoundError('');

        setRound(0);

        setLevel(INITIAL_LEVEL);

        setScore(0);

        setCorrectRounds(0);

        setIncorrectRounds(0);

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

        if (gameState === 'ready') {
            return 0;
        }

        return Math.min(
            round + 1,
            selectedRounds
        );

    };


    // ========================================================
    // GET ACCURACY
    // ========================================================

    const getAccuracy = () => {

        if (selectedRounds <= 0) {
            return 0;
        }

        return Math.round(
            (
                correctRounds /
                selectedRounds
            ) * 100
        );

    };


    // ========================================================
    // START SCREEN
    // ========================================================

    const renderStartScreen = () => (

        <div className="ms-card ms-start-card">

            <div className="ms-icon-lg">
                🧠
            </div>


            <h2>
                Welcome to Mind Snap
            </h2>


            <p className="ms-instruction">

                Watch the colored boxes light up
                one at a time.

                <br />

                Each box will show a number.

                <br />

                Remember the order and
                repeat the sequence!

            </p>


            {/* =================================================
                HOW TO PLAY
            ================================================= */}

            <div className="ms-how-to-play">

                <div className="ms-how-step">

                    <span className="ms-step-number">
                        1
                    </span>

                    <span>
                        Watch the numbered boxes.
                    </span>

                </div>


                <div className="ms-how-step">

                    <span className="ms-step-number">
                        2
                    </span>

                    <span>
                        Remember their order.
                    </span>

                </div>


                <div className="ms-how-step">

                    <span className="ms-step-number">
                        3
                    </span>

                    <span>
                        Click them in the same order.
                    </span>

                </div>

            </div>


            {/* =================================================
                ROUND SELECTION
            ================================================= */}

            <div className="ms-round-selection">

                <h3>
                    Choose Number of Rounds
                </h3>

                <p>
                    Enter a whole number between
                    1 and 30.
                </p>


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
                        onChange={
                            handleRoundInputChange
                        }
                        className={
                            `ms-round-input ${
                                roundError
                                    ? 'input-error'
                                    : ''
                            }`
                        }
                        aria-invalid={
                            Boolean(roundError)
                        }
                        aria-describedby={
                            roundError
                                ? 'round-error-message'
                                : undefined
                        }
                    />

                </div>


                {/* =================================================
                    RED VALIDATION ALERT
                ================================================= */}

                {roundError && (

                    <div
                        id="round-error-message"
                        className="ms-round-error"
                        role="alert"
                    >

                        <span className="ms-error-icon">
                            !
                        </span>

                        <span>
                            {roundError}
                        </span>

                    </div>

                )}


                {!roundError && (

                    <div className="ms-round-valid">

                        <span>
                            ✓
                        </span>

                        <span>
                            You can choose 1 to 30 rounds.
                        </span>

                    </div>

                )}

            </div>


            {/* =================================================
                ADAPTIVE DIFFICULTY
            ================================================= */}

            <div className="ms-round-info">

                <strong>
                    📈 Adaptive Difficulty
                </strong>

                <span>
                    The game automatically adjusts
                    the difficulty according to
                    your performance.
                </span>

            </div>


            {/* =================================================
                START BUTTON
            ================================================= */}

            <button
                type="button"
                className="ms-primary-btn ms-start-button"
                onClick={handleStartGame}
                disabled={Boolean(roundError)}
            >
                START {selectedRounds} ROUNDS
            </button>

        </div>

    );


    // ========================================================
    // GAME OVER SCREEN
    // ========================================================

    const renderGameOverScreen = () => {

        const accuracy =
            getAccuracy();


        let resultIcon = '🌟';

        if (accuracy >= 80) {
            resultIcon = '🎉';
        }
        else if (accuracy >= 50) {
            resultIcon = '👏';
        }


        return (

            <div className="ms-card ms-game-over-card">

                <div className="ms-icon-lg">
                    {resultIcon}
                </div>


                <h2>
                    Mind Snap Complete!
                </h2>


                <p className="ms-instruction">

                    Well done!

                    <br />

                    You completed
                    <strong>
                        {' '}{selectedRounds}{' '}
                    </strong>
                    rounds.

                </p>


                {/* =================================================
                    STATISTICS
                ================================================= */}

                <div className="ms-stats">

                    <div className="ms-stat-item">

                        <span className="ms-stat-icon">
                            🏆
                        </span>

                        <div>

                            <span className="ms-stat-label">
                                Final Score
                            </span>

                            <strong>
                                {score}
                            </strong>

                        </div>

                    </div>


                    <div className="ms-stat-item">

                        <span className="ms-stat-icon">
                            🔄
                        </span>

                        <div>

                            <span className="ms-stat-label">
                                Rounds Played
                            </span>

                            <strong>
                                {selectedRounds}
                            </strong>

                        </div>

                    </div>


                    <div className="ms-stat-item">

                        <span className="ms-stat-icon">
                            ✅
                        </span>

                        <div>

                            <span className="ms-stat-label">
                                Correct Rounds
                            </span>

                            <strong>
                                {correctRounds}
                            </strong>

                        </div>

                    </div>


                    <div className="ms-stat-item">

                        <span className="ms-stat-icon">
                            ❌
                        </span>

                        <div>

                            <span className="ms-stat-label">
                                Incorrect Rounds
                            </span>

                            <strong>
                                {incorrectRounds}
                            </strong>

                        </div>

                    </div>


                    <div className="ms-stat-item ms-stat-full">

                        <span className="ms-stat-icon">
                            🎯
                        </span>

                        <div>

                            <span className="ms-stat-label">
                                Overall Accuracy
                            </span>

                            <strong>
                                {accuracy}%
                            </strong>

                        </div>

                    </div>

                </div>


                {/* =================================================
                    BUTTONS
                ================================================= */}

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

        const config =
            LEVEL_CONFIG[level];

        const totalCells =
            config.rows * config.columns;

        const gridArray =
            Array.from(
                { length: totalCells },
                (_, i) => i
            );


        return (

            <div className="ms-card ms-game-card">

                {/* =================================================
                    TOP BAR
                ================================================= */}

                <div className="ms-top-bar">

                    <div className="ms-round-board">

                        🔄 Round{' '}
                        {getDisplayedRound()}
                        {' / '}
                        {selectedRounds}

                    </div>


                    <div className="ms-level-board">

                        ⭐ Level {level}

                    </div>


                    <div className="ms-score-board">

                        🏆 {score}

                    </div>

                </div>


                {/* =================================================
                    FEEDBACK AREA
                ================================================= */}

                <div className="ms-feedback-area">


                    {gameState === 'memorize' && (

                        <>

                            <div className="ms-phase-title">
                                👀 WATCH THE SEQUENCE
                            </div>


                            <p className="ms-feedback-text">

                                Remember the numbered
                                boxes in order.

                            </p>


                            <div className="ms-sequence-progress">

                                {displayIndex >= 0

                                    ? `Showing ${
                                        displayIndex + 1
                                    } of ${
                                        targetSequence.length
                                    }`

                                    : 'Get ready...'

                                }

                            </div>

                        </>

                    )}


                    {gameState === 'answer' && (

                        <>

                            <div className="ms-phase-title ms-answer-title">
                                🧠 YOUR TURN
                            </div>


                            <p className="ms-feedback-text">

                                Click the boxes in
                                the same order.

                            </p>


                            <div className="ms-selection-progress">

                                Your sequence:

                                <strong>

                                    {patientSequence.length === 0

                                        ? ' —'

                                        : ` ${
                                            patientSequence
                                                .map(
                                                    (_, i) =>
                                                        i + 1
                                                )
                                                .join(' → ')
                                        }`

                                    }

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

                                {roundCorrect
                                    ? '✓'
                                    : '✕'
                                }

                            </span>


                            <span>
                                {feedbackMsg}
                            </span>

                        </div>

                    )}

                </div>


                {/* =================================================
                    GRID
                ================================================= */}

                <div className="ms-grid-wrapper">

                    <div
                        className="ms-grid"
                        style={{
                            gridTemplateColumns:
                                `repeat(${config.columns}, 1fr)`
                        }}
                    >

                        {gridArray.map((index) => {

                            const targetPosition =
                                targetSequence.indexOf(
                                    index
                                );


                            const isCurrentHighlighted =
                                gameState === 'memorize' &&
                                targetSequence[
                                    displayIndex
                                ] === index;


                            const selectedPosition =
                                patientSequence.indexOf(
                                    index
                                );


                            const isSelected =
                                selectedPosition !== -1;


                            const isWrong =
                                wrongCell === index;


                            const isInteractive =
                                gameState === 'answer';


                            return (

                                <button
                                    key={index}
                                    type="button"
                                    onClick={() =>
                                        handleCellClick(index)
                                    }
                                    disabled={!isInteractive}
                                    className={`
                                        ms-cell
                                        ${
                                            isCurrentHighlighted
                                                ? 'highlighted'
                                                : ''
                                        }
                                        ${
                                            isSelected
                                                ? 'selected'
                                                : ''
                                        }
                                        ${
                                            isWrong
                                                ? 'wrong'
                                                : ''
                                        }
                                        ${
                                            isInteractive
                                                ? 'interactive'
                                                : ''
                                        }
                                    `}
                                >

                                    {/* ---------------------------------
                                        NUMBER DURING MEMORIZATION
                                    --------------------------------- */}

                                    {isCurrentHighlighted && (

                                        <span className="ms-display-number">

                                            {targetPosition + 1}

                                        </span>

                                    )}


                                    {/* ---------------------------------
                                        PATIENT SELECTION NUMBER
                                    --------------------------------- */}

                                    {isSelected &&
                                        gameState !== 'memorize' && (

                                            <span className="ms-selected-number">

                                                {selectedPosition + 1}

                                            </span>

                                        )}


                                    {/* ---------------------------------
                                        WRONG ANSWER
                                    --------------------------------- */}

                                    {isWrong && (

                                        <span className="ms-wrong-symbol">

                                            ✕

                                        </span>

                                    )}

                                </button>

                            );

                        })}

                    </div>

                </div>


                {/* =================================================
                    HELPER TEXT
                ================================================= */}

                {gameState === 'memorize' && (

                    <div className="ms-helper-text">

                        <span>
                            💡
                        </span>

                        Watch carefully —
                        the numbers show the order.

                    </div>

                )}


                {gameState === 'answer' && (

                    <div className="ms-helper-text">

                        <span>
                            💡
                        </span>

                        Start with box 1,
                        then box 2,
                        then box 3...

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

                <h1>
                    🧠 NeuroPlay
                </h1>


                <h2>
                    Mind Snap
                </h2>


                <p className="ms-header-subtitle">
                    Visual Sequence Memory
                </p>

            </header>


            {gameState === 'ready' &&
                renderStartScreen()
            }


            {(
                gameState === 'memorize' ||
                gameState === 'answer' ||
                gameState === 'evaluating'
            ) &&
                renderActiveGame()
            }


            {gameState === 'gameOver' &&
                renderGameOverScreen()
            }

        </div>

    );
}