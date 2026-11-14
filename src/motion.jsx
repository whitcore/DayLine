import { useLocale } from "./i18n.jsx";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  memo,
} from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { motionPolicy, easeOut, cssEaseOut } from "./motion-policy.js";
const Context = createContext({
  enabled: true,
  active: true,
  setEnabled: () => {},
});
export const spring = {
  type: "spring",
  stiffness: 360,
  damping: 32,
  mass: 0.8,
};
export function MotionProvider({ children }) {
  const [systemReduced, setSystemReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(query.matches);
    query.addEventListener("change", update);
    update();
    return () => query.removeEventListener("change", update);
  }, []);
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem("dayline-motion") !== "off",
  );
  const [style, setStyle] = useState(() => {
    const saved = localStorage.getItem("dayline-motion-style");
    return ["system", "full", "gentle"].includes(saved) ? saved : "system";
  });
  const [input, setInput] = useState("pointer");
  const inputMethod = useRef("pointer");
  const [visible, setVisible] = useState(!document.hidden);
  const [reveal, setReveal] = useState(0);
  const effective = motionPolicy(enabled, style, systemReduced);
  const active = effective === "on" && input === "pointer";
  const gentle = effective === "reduced";
  useEffect(() => {
    const setMethod = (method) => {
      if (inputMethod.current !== method) {
        inputMethod.current = method;
        document.documentElement.dataset.input = method;
        setInput(method);
      }
    };
    // Motion synthesizes pointerdown with an empty pointerType for Enter.
    // That must remain a keyboard action, not re-enable tap/route movement.
    const pointer = (event) => {
        if (event.pointerType) setMethod("pointer");
      },
      keyboard = () => setMethod("keyboard");
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", keyboard, true);
    let previous = null;
    const update = (value) => {
      setVisible(value);
      if (value && previous !== true) {
        // A native window reveal is a new interaction. Typing a note before
        // hiding the app must not suppress its next entrance from the tray.
        setMethod("pointer");
        setReveal((n) => n + 1);
      }
      previous = value;
    };
    const api = window.dayline;
    let alive = true;
    let eventSeen = false;
    const unsubscribe = api?.onWindowVisibility?.((value) => {
      eventSeen = true;
      update(value);
    });
    const fallback = () => update(!document.hidden);
    if (api?.windowVisible)
      api
        .windowVisible()
        .then((value) => {
          if (alive && !eventSeen) update(value);
        })
        .catch(fallback);
    else document.addEventListener("visibilitychange", fallback);
    return () => {
      alive = false;
      unsubscribe?.();
      document.removeEventListener("visibilitychange", fallback);
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("keydown", keyboard, true);
    };
  }, []);
  useEffect(() => {
    localStorage.setItem("dayline-motion", enabled ? "on" : "off");
    localStorage.setItem("dayline-motion-style", style);
    document.documentElement.dataset.motion = effective;
  }, [enabled, style, effective]);
  return (
    <Context.Provider
      value={{
        enabled,
        active,
        gentle,
        canFade: enabled && input === "pointer",
        effective,
        style,
        setStyle,
        setEnabled,
        systemReduced,
        visible,
        reveal,
        inputMethod,
      }}
    >
      <MotionConfig
        reducedMotion={active ? "never" : "always"}
        transition={
          active
            ? { duration: 0.2, ease: easeOut }
            : { duration: gentle && input === "pointer" ? 0.12 : 0 }
        }
      >
        {children}
      </MotionConfig>
    </Context.Provider>
  );
}
export const useMotion = () => useContext(Context);
export function useSidebarTransition(collapsed) {
  const ref = useRef(null),
    previous = useRef(null),
    animation = useRef(null),
    { active } = useMotion();
  useLayoutEffect(() => {
    if (previous.current === null || !ref.current) return;
    animation.current?.cancel();
    const offset = previous.current - ref.current.getBoundingClientRect().left;
    previous.current = null;
    if (active)
      animation.current = ref.current.animate(
        [
          { transform: `translateX(${offset}px)`, opacity: 0.9 },
          { transform: "translateX(0)", opacity: 1 },
        ],
        { duration: 240, easing: cssEaseOut },
      );
  }, [collapsed]);
  useEffect(() => () => animation.current?.cancel(), []);
  return [
    ref,
    () => {
      previous.current = ref.current?.getBoundingClientRect().left ?? null;
    },
  ];
}
export const Number = memo(function Number({
  value,
  pad = 1,
  suffix = "",
  className = "",
}) {
  return (
    <span
      className={"animated-number " + className}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {String(value).padStart(pad, "0")}
      {suffix}
    </span>
  );
});
export function Duration({ ms, className = "" }) {
  const { t } = useLocale();
  const mins = Math.floor(ms / 60000),
    h = Math.floor(mins / 60);
  return (
    <span
      className={"duration " + className}
      aria-label={
        h
          ? t("{0} ч {1} мин", h, mins % 60)
          : mins
            ? t("{0} мин", mins)
            : ms > 0
              ? t("Меньше минуты")
              : t("0 мин")
      }
    >
      {h > 0 && (
        <>
          <Number value={h} />
          <span>{" "}{t("ч")}{" "}</span>
        </>
      )}
      {ms > 0 && mins === 0 ? (
        <span>&lt; 1</span>
      ) : (
        <Number value={h ? mins % 60 : mins} pad={h ? 2 : 1} />
      )}
      <span>{" "}{t("мин")}</span>
    </span>
  );
}
export function Panel({ children, className = "", style, ...props }) {
  return (
    <motion.section className={"panel " + className} style={style} {...props}>
      {children}
    </motion.section>
  );
}
export function RouteStage({ route, children }) {
  const { effective, visible, reveal, canFade, inputMethod } =
    useMotion();
  const ref = useRef(null);
  const lastEntrance = useRef(null);
  useLayoutEffect(() => {
    if (!visible) return;
    const entrance = `${route}:${reveal}`;
    if (entrance === lastEntrance.current) return;
    lastEntrance.current = entrance;
    if (!canFade || inputMethod.current === "keyboard") return;
    const animation = ref.current.animate([{ opacity: 0.35 }, { opacity: 1 }], {
      duration: effective === "reduced" ? 120 : 140,
      easing: cssEaseOut,
    });
    return () => animation.cancel();
  }, [visible, reveal, route, effective, canFade, inputMethod]);
  return (
    <div
      ref={ref}
      className="route-stage"
      data-route={route}
    >
      {children}
    </div>
  );
}
export function Fill({ value, color, className = "" }) {
  return (
    <i
      className={"animated-fill " + className}
      style={{ background: color, transformOrigin: "left", transform: `scaleX(${Math.max(0, Math.min(1, value))})` }}
    />
  );
}
export function Toggle({ checked, onChange, label, disabled = false }) {
  const { active } = useMotion();
  return (
    <motion.button
      className={"toggle " + (checked ? "on" : "")}
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      whileTap={active ? { scale: 0.97 } : undefined}
    >
      <motion.span
        animate={{ x: checked ? 20 : 0 }}
        transition={
          active ? { duration: 0.18, ease: easeOut } : { duration: 0 }
        }
      >
        <AnimatePresence initial={false}>
          {checked && (
            <motion.svg
              key="check"
              viewBox="0 0 12 12"
              initial={active ? { opacity: 0, scale: 0.95 } : false}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.path
                d="m3 6 2 2 4-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={active ? { pathLength: 0 } : false}
                animate={{ pathLength: 1 }}
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.span>
    </motion.button>
  );
}
export { AnimatePresence, motion };
