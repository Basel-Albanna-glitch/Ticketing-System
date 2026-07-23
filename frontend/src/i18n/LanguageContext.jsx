import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { LANGUAGES, translations } from './translations'

export const LanguageContext = createContext(null)

function getInitialLang() {
  const stored = localStorage.getItem('lang')
  if (stored && LANGUAGES[stored]) return stored
  return 'en'
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(getInitialLang)

  const dir = LANGUAGES[lang]?.dir || 'ltr'

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
    localStorage.setItem('lang', lang)
  }, [lang, dir])

  const t = useCallback(
    (key) => translations[lang]?.[key] ?? translations.en[key] ?? key,
    [lang]
  )

  const toggleLang = useCallback(() => {
    setLang((current) => (current === 'ar' ? 'en' : 'ar'))
  }, [])

  const value = useMemo(() => ({ lang, dir, setLang, toggleLang, t }), [lang, dir, toggleLang, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
