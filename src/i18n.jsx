import { createContext, useContext, useLayoutEffect, useMemo, useState } from "react";
import english from "../desktop/messages.en.json";
import { pretty, time } from "./shared.js";

const LocaleContext = createContext(null);
const formatLocale = { ru: "ru-RU", en: "en-US" };

export function LocaleProvider({ initialLanguage, children }) {
  const [language, setLanguage] = useState(initialLanguage === "en" ? "en" : "ru");
  const [changing, setChanging] = useState(false);

  useLayoutEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => {
    const locale = formatLocale[language];
    const t = (key, ...values) => {
      const message = language === "en" && Object.hasOwn(english, key) ? english[key] : key;
      return values.length ? message.replace(/\{(\d+)\}/g, (placeholder, index) => values[index] ?? placeholder) : message;
    };
    return {
      language,
      locale,
      t,
      changing,
      errorText: (error, fallback) => {
        const message = error?.message?.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "");
        return message && Object.hasOwn(english, message) ? t(message) : t(fallback);
      },
      pretty: (date, options) => pretty(date, options, locale),
      time: (ms) => time(ms, t),
      selectLanguage: async (next) => {
        if (!Object.hasOwn(formatLocale, next) || next === language || changing) return;
        setChanging(true);
        try {
          await window.dayline?.locale?.(next);
          setLanguage(next);
        } finally {
          setChanging(false);
        }
      },
    };
  }, [language, changing]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);
