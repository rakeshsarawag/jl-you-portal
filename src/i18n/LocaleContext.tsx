import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { type Locale, getLocale, setLocale as i18nSetLocale, _registerReactSetter } from "./index";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: i18nSetLocale,
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getLocale);

  // Register the state setter so the module-level setLocale() also triggers React re-renders
  useEffect(() => {
    _registerReactSetter(setLocaleState);
    return () => { _registerReactSetter(() => {}); };
  }, []);

  const handleSetLocale = useCallback((l: Locale) => {
    i18nSetLocale(l);
    setLocaleState(l);
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale: handleSetLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

/** Returns the current locale and a setter that triggers full re-renders */
export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
