// Language loader — supports en, hi, de, es
// To add a new language: create src/i18n/locales/<lang>.ts and add it below

import en from "./locales/en";
import hi from "./locales/hi";
import de from "./locales/de";
import es from "./locales/es";

export type Locale = "en" | "hi" | "de" | "es";
export type TextKey = keyof typeof en;

const locales: Record<Locale, typeof en> = { en, hi, de, es };

// Restore persisted locale on module load
const _saved = typeof localStorage !== "undefined"
  ? (localStorage.getItem("jl-locale") as Locale | null)
  : null;
const VALID: Locale[] = ["en", "hi", "de", "es"];

let currentLocale: Locale = VALID.includes(_saved as Locale) ? (_saved as Locale) : "en";

export const setLocale = (locale: Locale): void => {
  currentLocale = locale;
  if (typeof localStorage !== "undefined") localStorage.setItem("jl-locale", locale);
  // Notify React subscribers (populated by LocaleProvider)
  if (_reactSetLocale) _reactSetLocale(locale);
};

export const getLocale = (): Locale => currentLocale;

/** Returns the translated string for the active locale, with English fallback */
export const t = (key: string): string => {
  const map = locales[currentLocale] as Record<string, string>;
  return map[key] ?? (locales.en as Record<string, string>)[key] ?? key;
};

// Module-level reference to the React state setter — set by LocaleProvider on mount
let _reactSetLocale: ((l: Locale) => void) | null = null;
export const _registerReactSetter = (setter: (l: Locale) => void): void => {
  _reactSetLocale = setter;
};

export default en;
