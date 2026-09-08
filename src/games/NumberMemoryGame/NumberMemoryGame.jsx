import React, { useEffect, useRef, useState } from "react";
import "./NumberMemoryGame.css";

const API_BASE_URL = "http://localhost:5000/api";
const GAME_NAME = "Number Memory";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const randomInt = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

const shuffle = (array) => {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
};

/* -------------------------------------------------------
   LEVEL CONFIGURATION
------------------------------------------------------- */

const getLevelConfig = (level) => {
    const safeLevel = clamp(level, 1, 5);

    const configs = {
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
            multiplicationMax: 9,
            divisionMax: 30,
        },

        4: {
            recallLength: 6,
            recallTime: 7,
            additionMax: 50,
            subtractionMax: 50,
            multiplicationMax: 10,
            divisionMax: 50,
        },

        5: {
            recallLength: 7,
            recallTime: 8,
            additionMax: 75,
            subtractionMax: 75,
            multiplicationMax: 12,
            divisionMax: 75,
        },
    };

    return configs[safeLevel];
};

/* -------------------------------------------------------
   NUMBER RECALL
------------------------------------------------------- */

const createNumberSequence = (length) => {
    return Array.from({ length }, () => randomInt(0, 9));
};

/* -------------------------------------------------------
   ARITHMETIC QUESTIONS
------------------------------------------------------- */

const createArithmeticQuestion = (type, difficulty) => {
    const config = getLevelConfig(difficulty);

    if (type === "addition") {
        const a = randomInt(1, config.additionMax);
        const b = randomInt(1, config.additionMax);

        return {
            type,
            a,
            b,
            answer: a + b,
        };
    }

    if (type === "subtraction") {
        let a = randomInt(1, config.subtractionMax);
        let b = randomInt(1, config.subtractionMax);

        if (b > a) {
            [a, b] = [b, a];
        }

        return {
            type,
            a,
            b,
            answer: a - b,
        };
    }

    if (type === "multiplication") {
        const a = randomInt(2, config.multiplicationMax);
        const b = randomInt(2, 5);

        return {
            type,
            a,
            b,
            answer: a * b,
        };
    }

    if (type === "division") {
        const divisor = randomInt(
            2,
            Math.min(10, config.divisionMax)
        );

        const maxQuotient = Math.max(
            1,
            Math.floor(config.divisionMax / divisor)
        );

        const quotient = randomInt(1, maxQuotient);

        return {
            type,
            a: divisor * quotient,
            b: divisor,
            answer: quotient,
        };
    }

    return null;
};

/* -------------------------------------------------------
   QUESTION CREATION
------------------------------------------------------- */

const createQuestion = (type, level, adaptiveDifficulty) => {
    if (type === "numberRecall") {
        const config = getLevelConfig(level);

        const sequence = createNumberSequence(
            config.recallLength
        );

        return {
            type,
            sequence,
            answer: sequence.join(""),
            recallTime: config.recallTime,
        };
    }

    const effectiveDifficulty = clamp(
        Math.round((level + adaptiveDifficulty) / 2),
        1,
        5
    );

    return createArithmeticQuestion(
        type,
        effectiveDifficulty
    );
};

/* -------------------------------------------------------
   QUESTION TYPES
------------------------------------------------------- */

const createMixedQuestionTypes = (count) => {
    const baseTypes = [
        "numberRecall",
        "addition",
        "subtraction",
        "multiplication",
        "division",
    ];

    const types = [...baseTypes];

    while (types.length < count) {
        types.push(
            baseTypes[randomInt(0, baseTypes.length - 1)]
        );
    }

    return shuffle(types).slice(0, count);
};

/* -------------------------------------------------------
   QUESTION COUNT
------------------------------------------------------- */

const determineQuestionCount = (level) => {
    return clamp(
        4 + Math.min(level, 5),
        5,
        10
    );
};

/* -------------------------------------------------------
   ADAPTIVE DIFFICULTY
------------------------------------------------------- */

