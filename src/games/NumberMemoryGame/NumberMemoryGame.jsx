import React, { useEffect, useMemo, useRef, useState } from "react";
import "./NumberMemoryGame.css";

/*
|--------------------------------------------------------------------------
| NUMBER MEMORY GAME
|--------------------------------------------------------------------------
| Game types:
|   1. Number Recall
|   2. Addition
|   3. Subtraction
|   4. Multiplication
|   5. Division
|
| First 3 levels are mandatory.
|
| After Level 1 -> NEXT LEVEL
| After Level 2 -> NEXT LEVEL
| After Level 3 -> NEXT ROUND + BACK TO DASHBOARD
|
| After Level 3, the patient can continue with Level 4, 5, 6...
|
| Difficulty is automatically calculated from previous performance.
| The elderly user never selects Easy / Medium / Hard manually.
|--------------------------------------------------------------------------
*/

const MANDATORY_LEVELS = 3;
const ROUNDS_PER_LEVEL = 3;
const MAX_ATTEMPTS = 3;

const API_BASE_URL = "http://localhost:5000/api";
const GAME_NAME = "Number Memory Game";

/*
|--------------------------------------------------------------------------
| First 3 levels
|--------------------------------------------------------------------------
| Viewing time increases with level as requested.
|
| Level 1 -> 4 seconds
| Level 2 -> 5 seconds
| Level 3 -> 6 seconds
|
| After Level 3, time continues increasing gradually.
|--------------------------------------------------------------------------
*/

const BASE_LEVELS = {
    1: {
        recallLength: 3,
        recallTime: 4,
        additionMax: 10,
        subtractionMax: 10,
        multiplicationMax: 5,
        divisionMax: 10,
    },

    2: {
        recallLength: 4,
        recallTime: 5,
        additionMax: 20,
        subtractionMax: 20,
        multiplicationMax: 7,
        divisionMax: 20,
    },

    3: {
        recallLength: 5,
        recallTime: 6,
        additionMax: 30,
        subtractionMax: 30,
        multiplicationMax: 8,
        divisionMax: 30,
    },

    4: {
        recallLength: 6,
        recallTime: 7,
        additionMax: 40,
        subtractionMax: 40,
        multiplicationMax: 9,
        divisionMax: 40,
    },

    5: {
        recallLength: 7,
        recallTime: 8,
        additionMax: 50,
        subtractionMax: 50,
        multiplicationMax: 10,
        divisionMax: 50,
    },
};

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(array) {
    return [...array].sort(() => Math.random() - 0.5);
}

function normalizeAnswer(value) {
    return String(value ?? "")
        .trim()
        .replace(/\s+/g, "");
}

function getLevelConfig(level) {
    if (BASE_LEVELS[level]) {
        return BASE_LEVELS[level];
    }

    /*
     * Levels above 5 continue gradually.
     * Viewing time increases up to 10 seconds.
     */
    const extra = level - 5;

    return {
        recallLength: Math.min(10, 7 + extra),
        recallTime: Math.min(10, 8 + extra),

        additionMax: Math.min(100, 50 + extra * 10),

        subtractionMax: Math.min(100, 50 + extra * 10),

        multiplicationMax: Math.min(12, 10 + Math.floor(extra / 2)),

        divisionMax: Math.min(100, 50 + extra * 10),
    };
}

function generateNumberSequence(length) {
    const sequence = [];

    for (let i = 0; i < length; i++) {
        let number = randomInt(0, 9);

        /*
         * Avoid immediate duplicate digits.
         */
        if (i > 0) {
            while (number === sequence[i - 1]) {
                number = randomInt(0, 9);
            }
        }

        sequence.push(number);
    }

    return sequence;
}

/*
|--------------------------------------------------------------------------
| Generate arithmetic questions
|--------------------------------------------------------------------------
*/

function createAddition(config) {
    const first = randomInt(1, config.additionMax);
    const second = randomInt(1, config.additionMax);

    return {
        type: "addition",
        icon: "➕",
        title: "Addition",
        question: `${first} + ${second} = ?`,
        answer: first + second,
    };
}

