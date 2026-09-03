import React, { useEffect, useRef, useState } from 'react';
import './MemoryMapGame.css';

/* =========================================================
   MEMORY MAP DATA
   Dementia-friendly progression:
   Easy   → fewer locations, more viewing time
   Medium → more locations and spatial relationships
   Hard   → more locations and more complex recall
========================================================= */

const MAPS = {
    easy: {
        label: 'Gentle',
        memorizeTime: 25,
        description: 'A simple map with familiar places.',
        grid: [
            [
                { type: 'empty' },
                { type: 'loc', icon: '🏠', label: 'House' },
                { type: 'empty' }
            ],
            [
                { type: 'loc', icon: '🌳', label: 'Park' },
                { type: 'path' },
                { type: 'loc', icon: '🏪', label: 'Shop' }
            ],
            [
                { type: 'empty' },
                { type: 'loc', icon: '🏥', label: 'Hospital' },
                { type: 'empty' }
            ]
        ],
        questions: [
            {
                q: 'Where is the Hospital?',
                options: [
                    'Above the road',
                    'Below the road',
                    'To the left of the Park',
                    'To the right of the Shop'
                ],
                correct: 1,
                hint: 'Think about the lower part of the map.'
            },
            {
                q: 'What is between the Park and the Shop?',
                options: ['Hospital', 'House', 'Road', 'Nothing'],
                correct: 2,
                hint: 'It connects the left and right sides.'
            },
            {
                q: 'Where was the House?',
                options: [
                    'At the top of the map',
                    'Below the Hospital',
                    'Next to the Shop',
                    'Below the Park'
                ],
                correct: 0,
                hint: 'Think about the very top of the map.'
            }
        ]
    },

    medium: {
        label: 'Standard',
        memorizeTime: 30,
        description: 'A larger map with more places to remember.',
        grid: [
            [
                { type: 'empty' },
                { type: 'loc', icon: '🏠', label: 'House' },
                { type: 'empty' },
                { type: 'empty' }
            ],
            [
                { type: 'loc', icon: '🌳', label: 'Park' },
                { type: 'path' },
                { type: 'loc', icon: '🏪', label: 'Shop' },
                { type: 'empty' }
            ],
            [
                { type: 'empty' },
                { type: 'loc', icon: '🏥', label: 'Hospital' },
                { type: 'path' },
                { type: 'loc', icon: '📚', label: 'Library' }
            ]
        ],
        questions: [
            {
                q: 'Where is the Library?',
                options: [
                    'Next to the House',
                    'To the right of the Hospital',
                    'Above the Shop',
                    'To the left of the Park'
                ],
                correct: 1,
                hint: 'Think about the bottom-right area.'
            },
            {
                q: 'What is directly below the House?',
                options: ['Hospital', 'Park', 'Road', 'Shop'],
                correct: 2,
                hint: 'Look at the middle of the map.'
            },
            {
                q: 'Which place is furthest to the left?',
                options: ['Shop', 'Hospital', 'Library', 'Park'],
                correct: 3,
                hint: 'It is the green outdoor place.'
            },
            {
                q: 'What is above the Hospital?',
                options: ['Shop', 'Park', 'Road', 'Nothing'],
                correct: 2,
                hint: 'It is something you can travel along.'
            }
        ]
    },

    hard: {
        label: 'Challenge',
        memorizeTime: 35,
        description: 'A more detailed map with several locations.',
        grid: [
            [
                { type: 'loc', icon: '⛽', label: 'Gas Station' },
                { type: 'path' },
                { type: 'loc', icon: '🏫', label: 'School' },
                { type: 'empty' }
            ],
            [
                { type: 'empty' },
                { type: 'path' },
                { type: 'empty' },
                { type: 'loc', icon: '🏪', label: 'Shop' }
            ],
            [
                { type: 'loc', icon: '🌳', label: 'Park' },
                { type: 'path' },
                { type: 'loc', icon: '🏥', label: 'Hospital' },
                { type: 'empty' }
            ],
            [
                { type: 'empty' },
                { type: 'empty' },
                { type: 'path' },
                { type: 'loc', icon: '🍽️', label: 'Diner' }
            ]
        ],
        questions: [
            {
                q: 'What is directly to the left of the School?',
                options: ['Park', 'Road', 'Shop', 'Hospital'],
                correct: 1,
                hint: 'It is a path beside the School.'
            },
            {
                q: 'Where is the Diner?',
                options: [
                    'Top-left',
                    'Bottom-right',
                    'Center',
                    'Top-right'
                ],
                correct: 1,
                hint: 'Think about the lowest right-hand corner.'
            },
            {
                q: 'What is between the Park and the Hospital?',
                options: ['Road', 'School', 'Shop', 'Diner'],
                correct: 0,
                hint: 'It connects the two locations.'
            },
            {
                q: 'Which location is at the top-left?',
                options: [
                    'Park',
                    'Hospital',
                    'School',
                    'Gas Station'
                ],
                correct: 3,
                hint: 'It is where vehicles can get fuel.'
            }
        ]
    }
};


