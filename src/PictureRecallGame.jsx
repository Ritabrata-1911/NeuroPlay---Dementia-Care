import React, { useEffect, useMemo, useRef, useState } from 'react';
import './PictureRecallGame.css';

/*
|--------------------------------------------------------------------------
| Picture Recall Game
|--------------------------------------------------------------------------
| The patient first observes a visual scene.
| The scene is then hidden and the patient answers questions about:
|
| 1. Objects
| 2. Colors
| 3. Quantities
| 4. Positions
| 5. Presence / absence
|
| Each scene is represented by individual objects with meaningful positions.
|--------------------------------------------------------------------------
*/

const DIFFICULTY_CONFIG = {
    easy: {
        label: 'Easy',
        observationTime: 15,
        questionCount: 5,
    },
    medium: {
        label: 'Medium',
        observationTime: 12,
        questionCount: 7,
    },
    hard: {
        label: 'Hard',
        observationTime: 10,
        questionCount: 9,
    },
};

/*
|--------------------------------------------------------------------------
| Scene Data
|--------------------------------------------------------------------------
| Every object has:
| - name
| - emoji
| - color
| - position
| - area
|
| Multiple copies are represented as separate objects.
|--------------------------------------------------------------------------
*/

const SCENES = {
    easy: [
        {
            id: 'living-room',
            title: 'Living Room',
            description: 'A simple living room with a sofa, table and a few objects.',
            objects: [
                {
                    id: 'sofa',
                    name: 'Sofa',
                    emoji: '🛋️',
                    color: 'Blue',
                    position: 'center',
                    area: 'middle',
                },
                {
                    id: 'clock',
                    name: 'Clock',
                    emoji: '🕐',
                    color: 'Brown',
                    position: 'top',
                    area: 'wall',
                },
                {
                    id: 'table',
                    name: 'Table',
                    emoji: '🟫',
                    color: 'Brown',
                    position: 'bottom-center',
                    area: 'floor',
                },
                {
                    id: 'book',
                    name: 'Book',
                    emoji: '📖',
                    color: 'Blue',
                    position: 'left',
                    area: 'table',
                },
                {
                    id: 'vase',
                    name: 'Flower Vase',
                    emoji: '🌷',
                    color: 'Pink',
                    position: 'right',
                    area: 'table',
                },
            ],
        },

        {
            id: 'garden',
            title: 'Garden',
            description: 'A small garden with flowers, a tree and a bench.',
            objects: [
                {
                    id: 'tree',
                    name: 'Tree',
                    emoji: '🌳',
                    color: 'Green',
                    position: 'left',
                    area: 'garden',
                },
                {
                    id: 'flower-red',
                    name: 'Flower',
                    emoji: '🌹',
                    color: 'Red',
                    position: 'center-left',
                    area: 'garden',
                },
                {
                    id: 'flower-yellow',
                    name: 'Flower',
                    emoji: '🌻',
                    color: 'Yellow',
                    position: 'center-right',
                    area: 'garden',
                },
                {
                    id: 'bench',
                    name: 'Bench',
                    emoji: '🪑',
                    color: 'Brown',
                    position: 'bottom',
                    area: 'garden',
                },
                {
                    id: 'ball',
                    name: 'Ball',
                    emoji: '⚽',
                    color: 'White',
                    position: 'right',
                    area: 'garden',
                },
            ],
        },
    ],

    medium: [
        {
            id: 'kitchen',
            title: 'Kitchen',
            description: 'A kitchen with a table, cups, fruit and cooking items.',
            objects: [
                {
                    id: 'table',
                    name: 'Table',
                    emoji: '🟫',
                    color: 'Brown',
                    position: 'center',
                    area: 'middle',
                },
                {
                    id: 'cup-1',
                    name: 'Cup',
                    emoji: '☕',
                    color: 'Blue',
                    position: 'left',
                    area: 'table',
                },
                {
                    id: 'cup-2',
                    name: 'Cup',
                    emoji: '☕',
                    color: 'Blue',
                    position: 'right',
                    area: 'table',
                },
                {
                    id: 'plate',
                    name: 'Plate',
                    emoji: '🍽️',
                    color: 'White',
                    position: 'center',
                    area: 'table',
                },
                {
                    id: 'spoon',
                    name: 'Spoon',
                    emoji: '🥄',
                    color: 'Silver',
                    position: 'bottom-right',
                    area: 'table',
                },
                {
                    id: 'kettle',
                    name: 'Kettle',
                    emoji: '🫖',
                    color: 'Red',
                    position: 'top-right',
                    area: 'stove',
                },
                {
                    id: 'apple-1',
                    name: 'Apple',
                    emoji: '🍎',
                    color: 'Red',
                    position: 'top-left',
                    area: 'fruit bowl',
                },
                {
                    id: 'apple-2',
                    name: 'Apple',
                    emoji: '🍎',
                    color: 'Red',
                    position: 'top-center',
                    area: 'fruit bowl',
                },
                {
                    id: 'pan',
                    name: 'Pan',
                    emoji: '🍳',
                    color: 'Black',
                    position: 'left',
                    area: 'stove',
                },
            ],
        },

        {
            id: 'bedroom',
            title: 'Bedroom',
            description: 'A bedroom with a bed, lamp, book and other familiar objects.',
            objects: [
                {
                    id: 'bed',
                    name: 'Bed',
                    emoji: '🛏️',
                    color: 'White',
                    position: 'center',
                    area: 'middle',
                },
                {
                    id: 'lamp',
                    name: 'Lamp',
                    emoji: '💡',
                    color: 'Yellow',
                    position: 'left',
                    area: 'bedside',
                },
                {
                    id: 'book',
                    name: 'Book',
                    emoji: '📕',
                    color: 'Red',
                    position: 'right',
                    area: 'bedside',
                },
                {
                    id: 'clock',
                    name: 'Clock',
                    emoji: '⏰',
                    color: 'Black',
                    position: 'top-right',
                    area: 'wall',
                },
                {
                    id: 'plant',
                    name: 'Plant',
                    emoji: '🪴',
                    color: 'Green',
                    position: 'bottom-left',
                    area: 'floor',
                },
                {
                    id: 'pillow-1',
                    name: 'Pillow',
                    emoji: '🛏️',
                    color: 'Blue',
                    position: 'center-left',
                    area: 'bed',
                },
                {
                    id: 'pillow-2',
                    name: 'Pillow',
                    emoji: '🛏️',
                    color: 'Blue',
                    position: 'center-right',
                    area: 'bed',
                },
            ],
        },
    ],

    hard: [
        {
            id: 'dining-room',
            title: 'Dining Room',
            description: 'A dining room containing several objects in different positions.',
            objects: [
                {
                    id: 'table',
                    name: 'Table',
                    emoji: '🟫',
                    color: 'Brown',
                    position: 'center',
                    area: 'middle',
                },
                {
                    id: 'plate-1',
                    name: 'Plate',
                    emoji: '🍽️',
                    color: 'White',
                    position: 'top-left',
                    area: 'table',
                },
                {
                    id: 'plate-2',
                    name: 'Plate',
                    emoji: '🍽️',
                    color: 'White',
                    position: 'top-right',
                    area: 'table',
                },
                {
                    id: 'plate-3',
                    name: 'Plate',
                    emoji: '🍽️',
                    color: 'White',
                    position: 'bottom-left',
                    area: 'table',
                },
                {
                    id: 'plate-4',
                    name: 'Plate',
                    emoji: '🍽️',
                    color: 'White',
                    position: 'bottom-right',
                    area: 'table',
                },
                {
                    id: 'cup-1',
                    name: 'Cup',
                    emoji: '☕',
                    color: 'Blue',
                    position: 'left',
                    area: 'table',
                },
                {
                    id: 'cup-2',
                    name: 'Cup',
                    emoji: '☕',
                    color: 'Blue',
                    position: 'right',
                    area: 'table',
                },
                {
                    id: 'cake',
                    name: 'Cake',
                    emoji: '🎂',
                    color: 'Brown',
                    position: 'center',
                    area: 'table',
                },
                {
                    id: 'vase',
                    name: 'Flower Vase',
                    emoji: '🌻',
                    color: 'Yellow',
                    position: 'top-center',
                    area: 'table',
                },
                {
                    id: 'candle',
                    name: 'Candle',
                    emoji: '🕯️',
                    color: 'White',
                    position: 'center-right',
                    area: 'table',
                },
                {
                    id: 'bread',
                    name: 'Bread',
                    emoji: '🍞',
                    color: 'Brown',
                    position: 'bottom-center',
                    area: 'table',
                },
                {
                    id: 'clock',
                    name: 'Clock',
                    emoji: '🕐',
                    color: 'Brown',
                    position: 'top-left',
                    area: 'wall',
                },
                {
                    id: 'window',
                    name: 'Window',
                    emoji: '🪟',
                    color: 'Blue',
                    position: 'top-right',
                    area: 'wall',
                },
                {
                    id: 'chair-1',
                    name: 'Chair',
                    emoji: '🪑',
                    color: 'Brown',
                    position: 'left',
                    area: 'floor',
                },
                {
                    id: 'chair-2',
                    name: 'Chair',
                    emoji: '🪑',
                    color: 'Brown',
                    position: 'right',
                    area: 'floor',
                },
            ],
        },

        {
            id: 'market',
            title: 'Market',
            description: 'A small market with fruits, vegetables and familiar objects.',
            objects: [
                {
                    id: 'basket',
                    name: 'Basket',
                    emoji: '🧺',
                    color: 'Brown',
                    position: 'center',
                    area: 'middle',
                },
                {
                    id: 'apple-1',
                    name: 'Apple',
                    emoji: '🍎',
                    color: 'Red',
                    position: 'left',
                    area: 'basket',
                },
                {
                    id: 'apple-2',
                    name: 'Apple',
                    emoji: '🍎',
                    color: 'Red',
                    position: 'center-left',
                    area: 'basket',
                },
                {
                    id: 'banana-1',
                    name: 'Banana',
                    emoji: '🍌',
                    color: 'Yellow',
                    position: 'center-right',
                    area: 'basket',
                },
                {
                    id: 'banana-2',
                    name: 'Banana',
                    emoji: '🍌',
                    color: 'Yellow',
                    position: 'right',
                    area: 'basket',
                },
                {
                    id: 'tomato',
                    name: 'Tomato',
                    emoji: '🍅',
                    color: 'Red',
                    position: 'bottom-left',
                    area: 'basket',
                },
                {
                    id: 'bread',
                    name: 'Bread',
                    emoji: '🍞',
                    color: 'Brown',
                    position: 'bottom-right',
                    area: 'shelf',
                },
                {
                    id: 'bottle',
                    name: 'Bottle',
                    emoji: '🧴',
                    color: 'Green',
                    position: 'top-right',
                    area: 'shelf',
                },
                {
                    id: 'clock',
                    name: 'Clock',
                    emoji: '🕐',
                    color: 'Black',
                    position: 'top',
                    area: 'wall',
                },
                {
                    id: 'bag',
                    name: 'Bag',
                    emoji: '👜',
                    color: 'Brown',
                    position: 'bottom-center',
                    area: 'floor',
                },
            ],
        },
    ],
};