function createSubtraction(config) {
    let first = randomInt(1, config.subtractionMax);
    let second = randomInt(1, config.subtractionMax);

    /*
     * Make sure answer is never negative.
     */
    if (second > first) {
        [first, second] = [second, first];
    }

    return {
        type: "subtraction",
        icon: "➖",
        title: "Subtraction",
        question: `${first} − ${second} = ?`,
        answer: first - second,
    };
}

function createMultiplication(config) {
    const first = randomInt(2, config.multiplicationMax);
    const second = randomInt(2, 5);

    return {
        type: "multiplication",
        icon: "✖️",
        title: "Multiplication",
        question: `${first} × ${second} = ?`,
        answer: first * second,
    };
}

function createDivision(config) {
    const divisor = randomInt(
        2,
        Math.min(10, config.divisionMax)
    );

    const maximumQuotient = Math.max(
        2,
        Math.floor(config.divisionMax / divisor)
    );

    const quotient = randomInt(1, maximumQuotient);

    const dividend = divisor * quotient;

    return {
        type: "division",
        icon: "➗",
        title: "Division",
        question: `${dividend} ÷ ${divisor} = ?`,
        answer: quotient,
    };
}

function createRecallQuestion(config) {
    const sequence = generateNumberSequence(config.recallLength);

    return {
        type: "recall",
        icon: "🧠",
        title: "Number Recall",
        sequence,
        question: "Remember the numbers",
        answer: sequence.join(""),
    };
}

function createQuestion(config, type) {
    switch (type) {
        case "recall":
            return createRecallQuestion(config);

        case "addition":
            return createAddition(config);

        case "subtraction":
            return createSubtraction(config);

        case "multiplication":
            return createMultiplication(config);

        case "division":
            return createDivision(config);

        default:
            return createRecallQuestion(config);
    }
}

/*
|--------------------------------------------------------------------------
| Create mixed question types
|--------------------------------------------------------------------------
| Every level contains all 5 types when possible.
|--------------------------------------------------------------------------
*/

function createQuestionSet(config) {
    const allTypes = [
        "recall",
        "addition",
        "subtraction",
        "multiplication",
        "division",
    ];

    /*
     * Since each level has 3 rounds, select 3 different types for
     * each level, while rotating the types so that all five are
     * regularly represented.
     */
    const start = randomInt(0, allTypes.length - 1);

    const selectedTypes = [];

    for (let i = 0; i < ROUNDS_PER_LEVEL; i++) {
        selectedTypes.push(
            allTypes[(start + i) % allTypes.length]
        );
    }

    return shuffle(
        selectedTypes.map((type) => createQuestion(config, type))
    );
}

/*
|--------------------------------------------------------------------------
| Difficulty calculation
|--------------------------------------------------------------------------
| Previous performance controls the next starting level.
|
| No difficulty buttons are shown to the patient.
|--------------------------------------------------------------------------
*/

function calculateNextDifficulty(previousPerformance) {
    if (!previousPerformance) {
        return 1;
    }

    const accuracy = Number(
        previousPerformance.accuracy ?? 0
    );

    const mistakeRate = Number(
        previousPerformance.mistake_rate ?? 0
    );

    const hintRate = Number(
        previousPerformance.hint_rate ?? 0
    );

    const averageResponseTime = Number(
        previousPerformance.average_response_time ?? 0
    );

    const previousLevel = clamp(
        Number(previousPerformance.difficulty_level ?? 1),
        1,
        10
    );

    let score = 0;

    if (accuracy >= 85) {
        score += 2;
    } else if (accuracy >= 70) {
        score += 1;
    } else if (accuracy < 50) {
        score -= 2;
    } else if (accuracy < 65) {
        score -= 1;
    }

    if (mistakeRate <= 15) {
        score += 1;
    } else if (mistakeRate >= 40) {
        score -= 1;
    }

    if (hintRate <= 15) {
        score += 1;
    } else if (hintRate >= 40) {
        score -= 1;
    }

    if (averageResponseTime > 0) {
        if (averageResponseTime <= 8) {
            score += 1;
        } else if (averageResponseTime >= 18) {
            score -= 1;
        }
    }

    if (score >= 3) {
        return clamp(previousLevel + 1, 1, 10);
    }

    if (score <= -2) {
        return clamp(previousLevel - 1, 1, 10);
    }

    return previousLevel;
}

