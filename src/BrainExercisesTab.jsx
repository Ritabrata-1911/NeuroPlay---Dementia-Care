import React, { useState } from 'react';

const CATEGORIES = [
    {
        id: 'personalised',
        label: 'Personalised Memory',
        tagline: 'Tailored to your own life and stories',
        color: '#f0f4ff',
        accent: '#4361ee',
        text: '#1e3a8a',
        icon: '⭐',
        badge: 'Your Content',
        badgeColor: '#dbeafe',
        badgeText: '#1d4ed8',
        games: [
            {
                id: 'picture-memory',
                title: 'Photo Stories',
                subtitle: 'Recall scenes from your personal photo library',
                icon: '🖼️',
                playable: true,
                tag: 'Personalised',
            },
            {
                id: 'memory-lane',
                title: 'Memory Lane',
                subtitle: 'A gentle walk through familiar life moments',
                icon: '🌸',
                playable: true,
                tag: 'Personalised',
            },
        ],
    },
    {
        id: 'recall',
        label: 'Short-Term Recall',
        tagline: 'Train the brain to hold and retrieve information',
        color: '#f0fdf4',
        accent: '#16a34a',
        text: '#14532d',
        icon: '🧠',
        badge: null,
        games: [
            {
                id: 'mind-snap',
                title: 'Mind Snap',
                subtitle: 'Watch boxes light up in sequence and repeat the pattern from memory',
                icon: '⚡',
                playable: true,
                tag: null,
            },
            {
                id: 'memory-match',
                title: 'Card Match',
                subtitle: 'Flip cards and find matching pairs from memory',
                icon: '🃏',
                playable: true,
                tag: null,
            },
        ],
    },
    {
        id: 'numbers',
        label: 'Numbers & Sequences',
        tagline: 'Strengthen numeric memory and pattern recognition',
        color: '#faf5ff',
        accent: '#7c3aed',
        text: '#4c1d95',
        icon: '🔢',
        badge: null,
        games: [
            {
                id: 'number-memory',
                title: 'Number Recall',
                subtitle: 'Memorise a sequence of numbers and type it back',
                icon: '🔢',
                playable: true,
                tag: null,
            },
        ],
    },
    {
        id: 'visual',
        label: 'Visual & Spatial',
        tagline: 'Sharpen observation skills and spatial reasoning',
        color: '#fff7ed',
        accent: '#ea580c',
        text: '#7c2d12',
        icon: '🗺️',
        badge: null,
        games: [
            {
                id: 'memory-map',
                title: 'Memory Map', 
                subtitle: 'Study a map and remember where items are placed',
                icon: '📍',
                playable: true,
                tag: null,
            },
            {
                id: 'picture-recall',
                title: 'Scene Detective',
                subtitle: 'Observe a scene carefully, then answer questions about it',
                icon: '🔍',
                playable: true,
                tag: null,
            },
        ],
    },
    {
        id: 'attention',
        label: 'Focus & Attention',
        tagline: 'Build sustained concentration and mental stamina',
        color: '#fdf2f8',
        accent: '#be185d',
        text: '#831843',
        icon: '🎯',
        badge: 'Coming Soon',
        badgeColor: '#fce7f3',
        badgeText: '#9d174d',
        games: [
            {
                id: 'attention',
                title: 'Focus Challenge',
                subtitle: 'Advanced attention and inhibition training exercises',
                icon: '🎯',
                playable: false,
                tag: null,
            },
        ],
    },
];