/* =========================================================
   MEMORY MAP GAME
========================================================= */

export default function MemoryMapGame({ patient = {}, onHome }) {

    /* ---------------- GAME STATE ---------------- */

    const [gameState, setGameState] = useState('start');
    // start | instructions | memorize | question | feedback | results

    const [difficulty, setDifficulty] = useState('easy');
    const [timeLeft, setTimeLeft] = useState(0);

    const [currentQIndex, setCurrentQIndex] = useState(0);

    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [feedback, setFeedback] = useState(null);

    const [correctAnswers, setCorrectAnswers] = useState(0);
    const [incorrectAnswers, setIncorrectAnswers] = useState(0);

    const [hintsUsed, setHintsUsed] = useState(0);
    const [showHint, setShowHint] = useState(false);

    const [score, setScore] = useState(0);

    const [extraTimeUsed, setExtraTimeUsed] = useState(false);
    const [questionStartTime, setQuestionStartTime] = useState(null);

    const currentMap = MAPS[difficulty];
    const currentQuestion = currentMap.questions[currentQIndex];


    /* =========================================================
       PERFORMANCE TRACKING
       useRef prevents asynchronous React state problems.
    ========================================================= */

    const sessionRef = useRef({
        startedAt: null,
        completedAt: null,

        questionResponseTimes: [],
        questionAttempts: [],

        hintsUsed: 0,
        extraTimeUsed: false,

        questionsCompleted: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,

        memorizationDuration: 0
    });


    /* =========================================================
       TIMER
    ========================================================= */

    useEffect(() => {

        if (gameState !== 'memorize') return;

        if (timeLeft <= 0) {
            setGameState('question');
            setQuestionStartTime(Date.now());
            return;
        }

        const timer = setTimeout(() => {
            setTimeLeft(previous => previous - 1);
        }, 1000);

        return () => clearTimeout(timer);

    }, [gameState, timeLeft]);


    /* =========================================================
       START GAME
    ========================================================= */

    const resetSession = () => {

        setCurrentQIndex(0);

        setCorrectAnswers(0);
        setIncorrectAnswers(0);

        setHintsUsed(0);

        setScore(0);

        setShowHint(false);
        setSelectedAnswer(null);
        setFeedback(null);

        setExtraTimeUsed(false);

        sessionRef.current = {
            startedAt: Date.now(),
            completedAt: null,

            questionResponseTimes: [],
            questionAttempts: [],

            hintsUsed: 0,
            extraTimeUsed: false,

            questionsCompleted: 0,
            correctAnswers: 0,
            incorrectAnswers: 0,

            memorizationDuration: 0
        };
    };


    const handleStartGame = () => {

        resetSession();

        setTimeLeft(currentMap.memorizeTime);

        sessionRef.current.memorizationStartedAt = Date.now();

        setGameState('memorize');
    };


    /* =========================================================
       EXTRA MEMORIZATION TIME
       Helpful for dementia patients without punishment.
    ========================================================= */

    const handleExtraTime = () => {

        if (!extraTimeUsed) {

            setTimeLeft(previous => previous + 10);

            setExtraTimeUsed(true);

            sessionRef.current.extraTimeUsed = true;
        }
    };


    const handleReadyForQuestions = () => {

        const startedAt = sessionRef.current.memorizationStartedAt;

        if (startedAt) {
            sessionRef.current.memorizationDuration =
                Math.round((Date.now() - startedAt) / 1000);
        }

        setGameState('question');

        setQuestionStartTime(Date.now());
    };


    /* =========================================================
       ANSWER HANDLING
    ========================================================= */

    const handleAnswer = (optionIndex) => {

        // Prevent accidental double answers
        if (selectedAnswer !== null) return;

        setSelectedAnswer(optionIndex);

        const isCorrect = optionIndex === currentQuestion.correct;

        const responseTime =
            Math.round((Date.now() - questionStartTime) / 1000);

        sessionRef.current.questionResponseTimes.push(responseTime);

        sessionRef.current.questionAttempts.push({
            questionNumber: currentQIndex + 1,
            question: currentQuestion.q,

            selectedAnswer:
                currentQuestion.options[optionIndex],

            correctAnswer:
                currentQuestion.options[currentQuestion.correct],

            isCorrect,

            responseTime,

            hintUsed: showHint
        });


        sessionRef.current.questionsCompleted += 1;


        if (isCorrect) {

            sessionRef.current.correctAnswers += 1;

            setCorrectAnswers(sessionRef.current.correctAnswers);

            // Points are intentionally simple.
            // Hint reduces points but never creates negative feedback.

            const earnedPoints = showHint ? 8 : 10;

            setScore(previous => previous + earnedPoints);

        } else {

            sessionRef.current.incorrectAnswers += 1;

            setIncorrectAnswers(
                sessionRef.current.incorrectAnswers
            );
        }


        setFeedback({
            isCorrect,
            correctAnswer:
                currentQuestion.options[currentQuestion.correct]
        });

        setGameState('feedback');
    };


    /* =========================================================
       HINT
    ========================================================= */

    const handleHint = () => {

        if (showHint) return;

        setShowHint(true);

        sessionRef.current.hintsUsed += 1;

        setHintsUsed(sessionRef.current.hintsUsed);
    };


    /* =========================================================
       NEXT QUESTION
    ========================================================= */

    const handleNextQuestion = () => {

        const isLastQuestion =
            currentQIndex >= currentMap.questions.length - 1;


        if (isLastQuestion) {

            handleGameComplete();

            setGameState('results');

            return;
        }


        setCurrentQIndex(previous => previous + 1);

        setShowHint(false);

        setSelectedAnswer(null);

        setFeedback(null);

        setQuestionStartTime(Date.now());

        setGameState('question');
    };


    /* =========================================================
       GAME COMPLETE + BACKEND READY PAYLOAD
    ========================================================= */

    const handleGameComplete = () => {

        sessionRef.current.completedAt = Date.now();

        const totalQuestions =
            currentMap.questions.length;

        const correct =
            sessionRef.current.correctAnswers;

        const incorrect =
            sessionRef.current.incorrectAnswers;

        const responseTimes =
            sessionRef.current.questionResponseTimes;


        const averageResponseTime =
            responseTimes.length > 0
                ? Number(
                    (
                        responseTimes.reduce(
                            (sum, time) => sum + time,
                            0
                        ) / responseTimes.length
                    ).toFixed(2)
                )
                : 0;


        const accuracy =
            totalQuestions > 0
                ? Number(
                    ((correct / totalQuestions) * 100).toFixed(2)
                )
                : 0;


        const mistakeRate =
            totalQuestions > 0
                ? Number(
                    ((incorrect / totalQuestions) * 100).toFixed(2)
                )
                : 0;


        const hintRate =
            totalQuestions > 0
                ? Number(
                    (
                        (sessionRef.current.hintsUsed /
                            totalQuestions) * 100
                    ).toFixed(2)
                )
                : 0;


        const completionRate =
            totalQuestions > 0
                ? Number(
                    (
                        (sessionRef.current.questionsCompleted /
                            totalQuestions) * 100
                    ).toFixed(2)
                )
                : 0;


        const sessionDuration =
            Math.round(
                (
                    sessionRef.current.completedAt -
                    sessionRef.current.startedAt
                ) / 1000
            );


        const gameData = {

            /* PATIENT */

            patient_id:
                patient?.id ||
                patient?.patient_id ||
                null,


            /* GAME */

            game_name: 'Memory Map',

            difficulty,

            difficulty_label:
                currentMap.label,


            /* QUESTIONS */

            total_questions:
                totalQuestions,

            questions_completed:
                sessionRef.current.questionsCompleted,

            correct_answers:
                correct,

            incorrect_answers:
                incorrect,


            /* PERFORMANCE */

            accuracy,

            mistake_rate:
                mistakeRate,

            hint_rate:
                hintRate,

            completion_rate:
                completionRate,

            average_response_time:
                averageResponseTime,

            question_response_times:
                responseTimes,


            /* ASSISTANCE */

            hints_used:
                sessionRef.current.hintsUsed,

            extra_time_used:
                sessionRef.current.extraTimeUsed,

            assistance_required:
                sessionRef.current.hintsUsed > 0 ||
                sessionRef.current.extraTimeUsed,


            /* TIME */

            memorization_time:
                sessionRef.current.memorizationDuration,

            session_duration:
                sessionDuration,

            completion_time:
                sessionDuration,


            /* SCORE */

            score,


            /* FUTURE ADAPTIVE DIFFICULTY */

            previous_accuracy: null,

            performance_trend: null,

            recommended_difficulty: null,


            /* QUESTION LEVEL DATA */

            question_attempts:
                sessionRef.current.questionAttempts,


            /* STATUS */

            completed: true,

            abandoned_game: false,


            /* TIMESTAMP */

            timestamp:
                new Date().toISOString()
        };


        console.log(
            'MEMORY MAP PERFORMANCE DATA:',
            gameData
        );


        /*
        ==================================================

        FUTURE BACKEND INTEGRATION

        Uncomment when backend is ready:

        fetch('/api/game-performance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(gameData)
        })
        .then(response => response.json())
        .then(data => {
            console.log('Saved successfully:', data);
        })
        .catch(error => {
            console.error('Error saving performance:', error);
        });

        ==================================================
        */

        return gameData;
    };


    /* =========================================================
       START SCREEN
    ========================================================= */

    const renderStartScreen = () => (

        <div className="mm-card mm-start-card">

            <div className="mm-game-icon">
                🗺️
            </div>

            <h2 className="mm-title">
                Welcome to Memory Map
            </h2>

            <p className="mm-instruction">
                Look carefully at a simple map and try to
                remember where familiar places are located.
                Take your time — there is no need to rush.
            </p>


            <div className="mm-section-label">
                Choose a level
            </div>


            <div className="mm-difficulty-grid">

                {Object.keys(MAPS).map(level => (

                    <button
                        key={level}

                        className={
                            `mm-diff-btn ${
                                difficulty === level
                                    ? 'selected'
                                    : ''
                            }`
                        }

                        onClick={() =>
                            setDifficulty(level)
                        }
                    >

                        <span className="mm-diff-name">

                            {MAPS[level].label}

                        </span>

                        <span className="mm-diff-description">

                            {MAPS[level].description}

                        </span>

                    </button>

                ))}

            </div>


            <button
                className="mm-primary-btn"
                onClick={() =>
                    setGameState('instructions')
                }
            >

                Continue

                <span>→</span>

            </button>

        </div>
    );


    /* =========================================================
       INSTRUCTIONS SCREEN
    ========================================================= */

    const renderInstructionsScreen = () => (

        <div className="mm-card">

            <div className="mm-game-icon small">
                🧠
            </div>

            <h2 className="mm-title">
                How to Play
            </h2>


            <div className="mm-instruction-steps">

                <div className="mm-step">

                    <div className="mm-step-number">
                        1
                    </div>

                    <div>
                        Look at the map carefully.
                    </div>

                </div>


                <div className="mm-step">

                    <div className="mm-step-number">
                        2
                    </div>

                    <div>
                        Take your time to remember
                        where each place is located.
                    </div>

                </div>


                <div className="mm-step">

                    <div className="mm-step-number">
                        3
                    </div>

                    <div>
                        Answer simple questions about
                        the map.
                    </div>

                </div>


                <div className="mm-step">

                    <div className="mm-step-number">
                        💡
                    </div>

                    <div>
                        You can use a hint whenever
                        you need help.
                    </div>

                </div>

            </div>


            <div className="mm-action-row">

                <button
                    className="mm-secondary-btn"
                    onClick={() =>
                        setGameState('start')
                    }
                >

                    ← Back

                </button>


                <button
                    className="mm-primary-btn"
                    onClick={handleStartGame}
                >

                    Start Memory Map

                </button>

            </div>

        </div>
    );


    /* =========================================================
       MAP SCREEN
    ========================================================= */

    const renderMapScreen = () => (

        <div className="mm-card">

            <div className="mm-progress-header">

                <div>

                    <span className="mm-progress-label">
                        Step 1 of 2
                    </span>

                    <h2 className="mm-title small-title">
                        Take a moment to remember the map
                    </h2>

                </div>

            </div>


            <div className="mm-progress-bar">

                <div
                    className="mm-progress-fill"
                    style={{ width: '50%' }}
                />

            </div>


            <p className="mm-map-instruction">

                Look at the places and their positions.
                When you feel ready, you can continue.

            </p>


            <div className="mm-map-wrapper">

                <div
                    className="mm-map-grid"
                    style={{
                        gridTemplateColumns:
                            `repeat(
                                ${currentMap.grid[0].length},
                                minmax(70px, 110px)
                            )`
                    }}
                >

                    {currentMap.grid.map(
                        (row, rowIndex) =>

                            row.map(
                                (cell, columnIndex) => (

                                    <div
                                        key={
                                            `${rowIndex}-${columnIndex}`
                                        }

                                        className={
                                            `mm-cell ${cell.type}`
                                        }
                                    >

                                        {cell.type === 'loc' && (

                                            <>

                                                <span className="mm-icon">

                                                    {cell.icon}

                                                </span>

                                                <span className="mm-label">

                                                    {cell.label}

                                                </span>

                                            </>

                                        )}


                                        {cell.type === 'path' && (

                                            <span className="mm-road">

                                                ═══

                                            </span>

                                        )}

                                    </div>

                                )
                            )

                    )}

                </div>

            </div>


            <div className="mm-time-panel">

                <span className="mm-time-icon">
                    ⏳
                </span>

                <div>

                    <span>
                        Suggested viewing time
                    </span>

                    <strong>
                        {timeLeft} seconds
                    </strong>

                </div>

            </div>


            <div className="mm-map-actions">

                <button
                    className="mm-secondary-btn"
                    onClick={handleExtraTime}
                    disabled={extraTimeUsed}
                >

                    {extraTimeUsed
                        ? 'Extra Time Added'
                        : '+ 10 More Seconds'}

                </button>


                <button
                    className="mm-primary-btn"
                    onClick={handleReadyForQuestions}
                >

                    I'm Ready →

                </button>

            </div>

        </div>
    );


    /* =========================================================
       QUESTION SCREEN
    ========================================================= */

    const renderQuestionScreen = () => {

        const progress =
            ((currentQIndex + 1) /
                currentMap.questions.length) * 100;


        return (

            <div className="mm-card">

                <div className="mm-question-top">

                    <div>

                        <span className="mm-progress-label">

                            Question
                            {' '}
                            {currentQIndex + 1}
                            {' '}
                            of
                            {' '}
                            {currentMap.questions.length}

                        </span>

                    </div>


                    <div className="mm-score-pill">

                        ⭐ {score} points

                    </div>

                </div>


                <div className="mm-progress-bar">

                    <div
                        className="mm-progress-fill"
                        style={{
                            width: `${progress}%`
                        }}
                    />

                </div>


                <h2 className="mm-question">

                    {currentQuestion.q}

                </h2>


                <p className="mm-question-support">

                    Choose the answer that feels right.
                    Take your time.

                </p>


                <div className="mm-options-grid">

                    {currentQuestion.options.map(
                        (option, index) => (

                            <button

                                key={index}

                                className="mm-option-btn"

                                onClick={() =>
                                    handleAnswer(index)
                                }

                            >

                                <span className="mm-option-letter">

                                    {String.fromCharCode(
                                        65 + index
                                    )}

                                </span>


                                {option}

                            </button>

                        )
                    )}

                </div>


                <div className="mm-hint-box">

                    {!showHint ? (

                        <button
                            className="mm-hint-btn"
                            onClick={handleHint}
                        >

                            💡 Show a Helpful Hint

                        </button>

                    ) : (

                        <div className="mm-hint-text">

                            <span>💡</span>

                            <div>

                                <strong>
                                    Helpful Hint
                                </strong>

                                <p>
                                    {currentQuestion.hint}
                                </p>

                            </div>

                        </div>

                    )}

                </div>

            </div>

        );
    };


    /* =========================================================
       FEEDBACK SCREEN
    ========================================================= */

    const renderFeedbackScreen = () => (

        <div className="mm-card mm-feedback-card">

            <div className="mm-feedback-icon">

                {feedback?.isCorrect
                    ? '🌟'
                    : '🌱'}

            </div>


            <h2 className="mm-feedback-msg">

                {feedback?.isCorrect
                    ? 'Well done!'
                    : 'That is okay!'}

            </h2>


            <p className="mm-feedback-description">

                {feedback?.isCorrect
                    ? 'You remembered that location correctly.'
                    : 'Memory exercises take practice. Let us continue together.'}

            </p>


            {!feedback?.isCorrect && (

                <div className="mm-answer-reveal">

                    <span>
                        The correct answer was:
                    </span>

                    <strong>
                        {feedback?.correctAnswer}
                    </strong>

                </div>

            )}


            <button
                className="mm-primary-btn"
                onClick={handleNextQuestion}
            >

                {currentQIndex <
                currentMap.questions.length - 1

                    ? 'Next Question →'

                    : 'See My Results'

                }

            </button>

        </div>
    );


    /* =========================================================
       RESULTS SCREEN
    ========================================================= */

    const renderResultScreen = () => {

        const totalQuestions =
            currentMap.questions.length;

        const accuracy =
            Math.round(
                (
                    correctAnswers /
                    totalQuestions
                ) * 100
            );


        let message =
            'Thank you for completing the exercise.';


        if (accuracy >= 80) {

            message =
                'Wonderful work! You remembered many locations.';

        } else if (accuracy >= 60) {

            message =
                'Good work! You remembered several locations.';

        } else {

            message =
                'Thank you for trying. Every practice session can be helpful.';
        }


        return (

            <div className="mm-card mm-results-card">

                <div className="mm-feedback-icon">

                    🏆

                </div>


                <h2 className="mm-title">

                    Memory Map Complete

                </h2>


                <p className="mm-instruction">

                    {message}

                </p>


                <div className="mm-results-highlight">

                    <span>Your Accuracy</span>

                    <strong>
                        {accuracy}%
                    </strong>

                </div>


                <div className="mm-stats-grid">

                    <div className="mm-stat">

                        <span>✓</span>

                        <div>

                            <strong>
                                {correctAnswers}
                            </strong>

                            <small>
                                Correct Answers
                            </small>

                        </div>

                    </div>


                    <div className="mm-stat">

                        <span>💡</span>

                        <div>

                            <strong>
                                {hintsUsed}
                            </strong>

                            <small>
                                Hints Used
                            </small>

                        </div>

                    </div>


                    <div className="mm-stat">

                        <span>⭐</span>

                        <div>

                            <strong>
                                {score}
                            </strong>

                            <small>
                                Points
                            </small>

                        </div>

                    </div>


                    <div className="mm-stat">

                        <span>📍</span>

                        <div>

                            <strong>
                                {currentMap.label}
                            </strong>

                            <small>
                                Level
                            </small>

                        </div>

                    </div>

                </div>


                <p className="mm-results-note">

                    Your session performance has been
                    recorded locally and is ready for
                    future backend integration.

                </p>


                <div className="mm-action-row center">

                    <button
                        className="mm-secondary-btn"
                        onClick={() =>
                            setGameState('start')
                        }
                    >

                        Choose Another Level

                    </button>


                    <button
                        className="mm-primary-btn"
                        onClick={handleStartGame}
                    >

                        Play Again

                    </button>

                </div>

            </div>

        );
    };


    /* =========================================================
       MAIN RENDER
    ========================================================= */

    return (

        <div className="memory-map-container">

            <header className="mm-header">

                <div className="mm-brand">

                    <span className="mm-brand-icon">
                        🧠
                    </span>

                    <span>
                        NeuroPlay
                    </span>

                </div>


                <div className="mm-game-name">

                    🗺️ Memory Map

                </div>

            </header>


            <main className="mm-game-content">

                {gameState === 'start' &&
                    renderStartScreen()}

                {gameState === 'instructions' &&
                    renderInstructionsScreen()}

                {gameState === 'memorize' &&
                    renderMapScreen()}

                {gameState === 'question' &&
                    renderQuestionScreen()}

                {gameState === 'feedback' &&
                    renderFeedbackScreen()}

                {gameState === 'results' &&
                    renderResultScreen()}

            </main>


            <button
                className="mm-back-btn"
                onClick={onHome}
            >

                ← Back to Dashboard

            </button>

        </div>

    );
}