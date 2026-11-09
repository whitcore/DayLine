import { useEffect, useRef, useState } from "react";
import {
  Angry,
  Frown,
  Meh,
  Smile,
  Laugh,
  NotebookPen,
  Check,
  ChevronDown,
  CalendarDays,
  ChevronRight,
} from "lucide-react";
import { AnimatePresence, motion, Panel, useMotion } from "./motion.jsx";
import { pretty } from "./shared.js";
export const moods = [
  { Icon: Angry, label: "Тяжело", color: "var(--pink)" },
  { Icon: Frown, label: "Не очень", color: "var(--orange)" },
  { Icon: Meh, label: "Обычно", color: "var(--yellow)" },
  { Icon: Smile, label: "Хорошо", color: "var(--lime)" },
  { Icon: Laugh, label: "Отлично", color: "var(--green)" },
];
export function MoodPicker({ value, onChange }) {
  const { active } = useMotion();
  return (
    <div className="mood-picker" role="group" aria-label="Настроение дня">
      {moods.map(({ Icon, label, color }, i) => (
        <motion.button
          key={label}
          aria-label={label}
          aria-pressed={value === i + 1}
          className={value === i + 1 ? "selected" : ""}
          style={{ "--mood": color }}
          onClick={() => onChange(value === i + 1 ? null : i + 1)}
          whileHover={
            active && matchMedia("(hover:hover) and (pointer:fine)").matches
              ? { y: -2 }
              : undefined
          }
          whileTap={active ? { scale: 0.97 } : undefined}
        >
          {value === i + 1 && (
            <motion.span
              className="mood-active"
              transition={
                active
                  ? { type: "spring", stiffness: 400, damping: 28 }
                  : { duration: 0 }
              }
            />
          )}
          <motion.span
            className="mood-face"
            animate={
              active && value === i + 1
                ? { rotate: [0, -6, 4, 0], scale: [1, 1.08, 1] }
                : { rotate: 0, scale: 1 }
            }
            transition={{ duration: active ? 0.25 : 0 }}
          >
            <Icon size={29} strokeWidth={1.8} />
          </motion.span>
          <span className="mood-label">{label}</span>
          {value === i + 1 && (
            <motion.i
              className="mood-check"
              initial={active ? { scale: 0.95 } : false}
              animate={{ scale: 1 }}
            >
              <Check size={9} />
            </motion.i>
          )}
        </motion.button>
      ))}
    </div>
  );
}
export function JournalEditor({ date, entry, onSave, compact = false }) {
  const { active } = useMotion();
  const [draft, setDraft] = useState(entry),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState(""),
    [expanded, setExpanded] = useState(
      !compact || !!(entry.note || entry.done),
    );
  const draftRef = useRef(draft),
    dirtyRef = useRef(false),
    revision = useRef(0);
  useEffect(() => {
    if (!dirtyRef.current) setDraft(entry);
  }, [entry?.updatedAt]);
  useEffect(() => {
    draftRef.current = draft;
    dirtyRef.current = dirty;
  }, [draft, dirty]);
  useEffect(
    () => () => {
      if (dirtyRef.current)
        window.dayline.entry(date, draftRef.current).catch(() => {});
    },
    [date],
  );
  const update = (key, value) => {
    revision.current++;
    setDraft((p) => ({ ...p, [key]: value }));
    setDirty(true);
    setSaved(false);
  };
  const save = async () => {
    const currentRevision = revision.current;
    setSaving(true);
    setError("");
    try {
      await onSave(date, draft);
      if (revision.current === currentRevision) {
        setDirty(false);
        dirtyRef.current = false;
        setSaved(true);
      }
    } catch {
      setError("Не удалось сохранить. Попробуй ещё раз.");
    } finally {
      setSaving(false);
    }
  };
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(save, 1200);
    return () => clearTimeout(timer);
  }, [draft, dirty, date]);
  return (
    <Panel className={"journal-editor " + (compact ? "compact" : "")}>
      <div className="section-heading">
        <div>
          <h2>
            <span className="heading-icon lime">
              <Smile />
            </span>
            {compact ? "Как прошёл день?" : "Несколько слов о дне"}
          </h2>
          <p>Маленькая пауза для себя</p>
        </div>
        {compact && (
          <motion.button
            className="icon-button editor-expand"
            aria-label={expanded ? "Свернуть заметку" : "Добавить заметку"}
            aria-expanded={expanded}
            onClick={() => setExpanded((p) => !p)}
            whileTap={active ? { scale: 0.97 } : undefined}
          >
            <NotebookPen size={21} />
          </motion.button>
        )}
      </div>
      <MoodPicker value={draft.mood} onChange={(v) => update("mood", v)} />
      {compact && !expanded && (
        <button
          className="text-button note-link"
          onClick={() => setExpanded(true)}
        >
          <NotebookPen size={14} /> Добавить заметку <ChevronDown size={13} />
        </button>
      )}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="editor-fields"
            className="editor-fields"
            initial={active ? { opacity: 0, height: 0 } : false}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              duration: active ? 0.22 : 0,
              ease: [0.23, 1, 0.32, 1],
            }}
          >
            <label className="field">
              <span>Что получилось сделать</span>
              <textarea
                rows={compact ? 2 : 3}
                maxLength={20000}
                placeholder="Даже небольшое дело считается"
                value={draft.done}
                onChange={(e) => update("done", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Мысли и заметки</span>
              <textarea
                rows={compact ? 2 : 5}
                maxLength={20000}
                placeholder="Что запомнилось? Как ты себя чувствуешь?"
                value={draft.note}
                onChange={(e) => update("note", e.target.value)}
              />
            </label>
          </motion.div>
        )}
      </AnimatePresence>
      {(expanded || dirty || saved) && (
        <div className="editor-footer">
          <span className={error ? "error-text" : "muted"} aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={
                  error ||
                  (saving
                    ? "saving"
                    : saved
                      ? "saved"
                      : dirty
                        ? "dirty"
                        : "private")
                }
                initial={active ? { opacity: 0, y: 4 } : false}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: active ? 0.15 : 0 }}
              >
                {error ||
                  (saving
                    ? "Сохраняю…"
                    : saved
                      ? "Запись сохранена"
                      : dirty
                        ? "Есть изменения"
                        : "Только для тебя")}
              </motion.span>
            </AnimatePresence>
          </span>
          {expanded && (
            <motion.button
              className="button primary"
              onClick={save}
              disabled={saving || !dirty}
              whileHover={
                active && matchMedia("(hover:hover) and (pointer:fine)").matches
                  ? { y: -2 }
                  : undefined
              }
              whileTap={active ? { scale: 0.96 } : undefined}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={saved ? "check" : "edit"}
                  initial={active ? { scale: 0.95, opacity: 0 } : false}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ duration: active ? 0.15 : 0 }}
                >
                  {saved ? <Check size={16} /> : <NotebookPen size={16} />}
                </motion.span>
              </AnimatePresence>
              {saving ? "Сохраняю…" : saved ? "Сохранено" : "Сохранить"}
            </motion.button>
          )}
        </div>
      )}
    </Panel>
  );
}
export default function Journal({ data, onDate, onSave }) {
  const { active } = useMotion();
  const entries = Object.entries(data.entries)
    .filter(([, e]) => e.mood || e.note || e.done)
    .sort(([a], [b]) => b.localeCompare(a));
  return (
    <div className="journal-layout">
      <JournalEditor
        key={data.date}
        date={data.date}
        entry={data.entry}
        onSave={onSave}
      />
      <Panel className="journal-history">
        <div className="section-heading">
          <h2>
            <span className="heading-icon pink">
              <CalendarDays />
            </span>
            Предыдущие дни
          </h2>
        </div>
        {entries.length ? (
          <div className="history-scroll scroll-fade">
            {entries.map(([date, e]) => {
              const mood = moods[(e.mood || 3) - 1],
                Icon = mood.Icon;
              return (
                <motion.button
                  layout="position"
                  key={date}
                  onClick={() => onDate(date)}
                  className={
                    "journal-history-row " +
                    (date === data.date ? "active" : "")
                  }
                  whileHover={
                    active &&
                    matchMedia("(hover:hover) and (pointer:fine)").matches
                      ? { x: 4 }
                      : undefined
                  }
                >
                  <span className="history-mood" style={{ color: mood.color }}>
                    <Icon size={23} />
                  </span>
                  <span>
                    <strong>{pretty(date)}</strong>
                    <small>{e.done || e.note || mood.label}</small>
                  </span>
                  <ChevronRight size={15} />
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <NotebookPen size={32} />
            <h3>Первая страница — сегодня</h3>
            <p>Сохрани настроение или заметку. Здесь будет твоя история.</p>
          </div>
        )}
      </Panel>
    </div>
  );
}
