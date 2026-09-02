import React, { useState, useEffect } from 'react';
import './MemoryMapGame.css';

// ---------------------------------------------------------
// MAP DATA STRUCTURES
// ---------------------------------------------------------
const MAPS = {
    easy: {
        time: 15,
        grid: [
            [{ type: 'empty' }, { type: 'loc', icon: '🏠', label: 'House' }, { type: 'empty' }],
            [{ type: 'loc', icon: '🌳', label: 'Park' }, { type: 'path', label: '🛣️' }, { type: 'loc', icon: '🏪', label: 'Shop' }],
            [{ type: 'empty' }, { type: 'loc', icon: '🏥', label: 'Hospital' }, { type: 'empty' }]
        ],
        questions: [
            { q: "Where is the hospital?", options: ["Above the road", "Below the road", "To the left of the park", "To the right of the shop"], correct: 1, hint: "Think about the bottom part of the map." },
            { q: "What is between the Park and the Shop?", options: ["Hospital", "House", "Road", "Nothing"], correct: 2, hint: "It connects the left and right sides." },
            { q: "Where was the House located?", options: ["Above the road", "Below the hospital", "Next to the shop", "Below the tree"], correct: 0, hint: "Think about the very top of the map." }
        ]
    },
    medium: {
        time: 12,
        grid: [
            [{ type: 'empty' }, { type: 'loc', icon: '🏠', label: 'House' }, { type: 'empty' }, { type: 'empty' }],
            [{ type: 'loc', icon: '🌳', label: 'Park' }, { type: 'path', label: '🛣️' }, { type: 'loc', icon: '🏪', label: 'Shop' }, { type: 'empty' }],
            [{ type: 'empty' }, { type: 'loc', icon: '🏥', label: 'Hospital' }, { type: 'path', label: '🛣️' }, { type: 'loc', icon: '📚', label: 'Library' }]
        ],
        questions: [
            { q: "Where is the Library?", options: ["Next to the House", "To the right of the Hospital", "Above the Shop", "To the left of the Park"], correct: 1, hint: "Think about the bottom right corner." },
            { q: "What is directly below the House?", options: ["Hospital", "Park", "Road", "Shop"], correct: 2, hint: "It's the center intersection." },
            { q: "Which place is furthest to the left?", options: ["Shop", "Hospital", "Library", "Park"], correct: 3, hint: "It's a green outdoor area." },
            { q: "What is above the Hospital?", options: ["Shop", "Park", "Road", "Nothing"], correct: 2, hint: "It's a path you can walk on." }
        ]
    },
    hard: {
        time: 10,
        grid: [
            [{ type: 'loc', icon: '⛽', label: 'Gas' }, { type: 'path', label: '🛣️' }, { type: 'loc', icon: '🏫', label: 'School' }, { type: 'empty' }],
            [{ type: 'empty' }, { type: 'path', label: '🛣️' }, { type: 'empty' }, { type: 'loc', icon: '🏪', label: 'Shop' }],
            [{ type: 'loc', icon: '🌳', label: 'Park' }, { type: 'path', label: '🛣️' }, { type: 'loc', icon: '🏥', label: 'Hospital' }, { type: 'empty' }],
            [{ type: 'empty' }, { type: 'empty' }, { type: 'path', label: '🛣️' }, { type: 'loc', icon: '🍽️', label: 'Diner' }]
        ],
        questions: [
            { q: "What is directly to the left of the School?", options: ["Park", "Road", "Shop", "Hospital"], correct: 1, hint: "It leads back to the Gas Station." },
            { q: "Where is the Diner located?", options: ["Top left", "Bottom right", "Center", "Top right"], correct: 1, hint: "It's at the very end of the bottom path." },
            { q: "What is directly between the Park and the Hospital?", options: ["Road", "School", "Shop", "Diner"], correct: 0, hint: "It's a pathway." },
            { q: "Which location is at the top-left?", options: ["Park", "Hospital", "School", "Gas Station"], correct: 3, hint: "It's where you fill up a car." },
            { q: "Where is the Shop?", options: ["Below the School", "Above the Diner", "Left of the Park", "Top Right corner"], correct: 0, hint: "Look to the far right, just below the top row." }
        ]
    }
};

