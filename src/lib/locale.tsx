'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { en } from '@/lib/i18n/en';
import { ko } from '@/lib/i18n/ko';
import { STORE_CHANGED_EVENT, workspaceStore } from '@/lib/api/workspace-store';

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

  /*
   * Re-read whenever the store changes, not only on mount.
   *
   * This provider sits outside `WorkspaceProvider` — it wraps the shell that mounts it —
   * so on the first pass the store has not been filled yet and the stored language reads
   * as absent. Mounting alone would therefore leave a Korean user on English until they
   * chose it again. The store announces its hydrate, and that is what this listens for.
   */
  useEffect(() => {
    const read = () => {
      try {
        const saved = workspaceStore.getItem(STORAGE_KEY);
        if (saved === 'ko' || saved === 'en') setLocaleState(saved);
      } catch {}
    };
    read();
    window.addEventListener(STORE_CHANGED_EVENT, read);
    return () => window.removeEventListener(STORE_CHANGED_EVENT, read);
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    try {
      workspaceStore.setItem(STORAGE_KEY, next);
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
    <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
};
