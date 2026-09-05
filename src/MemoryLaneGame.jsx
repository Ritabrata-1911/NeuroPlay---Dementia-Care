import React, { useState, useMemo } from 'react';
import './MemoryLaneGame.css';
import { fetchMemoryLanePrompts, logMemoryLaneResponse } from './EngagementService';

// -----------------------------------------------------------------------------
// REACTION OPTIONS
// -----------------------------------------------------------------------------

const REACTIONS = [
    { id: 'loved', emoji: '❤️', label: 'Loved it' },
    { id: 'nice', emoji: '😊', label: 'Nice memory' },
    { id: 'unsure', emoji: '🤔', label: 'Not sure' },
    { id: 'more', emoji: '💭', label: 'Tell more' },
];

function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// -----------------------------------------------------------------------------
// COMPONENT
// -----------------------------------------------------------------------------
//
// Deliberately the calmest activity in the library: no score, no
// timer, no "wrong answer" state. The patient looks at a warm,
// culturally-familiar prompt, reacts however they like (or not at
// all), and moves on whenever they're ready.

export default function MemoryLaneGame({ patient, onHome }) {
    const patientId = patient?.id || patient?.patient_id;

    const prompts = useMemo(() => shuffle(fetchMemoryLanePrompts()), []);
    const [promptIndex, setPromptIndex] = useState(0);

    const [selectedReaction, setSelectedReaction] = useState(null);
    const [freeText, setFreeText] = useState('');
    const [showTellMore, setShowTellMore] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const currentPrompt = prompts[promptIndex];
    const visitedCount = promptIndex + 1;

    async function handleReaction(reaction) {
        setSelectedReaction(reaction.id);

        if (reaction.id === 'more') {
            setShowTellMore(true);
            return;
        }

        setSaving(true);
        await logMemoryLaneResponse(patientId, currentPrompt.id, reaction.id);
        setSaving(false);
        setSaved(true);
    }

    async function handleTellMoreSubmit() {
        setSaving(true);
        await logMemoryLaneResponse(patientId, currentPrompt.id, 'more', freeText.trim() || null);
        setSaving(false);
        setSaved(true);
    }

    function goToNextPrompt() {
        setSelectedReaction(null);
        setFreeText('');
        setShowTellMore(false);
        setSaved(false);

        if (promptIndex + 1 < prompts.length) {
            setPromptIndex((prev) => prev + 1);
        } else {
            // Gently loop rather than stopping abruptly — this activity
            // has no "end", the patient chooses when to go home.
            setPromptIndex(0);
        }
    }

    if (!currentPrompt) {
        return null;
    }

    return (
        <div className="memlane-container">
            <header className="memlane-header">
                <button className="memlane-home-btn" onClick={onHome} aria-label="Back to Patient Dashboard">
                    🏠 Home
                </button>
                <div className="memlane-header-text">
                    <h1>💛 Memory Lane</h1>
                    <p>A gentle stroll through familiar memories — no right answers.</p>
                </div>
                <span className="memlane-visited-pill">{visitedCount} of {prompts.length} today</span>
            </header>

            <div className="memlane-card">
                <div className="memlane-prompt-emoji" aria-hidden="true">{currentPrompt.emoji}</div>
                <h2>{currentPrompt.title}</h2>
                <p className="memlane-question">{currentPrompt.question}</p>

                {!showTellMore && (
                    <div className="memlane-reactions">
                        {REACTIONS.map((reaction) => (
                            <button
                                key={reaction.id}
                                type="button"
                                className={`memlane-reaction-btn ${selectedReaction === reaction.id ? 'selected' : ''}`}
                                onClick={() => handleReaction(reaction)}
                                disabled={saving}
                            >
                                <span className="memlane-reaction-emoji">{reaction.emoji}</span>
                                <span>{reaction.label}</span>
                            </button>
                        ))}
                    </div>
                )}

                {showTellMore && !saved && (
                    <div className="memlane-tellmore">
                        <textarea
                            className="memlane-textarea"
                            placeholder="Share as much or as little as you like..."
                            value={freeText}
                            onChange={(e) => setFreeText(e.target.value)}
                            rows={3}
                        />
                        <button
                            type="button"
                            className="memlane-btn memlane-btn-primary"
                            onClick={handleTellMoreSubmit}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Share this memory'}
                        </button>
                    </div>
                )}

                {saved && (
                    <div className="memlane-thankyou">
                        <p>Thank you for sharing. 💛</p>
                        <div className="memlane-next-actions">
                            <button type="button" className="memlane-btn memlane-btn-primary" onClick={goToNextPrompt}>
                                Show me another
                            </button>
                            <button type="button" className="memlane-btn memlane-btn-secondary" onClick={onHome}>
                                I'm done for now
                            </button>
                        </div>
                    </div>
                )}

                {!showTellMore && !saved && (
                    <button type="button" className="memlane-skip-link" onClick={goToNextPrompt}>
                        Skip, show me a different one →
                    </button>
                )}
            </div>
        </div>
    );
}