export default function MemoryMapGame({ patient, onHome }) {
    // ---------------------------------------------------------
    // GAME STATES
    // ---------------------------------------------------------
    const [gameState, setGameState] = useState('start'); // start, memorize, question, feedback, results
    const [difficulty, setDifficulty] = useState('easy');
    const [timeLeft, setTimeLeft] = useState(0);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [correctAnswers, setCorrectAnswers] = useState(0);
    const [hintsUsed, setHintsUsed] = useState(0);
    const [showHint, setShowHint] = useState(false);
    const [feedback, setFeedback] = useState(null); // { isCorrect: boolean }

    const currentMap = MAPS[difficulty];
    const currentQ = currentMap.questions[currentQIndex];

    // ---------------------------------------------------------
    // MEMORIZE TIMER EFFECT
    // ---------------------------------------------------------
    useEffect(() => {
        let timer;
        if (gameState === 'memorize') {
            if (timeLeft > 0) {
                timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            } else {
                setGameState('question');
            }
        }
        return () => clearTimeout(timer);
    }, [gameState, timeLeft]);

    // ---------------------------------------------------------
    // EVENT HANDLERS
    // ---------------------------------------------------------
    const handleStartGame = () => {
        setScore(0);
        setCorrectAnswers(0);
        setHintsUsed(0);
        setCurrentQIndex(0);
        setTimeLeft(MAPS[difficulty].time);
        setGameState('memorize');
    };

    const handleAnswer = (optionIdx) => {
        const isCorrect = optionIdx === currentQ.correct;
        
        if (isCorrect) {
            // +10 pts, minus 2 if hint was used
            const points = Math.max(0, 10 - (showHint ? 2 : 0));
            setScore(prev => prev + points);
            setCorrectAnswers(prev => prev + 1);
        }

        setFeedback({ isCorrect });
        setGameState('feedback');
    };

    const handleNextQuestion = () => {
        setShowHint(false);
        if (currentQIndex + 1 < currentMap.questions.length) {
            setCurrentQIndex(prev => prev + 1);
            setGameState('question');
        } else {
            handleGameComplete();
            setGameState('results');
        }
    };

    const useHint = () => {
        if (!showHint) {
            setShowHint(true);
            setHintsUsed(prev => prev + 1);
        }
    };

    // Prepare for future backend tracking
    const handleGameComplete = () => {
        const gameData = {
            userId: patient.id || patient.patient_id,
            gameName: "Memory Map",
            difficulty,
            totalQuestions: currentMap.questions.length,
            correctAnswers: correctAnswers + (feedback?.isCorrect ? 1 : 0), // account for last question
            accuracy: Math.round(((correctAnswers + (feedback?.isCorrect ? 1 : 0)) / currentMap.questions.length) * 100),
            hintsUsed,
            score: score + (feedback?.isCorrect ? Math.max(0, 10 - (showHint ? 2 : 0)) : 0),
            completed: true,
            timestamp: new Date().toISOString()
        };
        console.log("Memory Map Completed. Future backend payload:", gameData);
        // Future: await supabase.from('patient_game_sessions').insert(gameData);
    };

    // ---------------------------------------------------------
    // RENDER SCREENS
    // ---------------------------------------------------------
    const renderStartScreen = () => (
        <div className="mm-card">
            <h2 className="mm-question" style={{fontSize: '2rem'}}>Choose Difficulty</h2>
            <div className="mm-difficulty-grid">
                {['easy', 'medium', 'hard'].map(level => (
                    <button 
                        key={level}
                        className={`mm-diff-btn ${difficulty === level ? 'selected' : ''}`}
                        onClick={() => setDifficulty(level)}
                    >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                ))}
            </div>
            <p className="mm-instruction">
                You will see a map for a few seconds. Try to remember where the places are located.
            </p>
            <button className="mm-primary-btn" onClick={handleStartGame}>Start Game</button>
        </div>
    );

    const renderMapScreen = () => (
        <div className="mm-card">
            <h2 className="mm-question">Remember the map</h2>
            
            <div className="mm-map-wrapper">
                <div 
                    className="mm-map-grid" 
                    style={{ gridTemplateColumns: `repeat(${currentMap.grid[0].length}, 100px)` }}
                >
                    {currentMap.grid.map((row, rIdx) => (
                        row.map((cell, cIdx) => (
                            <div key={`${rIdx}-${cIdx}`} className={`mm-cell ${cell.type}`}>
                                {cell.type === 'loc' && (
                                    <>
                                        <span className="mm-icon">{cell.icon}</span>
                                        <span className="mm-label">{cell.label}</span>
                                    </>
                                )}
                                {cell.type === 'path' && <span className="mm-icon">{cell.label}</span>}
                            </div>
                        ))
                    ))}
                </div>
            </div>

            <div className="mm-timer">Time remaining: {timeLeft} seconds</div>
        </div>
    );

    const renderQuestionScreen = () => (
        <div className="mm-card">
            <p style={{fontSize: '1.2rem', color: '#64748b', fontWeight: 'bold', marginBottom: '1rem'}}>
                Question {currentQIndex + 1} of {currentMap.questions.length}
            </p>
            
            <h2 className="mm-question">{currentQ.q}</h2>
            
            <div className="mm-options-grid">
                {currentQ.options.map((opt, idx) => (
                    <button 
                        key={idx} 
                        className="mm-option-btn"
                        onClick={() => handleAnswer(idx)}
                    >
                        {opt}
                    </button>
                ))}
            </div>

            <div className="mm-hint-box">
                {!showHint ? (
                    <button className="mm-hint-btn" onClick={useHint}>💡 Need a Hint?</button>
                ) : (
                    <div className="mm-hint-text">💡 Hint: {currentQ.hint}</div>
                )}
            </div>
        </div>
    );

    const renderFeedbackScreen = () => (
        <div className="mm-card">
            <div className="mm-feedback-icon">
                {feedback.isCorrect ? '🎉' : '👍'}
            </div>
            <h2 className="mm-feedback-msg">
                {feedback.isCorrect ? "Excellent! You remembered the location." : "Good try! Let's continue."}
            </h2>
            <button className="mm-primary-btn" onClick={handleNextQuestion}>
                {currentQIndex + 1 < currentMap.questions.length ? "Next Question" : "See Results"}
            </button>
        </div>
    );

    const renderResultScreen = () => {
        const accuracy = Math.round((correctAnswers / currentMap.questions.length) * 100);
        let message = "Good try! Let's try another map.";
        if (accuracy >= 90) message = "Excellent spatial memory!";
        else if (accuracy >= 70) message = "Great job! You remembered many locations.";
        else if (accuracy >= 50) message = "Good effort! Keep practicing.";

        return (
            <div className="mm-card">
                <div className="mm-feedback-icon">🏆</div>
                <h2 className="mm-question">Great Work! You completed Memory Map.</h2>
                <p className="mm-instruction">{message}</p>
                
                <div className="mm-stats">
                    <div><strong>Difficulty:</strong> {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</div>
                    <div><strong>Score:</strong> {score} Points</div>
                    <div><strong>Correct Answers:</strong> {correctAnswers} / {currentMap.questions.length}</div>
                    <div><strong>Accuracy:</strong> {accuracy}%</div>
                    <div><strong>Hints Used:</strong> {hintsUsed}</div>
                </div>

                <div style={{display: 'flex', gap: '1rem', justifyContent: 'center'}}>
                    <button className="mm-primary-btn" onClick={() => setGameState('start')}>Play Again</button>
                </div>
            </div>
        );
    };

    // ---------------------------------------------------------
    // MAIN RENDER
    // ---------------------------------------------------------
    return (
        <div className="memory-map-container">
            <header className="mm-header">
                <h1>🧠 NeuroPlay</h1>
                <h2>🗺️ Memory Map</h2>
            </header>

            {gameState === 'start' && renderStartScreen()}
            {gameState === 'memorize' && renderMapScreen()}
            {gameState === 'question' && renderQuestionScreen()}
            {gameState === 'feedback' && renderFeedbackScreen()}
            {gameState === 'results' && renderResultScreen()}

            <button className="mm-back-btn" onClick={onHome}>
                ← Back to Dashboard
            </button>
        </div>
    );
}