export default function BrainExercisesTab({ onPlay }) {
    const [hovered, setHovered] = useState(null);

    const totalReady = CATEGORIES.reduce(
        (n, c) => n + c.games.filter((g) => g.playable).length, 0
    );
    const totalGames = CATEGORIES.reduce((n, c) => n + c.games.length, 0);

    return (
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", padding: '2rem', background: '#f8fafc', minHeight: '100%' }}>

            {/* Page header */}
            <div style={{ marginBottom: '1.75rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
                    Brain Training Exercises
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.35rem', marginBottom: 0 }}>
                    Cognitive exercises personalised for memory, focus, and emotional wellbeing
                </p>
            </div>

            {/* Summary pills */}
            <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
                {[
                    { dot: '#16a34a', label: `${totalReady} of ${totalGames} games available` },
                    { dot: '#4361ee', label: '2 personalised to you' },
                    { dot: '#94a3b8', label: `${CATEGORIES.length} training categories` },
                ].map((p) => (
                    <div key={p.label} style={{
                        display: 'flex', alignItems: 'center', gap: '0.45rem',
                        background: '#fff', border: '1px solid #e2e8f0',
                        borderRadius: 999, padding: '0.35rem 0.9rem',
                        fontSize: '0.78rem', color: '#334155', fontWeight: 500,
                    }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.dot, flexShrink: 0 }} />
                        {p.label}
                    </div>
                ))}
            </div>

            {/* Category grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1.1rem',
            }}>
                {CATEGORIES.map((cat) => (
                    <div key={cat.id} style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 16,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                    }}>

                        {/* Category header */}
                        <div style={{
                            background: cat.color,
                            borderBottom: `1px solid ${cat.accent}1a`,
                            padding: '1rem 1.25rem',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.75rem',
                        }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 12,
                                background: `${cat.accent}18`,
                                border: `1px solid ${cat.accent}30`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.25rem', flexShrink: 0,
                            }}>
                                {cat.icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: cat.text, lineHeight: 1.3 }}>
                                        {cat.label}
                                    </span>
                                    {cat.badge && (
                                        <span style={{
                                            fontSize: '0.65rem', fontWeight: 700,
                                            color: cat.badgeText, background: cat.badgeColor,
                                            borderRadius: 999, padding: '2px 7px',
                                            border: `1px solid ${cat.accent}30`,
                                        }}>
                                            {cat.badge}
                                        </span>
                                    )}
                                </div>
                                <p style={{ fontSize: '0.74rem', color: cat.text, opacity: 0.65, margin: '3px 0 0', lineHeight: 1.4 }}>
                                    {cat.tagline}
                                </p>
                            </div>
                        </div>

                        {/* Games list */}
                        <div style={{ flex: 1 }}>
                            {cat.games.map((game, idx) => {
                                const isLast = idx === cat.games.length - 1;
                                const key = `${cat.id}-${game.id}`;
                                const isHov = hovered === key;

                                return (
                                    <div
                                        key={game.id}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.85rem',
                                            padding: '0.9rem 1.25rem',
                                            borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                                            background: isHov && game.playable ? '#f8fafc' : 'transparent',
                                            transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={() => setHovered(key)}
                                        onMouseLeave={() => setHovered(null)}
                                    >
                                        {/* Icon */}
                                        <div style={{
                                            width: 38, height: 38, borderRadius: 10,
                                            background: game.playable ? `${cat.accent}10` : '#f1f5f9',
                                            border: `1px solid ${game.playable ? cat.accent + '25' : '#e2e8f0'}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.15rem', flexShrink: 0,
                                        }}>
                                            {game.icon}
                                        </div>

                                        {/* Text */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                                <span style={{
                                                    fontSize: '0.84rem', fontWeight: 600,
                                                    color: game.playable ? '#0f172a' : '#94a3b8',
                                                    lineHeight: 1.3,
                                                }}>
                                                    {game.title}
                                                </span>
                                                {game.playable ? (
                                                    <span style={{
                                                        fontSize: '0.62rem', fontWeight: 700,
                                                        color: '#15803d', background: '#dcfce7',
                                                        border: '1px solid #bbf7d0',
                                                        borderRadius: 999, padding: '1px 6px',
                                                    }}>
                                                        Ready
                                                    </span>
                                                ) : (
                                                    <span style={{
                                                        fontSize: '0.62rem', fontWeight: 700,
                                                        color: '#92400e', background: '#fef3c7',
                                                        border: '1px solid #fde68a',
                                                        borderRadius: 999, padding: '1px 6px',
                                                    }}>
                                                        Coming soon
                                                    </span>
                                                )}
                                                {game.tag && (
                                                    <span style={{
                                                        fontSize: '0.62rem', fontWeight: 700,
                                                        color: '#1d4ed8', background: '#dbeafe',
                                                        border: '1px solid #bfdbfe',
                                                        borderRadius: 999, padding: '1px 6px',
                                                    }}>
                                                        {game.tag}
                                                    </span>
                                                )}
                                            </div>
                                            <p style={{
                                                fontSize: '0.73rem', color: '#64748b',
                                                margin: '3px 0 0', lineHeight: 1.4,
                                            }}>
                                                {game.subtitle}
                                            </p>
                                        </div>

                                        {/* Action */}
                                        {game.playable ? (
                                            <button
                                                onClick={() => onPlay?.(game.id)}
                                                style={{
                                                    flexShrink: 0,
                                                    background: cat.accent,
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: 999,
                                                    padding: '0.38rem 1.05rem',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    letterSpacing: '0.01em',
                                                    opacity: isHov ? 0.88 : 1,
                                                    transition: 'opacity 0.15s',
                                                }}
                                            >
                                                Play
                                            </button>
                                        ) : (
                                            <span style={{
                                                flexShrink: 0,
                                                background: '#f1f5f9',
                                                color: '#94a3b8',
                                                borderRadius: 999,
                                                padding: '0.38rem 1.05rem',
                                                fontSize: '0.78rem',
                                                fontWeight: 600,
                                            }}>
                                                Locked
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}