/*
|--------------------------------------------------------------------------
| Hints
|--------------------------------------------------------------------------
*/

function getHint(question) {
    switch (question.type) {
        case "recall":
            return "Try remembering the first number, then continue one number at a time.";

        case "addition":
            return "Start with the first number and count forward by the second number.";

        case "subtraction":
            return "Start with the first number and count backwards.";

        case "multiplication":
            return "Think of equal groups. For example, 3 × 4 means 3 groups of 4.";

        case "division":
            return "Think about how many equal groups can be made.";

        default:
            return "Take your time and think carefully.";
    }
}

/*
|--------------------------------------------------------------------------
| Main Component
|--------------------------------------------------------------------------
*/

export default function NumberMemoryGame({ patient, onHome }) {
    const [screen, setScreen] = useState("intro");

    const [level, setLevel] = useState(1);

    const [round, setRound] = useState(0);

    const [questions, setQuestions] = useState([]);

    const [currentQuestion, setCurrentQuestion] = useState(null);

    const [answer, setAnswer] = useState("");

    const [attempts, setAttempts] = useState(0);

    const [hint, setHint] = useState("");

    const [showCorrectAnswer, setShowCorrectAnswer] =
        useState(false);

    const [recallVisible, setRecallVisible] = useState(false);

    const [remainingTime, setRemainingTime] = useState(0);

    const [questionStartTime, setQuestionStartTime] =
        useState(null);

    const [levelStartTime, setLevelStartTime] =
        useState(null);

    const [previousPerformance, setPreviousPerformance] =
        useState(null);

    const [loadingPerformance, setLoadingPerformance] =
        useState(false);

    const [levelResults, setLevelResults] = useState([]);

    const [resultData, setResultData] = useState(null);

    const [errorMessage, setErrorMessage] = useState("");

    const timerRef = useRef(null);

    const config = useMemo(
        () => getLevelConfig(level),
        [level]
    );

    /*
    |--------------------------------------------------------------------------
    | Cleanup
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        return () => {
            clearInterval(timerRef.current);
        };
    }, []);

    /*
    |--------------------------------------------------------------------------
    | Fetch previous performance
    |--------------------------------------------------------------------------
    */

    async function fetchPreviousPerformance() {
        const patientId =
            patient?.id ||
            patient?.patient_id ||
            patient?.patientId;

        if (!patientId) {
            return null;
        }

        setLoadingPerformance(true);

        try {
            const response = await fetch(
                `${API_BASE_URL}/games/number-memory/performance/${patientId}`
            );

            if (!response.ok) {
                throw new Error("Unable to load previous performance.");
            }

            const data = await response.json();

            const performance =
                data?.performance || data || null;

            setPreviousPerformance(performance);

            return performance;
        } catch (error) {
            console.warn(
                "Previous performance could not be loaded:",
                error
            );

            return null;
        } finally {
            setLoadingPerformance(false);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Start the game
    |--------------------------------------------------------------------------
    */

    async function handleStartGame() {
        setErrorMessage("");

        const previous = await fetchPreviousPerformance();

        /*
         * If this is the patient's first session, start at Level 1.
         *
         * Otherwise the level is automatically calculated from
         * previous performance.
         */
        const calculatedLevel =
            previous
                ? calculateNextDifficulty(previous)
                : 1;

        startLevel(calculatedLevel);
    }

    /*
    |--------------------------------------------------------------------------
    | Start level
    |--------------------------------------------------------------------------
    */

    function startLevel(levelNumber) {
        clearInterval(timerRef.current);

        const safeLevel = clamp(levelNumber, 1, 10);

        const levelConfig = getLevelConfig(safeLevel);

        const generatedQuestions =
            createQuestionSet(levelConfig);

        setLevel(safeLevel);

        setRound(0);

        setQuestions(generatedQuestions);

        setCurrentQuestion(generatedQuestions[0]);

        setAnswer("");

        setAttempts(0);

        setHint("");

        setShowCorrectAnswer(false);

        setRecallVisible(
            generatedQuestions[0]?.type === "recall"
        );

        setRemainingTime(
            generatedQuestions[0]?.type === "recall"
                ? levelConfig.recallTime
                : 0
        );

        setLevelResults([]);

        setResultData(null);

        setLevelStartTime(Date.now());

        setQuestionStartTime(null);

        if (generatedQuestions[0]?.type === "recall") {
            setScreen("memorizing");
        } else {
            setScreen("question");

            setQuestionStartTime(Date.now());
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Memorization timer
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        if (
            screen !== "memorizing" ||
            !currentQuestion ||
            currentQuestion.type !== "recall"
        ) {
            return undefined;
        }

        clearInterval(timerRef.current);

        setRemainingTime(config.recallTime);

        timerRef.current = setInterval(() => {
            setRemainingTime((previous) => {
                if (previous <= 1) {
                    clearInterval(timerRef.current);

                    setRecallVisible(false);

                    setScreen("question");

                    setQuestionStartTime(Date.now());

                    return 0;
                }

                return previous - 1;
            });
        }, 1000);

        return () => {
            clearInterval(timerRef.current);
        };
    }, [
        screen,
        currentQuestion,
        config.recallTime,
    ]);

    /*
    |--------------------------------------------------------------------------
    | Start next round
    |--------------------------------------------------------------------------
    */

    function startNextRound(nextRoundIndex) {
        const nextQuestion =
            questions[nextRoundIndex];

        setRound(nextRoundIndex);

        setCurrentQuestion(nextQuestion);

        setAnswer("");

        setAttempts(0);

        setHint("");

        setShowCorrectAnswer(false);

        setRecallVisible(
            nextQuestion.type === "recall"
        );

        if (nextQuestion.type === "recall") {
            setRemainingTime(config.recallTime);

            setScreen("memorizing");
        } else {
            setRemainingTime(0);

            setScreen("question");

            setQuestionStartTime(Date.now());
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Submit answer
    |--------------------------------------------------------------------------
    */

    function handleSubmit(event) {
        event.preventDefault();

        if (!currentQuestion) {
            return;
        }

        if (attempts >= MAX_ATTEMPTS) {
            return;
        }

        const cleanAnswer = normalizeAnswer(answer);

        if (!cleanAnswer) {
            setErrorMessage("Please enter your answer.");
            return;
        }

        setErrorMessage("");

        const currentAttempt = attempts + 1;

        const correctAnswer = normalizeAnswer(
            currentQuestion.answer
        );

        const isCorrect =
            cleanAnswer === correctAnswer;

        const responseTime =
            questionStartTime
                ? (Date.now() - questionStartTime) / 1000
                : 0;

        setAttempts(currentAttempt);

        if (isCorrect) {
            const result = {
                questionType: currentQuestion.type,
                correct: true,
                attempts: currentAttempt,
                mistakes: currentAttempt - 1,
                hints: currentAttempt - 1,
                response_time: Number(
                    responseTime.toFixed(2)
                ),
            };

            moveToNext(result);

            return;
        }

        /*
         * Wrong answer:
         *
         * Always provide a hint.
         */
        const nextHint = getHint(currentQuestion);

        setHint(nextHint);

        /*
         * Third wrong attempt:
         * stop accepting answers and reveal the answer.
         */
        if (currentAttempt >= MAX_ATTEMPTS) {
            setShowCorrectAnswer(true);

            const result = {
                questionType: currentQuestion.type,
                correct: false,
                attempts: MAX_ATTEMPTS,
                mistakes: MAX_ATTEMPTS,
                hints: MAX_ATTEMPTS,
                response_time: Number(
                    responseTime.toFixed(2)
                ),
            };

            setTimeout(() => {
                moveToNext(result);
            }, 2200);

            return;
        }

        /*
         * Allow another attempt.
         */
        setAnswer("");
    }

    /*
    |--------------------------------------------------------------------------
    | Move to next round
    |--------------------------------------------------------------------------
    */

    function moveToNext(result) {
        const updatedResults = [
            ...levelResults,
            result,
        ];

        setLevelResults(updatedResults);

        if (round < ROUNDS_PER_LEVEL - 1) {
            startNextRound(round + 1);

            return;
        }

        finishLevel(updatedResults);
    }

    /*
    |--------------------------------------------------------------------------
    | Finish level
    |--------------------------------------------------------------------------
    */

    async function finishLevel(results) {
        clearInterval(timerRef.current);

        const completionTime =
            levelStartTime
                ? (Date.now() - levelStartTime) / 1000
                : 0;

        const correctAnswers =
            results.filter(
                (item) => item.correct
            ).length;

        const incorrectAnswers =
            results.length - correctAnswers;

        const totalAttempts =
            results.reduce(
                (total, item) =>
                    total + item.attempts,
                0
            );

        const totalMistakes =
            results.reduce(
                (total, item) =>
                    total + item.mistakes,
                0
            );

        const totalHints =
            results.reduce(
                (total, item) =>
                    total + item.hints,
                0
            );

        const totalResponseTime =
            results.reduce(
                (total, item) =>
                    total + item.response_time,
                0
            );

        const accuracy =
            results.length > 0
                ? (correctAnswers /
                    results.length) *
                100
                : 0;

        /*
         * Mistake rate = wrong attempts / total attempts.
         */
        const mistakeRate =
            totalAttempts > 0
                ? (totalMistakes /
                    totalAttempts) *
                100
                : 0;

        /*
         * Hint rate = questions requiring at least one hint /
         * total questions.
         */
        const questionsWithHints =
            results.filter(
                (item) => item.hints > 0
            ).length;

        const hintRate =
            results.length > 0
                ? (questionsWithHints /
                    results.length) *
                100
                : 0;

        const averageResponseTime =
            results.length > 0
                ? totalResponseTime /
                results.length
                : 0;

        const performance = {
            accuracy: Number(
                accuracy.toFixed(2)
            ),

            mistake_rate: Number(
                mistakeRate.toFixed(2)
            ),

            hint_rate: Number(
                hintRate.toFixed(2)
            ),

            completion_time: Number(
                completionTime.toFixed(2)
            ),

            average_response_time: Number(
                averageResponseTime.toFixed(2)
            ),

            difficulty_level: level,

            attempts: totalAttempts,

            correct_answers: correctAnswers,

            incorrect_answers: incorrectAnswers,

            game_name: GAME_NAME,
        };

        setResultData(performance);

        setScreen("levelComplete");

        /*
         * Save performance to backend.
         */
        const patientId =
            patient?.id ||
            patient?.patient_id ||
            patient?.patientId;

        if (!patientId) {
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/games/number-memory/performance`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body: JSON.stringify({
                        patient_id: patientId,
                        ...performance,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(
                    "Performance could not be saved."
                );
            }
        } catch (error) {
            console.warn(
                "Performance save failed:",
                error
            );

            setErrorMessage(
                "Your result is shown above, but it could not be saved to the server."
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Continue after mandatory Level 3
    |--------------------------------------------------------------------------
    */

    function handleNextRound() {
        startLevel(level + 1);
    }

    /*
    |--------------------------------------------------------------------------
    | Dashboard
    |--------------------------------------------------------------------------
    */

    function handleBackToDashboard() {
        clearInterval(timerRef.current);

        if (onHome) {
            onHome();
            return;
        }

        window.history.back();
    }

    /*
    |--------------------------------------------------------------------------
    | Restart
    |--------------------------------------------------------------------------
    */

    function handleRestart() {
        startLevel(1);
    }

    /*
    |--------------------------------------------------------------------------
    | INTRO
    |--------------------------------------------------------------------------
    */

    if (screen === "intro") {
        return (
            <div className="number-memory-container">
                <div className="nm-pattern nm-pattern-top" />

                <main className="nm-main">
                    <section className="nm-card nm-intro-card">
                        <div className="nm-cultural-symbol">
                            🧠
                        </div>

                        <div className="nm-heritage-label">
                            NORTH EAST INDIA • COGNITIVE GAME
                        </div>

                        <h1>Number Memory</h1>

                        <p className="nm-intro-subtitle">
                            A gentle cognitive exercise combining
                            number memory and simple arithmetic.
                        </p>

                        <div className="nm-instruction-card">
                            <div className="nm-instruction-icon">
                                🔢
                            </div>

                            <div>
                                <h3>
                                    How to play
                                </h3>

                                <p>
                                    Remember numbers or solve
                                    simple arithmetic questions.
                                    Take your time and answer
                                    carefully.
                                </p>
                            </div>
                        </div>

                        <div className="nm-game-types">
                            <div className="nm-type-item">
                                <span>🧠</span>
                                <strong>
                                    Number Recall
                                </strong>
                            </div>

                            <div className="nm-type-item">
                                <span>➕</span>
                                <strong>
                                    Addition
                                </strong>
                            </div>

                            <div className="nm-type-item">
                                <span>➖</span>
                                <strong>
                                    Subtraction
                                </strong>
                            </div>

                            <div className="nm-type-item">
                                <span>✖️</span>
                                <strong>
                                    Multiplication
                                </strong>
                            </div>

                            <div className="nm-type-item">
                                <span>➗</span>
                                <strong>
                                    Division
                                </strong>
                            </div>
                        </div>

                        <div className="nm-first-level-note">
                            <span>🌿</span>

                            <p>
                                You will automatically progress
                                through the first{" "}
                                <strong>
                                    3 levels
                                </strong>
                                . Your difficulty is adjusted
                                according to your previous
                                performance.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="nm-primary-button nm-large-button"
                            onClick={handleStartGame}
                            disabled={loadingPerformance}
                        >
                            {loadingPerformance
                                ? "LOADING..."
                                : "START GAME"}
                        </button>

                        <button
                            type="button"
                            className="nm-dashboard-button"
                            onClick={
                                handleBackToDashboard
                            }
                        >
                            ← Back to Dashboard
                        </button>
                    </section>
                </main>

                <div className="nm-pattern nm-pattern-bottom" />
            </div>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | MEMORIZING SCREEN
    |--------------------------------------------------------------------------
    */

    if (screen === "memorizing") {
        return (
            <div className="number-memory-container">
                <div className="nm-pattern nm-pattern-top" />

                <main className="nm-main">
                    <section className="nm-card nm-game-card">
                        <div className="nm-game-header">
                            <div>
                                <span className="nm-small-label">
                                    NUMBER MEMORY
                                </span>

                                <h1>
                                    Level {level}
                                </h1>
                            </div>

                            <div className="nm-round-badge">
                                Round {round + 1} of{" "}
                                {ROUNDS_PER_LEVEL}
                            </div>
                        </div>

                        <div className="nm-progress-area">
                            <div className="nm-progress-labels">
                                <span>
                                    Level {level}
                                </span>

                                <span>
                                    {round + 1} /{" "}
                                    {ROUNDS_PER_LEVEL}
                                </span>
                            </div>

                            <div className="nm-progress-track">
                                <div
                                    className="nm-progress-fill"
                                    style={{
                                        width: `${((round + 1) /
                                                ROUNDS_PER_LEVEL) *
                                            100
                                            }%`,
                                    }}
                                />
                            </div>
                        </div>

                        <div className="nm-memory-instruction">
                            <span className="nm-memory-icon">
                                👀
                            </span>

                            <div>
                                <h2>
                                    Remember these numbers
                                </h2>

                                <p>
                                    Look carefully and
                                    remember them in the
                                    same order.
                                </p>
                            </div>
                        </div>

                        <div className="nm-countdown">
                            <span className="nm-countdown-number">
                                {remainingTime}
                            </span>

                            <span className="nm-countdown-text">
                                seconds
                            </span>
                        </div>

                        <div className="nm-number-sequence">
                            {currentQuestion?.sequence?.map(
                                (number, index) => (
                                    <React.Fragment
                                        key={`${number}-${index}`}
                                    >
                                        <div className="nm-number-box">
                                            {number}
                                        </div>

                                        {index <
                                            currentQuestion.sequence
                                                .length -
                                            1 && (
                                                <span className="nm-arrow">
                                                    →
                                                </span>
                                            )}
                                    </React.Fragment>
                                )
                            )}
                        </div>

                        <div className="nm-memory-tip">
                            <span>💡</span>

                            <span>
                                Try saying the numbers quietly
                                to yourself.
                            </span>
                        </div>

                        <div className="nm-level-time-info">
                            Level {level} gives you{" "}
                            <strong>
                                {config.recallTime} seconds
                            </strong>{" "}
                            to look at the sequence.
                        </div>
                    </section>
                </main>

                <div className="nm-pattern nm-pattern-bottom" />
            </div>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | QUESTION SCREEN
    |--------------------------------------------------------------------------
    */

    if (screen === "question") {
        const isRecall =
            currentQuestion?.type === "recall";

        return (
            <div className="number-memory-container">
                <div className="nm-pattern nm-pattern-top" />

                <main className="nm-main">
                    <section className="nm-card nm-game-card">
                        <div className="nm-game-header">
                            <div>
                                <span className="nm-small-label">
                                    {currentQuestion?.icon}{" "}
                                    {currentQuestion?.title}
                                </span>

                                <h1>
                                    Level {level}
                                </h1>
                            </div>

                            <div className="nm-round-badge">
                                Round {round + 1} of{" "}
                                {ROUNDS_PER_LEVEL}
                            </div>
                        </div>

                        <div className="nm-progress-area">
                            <div className="nm-progress-labels">
                                <span>
                                    Level {level}
                                </span>

                                <span>
                                    {round + 1} /{" "}
                                    {ROUNDS_PER_LEVEL}
                                </span>
                            </div>

                            <div className="nm-progress-track">
                                <div
                                    className="nm-progress-fill"
                                    style={{
                                        width: `${((round + 1) /
                                                ROUNDS_PER_LEVEL) *
                                            100
                                            }%`,
                                    }}
                                />
                            </div>
                        </div>

                        {isRecall ? (
                            <div className="nm-recall-heading">
                                <div className="nm-recall-icon">
                                    🧠
                                </div>

                                <h2>
                                    What numbers do you
                                    remember?
                                </h2>

                                <p>
                                    Enter the numbers in the
                                    same order.
                                </p>
                            </div>
                        ) : (
                            <div className="nm-arithmetic-area">
                                <div className="nm-arithmetic-icon">
                                    {currentQuestion?.icon}
                                </div>

                                <div className="nm-activity-label">
                                    {
                                        currentQuestion?.title
                                    }
                                </div>

                                <h2>
                                    {
                                        currentQuestion?.question
                                    }
                                </h2>

                                <p>
                                    Take your time and solve
                                    the question.
                                </p>
                            </div>
                        )}

                        <form
                            className="nm-answer-form"
                            onSubmit={
                                handleSubmit
                            }
                        >
                            <label htmlFor="number-memory-answer">
                                Your answer
                            </label>

                            <input
                                id="number-memory-answer"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                autoComplete="off"
                                value={answer}
                                onChange={(event) => {
                                    const value =
                                        event.target.value.replace(
                                            /\D/g,
                                            ""
                                        );

                                    setAnswer(value);
                                    setErrorMessage("");
                                }}
                                placeholder="Enter your answer"
                                autoFocus
                            />

                            <button
                                type="submit"
                                className="nm-primary-button nm-submit-button"
                                disabled={!answer}
                            >
                                CHECK ANSWER
                            </button>
                        </form>

                        <div className="nm-attempt-area">
                            <span>
                                Attempts:
                            </span>

                            <div className="nm-attempt-dots">
                                {[1, 2, 3].map(
                                    (number) => (
                                        <div
                                            key={number}
                                            className={`nm-attempt-dot ${number <=
                                                    attempts
                                                    ? "used"
                                                    : ""
                                                }`}
                                        >
                                            {number}
                                        </div>
                                    )
                                )}
                            </div>

                            <small>
                                Maximum 3 attempts
                            </small>
                        </div>

                        {hint && (
                            <div className="nm-hint-box">
                                <span>💡</span>

                                <div>
                                    <strong>
                                        Hint
                                    </strong>

                                    <p>
                                        {hint}
                                    </p>
                                </div>
                            </div>
                        )}

                        {showCorrectAnswer && (
                            <div className="nm-correct-answer-box">
                                <span>✓</span>

                                <div>
                                    <strong>
                                        Correct answer
                                    </strong>

                                    <p>
                                        {
                                            currentQuestion?.answer
                                        }
                                    </p>
                                </div>
                            </div>
                        )}

                        {errorMessage && (
                            <div className="nm-error-box">
                                {errorMessage}
                            </div>
                        )}

                        <div className="nm-elderly-tip">
                            <span>🌿</span>

                            <span>
                                There is no need to hurry.
                                Concentrate and answer when
                                you are ready.
                            </span>
                        </div>
                    </section>
                </main>

                <div className="nm-pattern nm-pattern-bottom" />
            </div>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | LEVEL COMPLETE SCREEN
    |--------------------------------------------------------------------------
    */

    if (screen === "levelComplete") {
        const accuracy =
            resultData?.accuracy ?? 0;

        const mandatoryLevelsComplete =
            level >= MANDATORY_LEVELS;

        return (
            <div className="number-memory-container">
                <div className="nm-pattern nm-pattern-top" />

                <main className="nm-main">
                    <section className="nm-card nm-result-card">
                        <div className="nm-result-icon">
                            {accuracy >= 70
                                ? "🎉"
                                : "🌿"}
                        </div>

                        <div className="nm-heritage-label">
                            LEVEL COMPLETED
                        </div>

                        <h1>
                            {mandatoryLevelsComplete
                                ? "First 3 Levels Complete!"
                                : `Level ${level} Complete!`}
                        </h1>

                        <p className="nm-result-message">
                            {accuracy >= 90
                                ? "Excellent work! Your memory performance was wonderful."
                                : accuracy >= 70
                                    ? "Great job! Keep exercising your memory."
                                    : accuracy >= 50
                                        ? "Good effort! Keep practicing."
                                        : "Well done for completing the level. Keep trying!"}
                        </p>

                        <div className="nm-score-circle">
                            <span>
                                {Math.round(accuracy)}%
                            </span>

                            <small>
                                Accuracy
                            </small>
                        </div>

                        <div className="nm-result-grid">
                            <div className="nm-result-stat">
                                <span>✓</span>

                                <strong>
                                    {
                                        resultData?.correct_answers ??
                                        0
                                    }
                                </strong>

                                <small>
                                    Correct
                                </small>
                            </div>

                            <div className="nm-result-stat">
                                <span>🔢</span>

                                <strong>
                                    {ROUNDS_PER_LEVEL}
                                </strong>

                                <small>
                                    Rounds
                                </small>
                            </div>

                            <div className="nm-result-stat">
                                <span>⏱️</span>

                                <strong>
                                    {Math.round(
                                        resultData?.completion_time ??
                                        0
                                    )}
                                    s
                                </strong>

                                <small>
                                    Time
                                </small>
                            </div>
                        </div>

                        <div className="nm-level-summary">
                            <div>
                                <span>
                                    Current Level
                                </span>

                                <strong>
                                    Level {level}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Game Types
                                </span>

                                <strong>
                                    5 Types
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Difficulty
                                </span>

                                <strong>
                                    Automatic
                                </strong>
                            </div>
                        </div>

                        {!mandatoryLevelsComplete ? (
                            <div className="nm-next-level-message">
                                <span>🌱</span>

                                <p>
                                    Great work! Your next
                                    level will begin
                                    automatically when you
                                    choose Next Level.
                                </p>
                            </div>
                        ) : (
                            <div className="nm-milestone-message">
                                <span>🏆</span>

                                <div>
                                    <strong>
                                        First 3 levels completed!
                                    </strong>

                                    <p>
                                        You can now continue
                                        with another round or
                                        return to your
                                        dashboard.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="nm-result-actions">
                            {!mandatoryLevelsComplete ? (
                                <button
                                    type="button"
                                    className="nm-primary-button nm-large-button"
                                    onClick={
                                        handleNextRound
                                    }
                                >
                                    NEXT LEVEL →
                                </button>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        className="nm-primary-button nm-large-button"
                                        onClick={
                                            handleNextRound
                                        }
                                    >
                                        NEXT ROUND →
                                    </button>

                                    <button
                                        type="button"
                                        className="nm-secondary-button nm-large-button"
                                        onClick={
                                            handleBackToDashboard
                                        }
                                    >
                                        🏠 BACK TO DASHBOARD
                                    </button>
                                </>
                            )}
                        </div>

                        {errorMessage && (
                            <div className="nm-save-error">
                                {errorMessage}
                            </div>
                        )}

                        <button
                            type="button"
                            className="nm-small-restart-button"
                            onClick={
                                handleRestart
                            }
                        >
                            Restart from Level 1
                        </button>
                    </section>
                </main>

                <div className="nm-pattern nm-pattern-bottom" />
            </div>
        );
    }

    return null;
}