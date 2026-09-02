import React, { useState, useEffect } from 'react';

const CodeCountdown = ({ expiresAt }) => {
    // Fallback translation helper if you don't use i18next:
    const t = (key, params) => {
        if (key === 'code_expired') return 'Code Expired';
        if (key === 'expires_in') return `Expires in ${params?.time || ''}`;
        return key;
    };

    const [timeLeft, setTimeLeft] = useState('');
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        let timer = null;

        const calculateTime = () => {
            const diff = new Date(expiresAt) - new Date();
            if (diff <= 0) return null;

            const m = Math.floor((diff / 1000 / 60) % 60);
            const s = Math.floor((diff / 1000) % 60);
            return `${m}m ${s < 10 ? '0' : ''}${s}s`;
        };

        const tick = () => {
            const result = calculateTime();
            if (result === null) {
                setIsExpired(true);
                if (timer) clearInterval(timer);
            } else {
                setTimeLeft(result);
            }
        };

        // Single-evaluation initialization
        const initial = calculateTime();
        
        if (initial === null) {
            setIsExpired(true);
        } else {
            setIsExpired(false);
            setTimeLeft(initial);
            timer = setInterval(tick, 1000);
        }

        return () => {
            if (timer) clearInterval(timer);
        };
    }, [expiresAt]);

    if (isExpired) {
        return (
            <span style={{ color: '#d32f2f', fontSize: '0.85rem', fontWeight: 'bold', marginLeft: '8px' }}>
                {t('code_expired')}
            </span>
        );
    }

    return (
        <span style={{ color: '#f57c00', fontSize: '0.85rem', marginLeft: '8px' }}>
            {t('expires_in', { time: timeLeft })}
        </span>
    );
};

export default CodeCountdown;