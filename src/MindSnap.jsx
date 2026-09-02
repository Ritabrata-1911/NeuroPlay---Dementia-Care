import React, { useState, useEffect, useCallback } from 'react';
import './MindSnap.css';

// --- CONFIGURATION ---
const GAME_DURATION = 60; // Total game time in seconds
const LEVEL_CONFIG = {
    1: { rows: 3, columns: 3, minTargets: 2, maxTargets: 4, displayTime: 2000 },
    2: { rows: 4, columns: 4, minTargets: 3, maxTargets: 6, displayTime: 2000 },
    3: { rows: 5, columns: 5, minTargets: 4, maxTargets: 8, displayTime: 1800 },
    4: { rows: 6, columns: 6, minTargets: 5, maxTargets: 10, displayTime: 1500 }
};

// --- UTILITIES ---
const generateTargetCount = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const generateRandomCells = (totalCells, targetCount) => {
    const cells = new Set();
    while (cells.size < targetCount) {
        cells.add(Math.floor(Math.random() * totalCells));
    }
    return Array.from(cells);
};
const calculateCorrectCells = (targetCells, selectedCells) => {
    return selectedCells.filter(cell => targetCells.includes(cell)).length;
};

// --- MAIN COMPONENT ---
export default function MindSnap({ patient, onHome }) {
    // Game Cycle States: "ready", "memorize", "answer", "evaluating", "gameOver"
    const [gameState, setGameState] = useState('ready');
    const [timeRemaining, setTimeRemaining] = useState(GAME_DURATION);
    const [level, setLevel] = useState(1); // Prepared for future AI adaptation

    // Scoring & Tracking
    const [score, setScore] = useState(0);
    const [roundsCompleted, setRoundsCompleted] = useState(0);
    const [totalCorrectBoxes, setTotalCorrectBoxes] = useState(0);

    // Round States
    const [targetCells, setTargetCells] = useState([]);
    const [selectedCells, setSelectedCells] = useState([]);
    const [feedbackMsg, setFeedbackMsg] = useState('');

    // --- GLOBAL TIMER MANAGEMENT ---
    useEffect(() => {
        let timer;
        if (gameState !== 'ready' && gameState !== 'gameOver') {
            if (timeRemaining > 0) {
                timer = setTimeout(() => setTimeRemaining(t => t - 1), 1000);
            } else {
                handleGameOver();
            }
        }
        return () => clearTimeout(timer);
    }, [timeRemaining, gameState]);

    // --- ROUND MANAGEMENT ---
    const startNewRound = useCallback(() => {
        if (timeRemaining <= 0) return;

        const config = LEVEL_CONFIG[level];
        const totalGridCells = config.rows * config.columns;
        const targetCount = generateTargetCount(config.minTargets, config.maxTargets);
        const newTargets = generateRandomCells(totalGridCells, targetCount);

        setTargetCells(newTargets);
        setSelectedCells([]);
        setFeedbackMsg('');
        setGameState('memorize');
    }, [level, timeRemaining]);

    // Memorization Phase Timer
    useEffect(() => {
        let displayTimer;
        if (gameState === 'memorize') {
            displayTimer = setTimeout(() => {
                if (timeRemaining > 0) {
                    setGameState('answer');
                }
            }, LEVEL_CONFIG[level].displayTime);
        }
        return () => clearTimeout(displayTimer);
    }, [gameState, level, timeRemaining]);

    // --- INTERACTIONS & EVALUATION ---
    const handleCellClick = (index) => {
        if (gameState !== 'answer') return;

        let newSelected;
        if (selectedCells.includes(index)) {
            // Deselect
            newSelected = selectedCells.filter(i => i !== index);
            setSelectedCells(newSelected);
        } else {
            // Select (only if under target limit)
            if (selectedCells.length < targetCells.length) {
                newSelected = [...selectedCells, index];
                setSelectedCells(newSelected);

                // If limit reached, evaluate instantly
                if (newSelected.length === targetCells.length) {
                    evaluateRound(newSelected);
                }
            }
        }
    };

    const evaluateRound = (finalSelections) => {
        setGameState('evaluating');
        const correctCount = calculateCorrectCells(targetCells, finalSelections);
        
        setScore(prev => prev + correctCount);
        setTotalCorrectBoxes(prev => prev + correctCount);
        setRoundsCompleted(prev => prev + 1);
        
        if (correctCount === targetCells.length) {
            setFeedbackMsg(`Great job! ${correctCount} / ${targetCells.length} Correct`);
        } else {
            setFeedbackMsg(`Good try! ${correctCount} / ${targetCells.length} Correct`);
        }

        // Wait briefly to show feedback, then start next round
        setTimeout(() => {
            if (timeRemaining > 0) {
                startNewRound();
            } else {
                handleGameOver();
            }
        }, 1200);
    };

    const handleGameOver = () => {
        setGameState('gameOver');
        
        // Future Supabase Analytics Payload
        const gameData = {
            userId: patient?.id || patient?.patient_id,
            gameName: "Mind Snap",
            level,
            duration: GAME_DURATION,
            finalScore: score,
            roundsCompleted,
            correctBoxes: totalCorrectBoxes,
            completedAt: new Date().toISOString()
        };
        console.log("Mind Snap Completed. Ready for DB:", gameData);
    };

    const resetGame = () => {
        setScore(0);
        setRoundsCompleted(0);
        setTotalCorrectBoxes(0);
        setTimeRemaining(GAME_DURATION);
        startNewRound();
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // --- RENDER SCREENS ---
    const renderStartScreen = () => (
        <div className="ms-card">
            <div className="ms-icon-lg">🧠</div>
            <h2>Welcome to Mind Snap</h2>
            <p className="ms-instruction">
                Remember the boxes that light up. <br/>
                When they disappear, select the boxes you remember.
            </p>
            <div className="ms-timer">You have {GAME_DURATION} seconds.</div>
            <br/><br/>
            <button className="ms-primary-btn" onClick={resetGame}>START GAME</button>
        </div>
    );

    const renderGameOverScreen = () => (
        <div className="ms-card">
            <div className="ms-icon-lg">🎉</div>
            <h2>Mind Snap Complete!</h2>
            <p className="ms-instruction">Great job completing this cognitive activity.</p>

            <div className="ms-stats">
                <div><strong>🏆 Final Score:</strong> {score}</div>
                <div><strong>🔄 Rounds Completed:</strong> {roundsCompleted}</div>
                <div><strong>🎯 Correct Boxes:</strong> {totalCorrectBoxes}</div>
            </div>

            <div>
                <button className="ms-primary-btn" onClick={resetGame}>PLAY AGAIN</button>
                <button className="ms-secondary-btn" onClick={onHome}>BACK TO DASHBOARD</button>
            </div>
        </div>
    );

    const renderActiveGame = () => {
        const config = LEVEL_CONFIG[level];
        const totalCells = config.rows * config.columns;
        const gridArray = Array.from({ length: totalCells }, (_, i) => i);

        return (
            <div className="ms-card">
                <div className="ms-top-bar">
                    <div className="ms-timer">⏱️ {formatTime(timeRemaining)}</div>
                    <div className="ms-score-board">🏆 Score: {score}</div>
                </div>

                <div className="ms-feedback-text">
                    {gameState === 'memorize' && 'Remember the highlighted boxes!'}
                    {gameState === 'answer' && `Select ${targetCells.length} boxes you remember`}
                    {gameState === 'evaluating' && feedbackMsg}
                </div>

                {gameState === 'answer' && (
                    <p style={{fontSize: '1.2rem', color: '#64748b'}}>
                        Selected: {selectedCells.length} / {targetCells.length}
                    </p>
                )}

                <div className="ms-grid-wrapper">
                    <div 
                        className="ms-grid" 
                        style={{ gridTemplateColumns: `repeat(${config.columns}, 1fr)` }}
                    >
                        {gridArray.map((index) => {
                            const isHighlighted = gameState === 'memorize' && targetCells.includes(index);
                            const isSelected = selectedCells.includes(index);
                            const isInteractive = gameState === 'answer';

                            return (
                                <div 
                                    key={index}
                                    onClick={() => handleCellClick(index)}
                                    className={`ms-cell ${isHighlighted ? 'highlighted' : ''} ${isSelected ? 'selected' : ''} ${isInteractive ? 'interactive' : ''}`}
                                >
                                    {isSelected ? '✓' : ''}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="mindsnap-container">
            <header className="ms-header">
                <h1>🧠 NeuroPlay</h1>
                <h2 style={{color: '#4a5568'}}>Mind Snap</h2>
            </header>

            {gameState === 'ready' && renderStartScreen()}
            {(gameState === 'memorize' || gameState === 'answer' || gameState === 'evaluating') && renderActiveGame()}
            {gameState === 'gameOver' && renderGameOverScreen()}
        </div>
    );
}