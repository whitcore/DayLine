import { useEffect, useId, useRef, useState } from "react";
import {
  Coffee,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
} from "lucide-react";
import { Panel } from "./motion.jsx";
import "@fontsource-variable/inter";
import "./focus.css";

function clockText(remainingMs) {
  const seconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function phaseState(timer) {
  if (!timer) return { label: "Подключение", hint: "Загружаем таймер…" };
  if (timer.status === "paused")
    return {
      label: "На паузе",
      hint: "Время остановлено. Продолжи, когда будешь готов.",
    };
  if (timer.status === "break-ready")
    return {
      label: "Время отдохнуть",
      hint: "Работа завершена. Перерыв начнётся по нажатию.",
    };
  if (timer.status === "work-ready")
    return {
      label: "Готов к фокусу",
      hint: "Следующая сессия начнётся, когда ты будешь готов.",
    };
  if (timer.status === "running")
    return {
      label: timer.phase === "break" ? "Перерыв" : "В фокусе",
      hint:
        timer.phase === "break"
          ? "Отойди от экрана и немного разомнись."
          : "Одна задача. Таймер продолжит работать в трее.",
    };
  return {
    label: "Готов к запуску",
    hint: "",
  };
}

export default function FocusPanel({ api = window.dayline, notify }) {
  const [timer, setTimer] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const commandPending = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(false);
  const titleId = useId();

  useEffect(() => {
    mounted.current = true;
    let alive = true;
    let interval;
    let pending = false;
    let windowVisible = true;
    let visibilityEventSeen = false;
    const visible = () => !document.hidden && windowVisible;
    const refresh = async () => {
      if (!alive || !visible() || pending || commandPending.current) return;
      if (!api?.focusSnapshot) {
        setError("Таймер доступен в приложении Dayline.");
        return;
      }
      const version = generation.current;
      pending = true;
      try {
        const next = await api.focusSnapshot();
        if (alive && version === generation.current) {
          setTimer(next);
          setError("");
        }
      } catch {
        if (alive && version === generation.current)
          setError("Не удалось получить состояние таймера.");
      } finally {
        pending = false;
      }
    };
    const syncPolling = () => {
      clearInterval(interval);
      if (visible()) {
        void refresh();
        interval = setInterval(refresh, 1000);
      }
    };
    const unsubscribe = api?.onWindowVisibility?.((value) => {
      visibilityEventSeen = true;
      windowVisible = value;
      syncPolling();
    });
    document.addEventListener("visibilitychange", syncPolling);
    syncPolling();
    api
      ?.windowVisible?.()
      .then((value) => {
        if (alive && !visibilityEventSeen) {
          windowVisible = value;
          syncPolling();
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
      mounted.current = false;
      clearInterval(interval);
      unsubscribe?.();
      document.removeEventListener("visibilitychange", syncPolling);
    };
  }, [api]);

  const act = async (action) => {
    if (commandPending.current) return;
    commandPending.current = true;
    generation.current += 1;
    setBusy(true);
    try {
      const next = await api.focusAction(action);
      if (mounted.current) {
        setTimer(next);
        setError("");
      }
    } catch (cause) {
      if (mounted.current) {
        const message = cause?.message || "Не удалось изменить таймер.";
        setError(message);
        notify?.(message);
      }
    } finally {
      commandPending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const state = phaseState(timer);
  const status = timer?.status || "loading";
  const isBreak = timer?.phase === "break";
  const running = status === "running";
  const paused = status === "paused";
  const primaryAction = running
    ? "pause"
    : paused
      ? "resume"
      : status === "break-ready"
        ? "startBreak"
        : "start";
  const primaryLabel = running
    ? "Пауза"
    : paused
      ? "Продолжить"
      : status === "break-ready"
        ? "Начать перерыв"
        : "Начать фокус";
  const PrimaryIcon = running
    ? Pause
    : status === "break-ready"
      ? Coffee
      : Play;
  const canReset = timer && status !== "idle";
  const progress = timer
    ? Math.min(1, Math.max(0, 1 - timer.remainingMs / timer.totalMs))
    : 0;

  return (
    <Panel
      className="focus-panel"
      data-phase={isBreak ? "break" : "work"}
      data-status={status}
      aria-labelledby={titleId}
    >
      <div className="focus-heading">
        <h2 id={titleId}>
          Таймер фокуса
        </h2>
        <span className="focus-status" role="status" title={state.hint || undefined}>
          {status === "idle" && timer
            ? `${timer.workMinutes} мин работы · ${timer.breakMinutes} мин отдыха`
            : state.label}
        </span>
      </div>
      <div className="focus-body">
        <div className="focus-clock">
          <div
            className="focus-time"
            role="timer"
            aria-live="off"
            aria-label={
              timer
                ? `Осталось ${clockText(timer.remainingMs)}`
                : "Таймер загружается"
            }
          >
            {timer ? clockText(timer.remainingMs) : "—:—"}
          </div>
        </div>
        <div className="focus-session">
          <div className="focus-actions" aria-busy={busy}>
            <button
              type="button"
              className="focus-button focus-primary"
              disabled={!timer || busy || !api?.focusAction}
              onClick={() => act(primaryAction)}
            >
              <PrimaryIcon size={15} />
              {primaryLabel}
            </button>
            {canReset && (
              <button
                type="button"
                className="focus-button focus-secondary"
                disabled={busy}
                onClick={() =>
                  act(status === "break-ready" ? "skipBreak" : "stop")
                }
              >
                {status === "break-ready" ? (
                  <SkipForward size={14} />
                ) : (
                  <RotateCcw size={14} />
                )}
                {status === "break-ready" ? "Пропустить" : "Сбросить"}
              </button>
            )}
          </div>
        </div>
      </div>
      {status !== "idle" && status !== "loading" && (
        <div className="focus-progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
      )}
      {error && (
        <p className="focus-error" role="alert">
          {error}
        </p>
      )}
    </Panel>
  );
}

export function FocusPreferences({ settings, onChange }) {
  const workMinutes = settings.focusWorkMinutes ?? 25;
  const breakMinutes = settings.focusBreakMinutes ?? 5;
  const [work, setWork] = useState(String(workMinutes));
  const [rest, setRest] = useState(String(breakMinutes));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const descriptionId = useId();
  useEffect(() => {
    setWork(String(workMinutes));
  }, [workMinutes]);
  useEffect(() => {
    setRest(String(breakMinutes));
  }, [breakMinutes]);
  const dirty = Number(work) !== workMinutes || Number(rest) !== breakMinutes;
  const save = async (event) => {
    event.preventDefault();
    if (busy || !dirty) return;
    setBusy(true);
    setError("");
    try {
      await onChange({
        focusWorkMinutes: Number(work),
        focusBreakMinutes: Number(rest),
      });
    } catch {
      setError("Не удалось сохранить длительности. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="focus-preferences" onSubmit={save} aria-busy={busy}>
      <h3>Таймер работы и перерыва</h3>
      <p id={descriptionId}>
        Изменения применятся со следующего этапа. Работа и перерыв запускаются
        вручную.
      </p>
      <div className="focus-duration-fields">
        <label>
          <span>Работа</span>
          <span className="focus-minute-input">
            <input
              type="number"
              min="1"
              max="180"
              step="1"
              required
              value={work}
              onChange={(event) => setWork(event.target.value)}
              aria-describedby={descriptionId}
            />
            <span>мин</span>
          </span>
          <small>От 1 до 180 минут</small>
        </label>
        <label>
          <span>Перерыв</span>
          <span className="focus-minute-input">
            <input
              type="number"
              min="1"
              max="60"
              step="1"
              required
              value={rest}
              onChange={(event) => setRest(event.target.value)}
              aria-describedby={descriptionId}
            />
            <span>мин</span>
          </span>
          <small>От 1 до 60 минут</small>
        </label>
      </div>
      <button
        type="submit"
        className="focus-button focus-secondary focus-save"
        disabled={busy || !dirty}
      >
        {busy ? "Сохраняем…" : "Сохранить длительности"}
      </button>
      {error && (
        <p className="focus-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
