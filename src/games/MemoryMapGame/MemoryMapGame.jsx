import React, { useEffect, useRef, useState } from 'react';
import './MemoryMapGame.css';
// Uncomment your supabase client import when backend is ready:
// import { supabase } from '../../supabaseClient'; 

/* =========================================================
   DYNAMIC MAP POOL
   Multiple layouts per difficulty to ensure the patient
   doesn't see the exact same map every round.
========================================================= */

const MAP_POOL = {
    easy: [
        {
            label: 'Gentle',
            memorizeTime: 25,
            description: 'A simple map with familiar places.',
            grid: [
                [{ type: 'empty' }, { type: 'loc', icon: '🏠', label: 'House' }, { type: 'empty' }],
                [{ type: 'loc', icon: '🌳', label: 'Park' }, { type: 'path' }, { type: 'loc', icon: '🏪', label: 'Shop' }],
                [{ type: 'empty' }, { type: 'loc', icon: '🏥', label: 'Hospital' }, { type: 'empty' }]
            ],
            questions: [
                { q: 'Where is the Hospital?', options: ['Above the road', 'Below the road', 'To the left of the Park', 'To the right of the Shop'], correct: 1, hint: 'Think about the lower part of the map.' },
                { q: 'What is between the Park and the Shop?', options: ['Hospital', 'House', 'Road', 'Nothing'], correct: 2, hint: 'It connects the left and right sides.' },
                { q: 'Where was the House?', options: ['At the top of the map', 'Below the Hospital', 'Next to the Shop', 'Below the Park'], correct: 0, hint: 'Think about the very top of the map.' }
            ]
        },
        {
            label: 'Gentle',
            memorizeTime: 25,
            description: 'A simple layout near the water.',
            grid: [
                [{ type: 'loc', icon: '🌊', label: 'Lake' }, { type: 'path' }, { type: 'loc', icon: '🥐', label: 'Bakery' }],
                [{ type: 'empty' }, { type: 'empty' }, { type: 'empty' }],
                [{ type: 'loc', icon: '📮', label: 'Post' }, { type: 'path' }, { type: 'loc', icon: '🐕', label: 'Vet' }]
            ],
            questions: [
                { q: 'Where is the Vet?', options: ['Next to the Post Office', 'Above the Bakery', 'Left of the Lake', 'Top right corner'], correct: 0, hint: 'Look at the bottom row, on the right.' },
                { q: 'What is connected to the Lake?', options: ['Vet', 'Bakery', 'Nothing', 'Post Office'], correct: 1, hint: 'Look along the path directly next to the Lake.' },
                { q: 'Where is the Post Office?', options: ['Bottom left', 'Top left', 'Bottom right', 'Top right'], correct: 0, hint: 'Look at the lowest, leftmost area.' }
            ]
        }
    ],
    medium: [
        {
            label: 'Standard',
            memorizeTime: 30,
            description: 'A larger map with more places to remember.',
            grid: [
                [{ type: 'empty' }, { type: 'loc', icon: '🏠', label: 'House' }, { type: 'empty' }, { type: 'empty' }],
                [{ type: 'loc', icon: '🌳', label: 'Park' }, { type: 'path' }, { type: 'loc', icon: '🏪', label: 'Shop' }, { type: 'empty' }],
                [{ type: 'empty' }, { type: 'loc', icon: '🏥', label: 'Hospital' }, { type: 'path' }, { type: 'loc', icon: '📚', label: 'Library' }]
            ],
            questions: [
                { q: 'Where is the Library?', options: ['Next to the House', 'To the right of the Hospital', 'Above the Shop', 'To the left of the Park'], correct: 1, hint: 'Think about the bottom-right area.' },
                { q: 'What is directly below the House?', options: ['Hospital', 'Park', 'Road', 'Shop'], correct: 2, hint: 'Look at the middle of the map.' },
                { q: 'Which place is furthest to the left?', options: ['Shop', 'Hospital', 'Library', 'Park'], correct: 3, hint: 'It is the green outdoor place.' },
                { q: 'What is above the Hospital?', options: ['Shop', 'Park', 'Road', 'Nothing'], correct: 2, hint: 'It is something you can travel along.' }
            ]
        },
        {
            label: 'Standard',
            memorizeTime: 30,
            description: 'A town center with several local spots.',
            grid: [
                [{ type: 'loc', icon: '🏫', label: 'School' }, { type: 'path' }, { type: 'loc', icon: '☕', label: 'Cafe' }, { type: 'empty' }],
                [{ type: 'empty' }, { type: 'empty' }, { type: 'path' }, { type: 'empty' }],
                [{ type: 'loc', icon: '🏊', label: 'Pool' }, { type: 'path' }, { type: 'loc', icon: '🚆', label: 'Station' }, { type: 'loc', icon: '🍿', label: 'Cinema' }]
            ],
            questions: [
                { q: 'Where is the Cinema?', options: ['Bottom right corner', 'Next to School', 'Top left', 'Above the Station'], correct: 0, hint: 'It is on the bottom edge, far right.' },
                { q: 'What is between the Pool and the Station?', options: ['School', 'Road', 'Cafe', 'Nothing'], correct: 1, hint: 'It connects the two locations.' },
                { q: 'Which location is at the top left?', options: ['Cinema', 'Cafe', 'School', 'Station'], correct: 2, hint: 'It is a place of learning.' },
                { q: 'Where is the Cafe located?', options: ['Top right', 'Below the School', 'Next to the Station', 'Connected to the School'], correct: 3, hint: 'Look at the top row.' }
            ]
        }
    ],
    hard: [
        {
            label: 'Challenge',
            memorizeTime: 35,
            description: 'A detailed map with several distinct locations.',
            grid: [
                [{ type: 'loc', icon: '⛽', label: 'Gas Station' }, { type: 'path' }, { type: 'loc', icon: '🏫', label: 'School' }, { type: 'empty' }],
                [{ type: 'empty' }, { type: 'path' }, { type: 'empty' }, { type: 'loc', icon: '🏪', label: 'Shop' }],
                [{ type: 'loc', icon: '🌳', label: 'Park' }, { type: 'path' }, { type: 'loc', icon: '🏥', label: 'Hospital' }, { type: 'empty' }],
                [{ type: 'empty' }, { type: 'empty' }, { type: 'path' }, { type: 'loc', icon: '🍽️', label: 'Diner' }]
            ],
            questions: [
                { q: 'What is directly to the left of the School?', options: ['Park', 'Road', 'Shop', 'Hospital'], correct: 1, hint: 'It is a path beside the School.' },
                { q: 'Where is the Diner?', options: ['Top-left', 'Bottom-right', 'Center', 'Top-right'], correct: 1, hint: 'Think about the lowest right-hand corner.' },
                { q: 'What is between the Park and the Hospital?', options: ['Road', 'School', 'Shop', 'Diner'], correct: 0, hint: 'It connects the two locations.' },
                { q: 'Which location is at the top-left?', options: ['Park', 'Hospital', 'School', 'Gas Station'], correct: 3, hint: 'It is where vehicles can get fuel.' }
            ]
        },
        {
            label: 'Challenge',
            memorizeTime: 35,
            description: 'A complex city layout.',
            grid: [
                [{ type: 'loc', icon: '🏛️', label: 'Museum' }, { type: 'path' }, { type: 'empty' }, { type: 'loc', icon: '🏨', label: 'Hotel' }],
                [{ type: 'empty' }, { type: 'path' }, { type: 'loc', icon: '🛍️', label: 'Mall' }, { type: 'empty' }],
                [{ type: 'loc', icon: '🏋️', label: 'Gym' }, { type: 'path' }, { type: 'empty' }, { type: 'loc', icon: '🏦', label: 'Bank' }],
                [{ type: 'empty' }, { type: 'path' }, { type: 'path' }, { type: 'loc', icon: '💊', label: 'Pharmacy' }]
            ],
            questions: [
                { q: 'What is directly to the right of the Museum?', options: ['Road', 'Hotel', 'Gym', 'Mall'], correct: 0, hint: 'There is a path next to it.' },
                { q: 'Where is the Pharmacy located?', options: ['Top right', 'Bottom left', 'Bottom right', 'Center'], correct: 2, hint: 'Look at the lowest corner on the right.' },
                { q: 'Which building is on the top right?', options: ['Hotel', 'Museum', 'Gym', 'Pharmacy'], correct: 0, hint: 'It is a place where you can stay overnight.' },
                { q: 'Where is the Gym?', options: ['Top right', 'Center', 'Bottom left', 'Middle left'], correct: 3, hint: 'It is on the left side, slightly below the center.' }
            ]
        }
    ]
};

