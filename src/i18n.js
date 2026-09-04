import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import as from './locales/as.json';
import bn from './locales/bn.json';
import en from './locales/en.json';
import hi from './locales/hi.json';
import ne from './locales/ne.json';

const savedLanguage =
    typeof window !== 'undefined'
        ? localStorage.getItem('appLanguage')
        : null;

i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        hi: { translation: hi },
        as: { translation: as },
        bn: { translation: bn },
        ne: { translation: ne },
    },

    lng: savedLanguage || 'en',

    fallbackLng: 'en',

    interpolation: {
        escapeValue: false,
    },
});

if (typeof window !== 'undefined') {
    i18n.on('languageChanged', (lng) => {
        localStorage.setItem('appLanguage', lng);
    });
}

export default i18n;