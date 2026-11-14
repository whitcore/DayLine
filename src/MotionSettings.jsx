import { useLocale } from "./i18n.jsx";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Play } from "lucide-react";
import { Toggle, useMotion } from "./motion.jsx";
import { cssEaseOut } from "./motion-policy.js";

const modes = [
  { value: "system", label: "По системе" },
  { value: "full", label: "Полные" },
  { value: "gentle", label: "Мягкие" },
];

export default function MotionSettings() {
  const { t } = useLocale();
  const { enabled, setEnabled, style, setStyle, effective, systemReduced } = useMotion();
  const [preview, setPreview] = useState(null);
  const example = useRef(null);
  const choose = (value) => {
    setPreview(null);
    setStyle(value);
    setEnabled(true);
  };
  const move = (event, index) => {
    let next;
    switch (event.key) {
      case "Home":
        next = 0;
        break;
      case "End":
        next = modes.length - 1;
        break;
      case "ArrowUp":
      case "ArrowLeft":
        next = (index + modes.length - 1) % modes.length;
        break;
      case "ArrowDown":
      case "ArrowRight":
        next = (index + 1) % modes.length;
        break;
      default:
        return;
    }
    event.preventDefault();
    choose(modes[next].value);
    event.currentTarget.parentElement.children[next].focus();
  };
  const description = !enabled
    ? t("Выключены")
    : style === "system"
      ? systemReduced
        ? t("Мягкие. Windows просит уменьшить движение.")
        : t("Полные. Windows разрешает движение.")
      : effective === "reduced"
        ? t("Мягкие. Только плавное появление.")
        : t("Полные. Появление, раскрытие и отклик кнопок.");

  useLayoutEffect(() => {
    if (!preview?.animate || !enabled) return;
    const frames = effective === "reduced"
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "translateY(0)" }];
    const animation = example.current.animate(frames, {
      duration: effective === "reduced" ? 120 : 160,
      easing: cssEaseOut,
    });
    return () => animation.cancel();
  }, [preview, enabled, effective]);

  useEffect(() => {
    if (!preview) return;
    const timer = setTimeout(() => setPreview(null), 2400);
    return () => clearTimeout(timer);
  }, [preview]);

  return (
    <section className="settings-group motion-settings" aria-labelledby="motion-settings-heading">
      <h2 id="motion-settings-heading">{t("Анимации")}</h2>
      <div className="setting-row">
        <strong>{t("Анимации интерфейса")}</strong>
        <Toggle
          label={t("Анимации интерфейса")}
          checked={enabled}
          onChange={() => {
            setPreview(null);
            setEnabled(!enabled);
          }}
        />
      </div>
      <div className="setting-row motion-mode-row">
        <div>
          <strong>{t("Режим")}</strong>
          <p className="motion-mode-description" role="status">{t("Сейчас:")}{" "}{description}</p>
        </div>
        <div className="motion-mode-group" role="radiogroup" aria-label={t("Режим анимаций")}>
          {modes.map(({ value, label }, index) => (
            <button
              type="button"
              role="radio"
              aria-checked={enabled && style === value}
              tabIndex={value === (enabled ? style : "system") ? 0 : -1}
              key={value}
              onClick={() => choose(value)}
              onKeyDown={(event) => move(event, index)}
            >
              {t(label)}
            </button>
          ))}
        </div>
      </div>
      <div className="settings-motion-preview">
        <button
          type="button"
          className="button"
          disabled={!enabled}
          onClick={(event) => setPreview({ animate: event.detail > 0 })}
        >
          <Play size={15} aria-hidden="true" />{t("Показать анимации")}</button>
        {preview && enabled && (
          <span className="demo-mini-card" ref={example}>
            <Check size={16} aria-hidden="true" />
            {effective === "reduced" ? t("Плавное появление") : t("Появление с движением")}
          </span>
        )}
      </div>
    </section>
  );
}
