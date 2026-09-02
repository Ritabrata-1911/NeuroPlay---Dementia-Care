import React, { useState, useEffect, useRef } from 'react';
import './PictureRecallGame.css';

// ---------------------------------------------------------------------------
// PICTURE + QUESTION DATA
// Each "picture" is a structured scene (no external photo library used here —
// objects are rendered as large labeled icons arranged like a simple room).
// Swap `objects` for a real <img> later without touching game logic below.
// ---------------------------------------------------------------------------
const PICTURES = {
    easy: [
        {
            id: 'living-room-1',
            category: 'Living Room',
            difficulty: 'easy',
            objects: [
                { id: 'sofa', emoji: '🛋️', name: 'Sofa', color: 'Blue', location: 'in the middle of the room', count: 1 },
                { id: 'clock', emoji: '🕐', name: 'Clock', location: 'on the wall', count: 1 },
                { id: 'table', emoji: '🟫', name: 'Table', location: 'in front of the sofa', count: 1 },
                { id: 'book', emoji: '📖', name: 'Book', location: 'on the table', count: 1 },
                { id: 'vase', emoji: '🌷', name: 'Flower Vase', color: 'Pink', location: 'on the table', count: 1 },
            ],
            questions: [
                {
                    question: 'What was on the table?',
                    options: ['Book', 'Football', 'Telephone', 'Hat'],
                    correctAnswer: 'Book',
                    type: 'object',
                    hint: 'Think about the objects on the table.',
                },
                {
                    question: 'Was there a clock on the wall?',
                    options: ['Yes', 'No'],
                    correctAnswer: 'Yes',
                    type: 'presence',
                    hint: 'Think back carefully to the picture.',
                },
                {
                    question: 'What color was the sofa?',
                    options: ['Blue', 'Green', 'Red', 'Yellow'],
                    correctAnswer: 'Blue',
                    type: 'color',
                    hint: 'Look for the main furniture item.',
                },
            ],
        },
    ],
    medium: [
        {
            id: 'kitchen-1',
            category: 'Kitchen',
            difficulty: 'medium',
            objects: [
                { id: 'table', emoji: '🟫', name: 'Table', location: 'in the center', count: 1 },
                { id: 'cup', emoji: '☕', name: 'Cup', color: 'Blue', location: 'on the table', count: 2 },
                { id: 'plate', emoji: '🍽️', name: 'Plate', color: 'White', location: 'on the table', count: 1 },
                { id: 'spoon', emoji: '🥄', name: 'Spoon', location: 'beside the plate', count: 1 },
                { id: 'kettle', emoji: '🫖', name: 'Kettle', color: 'Red', location: 'on the stove', count: 1 },
                { id: 'apple', emoji: '🍎', name: 'Apple', color: 'Red', location: 'in the fruit bowl', count: 1 },
                { id: 'pan', emoji: '🍳', name: 'Pan', color: 'Black', location: 'on the stove', count: 1 },
            ],
            questions: [
                {
                    question: 'What was on the table?',
                    options: ['Cup', 'Ball', 'Shoe', 'Hat'],
                    correctAnswer: 'Cup',
                    type: 'object',
                    hint: 'Think about the objects on the table.',
                },
                {
                    question: 'What color was the kettle?',
                    options: ['Red', 'Green', 'Blue', 'Yellow'],
                    correctAnswer: 'Red',
                    type: 'color',
                    hint: 'Look for the object on the stove.',
                },
                {
                    question: 'How many cups were on the table?',
                    options: ['1', '2', '3', '4'],
                    correctAnswer: '2',
                    type: 'counting',
                    hint: 'Try to picture how many you saw on the table.',
                },
                {
                    question: 'Where was the kettle?',
                    options: ['On the stove', 'On the table', 'On the floor', 'Near the window'],
                    correctAnswer: 'On the stove',
                    type: 'location',
                    hint: 'Think about where the kettle was placed.',
                },
                {
                    question: 'Was there a spoon beside the plate?',
                    options: ['Yes', 'No'],
                    correctAnswer: 'Yes',
                    type: 'presence',
                    hint: 'Think back carefully to the picture.',
                },
            ],
        },
    ],
    hard: [
        {
            id: 'dining-room-1',
            category: 'Dining Room',
            difficulty: 'hard',
            objects: [
                { id: 'table', emoji: '🟫', name: 'Table', location: 'in the center', count: 1 },
                { id: 'plate', emoji: '🍽️', name: 'Plate', location: 'on the table', count: 4 },
                { id: 'cup', emoji: '☕', name: 'Cup', location: 'on the table', count: 2 },
                { id: 'chair', emoji: '🪑', name: 'Chair', location: 'around the table', count: 4 },
                { id: 'cake', emoji: '🎂', name: 'Cake', color: 'Brown', location: 'on the table', count: 1 },
                { id: 'vase', emoji: '🌻', name: 'Flower Vase', color: 'Yellow', location: 'on the table', count: 1 },
                { id: 'clock', emoji: '🕐', name: 'Clock', location: 'on the wall', count: 1 },
                { id: 'window', emoji: '🪟', name: 'Window', location: 'on the wall', count: 1 },
                { id: 'candle', emoji: '🕯️', name: 'Candle', color: 'White', location: 'next to the cake', count: 1 },
                { id: 'bread', emoji: '🍞', name: 'Bread', location: 'on the table', count: 1 },
                { id: 'fork', emoji: '🍴', name: 'Fork', location: 'beside each plate', count: 4 },
                { id: 'napkin', emoji: '🟥', name: 'Napkin', color: 'Red', location: 'beside the plate', count: 1 },
            ],
            questions: [
                {
                    question: 'What was on the table?',
                    options: ['Cake', 'Football', 'Shoe', 'Hat'],
                    correctAnswer: 'Cake',
                    type: 'object',
                    hint: 'Think about the centerpiece on the table.',
                },
                {
                    question: 'What color was the flower vase?',
                    options: ['Yellow', 'Blue', 'Green', 'Red'],
                    correctAnswer: 'Yellow',
                    type: 'color',
                    hint: 'Look for the flowers on the table.',
                },
                {
                    question: 'How many plates were on the table?',
                    options: ['2', '3', '4', '5'],
                    correctAnswer: '4',
                    type: 'counting',
                    hint: 'Try to picture one plate per chair.',
                },
                {
                    question: 'Was there a clock on the wall?',
                    options: ['Yes', 'No'],
                    correctAnswer: 'Yes',
                    type: 'presence',
                    hint: 'Think back carefully to the picture.',
                },
                {
                    question: 'Where was the flower vase?',
                    options: ['On the table', 'On the chair', 'On the floor', 'Near the window'],
                    correctAnswer: 'On the table',
                    type: 'location',
                    hint: 'Think about where the vase was placed.',
                },
                {
                    question: 'What was next to the cake?',
                    options: ['Candle', 'Shoe', 'Book', 'Hat'],
                    correctAnswer: 'Candle',
                    type: 'relative-position',
                    hint: 'Think about what was right beside the cake.',
                },
                {
                    question: 'What color was the napkin?',
                    options: ['Red', 'Blue', 'Green', 'Black'],
                    correctAnswer: 'Red',
                    type: 'detail',
                    hint: 'Focus on the smaller details near the plate.',
                },
            ],
        },
    ],
};

