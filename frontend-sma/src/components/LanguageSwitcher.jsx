import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher({ className }) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language || 'th';

  const setLang = (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('lang', lang);
  };

  React.useEffect(() => {
    const savedLang = localStorage.getItem('lang');
    if (savedLang && savedLang !== i18n.language) {
      i18n.changeLanguage(savedLang);
    }
  }, [i18n]);

  return (
    <div
      className={
        className ||
        'flex items-center justify-end h-full min-w-[80px] pr-2'
      }
      style={{ minWidth: 80 }}
    >
      <div className="inline-flex rounded-full border border-gray-300 bg-white overflow-hidden shadow-sm">
        <button
          type="button"
          className={`px-3 py-1 text-xs font-semibold transition-colors duration-150 ${currentLang === 'th' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          onClick={() => setLang('th')}
          aria-pressed={currentLang === 'th'}
        >
          TH
        </button>
        <button
          type="button"
          className={`px-3 py-1 text-xs font-semibold transition-colors duration-150 ${currentLang === 'en' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          onClick={() => setLang('en')}
          aria-pressed={currentLang === 'en'}
        >
          EN
        </button>
      </div>
    </div>
  );
}
