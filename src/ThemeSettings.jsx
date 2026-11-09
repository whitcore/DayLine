import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { Check, Palette } from "lucide-react";
import { Panel } from "./motion.jsx";

export const themes = [
  { id: "dark", label: "Яркая тёмная", scheme: "dark" },
  { id: "light", label: "Яркая светлая", scheme: "light" },
  { id: "soft-dark", label: "Мягкая тёмная", scheme: "dark" },
  { id: "soft-light", label: "Мягкая светлая", scheme: "light" },
];

const ThemeContext = createContext(null);
const isTheme = (value) => themes.some(({ id }) => id === value);

function savedTheme() {
  try {
    const saved = localStorage.getItem("dayline-theme");
    return isTheme(saved) ? saved : "dark";
  } catch {
    return "dark";
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
  const groupId = useId();
  return (
    <Panel className="theme-settings">
      <div className="section-heading">
        <h2 id={`${groupId}-heading`}>
          <span className="heading-icon cyan">
            <Palette />
          </span>
          Оформление
        </h2>
      </div>
      <p className="theme-description">Выбери палитру, в которой комфортно работать.</p>
      <div className="theme-options" role="radiogroup" aria-labelledby={`${groupId}-heading`}>
        {themes.map(({ id, label }) => (
          <label className="theme-choice" key={id} data-selected={theme === id}>
            <input
              type="radio"
              name={`${groupId}-theme`}
              value={id}
              checked={theme === id}
              onChange={() => setTheme(id)}
            />
            <span className="theme-preview" data-preview-theme={id} aria-hidden="true">
              <span className="theme-preview-sidebar">
                <i />
                <i />
                <i />
              </span>
              <span className="theme-preview-content">
                <span className="theme-preview-title" />
                <span className="theme-preview-card">
                  <i />
                  <i />
                  <i />
                </span>
              </span>
            </span>
            <span className="theme-choice-label">
              {label}
              <span className="theme-choice-check" aria-hidden="true">
                {theme === id && <Check size={12} strokeWidth={2.2} />}
              </span>
            </span>
          </label>
        ))}
      </div>
    </Panel>
  );
}
