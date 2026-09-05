import React, { useEffect, useState } from 'react';

// Frontend-only encouragement layer (spec 3.4). Rotates through a
// small set of warm, non-generic messages per trigger. Callers pass
// real data (e.g. an actual streak count) rather than this component
// inventing numbers — see MESSAGES below, several are parameterized.

const MESSAGES = {
    reminderAllDone: () => [
        "All done for today — nicely handled!",
        "Everything's checked off. Well done!",
        "That's the full list complete today.",
    ],
    medicineDone: () => [
        "Medicine taken — thank you for staying on top of it.",
        "All set with your medicine today.",
    ],
    hydrationGoalHit: () => [
        "Hydration goal reached — great job!",
        "You've had all your water for today. Nicely done!",
    ],
    gameComplete: (label) => [
        `Great work finishing ${label}!`,
        `${label} complete — nicely done!`,
    ],
    streak: (days, label) => [
        `${days} days in a row on ${label}! Keep it up.`,
    ],
};

function pickMessage(trigger, ...args) {
    const options = MESSAGES[trigger]?.(...args) || [];
    if (options.length === 0) return null;
    return options[Math.floor(Math.random() * options.length)];
}

// `trigger` selects the message set (see MESSAGES above); `args` are
// passed through for parameterized messages (e.g. a real streak
// count or game name). Auto-dismisses after `duration` ms.
export default function EncouragementToast({ trigger, args = [], duration = 3500, onDismiss }) {
    const [message] = useState(() => pickMessage(trigger, ...args));

    useEffect(() => {
        if (!message) return;
        const timer = setTimeout(() => onDismiss?.(), duration);
        return () => clearTimeout(timer);
    }, [message, duration, onDismiss]);

    if (!message) return null;

    return (
        <div className="db-saved-toast db-encouragement-toast" role="status">
            🌟 {message}
        </div>
    );
}