/* ------------------------------------------------------------------------- */

const CORRECT_MESSAGES = [
    'Excellent!',
    'Great memory!',
    'That is correct!',
    'Wonderful!',
];

const INCORRECT_MESSAGES = [
    'Good try!',
    'That is okay. Keep going!',
    'Nice effort!',
    "Let's try the next one.",
];

function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function shuffle(array) {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function getObjectCount(objects, name) {
    return objects.filter((object) => object.name === name).length;
}

function getUniqueObjects(objects) {
    const seen = new Set();

    return objects.filter((object) => {
        if (seen.has(object.name)) return false;

        seen.add(object.name);
        return true;
    });
}

function getPositionLabel(position) {
    const labels = {
        top: 'at the top',
        'top-left': 'at the top left',
        'top-center': 'at the top center',
        'top-right': 'at the top right',
        left: 'on the left',
        'center-left': 'on the center-left',
        center: 'in the center',
        'center-right': 'on the center-right',
        right: 'on the right',
        'bottom-left': 'at the bottom left',
        'bottom-center': 'at the bottom center',
        'bottom-right': 'at the bottom right',
        bottom: 'at the bottom',
    };

    return labels[position] || position;
}

/*
|--------------------------------------------------------------------------
| Question Generator
|--------------------------------------------------------------------------
| Questions are generated from the actual objects in the scene.
|--------------------------------------------------------------------------
*/

function generateQuestions(scene, difficulty) {
    const objects = scene.objects;
    const uniqueObjects = getUniqueObjects(objects);
    const questions = [];

    const objectNames = uniqueObjects.map((object) => object.name);
    const colors = [...new Set(objects.map((object) => object.color))];

    /* Object question */
    const objectTarget = randomItem(uniqueObjects);

    const objectWrongOptions = shuffle(
        objectNames.filter((name) => name !== objectTarget.name)
    ).slice(0, 3);

    questions.push({
        id: 'object-question',
        type: 'object',
        question: 'Which of these objects was in the picture?',
        options: shuffle([
            objectTarget.name,
            ...objectWrongOptions,
        ]),
        correctAnswer: objectTarget.name,
        hint: 'Think about the main objects you saw.',
    });

    /* Color question */
    const colorTarget = randomItem(
        uniqueObjects.filter((object) => object.color)
    );

    const wrongColors = shuffle(
        colors.filter((color) => color !== colorTarget.color)
    ).slice(0, 3);

    while (wrongColors.length < 3) {
        const fallbackColors = ['Blue', 'Red', 'Green', 'Yellow', 'White', 'Brown'];

        const fallback = fallbackColors.find(
            (color) =>
                color !== colorTarget.color &&
                !wrongColors.includes(color)
        );

        if (!fallback) break;

        wrongColors.push(fallback);
    }

    questions.push({
        id: 'color-question',
        type: 'color',
        question: `What color was the ${colorTarget.name.toLowerCase()}?`,
        options: shuffle([
            colorTarget.color,
            ...wrongColors.slice(0, 3),
        ]),
        correctAnswer: colorTarget.color,
        hint: `Think about the ${colorTarget.name.toLowerCase()}.`,
    });

    /* Count question */
    const objectsWithDuplicates = uniqueObjects.filter(
        (object) => getObjectCount(objects, object.name) >= 2
    );

    if (objectsWithDuplicates.length > 0) {
        const countTarget = randomItem(objectsWithDuplicates);
        const correctCount = getObjectCount(objects, countTarget.name);

        const countOptions = new Set([String(correctCount)]);

        [1, 2, 3, 4, 5, 6].forEach((number) => {
            if (countOptions.size < 4) {
                countOptions.add(String(number));
            }
        });

        questions.push({
            id: 'count-question',
            type: 'counting',
            question: `How many ${countTarget.name.toLowerCase()}${correctCount > 1 ? 's' : ''} were in the picture?`,
            options: shuffle([...countOptions]),
            correctAnswer: String(correctCount),
            hint: `Try to picture each ${countTarget.name.toLowerCase()} separately.`,
        });
    }

    /* Position question */
    const positionTarget = randomItem(uniqueObjects);

    const positionOptions = shuffle([
        'At the top',
        'On the left',
        'In the center',
        'On the right',
        'At the bottom',
    ]);

    const correctPosition = (() => {
        if (positionTarget.position.includes('top')) return 'At the top';
        if (positionTarget.position.includes('bottom')) return 'At the bottom';
        if (positionTarget.position.includes('left')) return 'On the left';
        if (positionTarget.position.includes('right')) return 'On the right';
        return 'In the center';
    })();

    const filteredPositionOptions = [
        correctPosition,
        ...positionOptions.filter(
            (option) => option !== correctPosition
        ),
    ].slice(0, 4);

    questions.push({
        id: 'position-question',
        type: 'position',
        question: `Where was the ${positionTarget.name.toLowerCase()}?`,
        options: shuffle(filteredPositionOptions),
        correctAnswer: correctPosition,
        hint: 'Think about where you saw this object in the picture.',
    });

    /* Area / relative location question */
    const areaTarget = randomItem(
        objects.filter((object) => object.area)
    );

    if (areaTarget.area !== 'middle') {
        const areaLabels = {
            table: 'on the table',
            wall: 'on the wall',
            floor: 'on the floor',
            stove: 'near the stove',
            garden: 'in the garden',
            bed: 'on the bed',
            bedside: 'beside the bed',
            basket: 'in the basket',
            shelf: 'on the shelf',
        };

        const correctArea =
            areaLabels[areaTarget.area] || `in the ${areaTarget.area}`;

        const allAreas = Object.values(areaLabels);

        questions.push({
            id: 'area-question',
            type: 'location',
            question: `Where was the ${areaTarget.name.toLowerCase()} placed?`,
            options: shuffle([
                correctArea,
                ...shuffle(
                    allAreas.filter((area) => area !== correctArea)
                ).slice(0, 3),
            ]),
            correctAnswer: correctArea,
            hint: 'Remember what was around the object.',
        });
    }

    /* Presence question */
    const absentNames = [
        'Telephone',
        'Hat',
        'Shoe',
        'Football',
        'Umbrella',
        'Key',
    ].filter((name) => !objectNames.includes(name));

    const absentObject = randomItem(absentNames);

    questions.push({
        id: 'presence-question',
        type: 'presence',
        question: `Was there a ${absentObject.toLowerCase()} in the picture?`,
        options: ['Yes', 'No'],
        correctAnswer: 'No',
        hint: 'Think carefully about all the objects you saw.',
    });

    /* Relative object question */
    if (objects.length >= 2) {
        const firstObject = randomItem(objects);
        const nearbyObjects = objects.filter(
            (object) =>
                object.id !== firstObject.id &&
                object.area === firstObject.area
        );

        if (nearbyObjects.length > 0) {
            const secondObject = randomItem(nearbyObjects);

            questions.push({
                id: 'relative-question',
                type: 'relative',
                question: `Which object was also near the ${firstObject.name.toLowerCase()}?`,
                options: shuffle([
                    secondObject.name,
                    ...shuffle(
                        objectNames.filter(
                            (name) =>
                                name !== secondObject.name &&
                                name !== firstObject.name
                        )
                    ).slice(0, 3),
                ]),
                correctAnswer: secondObject.name,
                hint: 'Think about the objects that were close together.',
            });
        }
    }

    /*
     * Easy should be simpler.
     * Medium has more questions.
     * Hard uses almost everything.
     */
    const targetCount = DIFFICULTY_CONFIG[difficulty].questionCount;

    return shuffle(questions).slice(0, targetCount);
}

/* ------------------------------------------------------------------------- */

export function suggestNextDifficulty(accuracy) {
    if (accuracy >= 90) return 'harder';
    if (accuracy < 50) return 'easier';

    return 'same';
}

/* ------------------------------------------------------------------------- */

export default function PictureRecallGame({ patient, onHome }) {
    const [currentScreen, setCurrentScreen] = useState('intro');
    const [difficulty, setDifficulty] = useState('easy');
    const [selectedScene, setSelectedScene] = useState(null);

    const [remainingTime, setRemainingTime] = useState(
        DIFFICULTY_CONFIG.easy.observationTime
    );

    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);

    const [correctAnswers, setCorrectAnswers] = useState(0);
    const [hintsUsed, setHintsUsed] = useState(0);

    const [showHint, setShowHint] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    const [startTimestamp, setStartTimestamp] = useState(null);
    const [completionTime, setCompletionTime] = useState(0);

    const timerRef = useRef(null);

    const config = DIFFICULTY_CONFIG[difficulty];

    const currentQuestion =
        questions[currentQuestionIndex] || null;

    const accuracy = useMemo(() => {
        if (!questions.length) return 0;

        return Math.round(
            (correctAnswers / questions.length) * 100
        );
    }, [correctAnswers, questions.length]);

    useEffect(() => {
        return () => {
            clearInterval(timerRef.current);

            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    /*
    |--------------------------------------------------------------------------
    | Observation Timer
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        if (currentScreen !== 'observation') {
            clearInterval(timerRef.current);
            return undefined;
        }

        clearInterval(timerRef.current);

        timerRef.current = setInterval(() => {
            setRemainingTime((previousTime) => {
                if (previousTime <= 1) {
                    clearInterval(timerRef.current);
                    goToQuestions();

                    return 0;
                }

                return previousTime - 1;
            });
        }, 1000);

        return () => clearInterval(timerRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentScreen]);

    /*
    |--------------------------------------------------------------------------
    | Speech
    |--------------------------------------------------------------------------
    */

    function speak(text) {
        if (
            isMuted ||
            typeof window === 'undefined' ||
            !('speechSynthesis' in window)
        ) {
            return;
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        utterance.rate = 0.85;
        utterance.pitch = 1;

        window.speechSynthesis.speak(utterance);
    }

    /*
    |--------------------------------------------------------------------------
    | Difficulty
    |--------------------------------------------------------------------------
    */

    function handleDifficultyChange(nextDifficulty) {
        setDifficulty(nextDifficulty);

        const scene = randomItem(SCENES[nextDifficulty]);

        setSelectedScene(scene);
        setRemainingTime(
            DIFFICULTY_CONFIG[nextDifficulty].observationTime
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Start Game
    |--------------------------------------------------------------------------
    */

    function startGame() {
        clearInterval(timerRef.current);

        const scene = randomItem(SCENES[difficulty]);

        const generatedQuestions = generateQuestions(
            scene,
            difficulty
        );

        setSelectedScene(scene);
        setQuestions(generatedQuestions);

        setRemainingTime(config.observationTime);

        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setIsAnswered(false);

        setCorrectAnswers(0);
        setHintsUsed(0);

        setShowHint(false);

        setCompletionTime(0);
        setStartTimestamp(Date.now());

        setCurrentScreen('observation');
    }

    /*
    |--------------------------------------------------------------------------
    | Go to Questions
    |--------------------------------------------------------------------------
    */

    function goToQuestions() {
        clearInterval(timerRef.current);

        setCurrentScreen('question');

        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setShowHint(false);
    }

    /*
    |--------------------------------------------------------------------------
    | Answer
    |--------------------------------------------------------------------------
    */

    function handleAnswerSelect(option) {
        if (isAnswered || !currentQuestion) return;

        const correct =
            option === currentQuestion.correctAnswer;

        setSelectedAnswer(option);
        setIsAnswered(true);

        if (correct) {
            setCorrectAnswers((previous) => previous + 1);

            setFeedbackMessage(
                randomItem(CORRECT_MESSAGES)
            );
        } else {
            setFeedbackMessage(
                randomItem(INCORRECT_MESSAGES)
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Feedback
    |--------------------------------------------------------------------------
    */

    const [feedbackMessage, setFeedbackMessage] = useState('');

    /*
    |--------------------------------------------------------------------------
    | Next Question
    |--------------------------------------------------------------------------
    */

    function handleNextQuestion() {
        if (!isAnswered) return;

        const nextIndex = currentQuestionIndex + 1;

        if (nextIndex < questions.length) {
            setCurrentQuestionIndex(nextIndex);

            setSelectedAnswer(null);
            setIsAnswered(false);
            setShowHint(false);
            setFeedbackMessage('');
        } else {
            finishGame();
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Finish
    |--------------------------------------------------------------------------
    */

    function finishGame() {
        clearInterval(timerRef.current);

        const endTime = startTimestamp
            ? Math.round(
                  (Date.now() - startTimestamp) / 1000
              )
            : 0;

        setCompletionTime(endTime);
        setCurrentScreen('results');

        const finalAccuracy =
            questions.length > 0
                ? Math.round(
                      (correctAnswers / questions.length) * 100
                  )
                : 0;

        const analytics = {
            userId:
                patient?.id ||
                patient?.full_name ||
                'unknown',

            gameName: 'Picture Recall',

            difficulty,

            sceneId: selectedScene?.id || 'unknown',

            totalQuestions: questions.length,

            correctAnswers,

            accuracy: finalAccuracy,

            hintsUsed,

            observationTime: config.observationTime,

            completionTime: endTime,

            completed: true,

            timestamp: new Date().toISOString(),
        };

        console.log(
            'Picture Recall analytics:',
            analytics
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Hint
    |--------------------------------------------------------------------------
    */

    function useHint() {
        if (isAnswered || showHint) return;

        setShowHint(true);
        setHintsUsed((previous) => previous + 1);
    }

    /*
    |--------------------------------------------------------------------------
    | Navigation
    |--------------------------------------------------------------------------
    */

    function playAgain() {
        startGame();
    }

    function backToIntro() {
        clearInterval(timerRef.current);

        setCurrentScreen('intro');

        setSelectedAnswer(null);
        setIsAnswered(false);
        setShowHint(false);
    }

    /*
    |--------------------------------------------------------------------------
    | Performance Message
    |--------------------------------------------------------------------------
    */

    let performanceMessage =
        'Good effort! Keep practicing your memory.';

    if (accuracy >= 90) {
        performanceMessage =
            'Excellent memory! Wonderful work.';
    } else if (accuracy >= 70) {
        performanceMessage =
            'Great job! You remembered many details.';
    } else if (accuracy >= 50) {
        performanceMessage =
            'Good effort! Keep practicing.';
    }

    /*
    |--------------------------------------------------------------------------
    | INTRO SCREEN
    |--------------------------------------------------------------------------
    */

    if (currentScreen === 'intro') {
        return (
            <div className="picture-recall-container">
                <header className="picture-recall-header">
                    <div className="pr-brain-icon">
                        🧠
                    </div>

                    <h1>NeuroPlay</h1>

                    <h2>Picture Recall</h2>

                    <p>
                        Look carefully at a picture and
                        remember the objects, colors,
                        quantities and positions.
                    </p>
                </header>

                <section className="pr-instructions-card">
                    <div className="pr-instruction-item">
                        <span>👀</span>
                        <div>
                            <strong>1. Look</strong>
                            <p>
                                Study the picture carefully.
                            </p>
                        </div>
                    </div>

                    <div className="pr-instruction-item">
                        <span>🧠</span>
                        <div>
                            <strong>2. Remember</strong>
                            <p>
                                Remember where the objects
                                were placed.
                            </p>
                        </div>
                    </div>

                    <div className="pr-instruction-item">
                        <span>❓</span>
                        <div>
                            <strong>3. Answer</strong>
                            <p>
                                Answer questions about the
                                picture.
                            </p>
                        </div>
                    </div>
                </section>

                <div className="pr-section-title">
                    Choose Difficulty
                </div>

                <div className="pr-difficulty-selector">
                    {Object.keys(DIFFICULTY_CONFIG).map(
                        (key) => (
                            <button
                                key={key}
                                className={`pr-diff-btn ${
                                    difficulty === key
                                        ? 'active-diff'
                                        : ''
                                }`}
                                onClick={() =>
                                    handleDifficultyChange(
                                        key
                                    )
                                }
                            >
                                <span>
                                    {
                                        DIFFICULTY_CONFIG[
                                            key
                                        ].label
                                    }
                                </span>

                                <small>
                                    {
                                        DIFFICULTY_CONFIG[
                                            key
                                        ].observationTime
                                    }{' '}
                                    sec
                                </small>
                            </button>
                        )
                    )}
                </div>

                <p className="pr-current-difficulty">
                    Current difficulty:{' '}
                    <strong>
                        {config.label}
                    </strong>
                </p>

                <div className="pr-intro-actions">
                    <button
                        className="pr-primary-btn"
                        onClick={startGame}
                    >
                        ▶️ Start Game
                    </button>

                    <button
                        className="pr-secondary-btn"
                        onClick={() =>
                            speak(
                                'Look carefully at the picture. Remember the objects, their colors, quantities and positions. When the picture disappears, answer the questions.'
                            )
                        }
                    >
                        🔊 Read Instructions
                    </button>

                    <button
                        className="pr-secondary-btn"
                        onClick={onHome}
                    >
                        🏠 Home
                    </button>
                </div>

                <button
                    className="pr-mute-toggle"
                    onClick={() =>
                        setIsMuted(
                            (previous) => !previous
                        )
                    }
                >
                    {isMuted
                        ? '🔇 Sound Off'
                        : '🔊 Sound On'}
                </button>
            </div>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | OBSERVATION SCREEN
    |--------------------------------------------------------------------------
    */

    if (
        currentScreen === 'observation' &&
        selectedScene
    ) {
        return (
            <div className="picture-recall-container observation-screen">
                <header className="picture-recall-header observation-header">
                    <div className="pr-observation-badge">
                        👀 Remember This Picture
                    </div>

                    <h2>
                        {selectedScene.title}
                    </h2>

                    <p>
                        Remember the objects,
                        colors, quantities and positions.
                    </p>
                </header>

                <div className="pr-timer-area">
                    <div className="pr-timer-label">
                        Time remaining
                    </div>

                    <div
                        className={`pr-large-timer ${
                            remainingTime <= 3
                                ? 'timer-warning'
                                : ''
                        }`}
                    >
                        {remainingTime}
                    </div>

                    <div className="pr-progress-track">
                        <div
                            className="pr-progress-fill"
                            style={{
                                width: `${
                                    (remainingTime /
                                        config.observationTime) *
                                    100
                                }%`,
                            }}
                        />
                    </div>
                </div>

                <div
                    className={`pr-picture-scene pr-scene-${selectedScene.id}`}
                    role="img"
                    aria-label={`${selectedScene.title} scene`}
                >
                    <div className="pr-scene-wall">
                        <div className="pr-scene-window">
                            🪟
                        </div>

                        <div className="pr-scene-clock">
                            🕐
                        </div>
                    </div>

                    <div className="pr-scene-floor" />

                    {selectedScene.objects.map(
                        (object, index) => (
                            <div
                                key={object.id}
                                className={`pr-visual-object pr-position-${object.position}`}
                                style={{
                                    '--object-index':
                                        index,
                                }}
                            >
                                <span className="pr-object-emoji">
                                    {object.emoji}
                                </span>

                                <span className="pr-object-label">
                                    {object.name}
                                </span>
                            </div>
                        )
                    )}
                </div>

                <div className="pr-memory-reminder">
                    💡 Remember <strong>what</strong> you
                    saw, <strong>how many</strong>,{' '}
                    <strong>what color</strong>, and{' '}
                    <strong>where</strong>.
                </div>
            </div>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | QUESTION SCREEN
    |--------------------------------------------------------------------------
    */

    if (
        currentScreen === 'question' &&
        currentQuestion
    ) {
        return (
            <div className="picture-recall-container question-screen">
                <header className="picture-recall-header">
                    <div className="pr-question-badge">
                        🧠 Memory Question
                    </div>

                    <h2>
                        What do you remember?
                    </h2>
                </header>

                <div className="pr-question-progress-wrapper">
                    <div className="pr-question-counter">
                        Question{' '}
                        {currentQuestionIndex + 1}{' '}
                        of {questions.length}
                    </div>

                    <div className="pr-question-progress-track">
                        <div
                            className="pr-question-progress-fill"
                            style={{
                                width: `${
                                    ((currentQuestionIndex +
                                        1) /
                                        questions.length) *
                                    100
                                }%`,
                            }}
                        />
                    </div>
                </div>

                <div className="pr-question-card">
                    <div className="pr-question-type">
                        {currentQuestion.type ===
                            'counting' &&
                            '🔢 Quantity'}

                        {currentQuestion.type ===
                            'color' &&
                            '🎨 Color'}

                        {currentQuestion.type ===
                            'position' &&
                            '📍 Position'}

                        {currentQuestion.type ===
                            'location' &&
                            '🏠 Location'}

                        {currentQuestion.type ===
                            'presence' &&
                            '👀 Presence'}

                        {currentQuestion.type ===
                            'relative' &&
                            '↔️ Nearby Objects'}

                        {currentQuestion.type ===
                            'object' &&
                            '🧩 Object'}
                    </div>

                    <h3 className="pr-question-text">
                        {currentQuestion.question}
                    </h3>

                    <button
                        className="pr-read-question-btn"
                        onClick={() =>
                            speak(
                                `${currentQuestion.question}. Options are: ${currentQuestion.options.join(
                                    ', '
                                )}`
                            )
                        }
                    >
                        🔊 Read Question
                    </button>

                    <div className="pr-options-grid">
                        {currentQuestion.options.map(
                            (option) => {
                                const isSelected =
                                    selectedAnswer ===
                                    option;

                                const isCorrect =
                                    option ===
                                    currentQuestion.correctAnswer;

                                let optionClass =
                                    'pr-option-btn';

                                if (
                                    isAnswered &&
                                    isSelected &&
                                    isCorrect
                                ) {
                                    optionClass +=
                                        ' correct-option';
                                } else if (
                                    isAnswered &&
                                    isSelected &&
                                    !isCorrect
                                ) {
                                    optionClass +=
                                        ' incorrect-option';
                                } else if (
                                    isAnswered &&
                                    isCorrect
                                ) {
                                    optionClass +=
                                        ' reveal-correct';
                                } else if (
                                    isSelected
                                ) {
                                    optionClass +=
                                        ' selected-option';
                                }

                                return (
                                    <button
                                        key={option}
                                        type="button"
                                        className={
                                            optionClass
                                        }
                                        onClick={() =>
                                            handleAnswerSelect(
                                                option
                                            )
                                        }
                                        disabled={
                                            isAnswered
                                        }
                                    >
                                        <span className="pr-option-letter">
                                            {String.fromCharCode(
                                                65 +
                                                    currentQuestion.options.indexOf(
                                                        option
                                                    )
                                            )}
                                        </span>

                                        <span>
                                            {option}
                                        </span>

                                        {isAnswered &&
                                            isCorrect && (
                                                <span>
                                                    ✓
                                                </span>
                                            )}

                                        {isAnswered &&
                                            isSelected &&
                                            !isCorrect && (
                                                <span>
                                                    ✕
                                                </span>
                                            )}
                                    </button>
                                );
                            }
                        )}
                    </div>

                    {!isAnswered && (
                        <button
                            className="pr-hint-btn"
                            onClick={useHint}
                            disabled={showHint}
                        >
                            💡 {showHint
                                ? 'Hint Shown'
                                : 'Need a Hint?'}
                        </button>
                    )}

                    {showHint && !isAnswered && (
                        <div className="pr-hint-text">
                            💡 {currentQuestion.hint}
                        </div>
                    )}

                    {isAnswered && (
                        <div
                            className={`pr-feedback ${
                                selectedAnswer ===
                                currentQuestion.correctAnswer
                                    ? 'feedback-correct'
                                    : 'feedback-incorrect'
                            }`}
                            aria-live="polite"
                        >
                            <span>
                                {selectedAnswer ===
                                currentQuestion.correctAnswer
                                    ? '✓'
                                    : '💭'}
                            </span>

                            <div>
                                <strong>
                                    {feedbackMessage}
                                </strong>

                                {selectedAnswer !==
                                    currentQuestion.correctAnswer && (
                                    <p>
                                        Correct answer:{' '}
                                        <strong>
                                            {
                                                currentQuestion.correctAnswer
                                            }
                                        </strong>
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {isAnswered && (
                        <button
                            className="pr-primary-btn pr-next-btn"
                            onClick={
                                handleNextQuestion
                            }
                        >
                            {currentQuestionIndex + 1 <
                            questions.length
                                ? 'Next Question →'
                                : 'See Results →'}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | RESULTS SCREEN
    |--------------------------------------------------------------------------
    */

    return (
        <div className="picture-recall-container results-screen">
            <div className="pr-results-card">
                <div className="pr-results-icon">
                    {accuracy >= 70 ? '🌟' : '🧠'}
                </div>

                <h2>
                    Picture Recall Completed!
                </h2>

                <p className="pr-results-scene">
                    {selectedScene?.title}
                </p>

                <div className="pr-results-score">
                    <span className="pr-score-fraction">
                        {correctAnswers} /{' '}
                        {questions.length}
                    </span>

                    <span className="pr-score-accuracy">
                        {accuracy}% Accuracy
                    </span>
                </div>

                <div className="pr-performance-message">
                    {performanceMessage}
                </div>

                <div className="pr-results-stats">
                    <div className="pr-stat">
                        <span>✓</span>
                        <div>
                            <small>
                                Correct Answers
                            </small>
                            <strong>
                                {correctAnswers}
                            </strong>
                        </div>
                    </div>

                    <div className="pr-stat">
                        <span>❓</span>
                        <div>
                            <small>
                                Total Questions
                            </small>
                            <strong>
                                {questions.length}
                            </strong>
                        </div>
                    </div>

                    <div className="pr-stat">
                        <span>💡</span>
                        <div>
                            <small>Hints Used</small>
                            <strong>
                                {hintsUsed}
                            </strong>
                        </div>
                    </div>

                    <div className="pr-stat">
                        <span>⏱️</span>
                        <div>
                            <small>
                                Completion Time
                            </small>
                            <strong>
                                {formatTime(
                                    completionTime
                                )}
                            </strong>
                        </div>
                    </div>
                </div>

                <div className="pr-results-actions">
                    <button
                        className="pr-primary-btn"
                        onClick={playAgain}
                    >
                        🔄 Play Again
                    </button>

                    <button
                        className="pr-secondary-btn"
                        onClick={backToIntro}
                    >
                        🎮 Change Difficulty
                    </button>

                    <button
                        className="pr-secondary-btn"
                        onClick={onHome}
                    >
                        🏠 Home
                    </button>
                </div>
            </div>
        </div>
    );
}