const calculateDifficulty = (
    previousPerformance,
    currentDifficulty = 1
) => {
    if (!previousPerformance) {
        return 1;
    }

    const accuracy = Number(
        previousPerformance.accuracy || 0
    );

    const mistakeRate = Number(
        previousPerformance.mistake_rate || 0
    );

    const hintRate = Number(
        previousPerformance.hint_rate || 0
    );

    const responseTime = Number(
        previousPerformance.average_response_time || 0
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

    if (responseTime > 0) {
        if (responseTime <= 8) {
            score += 1;
        } else if (responseTime >= 18) {
            score -= 1;
        }
    }

    if (score >= 3) {
        return clamp(
            currentDifficulty + 1,
            1,
            5
        );
    }

    if (score <= -2) {
        return clamp(
            currentDifficulty - 1,
            1,
            5
        );
    }

    return clamp(
        currentDifficulty,
        1,
        5
    );
};

/* -------------------------------------------------------
   NORMALIZE ANSWERS
------------------------------------------------------- */

const normalizeAnswer = (value, type) => {
    if (type === "numberRecall") {
        return String(value || "").replace(/\D/g, "");
    }

    return String(value || "")
        .trim()
        .replace(/\s+/g, "");
};

/* -------------------------------------------------------
   THREE DIFFERENT HINTS
------------------------------------------------------- */

const getHints = (question) => {
    if (!question) {
        return [];
    }

    switch (question.type) {
        case "addition":
            return [
                `Try counting ${question.b} more from ${question.a}.`,
                `Start with ${question.a} and add ${question.b} step by step.`,
                `Think about combining ${question.a} objects with ${question.b} more objects.`,
            ];

        case "subtraction":
            return [
                `Start with ${question.a} and count backwards ${question.b}.`,
                `Take away ${question.b} from ${question.a} slowly.`,
                `Think: ${question.a} minus ${question.b} means removing ${question.b}.`,
            ];

        case "multiplication":
            return [
                `Think of ${question.b} groups of ${question.a}.`,
                `You can add ${question.a} together ${question.b} times.`,
                `Count ${question.a}, ${question.a}, ${question.a}... ${question.b} times.`,
            ];

        case "division":
            return [
                `How many groups of ${question.b} make ${question.a}?`,
                `Think about repeatedly subtracting ${question.b} from ${question.a}.`,
                `Ask yourself: ${question.b} multiplied by what gives ${question.a}?`,
            ];

        case "numberRecall":
            return [
                "Try remembering the first number again.",
                "Think about the order in which you saw the numbers.",
                "Picture the number sequence in your mind from left to right.",
            ];

        default:
            return [
                "Take your time and think carefully.",
                "Try remembering what you saw earlier.",
                "Look at the question carefully and try again.",
            ];
    }
};

/* -------------------------------------------------------
   LABELS
------------------------------------------------------- */

const getActivityLabel = (type) => {
    switch (type) {
        case "numberRecall":
            return "Number Recall";
        case "addition":
            return "Addition";
        case "subtraction":
            return "Subtraction";
        case "multiplication":
            return "Multiplication";
        case "division":
            return "Division";
        default:
            return "Memory Question";
    }
};

const getActivityIcon = (type) => {
    switch (type) {
        case "numberRecall":
            return "🧠";
        case "addition":
            return "➕";
        case "subtraction":
            return "➖";
        case "multiplication":
            return "✖️";
        case "division":
            return "➗";
        default:
            return "🧠";
    }
};

/* -------------------------------------------------------
   MAIN COMPONENT
------------------------------------------------------- */

const NumberMemoryGame = ({
    patientId,
    onBackToDashboard,
}) => {
    const [screen, setScreen] = useState("intro");

    const [level, setLevel] = useState(1);

    const [adaptiveDifficulty, setAdaptiveDifficulty] =
        useState(1);

    const [questions, setQuestions] = useState([]);

    const [questionIndex, setQuestionIndex] =
        useState(0);

    const [answer, setAnswer] = useState("");

    const [attempts, setAttempts] = useState(0);

    const [hint, setHint] = useState("");

    const [showCorrectAnswer, setShowCorrectAnswer] =
        useState(false);

    const [recallRemaining, setRecallRemaining] =
        useState(0);

    const [
        previousPerformance,
        setPreviousPerformance,
    ] = useState(null);

    const [
        loadingPreviousPerformance,
        setLoadingPreviousPerformance,
    ] = useState(false);

    const [sessionStartedAt, setSessionStartedAt] =
        useState(null);

    const [questionStartedAt, setQuestionStartedAt] =
        useState(null);

    const [questionResults, setQuestionResults] =
        useState([]);

    const [sessionResult, setSessionResult] =
        useState(null);

    const [errorMessage, setErrorMessage] =
        useState("");

    const countdownRef = useRef(null);

    const nextQuestionTimeoutRef =
        useRef(null);

    const currentQuestion =
        questions[questionIndex];

    /* -------------------------------------------------------
       FETCH PREVIOUS PERFORMANCE
    ------------------------------------------------------- */

    const fetchPreviousPerformance =
        async () => {
            if (!patientId) {
                return null;
            }

            try {
                setLoadingPreviousPerformance(true);

                const response = await fetch(
                    `${API_BASE_URL}/games/numbers-and-recall/performance/${patientId}`
                );

                if (!response.ok) {
                    throw new Error(
                        "Unable to load previous performance"
                    );
                }

                const data = await response.json();

                const performance =
                    data.performance ||
                    data.data ||
                    data;

                setPreviousPerformance(
                    performance
                );

                return performance;
            } catch (error) {
                console.warn(
                    "Previous performance could not be loaded:",
                    error
                );

                return null;
            } finally {
                setLoadingPreviousPerformance(
                    false
                );
            }
        };

    /* -------------------------------------------------------
       START ROUND
    ------------------------------------------------------- */

    const beginRound = (
        roundLevel,
        difficultyValue = adaptiveDifficulty
    ) => {
        const questionCount =
            determineQuestionCount(
                roundLevel
            );

        const types =
            createMixedQuestionTypes(
                questionCount
            );

        const generatedQuestions =
            types.map((type) =>
                createQuestion(
                    type,
                    roundLevel,
                    difficultyValue
                )
            );

        setLevel(roundLevel);

        setQuestions(generatedQuestions);

        setQuestionIndex(0);

        setAnswer("");

        setAttempts(0);

        setHint("");

        setShowCorrectAnswer(false);

        setQuestionResults([]);

        setErrorMessage("");

        const firstQuestion =
            generatedQuestions[0];

        if (
            firstQuestion.type ===
            "numberRecall"
        ) {
            setRecallRemaining(
                firstQuestion.recallTime
            );

            setQuestionStartedAt(null);

            setScreen("recall");
        } else {
            setQuestionStartedAt(
                Date.now()
            );

            setScreen("question");
        }
    };

    /* -------------------------------------------------------
       START GAME
    ------------------------------------------------------- */

    const startGame = async () => {
        setErrorMessage("");

        const previous =
            await fetchPreviousPerformance();

        const calculatedDifficulty =
            calculateDifficulty(
                previous,
                1
            );

        setAdaptiveDifficulty(
            calculatedDifficulty
        );

        setSessionStartedAt(
            Date.now()
        );

        beginRound(
            1,
            calculatedDifficulty
        );
    };

    /* -------------------------------------------------------
       RECALL COUNTDOWN
    ------------------------------------------------------- */

    useEffect(() => {
        if (
            screen !== "recall" ||
            !currentQuestion
        ) {
            return;
        }

        if (countdownRef.current) {
            clearInterval(
                countdownRef.current
            );
        }

        setRecallRemaining(
            currentQuestion.recallTime
        );

        countdownRef.current =
            setInterval(() => {
                setRecallRemaining(
                    (previous) => {
                        if (previous <= 1) {
                            clearInterval(
                                countdownRef.current
                            );

                            setScreen(
                                "question"
                            );

                            setQuestionStartedAt(
                                Date.now()
                            );

                            return 0;
                        }

                        return previous - 1;
                    }
                );
            }, 1000);

        return () => {
            if (countdownRef.current) {
                clearInterval(
                    countdownRef.current
                );
            }
        };
    }, [
        screen,
        questionIndex,
    ]);

    /* -------------------------------------------------------
       KEYBOARD ENTER
    ------------------------------------------------------- */

    useEffect(() => {
        const handleKeyDown = (
            event
        ) => {
            if (
                event.key === "Enter" &&
                screen === "question"
            ) {
                event.preventDefault();

                submitAnswer();
            }
        };

        window.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () => {
            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
        };
    });

    /* -------------------------------------------------------
       NEXT QUESTION
    ------------------------------------------------------- */

    const moveToNextQuestion = (
        result
    ) => {
        const updatedResults = [
            ...questionResults,
            result,
        ];

        setQuestionResults(
            updatedResults
        );

        if (
            questionIndex >=
            questions.length - 1
        ) {
            finishRound(
                updatedResults
            );

            return;
        }

        const nextIndex =
            questionIndex + 1;

        const nextQuestion =
            questions[nextIndex];

        setQuestionIndex(
            nextIndex
        );

        setAnswer("");

        setAttempts(0);

        setHint("");

        setShowCorrectAnswer(
            false
        );

        if (
            nextQuestion.type ===
            "numberRecall"
        ) {
            setRecallRemaining(
                nextQuestion.recallTime
            );

            setQuestionStartedAt(
                null
            );

            setScreen("recall");
        } else {
            setQuestionStartedAt(
                Date.now()
            );

            setScreen("question");
        }
    };

    /* -------------------------------------------------------
       SUBMIT ANSWER
    ------------------------------------------------------- */

    const submitAnswer = () => {
        if (
            !currentQuestion ||
            attempts >= 3 ||
            screen !== "question"
        ) {
            return;
        }

        if (!answer.trim()) {
            setErrorMessage(
                "Please enter your answer before submitting."
            );

            return;
        }

        setErrorMessage("");

        const currentAttempt =
            attempts + 1;

        const responseTime =
            questionStartedAt
                ? (Date.now() -
                    questionStartedAt) /
                1000
                : 0;

        const userAnswer =
            normalizeAnswer(
                answer,
                currentQuestion.type
            );

        const correctAnswer =
            normalizeAnswer(
                currentQuestion.answer,
                currentQuestion.type
            );

        const isCorrect =
            userAnswer ===
            correctAnswer;

        /* ---------------------------------------------------
           CORRECT ANSWER
        --------------------------------------------------- */

        if (isCorrect) {
            const result = {
                type: currentQuestion.type,
                correct: true,
                attempts: currentAttempt,
                mistakes:
                    currentAttempt - 1,
                hints:
                    currentAttempt - 1,
                response_time:
                    responseTime,
            };

            moveToNextQuestion(
                result
            );

            return;
        }

        /* ---------------------------------------------------
           WRONG ANSWER
           
           IMPORTANT:
           The patient's previous wrong answer is
           automatically deleted here.
        --------------------------------------------------- */

        setAnswer("");

        /* ---------------------------------------------------
           THREE DIFFERENT HINTS
        --------------------------------------------------- */

        const hints =
            getHints(currentQuestion);

        const currentHint =
            hints[currentAttempt - 1] ||
            hints[hints.length - 1];

        setHint(currentHint);

        setAttempts(
            currentAttempt
        );

        /* ---------------------------------------------------
           THIRD WRONG ATTEMPT
        --------------------------------------------------- */

        if (currentAttempt >= 3) {
            setShowCorrectAnswer(
                true
            );

            if (
                nextQuestionTimeoutRef.current
            ) {
                clearTimeout(
                    nextQuestionTimeoutRef.current
                );
            }

            nextQuestionTimeoutRef.current =
                setTimeout(() => {
                    const result = {
                        type: currentQuestion.type,
                        correct: false,
                        attempts: 3,
                        mistakes: 3,
                        hints: 3,
                        response_time:
                            responseTime,
                    };

                    moveToNextQuestion(
                        result
                    );
                }, 1800);
        }
    };

    /* -------------------------------------------------------
       FINISH ROUND
    ------------------------------------------------------- */

    const finishRound = async (
        results
    ) => {
        const completionTime =
            sessionStartedAt
                ? (Date.now() -
                    sessionStartedAt) /
                1000
                : 0;

        const totalQuestions =
            results.length;

        const correctAnswers =
            results.filter(
                (result) =>
                    result.correct
            ).length;

        const incorrectAnswers =
            totalQuestions -
            correctAnswers;

        const totalAttempts =
            results.reduce(
                (sum, result) =>
                    sum + result.attempts,
                0
            );

        const totalMistakes =
            results.reduce(
                (sum, result) =>
                    sum + result.mistakes,
                0
            );

        const totalHints =
            results.reduce(
                (sum, result) =>
                    sum + result.hints,
                0
            );

        const totalResponseTime =
            results.reduce(
                (sum, result) =>
                    sum +
                    Number(
                        result.response_time ||
                        0
                    ),
                0
            );

        const accuracy =
            totalQuestions > 0
                ? (correctAnswers /
                    totalQuestions) *
                100
                : 0;

        const mistakeRate =
            totalAttempts > 0
                ? (totalMistakes /
                    totalAttempts) *
                100
                : 0;

        const hintRate =
            totalAttempts > 0
                ? (totalHints /
                    totalAttempts) *
                100
                : 0;

        const averageResponseTime =
            totalQuestions > 0
                ? totalResponseTime /
                totalQuestions
                : 0;

        const effectiveDifficulty =
            clamp(
                Math.round(
                    (level +
                        adaptiveDifficulty) /
                    2
                ),
                1,
                5
            );

        const performance = {
            accuracy:
                Number(
                    accuracy.toFixed(2)
                ),

            mistake_rate:
                Number(
                    mistakeRate.toFixed(2)
                ),

            hint_rate:
                Number(
                    hintRate.toFixed(2)
                ),

            completion_time:
                Number(
                    completionTime.toFixed(2)
                ),

            average_response_time:
                Number(
                    averageResponseTime.toFixed(
                        2
                    )
                ),

            difficulty_level:
                effectiveDifficulty,

            attempts:
                totalAttempts,

            correct_answers:
                correctAnswers,

            incorrect_answers:
                incorrectAnswers,

            game_name:
                GAME_NAME,
        };

        const nextAdaptiveDifficulty =
            calculateDifficulty(
                performance,
                adaptiveDifficulty
            );

        setAdaptiveDifficulty(
            nextAdaptiveDifficulty
        );

        setSessionResult({
            ...performance,
            level,
            totalQuestions,
        });

        setScreen(
            "roundResult"
        );

        /* ---------------------------------------------------
           SAVE PERFORMANCE
        --------------------------------------------------- */

        if (patientId) {
            try {
                const response =
                    await fetch(
                        `${API_BASE_URL}/games/numbers-and-recall/performance`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body: JSON.stringify({
                                patient_id:
                                    patientId,

                                ...performance,
                            }),
                        }
                    );

                if (!response.ok) {
                    throw new Error(
                        "Performance could not be saved"
                    );
                }
            } catch (error) {
                console.warn(
                    "Performance save failed:",
                    error
                );

                setErrorMessage(
                    "Your result is shown, but it could not be saved right now."
                );
            }
        }
    };

    /* -------------------------------------------------------
       NEXT ROUND
    ------------------------------------------------------- */

    const handleNextRound = () => {
        const nextLevel =
            level + 1;

        setSessionStartedAt(
            Date.now()
        );

        beginRound(
            nextLevel,
            adaptiveDifficulty
        );
    };

    /* -------------------------------------------------------
       DASHBOARD
    ------------------------------------------------------- */

    const handleBack = () => {
        if (onBackToDashboard) {
            onBackToDashboard();

            return;
        }

        window.history.back();
    };

    /* -------------------------------------------------------
       CLEANUP
    ------------------------------------------------------- */

    useEffect(() => {
        return () => {
            if (countdownRef.current) {
                clearInterval(
                    countdownRef.current
                );
            }

            if (
                nextQuestionTimeoutRef.current
            ) {
                clearTimeout(
                    nextQuestionTimeoutRef.current
                );
            }
        };
    }, []);

    /* -------------------------------------------------------
       INTRO SCREEN
    ------------------------------------------------------- */

    if (screen === "intro") {
        return (
            <div className="number-memory-container">
                <div className="number-memory-card intro-card">

                    <div className="game-pattern">
                        ᱚ ᱚ ᱚ
                    </div>

                    <div className="game-icon-large">
                        🧠
                    </div>

                    <h1>
                        Number Memory
                    </h1>

                    <p className="game-description">
                        Strengthen your memory and
                        thinking skills through
                        numbers and simple
                        calculations.
                    </p>

                    <div className="instructions-box">
                        <h2>
                            How to Play
                        </h2>

                        <div className="instruction-item">
                            <span>🧠</span>

                            <p>
                                Remember number
                                sequences and recall
                                them after they
                                disappear.
                            </p>
                        </div>

                        <div className="instruction-item">
                            <span>➕</span>

                            <p>
                                Solve simple addition,
                                subtraction,
                                multiplication and
                                division questions.
                            </p>
                        </div>

                        <div className="instruction-item">
                            <span>💡</span>

                            <p>
                                If your answer is
                                wrong, you will
                                receive a different
                                helpful hint for
                                each attempt.
                            </p>
                        </div>

                        <div className="instruction-item">
                            <span>🔄</span>

                            <p>
                                You can try each
                                question up to
                                3 times.
                            </p>
                        </div>
                    </div>

                    <div className="level-info">
                        <strong>
                            First 3 Levels
                        </strong>

                        <span>
                            You will play Levels 1,
                            2 and 3. After Level 3,
                            you can continue to
                            another round or return
                            to the dashboard.
                        </span>
                    </div>

                    <p className="adaptive-text">
                        Difficulty is automatically
                        adjusted according to
                        previous performance.
                    </p>

                    <div className="intro-buttons">

                        <button
                            className="primary-button"
                            onClick={startGame}
                            disabled={
                                loadingPreviousPerformance
                            }
                        >
                            {loadingPreviousPerformance
                                ? "Loading..."
                                : "Start Game"}
                        </button>

                        <button
                            className="secondary-button"
                            onClick={handleBack}
                        >
                            Back to Dashboard
                        </button>

                    </div>
                </div>
            </div>
        );
    }

    /* -------------------------------------------------------
       RECALL SCREEN
    ------------------------------------------------------- */

    if (
        screen === "recall" &&
        currentQuestion
    ) {
        return (
            <div className="number-memory-container">

                <div className="number-memory-card game-card">

                    <div className="game-header">

                        <div>
                            <span className="level-badge">
                                Level {level}
                            </span>

                            <h1>
                                {getActivityIcon(
                                    currentQuestion.type
                                )}{" "}
                                Number Recall
                            </h1>
                        </div>

                        <div className="question-counter">
                            Question{" "}
                            {questionIndex + 1}{" "}
                            of{" "}
                            {questions.length}
                        </div>

                    </div>

                    <div className="recall-instruction">
                        <p>
                            Remember these
                            numbers carefully.
                        </p>
                    </div>

                    <div className="sequence-display">

                        {currentQuestion.sequence.map(
                            (number, index) => (
                                <React.Fragment
                                    key={index}
                                >

                                    <span className="memory-number">
                                        {number}
                                    </span>

                                    {index <
                                        currentQuestion
                                            .sequence.length -
                                        1 && (
                                            <span className="sequence-arrow">
                                                →
                                            </span>
                                        )}

                                </React.Fragment>
                            )
                        )}

                    </div>

                    <div className="countdown-circle">
                        {recallRemaining}
                    </div>

                    <p className="countdown-text">
                        Remember the sequence...
                    </p>

                    <div className="progress-bar-container">

                        <div
                            className="progress-bar"
                            style={{
                                width: `${(recallRemaining /
                                        currentQuestion.recallTime) *
                                    100
                                    }%`,
                            }}
                        />

                    </div>

                </div>
            </div>
        );
    }

    /* -------------------------------------------------------
       QUESTION SCREEN
    ------------------------------------------------------- */

    if (
        screen === "question" &&
        currentQuestion
    ) {
        return (
            <div className="number-memory-container">

                <div className="number-memory-card game-card">

                    <div className="game-header">

                        <div>
                            <span className="level-badge">
                                Level {level}
                            </span>

                            <h1>
                                {getActivityIcon(
                                    currentQuestion.type
                                )}{" "}
                                {getActivityLabel(
                                    currentQuestion.type
                                )}
                            </h1>
                        </div>

                        <div className="question-counter">
                            Question{" "}
                            {questionIndex + 1}{" "}
                            of{" "}
                            {questions.length}
                        </div>

                    </div>

                    <div className="question-area">

                        {currentQuestion.type ===
                            "numberRecall" && (
                                <>
                                    <p className="question-instruction">
                                        Enter the numbers
                                        in the same order.
                                    </p>

                                    <div className="question-symbol">
                                        ?
                                    </div>
                                </>
                            )}

                        {currentQuestion.type !==
                            "numberRecall" && (
                                <>
                                    <p className="question-instruction">
                                        Solve this
                                        calculation.
                                    </p>

                                    <div className="math-question">

                                        <span>
                                            {currentQuestion.a}
                                        </span>

                                        <span className="math-operator">

                                            {currentQuestion.type ===
                                                "addition" &&
                                                "+"}

                                            {currentQuestion.type ===
                                                "subtraction" &&
                                                "−"}

                                            {currentQuestion.type ===
                                                "multiplication" &&
                                                "×"}

                                            {currentQuestion.type ===
                                                "division" &&
                                                "÷"}

                                        </span>

                                        <span>
                                            {currentQuestion.b}
                                        </span>

                                        <span>
                                            =
                                        </span>

                                        <span>
                                            ?
                                        </span>

                                    </div>
                                </>
                            )}

                        <div className="answer-section">

                            <input
                                type="text"
                                value={answer}
                                onChange={(event) =>
                                    setAnswer(
                                        event.target.value
                                    )
                                }
                                placeholder={
                                    currentQuestion.type ===
                                        "numberRecall"
                                        ? "Enter the numbers"
                                        : "Enter your answer"
                                }
                                className="answer-input"
                                autoFocus
                                disabled={
                                    attempts >= 3 ||
                                    showCorrectAnswer
                                }
                            />

                            <button
                                className="submit-button"
                                onClick={
                                    submitAnswer
                                }
                                disabled={
                                    attempts >= 3 ||
                                    showCorrectAnswer
                                }
                            >
                                Submit Answer
                            </button>

                        </div>

                        <div className="attempts-display">
                            Attempt{" "}
                            {attempts + 1} of 3
                        </div>

                        {hint && (
                            <div className="hint-box">

                                <div className="hint-icon">
                                    💡
                                </div>

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
                            <div className="correct-answer-box">

                                <strong>
                                    The correct answer is:
                                </strong>

                                <span>
                                    {currentQuestion.type ===
                                        "numberRecall"
                                        ? currentQuestion.sequence.join(
                                            " → "
                                        )
                                        : currentQuestion.answer}
                                </span>

                                <p>
                                    Moving to the
                                    next question...
                                </p>

                            </div>
                        )}

                        {errorMessage && (
                            <div className="error-message">
                                {errorMessage}
                            </div>
                        )}

                    </div>
                </div>
            </div>
        );
    }

    /* -------------------------------------------------------
       RESULT SCREEN
    ------------------------------------------------------- */

    if (
        screen === "roundResult" &&
        sessionResult
    ) {
        const isMandatoryLevel =
            sessionResult.level < 3;

        return (
            <div className="number-memory-container">

                <div className="number-memory-card result-card">

                    <div className="result-icon">
                        🎉
                    </div>

                    <h1>
                        Level{" "}
                        {sessionResult.level}{" "}
                        Complete!
                    </h1>

                    <p className="result-message">
                        Great work! Your
                        performance has been
                        recorded and will help
                        adjust future questions.
                    </p>

                    <div className="result-stats">

                        <div className="stat-box">
                            <span className="stat-value">
                                {sessionResult.accuracy}%
                            </span>

                            <span className="stat-label">
                                Accuracy
                            </span>
                        </div>

                        <div className="stat-box">
                            <span className="stat-value">
                                {sessionResult.correct_answers}
                            </span>

                            <span className="stat-label">
                                Correct
                            </span>
                        </div>

                        <div className="stat-box">
                            <span className="stat-value">
                                {sessionResult.attempts}
                            </span>

                            <span className="stat-label">
                                Attempts
                            </span>
                        </div>

                        <div className="stat-box">
                            <span className="stat-value">
                                {
                                    sessionResult.average_response_time
                                }
                                s
                            </span>

                            <span className="stat-label">
                                Avg. Response
                            </span>
                        </div>

                        <div className="stat-box">
                            <span className="stat-value">
                                {sessionResult.hint_rate}%
                            </span>

                            <span className="stat-label">
                                Hint Rate
                            </span>
                        </div>

                        <div className="stat-box">
                            <span className="stat-value">
                                {sessionResult.totalQuestions}
                            </span>

                            <span className="stat-label">
                                Questions
                            </span>
                        </div>

                    </div>

                    <div className="adaptive-result-box">

                        <span>
                            🧠
                        </span>

                        <div>

                            <strong>
                                Difficulty automatically
                                adjusted
                            </strong>

                            <p>
                                Your next round will
                                be adapted according
                                to your performance.
                            </p>

                        </div>

                    </div>

                    {errorMessage && (
                        <div className="error-message">
                            {errorMessage}
                        </div>
                    )}

                    <div className="result-buttons">

                        {isMandatoryLevel ? (
                            <button
                                className="primary-button"
                                onClick={
                                    handleNextRound
                                }
                            >
                                Next Level
                            </button>
                        ) : (
                            <>
                                <button
                                    className="primary-button"
                                    onClick={
                                        handleNextRound
                                    }
                                >
                                    Next Round
                                </button>

                                <button
                                    className="secondary-button"
                                    onClick={handleBack}
                                >
                                    Back to Dashboard
                                </button>
                            </>
                        )}

                    </div>

                </div>
            </div>
        );
    }

    return null;
};

export default NumberMemoryGame;