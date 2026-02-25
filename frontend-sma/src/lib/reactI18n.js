import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import th from '../i18n/th.json'
import en from '../i18n/en.json'

const resources = {
  th: { translation: th },
  en: { translation: en },
}

i18n.use(initReactI18next).init({
  resources,
  lng: 'th',
  fallbackLng: 'en',
  ns: ['translation'],
  defaultNS: 'translation',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
})

export default i18n