const getRandomMap = (diff) => {
    const pool = MAP_POOL[diff];
    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex];
};

/* =========================================================
   MEMORY MAP GAME
========================================================= */

export default function MemoryMapGame({ patient = {}, onHome }) {

    /* ---------------- GAME STATE ---------------- */
    const [gameState, setGameState] = useState('start');
    // start | instructions | memorize | question | feedback | round-transition | results

    // Session Configuration
    const [totalRounds, setTotalRounds] = useState(1);
    const [currentRound, setCurrentRound] = useState(1);
    
    // Adaptive Difficulty
    const [difficulty, setDifficulty] = useState(patient?.recommendedDifficulty || patient?.performance_level || 'easy');
    const [pendingNextDifficulty, setPendingNextDifficulty] = useState(null);
    const [currentMap, setCurrentMap] = useState(null);
    
    // Timer & Flow
    const [timeLeft, setTimeLeft] = useState(0);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [feedback, setFeedback] = useState(null);
    
    // UI Helpers for Transitions
    const [roundScoreObj, setRoundScoreObj] = useState({ correct: 0, total: 0 });

    const [hintsUsed, setHintsUsed] = useState(0);
    const [showHint, setShowHint] = useState(false);
    const [score, setScore] = useState(0);
    const [extraTimeUsed, setExtraTimeUsed] = useState(false);
    const [questionStartTime, setQuestionStartTime] = useState(null);
    
    // Final data to display on end screen
    const [finalStats, setFinalStats] = useState(null);

    const activeQuestion = currentMap?.questions[currentQIndex];

    /* =========================================================
       PERFORMANCE TRACKING (Aggregates across all rounds)
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
       START GAME (Round 1)
    ========================================================= */
    const resetSession = () => {
        setCurrentRound(1);
        setCurrentQIndex(0);
        setHintsUsed(0);
        setScore(0);
        setShowHint(false);
        setSelectedAnswer(null);
        setFeedback(null);
        setExtraTimeUsed(false);
        setFinalStats(null);

        // Reset to base difficulty
        const baseDiff = patient?.recommendedDifficulty || patient?.performance_level || 'easy';
        setDifficulty(baseDiff);

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
        
        // Pick initial map for Round 1
        const initialMap = getRandomMap(difficulty);
        setCurrentMap(initialMap);
        setTimeLeft(initialMap.memorizeTime);
        
        sessionRef.current.memorizationStartedAt = Date.now();
        setGameState('memorize');
    };

    /* =========================================================
       EXTRA MEMORIZATION TIME
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
            sessionRef.current.memorizationDuration += Math.round((Date.now() - startedAt) / 1000);
        }
        setGameState('question');
        setQuestionStartTime(Date.now());
    };

    /* =========================================================
       ANSWER HANDLING
    ========================================================= */
    const handleAnswer = (optionIndex) => {
        if (selectedAnswer !== null) return;

        setSelectedAnswer(optionIndex);

        const isCorrect = optionIndex === activeQuestion.correct;
        const responseTime = Math.round((Date.now() - questionStartTime) / 1000);

        sessionRef.current.questionResponseTimes.push(responseTime);
        sessionRef.current.questionAttempts.push({
            roundNumber: currentRound,
            questionNumber: currentQIndex + 1,
            question: activeQuestion.q,
            selectedAnswer: activeQuestion.options[optionIndex],
            correctAnswer: activeQuestion.options[activeQuestion.correct],
            isCorrect,
            responseTime,
            hintUsed: showHint
        });

        sessionRef.current.questionsCompleted += 1;

        if (isCorrect) {
            sessionRef.current.correctAnswers += 1;
            const earnedPoints = showHint ? 8 : 10;
            setScore(previous => previous + earnedPoints);
        } else {
            sessionRef.current.incorrectAnswers += 1;
        }

        setFeedback({
            isCorrect,
            correctAnswer: activeQuestion.options[activeQuestion.correct]
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
       NEXT QUESTION & ADAPTIVE DIFFICULTY LOGIC
    ========================================================= */
    const handleNextQuestion = () => {
        const isLastQuestionOfRound = currentQIndex >= currentMap.questions.length - 1;

        if (isLastQuestionOfRound) {
            // 1. Calculate accuracy for JUST this round to determine adaptive change
            const roundAttempts = sessionRef.current.questionAttempts.slice(-currentMap.questions.length);
            const roundCorrect = roundAttempts.filter(a => a.isCorrect).length;
            const accuracy = roundCorrect / currentMap.questions.length;

            let nextDiff = difficulty;
            if (accuracy === 1) {
                nextDiff = difficulty === 'easy' ? 'medium' : 'hard';
            } else if (accuracy < 0.5) {
                nextDiff = difficulty === 'hard' ? 'medium' : 'easy';
            }

            if (currentRound < totalRounds) {
                // Prepare transition to next round
                setPendingNextDifficulty(nextDiff);
                setRoundScoreObj({ correct: roundCorrect, total: currentMap.questions.length });
                setGameState('round-transition');
            } else {
                // Entire game finished
                handleGameComplete();
                setGameState('results');
            }
            return;
        }

        // Just move to the next question in the current map
        setCurrentQIndex(prev => prev + 1);
        setShowHint(false);
        setSelectedAnswer(null);
        setFeedback(null);
        setQuestionStartTime(Date.now());
        setGameState('question');
    };

    /* =========================================================
       START NEXT ROUND (After Transition)
    ========================================================= */
    const handleNextRound = () => {
        const nextMap = getRandomMap(pendingNextDifficulty);
        
        setDifficulty(pendingNextDifficulty);
        setCurrentMap(nextMap);
        setCurrentRound(prev => prev + 1);
        setCurrentQIndex(0);
        setShowHint(false);
        setSelectedAnswer(null);
        setFeedback(null);
        setExtraTimeUsed(false);
        
        setTimeLeft(nextMap.memorizeTime);
        sessionRef.current.memorizationStartedAt = Date.now();
        setGameState('memorize');
    };

    /* =========================================================
       GAME COMPLETE (Aggregate Payload generation)
    ========================================================= */
    const handleGameComplete = () => {
        sessionRef.current.completedAt = Date.now();

        const totalQ = sessionRef.current.questionsCompleted;
        const correct = sessionRef.current.correctAnswers;
        const incorrect = sessionRef.current.incorrectAnswers;
        const responseTimes = sessionRef.current.questionResponseTimes;

        const averageResponseTime = responseTimes.length > 0
            ? Number((responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length).toFixed(2))
            : 0;

        const accuracy = totalQ > 0 ? Number(((correct / totalQ) * 100).toFixed(2)) : 0;
        const mistakeRate = totalQ > 0 ? Number(((incorrect / totalQ) * 100).toFixed(2)) : 0;
        const hintRate = totalQ > 0 ? Number(((sessionRef.current.hintsUsed / totalQ) * 100).toFixed(2)) : 0;

        const sessionDuration = Math.round((sessionRef.current.completedAt - sessionRef.current.startedAt) / 1000);

        const gameData = {
            patient_id: patient?.id || patient?.patient_id || null,
            game_name: 'Memory Map',
            
            // Log final round's difficulty as the benchmark reached
            difficulty_level: difficulty, 
            difficulty_label: currentMap.label,

            total_rounds_completed: totalRounds,
            questions_completed: totalQ,
            correct_answers: correct,
            incorrect_answers: incorrect,

            accuracy,
            mistake_rate: mistakeRate,
            hint_rate: hintRate,
            completion_rate: 100, // 100% since they finished all selected rounds
            average_response_time: averageResponseTime,
            question_response_times: responseTimes,

            hints_used: sessionRef.current.hintsUsed,
            extra_time_used: sessionRef.current.extraTimeUsed,
            assistance_required: sessionRef.current.hintsUsed > 0 || sessionRef.current.extraTimeUsed,

            memorization_time: sessionRef.current.memorizationDuration,
            session_duration: sessionDuration,
            completion_time: sessionDuration,

            score,
            question_attempts: sessionRef.current.questionAttempts,
            completed: true,
            timestamp: new Date().toISOString()
        };

        console.log('MEMORY MAP PERFORMANCE DATA:', gameData);
        setFinalStats(gameData);

        /* --- SUPABASE INTEGRATION --- 
           Ensure you have your supabase client imported at the top. */
        /*
        supabase
            .from('game_results')
            .insert([gameData])
            .then(({ data, error }) => {
                if (error) console.error('Error saving to Supabase:', error);
                else console.log('Successfully saved to Supabase:', data);
            });
        */

        return gameData;
    };


    /* =========================================================
       RENDER: START SCREEN
    ========================================================= */
    const renderStartScreen = () => (
        <div className="mm-card mm-start-card">
            <div className="mm-game-icon">🗺️</div>
            <h2 className="mm-title">Welcome to Memory Map</h2>
            <p className="mm-instruction">
                Look carefully at a simple map and try to remember where familiar places are located.
                The game will automatically adapt its difficulty based on your performance.
            </p>

            <div className="mm-section-label">Choose how many rounds to play</div>
            
            <div className="mm-difficulty-grid">
                {[1, 3, 5].map(num => (
                    <button
                        key={num}
                        className={`mm-diff-btn ${totalRounds === num ? 'selected' : ''}`}
                        onClick={() => setTotalRounds(num)}
                    >
                        <span className="mm-diff-name">{num} {num === 1 ? 'Round' : 'Rounds'}</span>
                    </button>
                ))}
            </div>

            <button
                className="mm-primary-btn"
                onClick={() => setGameState('instructions')}
            >
                Continue <span>→</span>
            </button>
        </div>
    );

    /* =========================================================
       RENDER: INSTRUCTIONS
    ========================================================= */
    const renderInstructionsScreen = () => (
        <div className="mm-card">
            <div className="mm-game-icon small">🧠</div>
            <h2 className="mm-title">How to Play</h2>

            <div className="mm-instruction-steps">
                <div className="mm-step">
                    <div className="mm-step-number">1</div>
                    <div>Look at the map carefully.</div>
                </div>
                <div className="mm-step">
                    <div className="mm-step-number">2</div>
                    <div>Take your time to remember where each place is located.</div>
                </div>
                <div className="mm-step">
                    <div className="mm-step-number">3</div>
                    <div>Answer simple questions about the map.</div>
                </div>
                <div className="mm-step">
                    <div className="mm-step-number">💡</div>
                    <div>You can use a hint whenever you need help.</div>
                </div>
            </div>

            <div className="mm-action-row">
                <button className="mm-secondary-btn" onClick={() => setGameState('start')}>
                    ← Back
                </button>
                <button className="mm-primary-btn" onClick={handleStartGame}>
                    Start Game
                </button>
            </div>
        </div>
    );

    /* =========================================================
       RENDER: MEMORIZE (MAP)
    ========================================================= */
    const renderMapScreen = () => {
        if (!currentMap) return null;
        
        return (
            <div className="mm-card">
                <div className="mm-progress-header">
                    <div>
                        <span className="mm-progress-label">Round {currentRound} of {totalRounds}</span>
                        <h2 className="mm-title small-title">Take a moment to remember the map</h2>
                    </div>
                </div>

                <div className="mm-progress-bar">
                    <div className="mm-progress-fill" style={{ width: '50%' }} />
                </div>

                <p className="mm-map-instruction">
                    Look at the places and their positions. When you feel ready, you can continue.
                </p>

                <div className="mm-map-wrapper">
                    <div
                        className="mm-map-grid"
                        style={{
                            gridTemplateColumns: `repeat(${currentMap.grid[0].length}, minmax(70px, 110px))`
                        }}
                    >
                        {currentMap.grid.map((row, rowIndex) =>
                            row.map((cell, columnIndex) => (
                                <div key={`${rowIndex}-${columnIndex}`} className={`mm-cell ${cell.type}`}>
                                    {cell.type === 'loc' && (
                                        <>
                                            <span className="mm-icon">{cell.icon}</span>
                                            <span className="mm-label">{cell.label}</span>
                                        </>
                                    )}
                                    {cell.type === 'path' && (
                                        <span className="mm-road">═══</span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="mm-time-panel">
                    <span className="mm-time-icon">⏳</span>
                    <div>
                        <span>Suggested viewing time</span>
                        <strong>{timeLeft} seconds</strong>
                    </div>
                </div>

                <div className="mm-map-actions">
                    <button
                        className="mm-secondary-btn"
                        onClick={handleExtraTime}
                        disabled={extraTimeUsed}
                    >
                        {extraTimeUsed ? 'Extra Time Added' : '+ 10 More Seconds'}
                    </button>
                    <button className="mm-primary-btn" onClick={handleReadyForQuestions}>
                        I'm Ready →
                    </button>
                </div>
            </div>
        );
    };

    /* =========================================================
       RENDER: QUESTION
    ========================================================= */
    const renderQuestionScreen = () => {
        if (!activeQuestion) return null;
        const progress = ((currentQIndex + 1) / currentMap.questions.length) * 100;

        return (
            <div className="mm-card">
                <div className="mm-question-top">
                    <div>
                        <span className="mm-progress-label">
                            Round {currentRound} — Question {currentQIndex + 1} of {currentMap.questions.length}
                        </span>
                    </div>
                    <div className="mm-score-pill">⭐ {score} points</div>
                </div>

                <div className="mm-progress-bar">
                    <div className="mm-progress-fill" style={{ width: `${progress}%` }} />
                </div>

                <h2 className="mm-question">{activeQuestion.q}</h2>
                <p className="mm-question-support">
                    Choose the answer that feels right. Take your time.
                </p>

                <div className="mm-options-grid">
                    {activeQuestion.options.map((option, index) => (
                        <button
                            key={index}
                            className="mm-option-btn"
                            onClick={() => handleAnswer(index)}
                        >
                            <span className="mm-option-letter">
                                {String.fromCharCode(65 + index)}
                            </span>
                            {option}
                        </button>
                    ))}
                </div>

                <div className="mm-hint-box">
                    {!showHint ? (
                        <button className="mm-hint-btn" onClick={handleHint}>
                            💡 Show a Helpful Hint
                        </button>
                    ) : (
                        <div className="mm-hint-text">
                            <span>💡</span>
                            <div>
                                <strong>Helpful Hint</strong>
                                <p>{activeQuestion.hint}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    /* =========================================================
       RENDER: FEEDBACK (After Each Question)
    ========================================================= */
    const renderFeedbackScreen = () => (
        <div className="mm-card mm-feedback-card">
            <div className="mm-feedback-icon">
                {feedback?.isCorrect ? '🌟' : '🌱'}
            </div>
            <h2 className="mm-feedback-msg">
                {feedback?.isCorrect ? 'Well done!' : 'That is okay!'}
            </h2>
            <p className="mm-feedback-description">
                {feedback?.isCorrect
                    ? 'You remembered that location correctly.'
                    : 'Memory exercises take practice. Let us continue together.'}
            </p>

            {!feedback?.isCorrect && (
                <div className="mm-answer-reveal">
                    <span>The correct answer was:</span>
                    <strong>{feedback?.correctAnswer}</strong>
                </div>
            )}

            <button className="mm-primary-btn" onClick={handleNextQuestion}>
                Continue →
            </button>
        </div>
    );

    /* =========================================================
       RENDER: ROUND TRANSITION (Between Rounds)
    ========================================================= */
    const renderRoundTransitionScreen = () => (
        <div className="mm-card mm-feedback-card">
            <div className="mm-feedback-icon">🎯</div>
            <h2 className="mm-feedback-msg">Round {currentRound} Complete!</h2>
            
            <p className="mm-feedback-description">
                You scored <strong>{roundScoreObj.correct} out of {roundScoreObj.total}</strong> on that map. 
            </p>

            {pendingNextDifficulty !== difficulty && (
                <div className="mm-round-alert">
                    {pendingNextDifficulty === 'medium' || pendingNextDifficulty === 'hard'
                        ? '📈 Difficulty increasing for the next round based on your great work!'
                        : '📉 Difficulty adjusting to keep things comfortable.'}
                </div>
            )}

            <button className="mm-primary-btn" onClick={handleNextRound}>
                Start Round {currentRound + 1} →
            </button>
        </div>
    );

    /* =========================================================
       RENDER: RESULTS
    ========================================================= */
    const renderResultScreen = () => {
        if (!finalStats) return null;

        let message = 'Thank you for completing the exercise.';
        if (finalStats.accuracy >= 80) {
            message = 'Wonderful work! You remembered many locations.';
        } else if (finalStats.accuracy >= 60) {
            message = 'Good work! You remembered several locations.';
        } else {
            message = 'Thank you for trying. Every practice session can be helpful.';
        }

        return (
            <div className="mm-card mm-results-card">
                <div className="mm-feedback-icon">🏆</div>
                <h2 className="mm-title">Memory Map Complete</h2>
                <p className="mm-instruction">{message}</p>

                <div className="mm-results-highlight">
                    <span>Total Session Accuracy</span>
                    <strong>{finalStats.accuracy}%</strong>
                </div>

                <div className="mm-stats-grid">
                    <div className="mm-stat">
                        <strong>{finalStats.game_name}</strong>
                        <small>Game Name</small>
                    </div>
                    <div className="mm-stat">
                        <strong>{finalStats.total_rounds_completed}</strong>
                        <small>Rounds Played</small>
                    </div>
                    <div className="mm-stat">
                        <strong>{finalStats.accuracy}%</strong>
                        <small>Accuracy</small>
                    </div>
                    <div className="mm-stat">
                        <strong>{finalStats.mistake_rate}%</strong>
                        <small>Mistake Rate</small>
                    </div>
                    <div className="mm-stat">
                        <strong>{finalStats.hint_rate}%</strong>
                        <small>Hint Rate</small>
                    </div>
                    <div className="mm-stat">
                        <strong>{finalStats.completion_time}s</strong>
                        <small>Completion Time</small>
                    </div>
                    <div className="mm-stat">
                        <strong>{finalStats.average_response_time}s</strong>
                        <small>Avg Response</small>
                    </div>
                    <div className="mm-stat">
                        <strong>{finalStats.questions_completed}</strong>
                        <small>Questions</small>
                    </div>
                    <div className="mm-stat">
                        <strong>{finalStats.correct_answers}</strong>
                        <small>Correct</small>
                    </div>
                    <div className="mm-stat">
                        <strong>{finalStats.incorrect_answers}</strong>
                        <small>Incorrect</small>
                    </div>
                </div>

                <div className="mm-action-row center">
                    <button className="mm-primary-btn" onClick={() => setGameState('start')}>
                        Play Again
                    </button>
                </div>
            </div>
        );
    };

    /* =========================================================
       MAIN COMPONENT RENDER
    ========================================================= */
    return (
        <div className="memory-map-container">
            <header className="mm-header">
                <div className="mm-brand">
                    <span className="mm-brand-icon">🧠</span>
                    <span>NeuroPlay</span>
                </div>
                <div className="mm-game-name">🗺️ Memory Map</div>
            </header>

            <main className="mm-game-content">
                {gameState === 'start' && renderStartScreen()}
                {gameState === 'instructions' && renderInstructionsScreen()}
                {gameState === 'memorize' && renderMapScreen()}
                {gameState === 'question' && renderQuestionScreen()}
                {gameState === 'feedback' && renderFeedbackScreen()}
                {gameState === 'round-transition' && renderRoundTransitionScreen()}
                {gameState === 'results' && renderResultScreen()}
            </main>

            <button className="mm-back-btn" onClick={onHome}>
                ← Back to Dashboard
            </button>
        </div>
    );
}