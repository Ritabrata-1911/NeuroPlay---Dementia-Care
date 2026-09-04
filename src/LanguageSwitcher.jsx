import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
    const { i18n } = useTranslation();

    const changeLanguage = (e) => {
        i18n.changeLanguage(e.target.value);
    };

    return (
        <select
            className="language-select"
            value={i18n.language}
            onChange={changeLanguage}
        >
            <option value="en">English</option>
            <option value="hi">हिंदी (Hindi)</option>
            <option value="as">অসমীয়া (Assamese)</option>
            <option value="bn">বাংলা (Bengali)</option>
            <option value="ne">नेपाली (Nepali)</option>
        </select>
    );
};

export default LanguageSwitcher;