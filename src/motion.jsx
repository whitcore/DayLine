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
        replay: () => setReveal((n) => n + 1),
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
export function NavigationHighlight({ page, collapsed, items }) {
  const ref = useRef(null),
    first = useRef(true),
    { active } = useMotion();
  useLayoutEffect(() => {
    const el = ref.current,
      nav = el.parentElement,
      target = nav.querySelector('[aria-current="page"]');
    if (!target) return;
    el.style.transition =
      first.current || !active
        ? "none"
        : `clip-path 240ms cubic-bezier(0.77,0,0.175,1)`;
    el.style.clipPath = `inset(${target.offsetTop}px 0 ${Math.max(0, nav.clientHeight - target.offsetTop - target.offsetHeight)}px 0 round 15px)`;
    first.current = false;
  }, [page, collapsed, active]);
  return (
    <span ref={ref} className="nav-highlight" aria-hidden="true">
      {items.map(([key, label, Icon]) => (
        <span key={key} className="nav-highlight-row">
          <Icon size={23} strokeWidth={1.7} />
          <span className="nav-highlight-label">{label}</span>
        </span>
      ))}
    </span>
  );
}
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
  const { active } = useMotion();
  const ref = useRef(null),
    previous = useRef(value);
  useLayoutEffect(() => {
    if (previous.current !== value && active) {
      const animation = ref.current.animate(
        [
          { opacity: 0.55, transform: "translateY(2px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 140, easing: cssEaseOut },
      );
      previous.current = value;
      return () => animation.cancel();
    }
    previous.current = value;
  }, [value, active]);
  return (
    <span
      ref={ref}
      className={"animated-number " + className}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {String(value).padStart(pad, "0")}
      {suffix}
    </span>
  );
});
export function Duration({ ms, className = "" }) {
  const mins = Math.floor(ms / 60000),
    h = Math.floor(mins / 60);
  return (
    <span
      className={"duration " + className}
      aria-label={
        h
          ? `${h} ч ${mins % 60} мин`
          : mins
            ? `${mins} мин`
            : ms > 0
              ? "Меньше минуты"
              : "0 мин"
      }
    >
      {h > 0 && (
        <>
          <Number value={h} />
          <span> ч </span>
        </>
      )}
      {ms > 0 && mins === 0 ? (
        <span>&lt; 1</span>
      ) : (
        <Number value={h ? mins % 60 : mins} pad={h ? 2 : 1} />
      )}
      <span> мин</span>
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
export function RouteStage({ route, contentKey, children }) {
  const { active, enabled, effective, visible, reveal, inputMethod } =
    useMotion();
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (!visible || !enabled || inputMethod.current === "keyboard") return;
    const el = ref.current,
      reduced = effective === "reduced";
    const animations = [];
    animations.push(
      el.animate([{ opacity: reduced ? 0.65 : 0.35 }, { opacity: 1 }], {
        duration: reduced ? 120 : 200,
        easing: cssEaseOut,
      }),
    );
    if (!reduced)
      for (const [i, panel] of [...el.querySelectorAll(".panel")].entries())
        animations.push(
          panel.animate(
            [
              { opacity: 0, transform: "translateY(14px) scale(0.99)" },
              { opacity: 1, transform: "translateY(0) scale(1)" },
            ],
            {
              duration: 220,
              delay: Math.min(i * 35, 70),
              easing: cssEaseOut,
              fill: "backwards",
            },
          ),
        );
    return () => animations.forEach((animation) => animation.cancel());
    // Input changes do not replay a page. Only navigation, showing the window,
    // an explicit preview, or a loaded date may start this entrance.
  }, [visible, reveal, route, contentKey, effective, enabled]);
  return (
    <motion.div
      ref={ref}
      className="route-stage"
      data-route={route}
      initial={false}
      exit={{
        opacity: 0,
        transform: active ? "translateY(-6px)" : "none",
        transition: { duration: active ? 0.08 : 0, ease: easeOut },
      }}
    >
      {children}
    </motion.div>
  );
}
export function Fill({ value, color, className = "" }) {
  const { active } = useMotion();
  return (
    <motion.i
      className={"animated-fill " + className}
      style={{ background: color, transformOrigin: "left" }}
      initial={active ? { scaleX: 0 } : false}
      animate={{ scaleX: Math.max(0, Math.min(1, value)) }}
      transition={{ duration: active ? 0.24 : 0, ease: easeOut }}
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
