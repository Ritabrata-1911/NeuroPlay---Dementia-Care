import React, { useEffect, useRef, useState } from "react";
import "./NumberMemoryGame.css";

const API_BASE_URL = "http://localhost:5000/api";

/*
 * IMPORTANT:
 * The game was renamed from "Number Memory" to "Number Recall".
 */
const GAME_NAME = "Number Recall";

const MIN_LEVEL = 1;
const MAX_LEVEL = 5;
const MAX_ATTEMPTS_PER_QUESTION = 3;

const clamp = (value, min, max) =>
    Math.min(Math.max(value, min), max);

const randomInt = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

const shuffle = (array) => {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [result[i], result[j]] = [
            result[j],
            result[i],
        ];
    }

    return result;
};

/* -------------------------------------------------------
   LEVEL CONFIGURATION
------------------------------------------------------- */

const LEVEL_CONFIG = {
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

const getLevelConfig = (level) => {
    const safeLevel = clamp(
        Number(level) || MIN_LEVEL,
        MIN_LEVEL,
        MAX_LEVEL
    );

    return LEVEL_CONFIG[safeLevel];
};

/* -------------------------------------------------------
   NUMBER SEQUENCE
------------------------------------------------------- */

const createNumberSequence = (length) => {
    return Array.from(
        { length },
        () => randomInt(0, 9)
    );
};

/* -------------------------------------------------------
   ARITHMETIC QUESTIONS
------------------------------------------------------- */

const createArithmeticQuestion = (
    type,
    level
) => {
    const config = getLevelConfig(level);

    /* ---------------- ADDITION ---------------- */

    if (type === "addition") {
        const a = randomInt(
            0,
            config.additionMax
        );

        const b = randomInt(
            0,
            config.additionMax
        );

        return {
            type,
            a,
            b,
            answer: a + b,
        };
    }

    /* ---------------- SUBTRACTION ---------------- */

    if (type === "subtraction") {
        /*
         * We deliberately allow:
         *
         * 10 - 10 = 0
         *
         * This is important because 0 is a valid answer.
         */

        let a = randomInt(
            0,
            config.subtractionMax
        );

        let b = randomInt(
            0,
            config.subtractionMax
        );

        /*
         * Make sure the answer is never negative.
         * Equal values are allowed.
         */
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

    /* ---------------- MULTIPLICATION ---------------- */

    if (type === "multiplication") {
        const a = randomInt(
            0,
            config.multiplicationMax
        );

        const b = randomInt(
            0,
            5
        );

        return {
            type,
            a,
            b,
            answer: a * b,
        };
    }

    /* ---------------- DIVISION ---------------- */

    if (type === "division") {
        /*
         * Generate division questions with whole-number
         * answers only.
         *
         * Example:
         * 24 ÷ 6 = 4
         */

        const divisor = randomInt(
            1,
            Math.min(
                10,
                config.divisionMax
            )
        );

        const maxQuotient = Math.max(
            1,
            Math.floor(
                config.divisionMax /
                    divisor
            )
        );

        const quotient = randomInt(
            1,
            maxQuotient
        );

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

const createQuestion = (
    type,
    level,
    adaptiveDifficulty
) => {
    if (type === "numberRecall") {
        const config =
            getLevelConfig(level);

        const sequence =
            createNumberSequence(
                config.recallLength
            );

        return {
            type,
            sequence,
            answer: sequence.join(""),
            recallTime:
                config.recallTime,
        };
    }

    const effectiveDifficulty = clamp(
        Math.round(
            (Number(level) +
                Number(adaptiveDifficulty || 1)) /
                2
        ),
        MIN_LEVEL,
        MAX_LEVEL
    );

    return createArithmeticQuestion(
        type,
        effectiveDifficulty
    );
};

/* -------------------------------------------------------
   QUESTION TYPES
------------------------------------------------------- */

const createMixedQuestionTypes = (
    count
) => {
    const baseTypes = [
        "numberRecall",
        "addition",
        "subtraction",
        "multiplication",
        "division",
    ];

    /*
     * Make sure every type appears at least once.
     */
    const types = shuffle([
        ...baseTypes,
    ]);

    while (types.length < count) {
        types.push(
            baseTypes[
                randomInt(
                    0,
                    baseTypes.length - 1
                )
            ]
        );
    }

    return shuffle(types).slice(
        0,
        count
    );
};

/* -------------------------------------------------------
   QUESTION COUNT
------------------------------------------------------- */

const determineQuestionCount = (
    level
) => {
    /*
     * Level 1 = 5 questions
     * Level 2 = 6 questions
     * Level 3 = 7 questions
     * Level 4 = 8 questions
     * Level 5 = 9 questions
     */

    return clamp(
        4 + Number(level),
        5,
        9
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
        return clamp(
            currentDifficulty,
            MIN_LEVEL,
            MAX_LEVEL
        );
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
        previousPerformance.average_response_time ||
            0
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
            Number(currentDifficulty) + 1,
            MIN_LEVEL,
            MAX_LEVEL
        );
    }

    if (score <= -2) {
        return clamp(
            Number(currentDifficulty) - 1,
            MIN_LEVEL,
            MAX_LEVEL
        );
    }

    return clamp(
        Number(currentDifficulty),
        MIN_LEVEL,
        MAX_LEVEL
    );
};

/* -------------------------------------------------------
   ANSWER NORMALIZATION
------------------------------------------------------- */

const normalizeAnswer = (
    value,
    type
) => {
    /*
     * IMPORTANT BUG FIX:
     *
     * OLD:
     * String(value || "")
     *
     * Problem:
     * String(0 || "") === ""
     *
     * So 0 was treated as an empty answer.
     *
     * NEW:
     * Explicitly check null/undefined.
     */

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    if (type === "numberRecall") {
        return String(value)
            .replace(/\D/g, "");
    }

    return String(value)
        .trim()
        .replace(/\s+/g, "");
};

/* -------------------------------------------------------
   HINTS
------------------------------------------------------- */

const getHints = (
    question
) => {
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

const getActivityLabel = (
    type
) => {
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
            return "Number Recall";
    }
};

const getActivityIcon = (
    type
) => {
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
    patient,
    patientId,
    onHome,
    onBackToDashboard,
}) => {
    /*
     * Support both prop names so the game works with
     * different versions of PatientDashboard.
     */

    const resolvedPatientId =
        patientId ||
        patient?.id ||
        null;

    const dashboardCallback =
        onHome ||
        onBackToDashboard ||
        null;

    const [screen, setScreen] =
        useState("intro");

    const [level, setLevel] =
        useState(1);

    const [
        adaptiveDifficulty,
        setAdaptiveDifficulty,
    ] = useState(1);

    const [questions, setQuestions] =
        useState([]);

    const [
        questionIndex,
        setQuestionIndex,
    ] = useState(0);

    const [answer, setAnswer] =
        useState("");

    const [attempts, setAttempts] =
        useState(0);

    const [hint, setHint] =
        useState("");

    const [
        showCorrectAnswer,
        setShowCorrectAnswer,
    ] = useState(false);

    const [
        recallRemaining,
        setRecallRemaining,
    ] = useState(0);

    const [
        previousPerformance,
        setPreviousPerformance,
    ] = useState(null);

    const [
        loadingPreviousPerformance,
        setLoadingPreviousPerformance,
    ] = useState(false);

    const [
        sessionStartedAt,
        setSessionStartedAt,
    ] = useState(null);

    const [
        questionStartedAt,
        setQuestionStartedAt,
    ] = useState(null);

    const [
        questionResults,
        setQuestionResults,
    ] = useState([]);

    const [
        sessionResult,
        setSessionResult,
    ] = useState(null);

    const [
        errorMessage,
        setErrorMessage,
    ] = useState("");

    const countdownRef =
        useRef(null);

    const nextQuestionTimeoutRef =
        useRef(null);

    const currentQuestion =
        questions[questionIndex];

    /* -------------------------------------------------------
       FETCH PREVIOUS PERFORMANCE
    ------------------------------------------------------- */

    const fetchPreviousPerformance =
        async () => {
            if (!resolvedPatientId) {
                return null;
            }

            try {
                setLoadingPreviousPerformance(
                    true
                );

                const response =
                    await fetch(
                        `${API_BASE_URL}/games/numbers-and-recall/performance/${resolvedPatientId}`
                    );

                if (!response.ok) {
                    throw new Error(
                        "Unable to load previous performance"
                    );
                }

                const data =
                    await response.json();

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
       START LEVEL / ROUND
    ------------------------------------------------------- */

    const beginRound = (
        roundLevel,
        difficultyValue = adaptiveDifficulty
    ) => {
        const safeLevel =
            clamp(
                Number(roundLevel) || 1,
                MIN_LEVEL,
                MAX_LEVEL
            );

        const questionCount =
            determineQuestionCount(
                safeLevel
            );

        const types =
            createMixedQuestionTypes(
                questionCount
            );

        const generatedQuestions =
            types.map((type) =>
                createQuestion(
                    type,
                    safeLevel,
                    difficultyValue
                )
            );

        setLevel(safeLevel);

        setQuestions(
            generatedQuestions
        );

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
       START GAME
    ------------------------------------------------------- */

    const startGame =
        async () => {
            setErrorMessage("");

            const previous =
                await fetchPreviousPerformance();

            setPreviousPerformance(
                previous
            );

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

        if (
            countdownRef.current
        ) {
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
                        if (
                            previous <= 1
                        ) {
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
            if (
                countdownRef.current
            ) {
                clearInterval(
                    countdownRef.current
                );
            }
        };
    }, [
        screen,
        questionIndex,
        currentQuestion,
    ]);

    /* -------------------------------------------------------
       KEYBOARD ENTER
    ------------------------------------------------------- */

    useEffect(() => {
        const handleKeyDown =
            (event) => {
                if (
                    event.key ===
                        "Enter" &&
                    screen ===
                        "question"
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
       MOVE TO NEXT QUESTION
    ------------------------------------------------------- */

    const moveToNextQuestion =
        (result) => {
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

    const submitAnswer =
        () => {
            if (
                !currentQuestion ||
                attempts >=
                    MAX_ATTEMPTS_PER_QUESTION ||
                screen !==
                    "question"
            ) {
                return;
            }

            /*
             * Do NOT use !answer here because "0" is a
             * valid answer.
             */
            if (
                answer === null ||
                answer === undefined ||
                String(answer).trim() === ""
            ) {
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
                    type:
                        currentQuestion.type,

                    correct: true,

                    attempts:
                        currentAttempt,

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
            --------------------------------------------------- */

            /*
             * Automatically remove the previous wrong answer.
             * The patient gets a fresh empty input.
             */
            setAnswer("");

            const hints =
                getHints(
                    currentQuestion
                );

            const currentHint =
                hints[
                    Math.min(
                        currentAttempt - 1,
                        hints.length - 1
                    )
                ];

            setHint(
                currentHint
            );

            setAttempts(
                currentAttempt
            );

            /* ---------------------------------------------------
               THIRD WRONG ATTEMPT
            --------------------------------------------------- */

            if (
                currentAttempt >=
                MAX_ATTEMPTS_PER_QUESTION
            ) {
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
                        const result =
                            {
                                type:
                                    currentQuestion.type,

                                correct: false,

                                attempts:
                                    MAX_ATTEMPTS_PER_QUESTION,

                                mistakes:
                                    MAX_ATTEMPTS_PER_QUESTION,

                                hints:
                                    MAX_ATTEMPTS_PER_QUESTION,

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
       FINISH LEVEL
    ------------------------------------------------------- */

    const finishRound =
        async (results) => {
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
                        sum +
                        Number(
                            result.attempts ||
                                0
                        ),
                    0
                );

            const totalMistakes =
                results.reduce(
                    (sum, result) =>
                        sum +
                        Number(
                            result.mistakes ||
                                0
                        ),
                    0
                );

            const totalHints =
                results.reduce(
                    (sum, result) =>
                        sum +
                        Number(
                            result.hints ||
                                0
                        ),
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
                    MIN_LEVEL,
                    MAX_LEVEL
                );

            /*
             * FINAL REPORT
             *
             * These are the exact requested report fields.
             */
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

                completion_time:
                    Number(
                        completionTime.toFixed(
                            2
                        )
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

            /*
             * Calculate next adaptive difficulty.
             */
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
               CONSOLE REPORT
            --------------------------------------------------- */

            console.log(
                "Number Recall Report:",
                performance
            );

            /* ---------------------------------------------------
               SAVE PERFORMANCE TO BACKEND
            --------------------------------------------------- */

            if (resolvedPatientId) {
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

                                body: JSON.stringify(
                                    {
                                        patient_id:
                                            resolvedPatientId,

                                        ...performance,
                                    }
                                ),
                            }
                        );

                    if (!response.ok) {
                        throw new Error(
                            "Performance could not be saved"
                        );
                    }

                    console.log(
                        "Number Recall performance saved successfully."
                    );
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
       NEXT LEVEL / ROUND
    ------------------------------------------------------- */

    const handleNextRound =
        () => {
            /*
             * Never allow the level to become 6.
             *
             * Level 5 is the maximum level.
             */
            const nextLevel =
                clamp(
                    level + 1,
                    MIN_LEVEL,
                    MAX_LEVEL
                );

            setSessionStartedAt(
                Date.now()
            );

            beginRound(
                nextLevel,
                adaptiveDifficulty
            );
        };

    /* -------------------------------------------------------
       BACK TO PATIENT DASHBOARD
    ------------------------------------------------------- */

    const handleBack =
        () => {
            /*
             * PatientDashboard should provide onHome.
             *
             * This prevents the game from accidentally
             * returning to the login/home page.
             */
            if (
                typeof dashboardCallback ===
                "function"
            ) {
                dashboardCallback();
                return;
            }

            /*
             * Compatibility fallback.
             *
             * If neither callback is supplied, go back one
             * browser history step.
             */
            window.history.back();
        };

    /* -------------------------------------------------------
       CLEANUP
    ------------------------------------------------------- */

    useEffect(() => {
        return () => {
            if (
                countdownRef.current
            ) {
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

    /* =======================================================
       INTRO SCREEN
    ======================================================= */

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
                        Number Recall
                    </h1>

                    <p className="game-description">
                        Strengthen your memory and
                        thinking skills through
                        number sequences and
                        simple calculations.
                    </p>

                    <div className="instructions-box">
                        <h2>
                            How to Play
                        </h2>

                        <div className="instruction-item">
                            <span>
                                🧠
                            </span>

                            <p>
                                Remember number
                                sequences and
                                recall them after
                                they disappear.
                            </p>
                        </div>

                        <div className="instruction-item">
                            <span>
                                ➕
                            </span>

                            <p>
                                Solve simple
                                addition,
                                subtraction,
                                multiplication
                                and division
                                questions.
                            </p>
                        </div>

                        <div className="instruction-item">
                            <span>
                                💡
                            </span>

                            <p>
                                If your answer is
                                wrong, the wrong
                                answer is cleared
                                automatically and
                                you can try again
                                with a helpful
                                hint.
                            </p>
                        </div>

                        <div className="instruction-item">
                            <span>
                                🔄
                            </span>

                            <p>
                                You can try each
                                question up to
                                3 times.
                            </p>
                        </div>
                    </div>

                    <div className="level-info">
                        <strong>
                            5 Levels
                        </strong>

                        <span>
                            You will progress
                            through Levels 1 to 5.
                            Difficulty becomes
                            more challenging as
                            you progress.
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
                            onClick={
                                startGame
                            }
                            disabled={
                                loadingPreviousPerformance
                            }
                        >
                            {loadingPreviousPerformance
                                ? "Loading..."
                                : "▶ Start Game"}
                        </button>

                        <button
                            className="secondary-button"
                            onClick={
                                handleBack
                            }
                        >
                            🏠 Back to Patient Dashboard
                        </button>

                    </div>
                </div>
            </div>
        );
    }

    /* =======================================================
       RECALL SCREEN
    ======================================================= */

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
                                🧠 Number Recall
                            </h1>
                        </div>

                        <div className="question-counter">
                            Question{" "}
                            {questionIndex +
                                1}{" "}
                            of{" "}
                            {
                                questions.length
                            }
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
                            (
                                number,
                                index
                            ) => (
                                <React.Fragment
                                    key={
                                        index
                                    }
                                >

                                    <span className="memory-number">
                                        {
                                            number
                                        }
                                    </span>

                                    {index <
                                        currentQuestion
                                            .sequence
                                            .length -
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
                        {
                            recallRemaining
                        }
                    </div>

                    <p className="countdown-text">
                        Remember the
                        sequence...
                    </p>

                    <div className="progress-bar-container">

                        <div
                            className="progress-bar"
                            style={{
                                width: `${
                                    currentQuestion
                                        .recallTime >
                                    0
                                        ? (recallRemaining /
                                              currentQuestion.recallTime) *
                                          100
                                        : 0
                                }%`,
                            }}
                        />

                    </div>

                </div>
            </div>
        );
    }

    /* =======================================================
       QUESTION SCREEN
    ======================================================= */

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
                                {
                                    getActivityIcon(
                                        currentQuestion.type
                                    )
                                }{" "}
                                {
                                    getActivityLabel(
                                        currentQuestion.type
                                    )
                                }
                            </h1>
                        </div>

                        <div className="question-counter">
                            Question{" "}
                            {questionIndex +
                                1}{" "}
                            of{" "}
                            {
                                questions.length
                            }
                        </div>

                    </div>

                    <div className="question-area">

                        {currentQuestion.type ===
                            "numberRecall" && (
                            <>
                                <p className="question-instruction">
                                    Enter the
                                    numbers in
                                    the same
                                    order.
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
                                        {
                                            currentQuestion.a
                                        }
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
                                        {
                                            currentQuestion.b
                                        }
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
                                inputMode="numeric"
                                value={
                                    answer
                                }
                                onChange={(
                                    event
                                ) =>
                                    setAnswer(
                                        event
                                            .target
                                            .value
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
                                    attempts >=
                                        MAX_ATTEMPTS_PER_QUESTION ||
                                    showCorrectAnswer
                                }
                            />

                            <button
                                className="submit-button"
                                onClick={
                                    submitAnswer
                                }
                                disabled={
                                    attempts >=
                                        MAX_ATTEMPTS_PER_QUESTION ||
                                    showCorrectAnswer
                                }
                            >
                                Submit Answer
                            </button>

                        </div>

                        <div className="attempts-display">
                            Attempt{" "}
                            {Math.min(
                                attempts + 1,
                                MAX_ATTEMPTS_PER_QUESTION
                            )}{" "}
                            of{" "}
                            {
                                MAX_ATTEMPTS_PER_QUESTION
                            }
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
                                        {
                                            hint
                                        }
                                    </p>
                                </div>

                            </div>
                        )}

                        {showCorrectAnswer && (
                            <div className="correct-answer-box">

                                <strong>
                                    The correct
                                    answer is:
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
                                    Moving to
                                    the next
                                    question...
                                </p>

                            </div>
                        )}

                        {errorMessage && (
                            <div
                                className="error-message"
                                role="alert"
                            >
                                {
                                    errorMessage
                                }
                            </div>
                        )}

                    </div>
                </div>
            </div>
        );
    }

    /* =======================================================
       RESULT SCREEN
    ======================================================= */

    if (
        screen === "roundResult" &&
        sessionResult
    ) {
        /*
         * Levels 1-4:
         * only Next Level
         *
         * Level 5:
         * Next Round + Back to Dashboard
         */
        const isMandatoryLevel =
            sessionResult.level <
            MAX_LEVEL;

        return (
            <div className="number-memory-container">

                <div className="number-memory-card result-card">

                    <div className="result-icon">
                        🎉
                    </div>

                    <h1>
                        Level{" "}
                        {
                            sessionResult.level
                        }{" "}
                        Complete!
                    </h1>

                    <p className="result-message">
                        Great work! Your
                        performance has
                        been recorded and
                        will help adjust
                        future questions.
                    </p>

                    <div className="result-stats">

                        <div className="stat-box">
                            <span className="stat-value">
                                {
                                    sessionResult.accuracy
                                }
                                %
                            </span>

                            <span className="stat-label">
                                Accuracy
                            </span>
                        </div>

                        <div className="stat-box">
                            <span className="stat-value">
                                {
                                    sessionResult.mistake_rate
                                }
                                %
                            </span>

                            <span className="stat-label">
                                Mistake Rate
                            </span>
                        </div>

                        <div className="stat-box">
                            <span className="stat-value">
                                {
                                    sessionResult.hint_rate
                                }
                                %
                            </span>

                            <span className="stat-label">
                                Hint Rate
                            </span>
                        </div>

                        <div className="stat-box">
                            <span className="stat-value">
                                {
                                    sessionResult.completion_time
                                }
                                s
                            </span>

                            <span className="stat-label">
                                Completion Time
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
                                {
                                    sessionResult.difficulty_level
                                }
                            </span>

                            <span className="stat-label">
                                Difficulty Level
                            </span>
                        </div>

                        <div className="stat-box">
                            <span className="stat-value">
                                {
                                    sessionResult.attempts
                                }
                            </span>

                            <span className="stat-label">
                                Attempts
                            </span>
                        </div>

                        <div className="stat-box">
                            <span className="stat-value">
                                {
                                    sessionResult.correct_answers
                                }
                            </span>

                            <span className="stat-label">
                                Correct Answers
                            </span>
                        </div>

                        <div className="stat-box">
                            <span className="stat-value">
                                {
                                    sessionResult.incorrect_answers
                                }
                            </span>

                            <span className="stat-label">
                                Incorrect Answers
                            </span>
                        </div>

                        <div className="stat-box">
                            <span className="stat-value game-name-stat">
                                {
                                    sessionResult.game_name
                                }
                            </span>

                            <span className="stat-label">
                                Game Name
                            </span>
                        </div>

                    </div>

                    <div className="adaptive-result-box">

                        <span>
                            🧠
                        </span>

                        <div>
                            <strong>
                                Difficulty
                                automatically
                                adjusted
                            </strong>

                            <p>
                                Your next
                                level will
                                be adapted
                                according to
                                your
                                performance.
                            </p>
                        </div>

                    </div>

                    {errorMessage && (
                        <div
                            className="error-message"
                            role="alert"
                        >
                            {
                                errorMessage
                            }
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
                                ▶ Next Level
                            </button>
                        ) : (
                            <>
                                <button
                                    className="primary-button"
                                    onClick={
                                        handleNextRound
                                    }
                                >
                                    🔄 Next Round
                                </button>

                                <button
                                    className="secondary-button"
                                    onClick={
                                        handleBack
                                    }
                                >
                                    🏠 Back to Patient Dashboard
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