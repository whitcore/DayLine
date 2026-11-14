import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { ChoiceSelect } from "./DatePicker.jsx";

export const themes = [
  { id: "graphite", label: "Графит", scheme: "dark" },
  { id: "dark", label: "Яркая тёмная", scheme: "dark" },
  { id: "light", label: "Яркая светлая", scheme: "light" },
  { id: "soft-dark", label: "Мягкая тёмная", scheme: "dark" },
  { id: "soft-light", label: "Мягкая светлая", scheme: "light" },
];

const ThemeContext = createContext(null);
const isTheme = (value) => themes.some(({ id }) => id === value);
const themeOptions = themes.map(({ id, label }) => ({ value: id, label }));

function savedTheme() {
  try {
    const saved = localStorage.getItem("dayline-theme");
    return isTheme(saved) ? saved : "graphite";
  } catch {
    return "graphite";
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(savedTheme);

  useLayoutEffect(() => {
    const selected = themes.find(({ id }) => id === theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = selected.scheme;
    try {
      localStorage.setItem("dayline-theme", theme);
    } catch {
      // Themes still work when the browser cannot persist preferences.
    }
  }, [theme]);

  useEffect(() => {
    window.dayline?.theme?.(theme)?.catch?.(() => {});
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: (next) => {
        if (isTheme(next)) setTheme(next);
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

export default function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  return (
    <section className="settings-group theme-settings" aria-labelledby="theme-settings-heading">
      <h2 id="theme-settings-heading">Внешний вид</h2>
      <div className="setting-row">
        <strong>Тема</strong>
        <ChoiceSelect label="Тема" value={theme} options={themeOptions} onChange={setTheme} />
      </div>
    </section>
  );
}
