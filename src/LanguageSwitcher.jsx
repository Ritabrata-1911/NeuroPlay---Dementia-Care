import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

const languages = [
    { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
    { code: 'hi', label: 'Hindi', native: 'हिंदी', flag: '🇮🇳' },
    { code: 'as', label: 'Assamese', native: 'অসমীয়া', flag: '🇮🇳' },
    { code: 'bn', label: 'Bengali', native: 'বাংলা', flag: '🇮🇳' },
    { code: 'ne', label: 'Nepali', native: 'नेपाली', flag: '🇮🇳' },
];

const LanguageSwitcher = () => {
    const { i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const [animOut, setAnimOut] = useState(false);
    const [prevLabel, setPrevLabel] = useState(null);
    const wrapperRef = useRef(null);

    const current = languages.find(l => l.code === i18n.language) || languages[0];

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const select = (lang) => {
        if (lang.code === current.code) { setOpen(false); return; }
        setPrevLabel(current.label);
        setAnimOut(true);
        setOpen(false);
        setTimeout(() => {
            i18n.changeLanguage(lang.code);
            setAnimOut(false);
            setPrevLabel(null);
        }, 300);
    };

    return (
        <div className="ls-wrap" ref={wrapperRef}>

            {/* ── Pill trigger ── */}
            <button
                className={`ls-trigger ${open ? 'ls-open' : ''}`}
                onClick={() => setOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className="ls-label-clip">
                    <span className={`ls-label-text ${animOut ? 'ls-exit' : 'ls-enter'}`}>
                        {animOut ? prevLabel : current.label}
                    </span>
                </span>

                <svg className="ls-caret" viewBox="0 0 12 12" fill="none">
                    <path d="M2 4.5l4 4 4-4" stroke="currentColor" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {/* ── Dropdown ── */}
            {open && (
                <div className="ls-dropdown" role="listbox">
                    <p className="ls-dropdown-label">Choose language</p>
                    {languages.map((lang, i) => {
                        const isActive = lang.code === current.code;
                        return (
                            <button
                                key={lang.code}
                                className={`ls-option ${isActive ? 'ls-option-active' : ''}`}
                                style={{ animationDelay: `${i * 35}ms` }}
                                role="option"
                                aria-selected={isActive}
                                onClick={() => select(lang)}
                            >
                                <span className="ls-opt-text">
                                    <span className="ls-opt-en">{lang.label}</span>
                                    <span className="ls-opt-native">{lang.native}</span>
                                </span>
                                {isActive && (
                                    <svg className="ls-tick" viewBox="0 0 14 14" fill="none">
                                        <path d="M2.5 7l3.5 3.5 5.5-6"
                                            stroke="currentColor" strokeWidth="2"
                                            strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default LanguageSwitcher;