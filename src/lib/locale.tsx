'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { en } from '@/lib/i18n/en';
import { ko } from '@/lib/i18n/ko';

export type Locale = 'en' | 'ko';

const STORAGE_KEY = 'we-adk:locale';

const dictionaries: Record<Locale, Record<string, string>> = { en, ko };

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}>({ locale: 'en', setLocale: () => {}, t: (key) => key });

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'ko' || saved === 'en') setLocaleState(saved);
    } catch {}
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  };

  const t = (key: string, vars?: Record<string, string | number>): string => {
    let text = dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return text;
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
};
