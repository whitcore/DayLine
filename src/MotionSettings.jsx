import { Play, Sparkles, Check, Layers3 } from "lucide-react";
import { Panel, Toggle, useMotion, motion } from "./motion.jsx";
import { easeOut } from "./motion-policy.js";
export default function MotionSettings() {
  const {
    enabled,
    setEnabled,
    active,
    canFade,
    style,
    setStyle,
    effective,
    systemReduced,
    replay,
    reveal,
  } = useMotion();
  const choose = (value) => {
    setStyle(value);
    setEnabled(true);
  };
  return (
    <Panel className="motion-settings">
      <div className="section-heading">
        <h2>
          <span className="heading-icon violet">
            <Sparkles />
          </span>
          Движение и отклик
        </h2>
      </div>
      <div className="setting-row">
        <div>
          <strong>Анимации интерфейса</strong>
          <p>Карточки, меню и короткий отклик на нажатие.</p>
        </div>
        <Toggle
          label="Анимации интерфейса"
          checked={enabled}
          onChange={() => setEnabled(!enabled)}
        />
      </div>
      <div
        className="motion-mode-group"
        role="radiogroup"
        aria-label="Режим анимаций"
      >
        {[
          ["system", "По системе"],
          ["full", "Полные"],
          ["gentle", "Мягкие"],
        ].map(([value, label]) => (
          <button
            role="radio"
            aria-checked={enabled && style === value}
            aria-label={label}
            tabIndex={
              enabled ? (style === value ? 0 : -1) : value === "system" ? 0 : -1
            }
            key={value}
            onClick={() => choose(value)}
            onKeyDown={(event) => {
              if (
                ![
                  "ArrowRight",
                  "ArrowLeft",
                  "ArrowDown",
                  "ArrowUp",
                  "Home",
                  "End",
                ].includes(event.key)
              )
                return;
              event.preventDefault();
              const values = ["system", "full", "gentle"];
              const index =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? 2
                    : (values.indexOf(value) +
                        (["ArrowRight", "ArrowDown"].includes(event.key)
                          ? 1
                          : 2)) %
                      3;
              choose(values[index]);
              event.currentTarget.parentElement
                .querySelectorAll("[role=radio]")
                [index].focus();
            }}
          >
            <span>{label}</span>
            <small>
              {value === "system"
                ? "Следует настройке Windows"
                : value === "full"
                  ? "Карточки, меню и отклик кнопок"
                  : "Только плавное появление"}
            </small>
          </button>
        ))}
      </div>
      <p className="motion-mode-description" role="status">
        {!enabled
          ? "Анимации выключены. Включи их, чтобы посмотреть пример."
          : effective === "reduced"
            ? style === "system" && systemReduced
              ? "Windows просит уменьшить движение → сейчас мягкие появления."
              : "Всегда только плавное появление. Без перемещений и увеличения."
            : style === "system"
              ? "Windows разрешает движение → сейчас полные анимации."
              : "Перемещения карточек, раскрытие меню и отклик кнопок."}
      </p>
      <p className="motion-system-note">
        «По системе» выбирает эффекты автоматически. «Мягкие» всегда уменьшает движение, независимо от Windows.
      </p>
      <div className="motion-demo" data-active={enabled}>
        <div className="demo-grid" />
        <motion.div
          className="demo-mini-card"
          key={reveal}
          initial={canFade ? { opacity: 0, y: active ? 10 : 0, scale: active ? 0.97 : 1 } : false}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: canFade ? (active ? 0.25 : 0.16) : 0, ease: easeOut }}
        >
          <div className="demo-card-title">
            <span>
              <Layers3 size={15} />
              Твой ритм
            </span>
            <motion.i
              initial={canFade ? { opacity: 0, scale: active ? 0.95 : 1 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: canFade ? 0.16 : 0,
                delay: active ? 0.06 : 0,
              }}
            >
              <Check size={12} />
            </motion.i>
          </div>
          {[
            ["Фокус", "var(--lime)", 0.86],
            ["Баланс", "var(--cyan)", 0.65],
            ["Отдых", "var(--pink)", 0.42],
          ].map(([label, color, width], i) => (
            <div className="demo-bar" key={label}>
              <span>{label}</span>
              <div>
                <motion.i
                  style={{ background: color, transformOrigin: "left" }}
                  initial={active ? { scaleX: 0.15 } : false}
                  animate={{ scaleX: width }}
                  transition={{
                    duration: active ? 0.22 : 0,
                    delay: active ? i * 0.035 : 0,
                    ease: easeOut,
                  }}
                />
              </div>
            </div>
          ))}
        </motion.div>
      </div>
      <div className="motion-demo-footer">
        <span>
          {effective === "off"
            ? "Выключены"
            : effective === "reduced"
              ? "Мягкий режим"
              : "Полные анимации"}
        </span>
        <button className="quiet-button" disabled={!enabled} onClick={replay}>
          <Play size={13} />
          Показать анимации
        </button>
      </div>
    </Panel>
  );
}