const DIFFICULTY_CONFIG = {
    easy: { label: 'Easy', observationTime: 15 },
    medium: { label: 'Medium', observationTime: 10 },
    hard: { label: 'Hard', observationTime: 8 },
};

const CORRECT_MESSAGES = ['Excellent!', 'Great memory!', "That's correct!"];
const INCORRECT_MESSAGES = ['Good try!', "That's okay — keep going!", "Let's continue."];

function pickRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// Placeholder for future adaptive difficulty. Not called automatically —
// kept here so a future update can wire it in without restructuring the game.
// e.g. accuracy >= 90 -> suggest 'harder'; accuracy < 50 -> suggest 'easier'.
export function suggestNextDifficulty(accuracy) {
    if (accuracy >= 90) return 'harder';
    if (accuracy < 50) return 'easier';
    return 'same';
}

export default function PictureRecallGame({ patient, onHome }) {
    const [currentScreen, setCurrentScreen] = useState('intro'); // intro | observation | question | results
    const [difficulty, setDifficulty] = useState('easy');
    const [selectedPicture, setSelectedPicture] = useState(PICTURES.easy[0]);
    const [remainingTime, setRemainingTime] = useState(DIFFICULTY_CONFIG.easy.observationTime);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [correctAnswers, setCorrectAnswers] = useState(0);
    const [hintsUsed, setHintsUsed] = useState(0);
    const [showHint, setShowHint] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [startTimestamp, setStartTimestamp] = useState(null);
    const [completionTime, setCompletionTime] = useState(0);

    const observationTimerRef = useRef(null);
    const questions = selectedPicture.questions;
    const totalQuestions = questions.length;
    const config = DIFFICULTY_CONFIG[difficulty];

    useEffect(() => {
        return () => clearInterval(observationTimerRef.current);
    }, []);

    // Observation countdown — stops itself the moment the picture is hidden
    useEffect(() => {
        if (currentScreen !== 'observation') {
            clearInterval(observationTimerRef.current);
            return;
        }

        observationTimerRef.current = setInterval(() => {
            setRemainingTime((prev) => {
                if (prev <= 1) {
                    clearInterval(observationTimerRef.current);
                    goToQuestions();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(observationTimerRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentScreen]);

    function speak(text) {
        if (isMuted || !('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }

    function handleDifficultyChange(nextDifficulty) {
        setDifficulty(nextDifficulty);
        setSelectedPicture(pickRandom(PICTURES[nextDifficulty]));
    }

    function startGame() {
        clearInterval(observationTimerRef.current);
        const picture = pickRandom(PICTURES[difficulty]);
        setSelectedPicture(picture);
        setRemainingTime(DIFFICULTY_CONFIG[difficulty].observationTime);
        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setFeedbackMessage('');
        setCorrectAnswers(0);
        setHintsUsed(0);
        setShowHint(false);
        setCompletionTime(0);
        setStartTimestamp(Date.now());
        setCurrentScreen('observation');
    }

    function goToQuestions() {
        setCurrentScreen('question');
        setSelectedAnswer(null);
        setIsAnswered(false);
        setFeedbackMessage('');
        setShowHint(false);
    }

    function handleAnswerSelect(option) {
        if (isAnswered) return; // prevent multiple answers for the same question

        const question = questions[currentQuestionIndex];
        const isCorrect = option === question.correctAnswer;

        setSelectedAnswer(option);
        setIsAnswered(true);

        if (isCorrect) {
            setCorrectAnswers((prev) => prev + 1);
            setFeedbackMessage(pickRandom(CORRECT_MESSAGES));
        } else {
            setFeedbackMessage(pickRandom(INCORRECT_MESSAGES));
        }
    }

    function handleNextQuestion() {
        if (currentQuestionIndex + 1 < totalQuestions) {
            setCurrentQuestionIndex((prev) => prev + 1);
            setSelectedAnswer(null);
            setIsAnswered(false);
            setFeedbackMessage('');
            setShowHint(false);
        } else {
            finishGame();
        }
    }

    function finishGame() {
        const endTime = startTimestamp ? Math.round((Date.now() - startTimestamp) / 1000) : 0;
        setCompletionTime(endTime);
        setCurrentScreen('results');

        const accuracy = Math.round((correctAnswers / totalQuestions) * 100);

        // Analytics record — ready to send to a backend later (e.g. Supabase).
        // Not sent anywhere yet, just prepared here.
        const analytics = {
            userId: patient?.id || patient?.full_name || 'unknown',
            gameName: 'Picture Recall',
            difficulty,
            pictureId: selectedPicture.id,
            totalQuestions,
            correctAnswers,
            accuracy,
            hintsUsed,
            observationTime: config.observationTime,
            completionTime: endTime,
            completed: true,
            timestamp: new Date().toISOString(),
        };
        console.log('Picture Recall analytics:', analytics);
    }

    function useHint() {
        if (isAnswered) return;
        setShowHint(true);
        setHintsUsed((prev) => prev + 1);
    }

    function playAgain() {
        startGame();
    }

    function backToIntro() {
        clearInterval(observationTimerRef.current);
        setCurrentScreen('intro');
    }

    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    let performanceMessage = 'Good try! Let\u2019s try another picture.';
    if (accuracy >= 90) performanceMessage = 'Excellent memory! Wonderful work.';
    else if (accuracy >= 70) performanceMessage = 'Great job! You remembered many details.';
    else if (accuracy >= 50) performanceMessage = 'Good effort! Keep practicing.';

    if (currentScreen === 'intro') {
        return (
            <div className="picture-recall-container">
                <header className="picture-recall-header">
                    <h1>🧠 NeuroPlay</h1>
                    <h2>Picture Recall</h2>
                    <p>Look carefully at the picture and remember as many details as you can.</p>
                </header>

                <div className="pr-difficulty-selector">
                    {Object.keys(DIFFICULTY_CONFIG).map((key) => (
                        <button
                            key={key}
                            className={`pr-diff-btn ${difficulty === key ? 'active-diff' : ''}`}
                            onClick={() => handleDifficultyChange(key)}
                        >
                            {DIFFICULTY_CONFIG[key].label}
                        </button>
                    ))}
                </div>

                <p className="pr-current-difficulty">Current difficulty: {config.label}</p>

                <div className="pr-intro-actions">
                    <button className="pr-primary-btn" onClick={startGame}>
                        ▶️ Start Game
                    </button>
                    <button
                        className="pr-secondary-btn"
                        onClick={() =>
                            speak(
                                'Look carefully at the picture and remember as many details as you can. When the time is up, the picture will be hidden and you will answer a few simple questions about it.'
                            )
                        }
                    >
                        🔊 Read Instructions
                    </button>
                    <button className="pr-secondary-btn" onClick={onHome}>
                        🏠 Home
                    </button>
                </div>

                <button
                    className="pr-mute-toggle"
                    onClick={() => setIsMuted((prev) => !prev)}
                    aria-pressed={isMuted}
                >
                    {isMuted ? '🔇 Sound Off' : '🔊 Sound On'}
                </button>
            </div>
        );
    }

    if (currentScreen === 'observation') {
        return (
            <div className="picture-recall-container">
                <header className="picture-recall-header">
                    <h2>Remember the picture</h2>
                    <p>Time remaining: {remainingTime} seconds</p>
                </header>

                <div className="pr-scene-board" role="img" aria-label={`${selectedPicture.category} scene`}>
                    <span className="pr-scene-label">{selectedPicture.category}</span>
                    <div className="pr-scene-objects">
                        {selectedPicture.objects.map((obj) => (
                            <div className="pr-scene-object" key={obj.id}>
                                <span className="pr-scene-emoji" aria-hidden="true">
                                    {obj.emoji}
                                    {obj.count > 1 ? ` ×${obj.count}` : ''}
                                </span>
                                <span className="pr-scene-name">{obj.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pr-progress-track">
                    <div
                        className="pr-progress-fill"
                        style={{ width: `${(remainingTime / config.observationTime) * 100}%` }}
                    />
                </div>
            </div>
        );
    }

    if (currentScreen === 'question') {
        const question = questions[currentQuestionIndex];
        return (
            <div className="picture-recall-container">
                <header className="picture-recall-header">
                    <h2>What do you remember?</h2>
                </header>

                <p className="pr-question-text">{question.question}</p>

                <div className="pr-options-grid">
                    {question.options.map((option) => {
                        const isSelected = selectedAnswer === option;
                        const isCorrectOption = option === question.correctAnswer;
                        let optionClass = 'pr-option-btn';
                        if (isAnswered && isSelected && isCorrectOption) optionClass += ' correct-option';
                        else if (isAnswered && isSelected && !isCorrectOption) optionClass += ' incorrect-option';
                        else if (isAnswered && isCorrectOption) optionClass += ' reveal-correct';
                        else if (isSelected) optionClass += ' selected-option';

                        return (
                            <button
                                key={option}
                                type="button"
                                className={optionClass}
                                onClick={() => handleAnswerSelect(option)}
                                disabled={isAnswered}
                                aria-pressed={isSelected}
                            >
                                {option}
                            </button>
                        );
                    })}
                </div>

                {showHint && !isAnswered && <p className="pr-hint-text">💡 {question.hint}</p>}

                {isAnswered && <p className="pr-feedback-text" aria-live="polite">{feedbackMessage}</p>}

                <div className="pr-question-footer">
                    <span className="pr-question-progress">
                        Question {currentQuestionIndex + 1}/{totalQuestions}
                    </span>

                    <div className="pr-question-actions">
                        {!isAnswered && (
                            <button className="pr-secondary-btn" onClick={useHint} disabled={showHint}>
                                💡 Hint
                            </button>
                        )}
                        <button
                            className="pr-secondary-btn"
                            onClick={() => speak(`${question.question} Options: ${question.options.join(', ')}`)}
                        >
                            🔊 Read Question
                        </button>
                        {isAnswered && (
                            <button className="pr-primary-btn" onClick={handleNextQuestion}>
                                {currentQuestionIndex + 1 < totalQuestions ? 'Next Question' : 'See Results'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="picture-recall-container">
            <div className="pr-results-card">
                <h2>Wonderful! You completed Picture Recall.</h2>

                <div className="pr-results-score">
                    <span className="pr-score-fraction">{correctAnswers} / {totalQuestions}</span>
                    <span className="pr-score-accuracy">Accuracy: {accuracy}%</span>
                </div>

                <p className="pr-performance-message">{performanceMessage}</p>

                <ul className="pr-results-stats">
                    <li><strong>Correct answers:</strong> {correctAnswers}</li>
                    <li><strong>Total questions:</strong> {totalQuestions}</li>
                    <li><strong>Difficulty:</strong> {config.label}</li>
                    <li><strong>Hints used:</strong> {hintsUsed}</li>
                    <li><strong>Completion time:</strong> {formatTime(completionTime)}</li>
                </ul>

                <div className="pr-results-actions">
                    <button className="pr-primary-btn" onClick={playAgain}>
                        Play Again
                    </button>
                    <button className="pr-secondary-btn" onClick={backToIntro}>
                        Back to Games
                    </button>
                    <button className="pr-secondary-btn" onClick={onHome}>
                        Home
                    </button>
                </div>
            </div>
        </div>
    );
}