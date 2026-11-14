import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Angry, Check, Frown, Laugh, Meh, Smile, X } from "lucide-react";
import DatePicker from "./DatePicker.jsx";
import { motion, useMotion } from "./motion.jsx";
import { pretty } from "./shared.js";
import "./journal.css";

export const moods = [
  { Icon: Angry, label: "Тяжело", color: "var(--pink)" },
  { Icon: Frown, label: "Не очень", color: "var(--orange)" },
  { Icon: Meh, label: "Обычно", color: "var(--yellow)" },
  { Icon: Smile, label: "Хорошо", color: "var(--lime)" },
  { Icon: Laugh, label: "Отлично", color: "var(--green)" },
];

const drafts = new Map();
const listeners = new Set();
const writes = new Map();

function setDraft(date, draft) {
  if (draft) drafts.set(date, draft);
  else drafts.delete(date);
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function sameEntry(a, b) {
  return a.mood === b.mood && a.done === b.done && a.note === b.note;
}

function saveDraft(date, onSave) {
  const draft = drafts.get(date);
  if (!draft || draft.status === "saving" || draft.status === "saved") return;

  const saving = { ...draft, status: "saving" };
  setDraft(date, saving);
  const previous = writes.get(date);
  const write = Promise.resolve(previous).then(async () => {
    if (drafts.get(date) !== saving) return;
    try {
      await onSave(date, saving.entry);
      // Keep the latest text available through remounts until the matching
      // snapshot arrives. A stale snapshot can still be on screen at this point.
      if (drafts.get(date) === saving) setDraft(date, { ...saving, status: "saved" });
    } catch {
      if (drafts.get(date) === saving) setDraft(date, { ...saving, status: "error" });
    }
  });
  writes.set(date, write);
  write.then(() => {
    if (writes.get(date) === write) writes.delete(date);
  });
}

export function MoodPicker({ value, onChange }) {
  return (
    <div className="mood-picker" role="group" aria-label="Настроение дня">
      {moods.map(({ Icon, label }, index) => (
        <button
          type="button"
          key={label}
          aria-label={label}
          aria-pressed={value === index + 1}
          title={label}
          onClick={() => onChange(value === index + 1 ? null : index + 1)}
        >
          <Icon strokeWidth={1.65} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function JournalEditor({
  date,
  entry,
  onSave,
  compact = false,
  openRequest = 0,
  onExpandedChange,
  id,
}) {
  const { active, canFade } = useMotion();
  const currentDraft = useSyncExternalStore(subscribe, () => drafts.get(date));
  const [expanded, setExpanded] = useState(!compact);
  const [handledRequest, setHandledRequest] = useState(openRequest);
  const firstField = useRef(null);
  const opener = useRef(null);
  const save = useRef(onSave);
  save.current = onSave;
  const flush = useCallback(() => saveDraft(date, save.current), [date]);

  useLayoutEffect(() => flush, [flush]);

  useEffect(() => {
    if (currentDraft?.status === "saved" && sameEntry(currentDraft.entry, entry))
      setDraft(date, null);
  }, [date, entry, currentDraft]);

  useEffect(() => {
    if (currentDraft?.status !== "dirty") return;
    const timer = setTimeout(flush, 1200);
    return () => clearTimeout(timer);
  }, [currentDraft, flush]);

  const requested = compact && handledRequest !== openRequest;
  const editorVisible = expanded || requested;

  useLayoutEffect(() => {
    if (!requested) return;
    if (!expanded) opener.current = document.activeElement;
    firstField.current?.focus();
    setExpanded(true);
    setHandledRequest(openRequest);
  }, [expanded, openRequest, requested]);

  useEffect(() => {
    onExpandedChange?.(editorVisible);
  }, [editorVisible, onExpandedChange]);

  if (!editorVisible) return null;
  const draft = currentDraft?.entry ?? entry;
  const dirty = currentDraft?.status === "dirty" || currentDraft?.status === "error";
  const saving = currentDraft?.status === "saving";
  const saved = currentDraft?.status === "saved"
    || (!currentDraft && Boolean(entry.updatedAt || entry.done || entry.note || entry.mood));
  const error = currentDraft?.status === "error" ? "Не удалось сохранить. Попробуй ещё раз." : "";
  const update = (key, value) => {
    const latest = drafts.get(date)?.entry ?? entry;
    setDraft(date, { entry: { ...latest, [key]: value }, status: "dirty" });
  };

  return (
    <motion.section
      id={id}
      className={compact ? "journal-editor compact" : "journal-editor"}
      initial={compact && canFade ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: active ? 0.14 : canFade ? 0.12 : 0 }}
    >
      <div className="journal-editor-title">
        <h2>{compact ? "Запись дня" : pretty(date)}</h2>
        {compact && (
          <button
            type="button"
            className="icon-button editor-expand"
            aria-label="Свернуть заметку"
            onClick={() => {
              setExpanded(false);
              opener.current?.focus();
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      <h3 className="journal-mood-title">Настроение</h3>
      <MoodPicker value={draft.mood} onChange={(value) => update("mood", value)} />
      <div className="editor-fields">
        <label className="field">
          <span>Что получилось сделать</span>
          <textarea
            ref={firstField}
            rows={compact ? 2 : 3}
            maxLength={20000}
            value={draft.done}
            onChange={(event) => update("done", event.target.value)}
          />
        </label>
        <label className="field">
          <span>Мысли и заметки</span>
          <textarea
            rows={compact ? 2 : 6}
            maxLength={20000}
            value={draft.note}
            onChange={(event) => update("note", event.target.value)}
          />
        </label>
      </div>
      <div className="editor-footer">
        <span className={error ? "error-text" : "journal-save-status"} aria-live="polite">
          {saved && <Check size={16} aria-hidden="true" />}
          {error || (saving ? "Сохраняю…" : saved ? "Запись сохранена" : dirty ? "Есть изменения" : "")}
        </span>
        <button type="button" className="button primary" onClick={flush} disabled={!dirty}>
          {saving ? "Сохраняю…" : saved ? "Сохранено" : "Сохранить"}
        </button>
      </div>
    </motion.section>
  );
}

export default function Journal({ data, onDate, onSave, navigationDate = data.date }) {
  const { date, entries, today } = data;
  const history = useMemo(() => {
    const month = date.slice(0, 7);
    const days = new Set(
      Object.keys(entries).filter((day) => {
        const { mood, done, note } = entries[day];
        return day.startsWith(month) && (mood || done || note);
      }),
    );
    days.add(date);
    if (today.startsWith(month)) days.add(today);
    return [...days].sort().reverse();
  }, [date, entries, today]);

  return (
    <div className="journal-layout">
      <section className="journal-history" aria-label="Даты дневника">
        <DatePicker monthNavigation value={date} navigationValue={navigationDate} onChange={onDate} max={today} />
        <div className="history-scroll">
          {history.map((day) => {
            const mood = moods[entries[day]?.mood - 1];
            const Icon = mood?.Icon;
            const selected = day === date;
            return (
              <button
                type="button"
                key={day}
                aria-current={selected ? "date" : undefined}
                className="journal-history-row"
                onClick={() => onDate(day)}
              >
                <span>{pretty(day)}</span>
                {Icon && <Icon size={20} strokeWidth={1.7} role="img" aria-label={mood.label} />}
              </button>
            );
          })}
        </div>
      </section>
      <JournalEditor key={date} date={date} entry={data.entry} onSave={onSave} />
    </div>
  );
}
