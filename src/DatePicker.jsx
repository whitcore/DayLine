import { useId, useLayoutEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  CalendarDays,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useMotion } from "./motion.jsx";
import "./controls.css";

const WEEKDAYS = [
  ["Пн", "Понедельник"],
  ["Вт", "Вторник"],
  ["Ср", "Среда"],
  ["Чт", "Четверг"],
  ["Пт", "Пятница"],
  ["Сб", "Суббота"],
  ["Вс", "Воскресенье"],
];
const MIN_DATE = "0001-01-01";
const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const monthFormat = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
  year: "numeric",
});
const shortDateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
});
const fullDateFormat = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

// Noon keeps calendar arithmetic in the local day, including across DST changes.
function dateKey(date) {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function parseDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < MIN_DATE
  )
    return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && dateKey(date) === value
    ? date
    : null;
}
function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}
function monthStart(date) {
  const next = new Date(date);
  next.setDate(1);
  return next;
}
function addMonths(date, amount) {
  const next = monthStart(date);
  next.setMonth(next.getMonth() + amount);
  const last = new Date(next);
  last.setMonth(last.getMonth() + 1, 0);
  next.setDate(Math.min(date.getDate(), last.getDate()));
  return next;
}
function clampDate(date, max) {
  return parseDate(
    dateKey(date) < MIN_DATE
      ? MIN_DATE
      : dateKey(date) > max
        ? max
        : dateKey(date),
  );
}
function calendarWeeks(month) {
  const first = monthStart(month);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day)),
  );
}
function motionMode({ active, canFade }, keyboardOpen) {
  return keyboardOpen ? "none" : active ? "full" : canFade ? "fade" : "none";
}

export default function DatePicker({ value, onChange, max }) {
  const today = dateKey(new Date());
  const limit = parseDate(max) ? (max < today ? max : today) : today;
  const selected = clampDate(parseDate(value) || parseDate(today), limit);
  const selectedKey = dateKey(selected);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => monthStart(selected));
  const [focused, setFocused] = useState(selectedKey);
  const days = useRef(new Map());
  const focusRequested = useRef(false);
  const keyboardOpen = useRef(false);
  const id = useId();
  const motion = useMotion();

  useLayoutEffect(() => {
    if (open && focusRequested.current) {
      focusRequested.current = false;
      days.current.get(focused)?.focus();
    }
  }, [open, focused, month]);

  const openCalendar = (next) => {
    if (next) {
      setMonth(monthStart(selected));
      setFocused(selectedKey);
    }
    setOpen(next);
  };
  const choose = (date) => {
    const key = dateKey(date);
    if (key < MIN_DATE || key > limit) return;
    if (key !== value) onChange(key);
    setOpen(false);
  };
  const focusDate = (date) => {
    const next = clampDate(date, limit);
    const key = dateKey(next);
    focusRequested.current = true;
    setFocused(key);
    setMonth(monthStart(next));
  };
  const changeMonth = (amount) => {
    const next = clampDate(addMonths(parseDate(focused), amount), limit);
    setMonth(monthStart(next));
    setFocused(dateKey(next));
  };
  const navigate = (event, date) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const weekday = (date.getDay() + 6) % 7;
    let next;
    switch (event.key) {
      case "ArrowLeft":
        next = addDays(date, -1);
        break;
      case "ArrowRight":
        next = addDays(date, 1);
        break;
      case "ArrowUp":
        next = addDays(date, -7);
        break;
      case "ArrowDown":
        next = addDays(date, 7);
        break;
      case "Home":
        next = addDays(date, -weekday);
        break;
      case "End":
        next = addDays(date, 6 - weekday);
        break;
      case "PageUp":
        next = addMonths(date, event.shiftKey ? -12 : -1);
        break;
      case "PageDown":
        next = addMonths(date, event.shiftKey ? 12 : 1);
        break;
      default:
        return;
    }
    event.preventDefault();
    focusDate(next);
  };

  return (
    <div className="day-date-controls">
      {selectedKey !== today && today <= limit && (
        <button type="button" className="day-date-return quiet-button control-press"
          aria-label="Вернуться к сегодняшнему дню"
          data-motion={motionMode(motion, false)}
          onClick={() => choose(parseDate(today))}>
          <RotateCcw size={14} aria-hidden="true" /> Сегодня
        </button>
      )}
    <div className="day-date-picker" data-motion={motionMode(motion, false)}>
      <button
        type="button"
        className="day-date-step control-press"
        aria-label="Предыдущий день"
        title="Предыдущий день"
        disabled={selectedKey === MIN_DATE}
        onClick={() => choose(addDays(selected, -1))}
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <Popover.Root open={open} onOpenChange={openCalendar}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="day-date-trigger control-press"
            aria-label="Выбрать дату"
            aria-describedby={`${id}-value`}
            onPointerDown={() => {
              keyboardOpen.current = false;
            }}
            onKeyDown={(event) => {
              keyboardOpen.current = true;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                openCalendar(true);
              }
            }}
          >
            <CalendarDays size={16} aria-hidden="true" />
            <span id={`${id}-value`}>
              {dateFormat.format(selected).replace(/ г\.$/, "")}
            </span>
            <ChevronDown
              size={13}
              className="day-date-chevron"
              aria-hidden="true"
            />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="dayline-popover day-calendar"
            data-motion={motionMode(motion, keyboardOpen.current)}
            align="end"
            sideOffset={10}
            collisionPadding={14}
            aria-label="Календарь"
            aria-describedby={`${id}-help`}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              days.current.get(selectedKey)?.focus();
            }}
          >
            <div className="day-calendar-heading">
              <h3 id={`${id}-month`} aria-live="polite" aria-atomic="true">
                {monthFormat.format(month).replace(/ г\.$/, "")}
              </h3>
              <div className="day-calendar-month-actions">
                <button
                  type="button"
                  className="day-calendar-month-step control-press"
                  aria-label="Предыдущий месяц"
                  disabled={dateKey(month) === MIN_DATE}
                  onClick={() => changeMonth(-1)}
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="day-calendar-month-step control-press"
                  aria-label="Следующий месяц"
                  disabled={dateKey(addMonths(month, 1)) > limit}
                  onClick={() => changeMonth(1)}
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
            <table
              className="day-calendar-grid"
              role="grid"
              aria-labelledby={`${id}-month`}
            >
              <thead>
                <tr>
                  {WEEKDAYS.map(([short, full]) => (
                    <th key={short} scope="col" abbr={full}>
                      {short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calendarWeeks(month).map((week, index) => (
                  <tr key={index}>
                    {week.map((date) => {
                      const key = dateKey(date);
                      const unavailable = key < MIN_DATE || key > limit;
                      return (
                        <td key={key} aria-selected={key === selectedKey}>
                          <button
                            type="button"
                            className="day-calendar-day control-press"
                            ref={(node) => {
                              if (node) days.current.set(key, node);
                              else days.current.delete(key);
                            }}
                            tabIndex={key === focused ? 0 : -1}
                            disabled={unavailable}
                            aria-label={fullDateFormat.format(date)}
                            aria-current={key === today ? "date" : undefined}
                            data-selected={key === selectedKey || undefined}
                            data-outside={
                              date.getMonth() !== month.getMonth() || undefined
                            }
                            onFocus={() => setFocused(key)}
                            onKeyDown={(event) => navigate(event, date)}
                            onClick={() => choose(date)}
                          >
                            {date.getDate()}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="day-calendar-footer">
              <button
                type="button"
                className="day-calendar-today control-press"
                disabled={today > limit}
                onClick={() => choose(parseDate(today))}
              >
                <span className="day-calendar-today-dot" aria-hidden="true" />
                Сегодня
                <span>{shortDateFormat.format(parseDate(today))}</span>
              </button>
            </div>
            <span className="control-sr-only" id={`${id}-help`}>
              Стрелки — перейти к дню. Page Up и Page Down — сменить месяц. Home
              и End — начало и конец недели. Enter — выбрать. Escape — закрыть.
            </span>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <button
        type="button"
        className="day-date-step control-press"
        aria-label="Следующий день"
        title="Следующий день"
        disabled={selectedKey >= limit}
        onClick={() => choose(addDays(selected, 1))}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
    </div>
  );
}

export function ChoiceSelect({ label, value, options, onChange }) {
  const selectedIndex = options.findIndex((option) => option.value === value);
  const initialIndex = Math.max(0, selectedIndex);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(initialIndex);
  const optionRefs = useRef([]);
  const keyboardOpen = useRef(false);
  const search = useRef({ text: "", time: 0 });
  const id = useId();
  const motion = useMotion();
  const openSelect = (next) => {
    if (next) {
      setFocused(initialIndex);
      search.current = { text: "", time: 0 };
    }
    setOpen(next);
  };
  const focusOption = (index) => {
    setFocused(index);
    optionRefs.current[index]?.focus();
  };
  const navigate = (event) => {
    let index;
    switch (event.key) {
      case "ArrowDown":
        index = (focused + 1) % options.length;
        break;
      case "ArrowUp":
        index = (focused + options.length - 1) % options.length;
        break;
      case "Home":
      case "PageUp":
        index = 0;
        break;
      case "End":
      case "PageDown":
        index = options.length - 1;
        break;
      default: {
        if (
          event.key.length !== 1 ||
          event.key === " " ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey
        )
          return;
        const now = Date.now();
        const text =
          (now - search.current.time < 600 ? search.current.text : "") +
          event.key.toLocaleLowerCase("ru-RU");
        search.current = { text, time: now };
        const query = [...text].every((letter) => letter === text[0])
          ? text[0]
          : text;
        index = options.findIndex((_, offset) => {
          const next = (focused + 1 + offset) % options.length;
          return options[next].label
            .toLocaleLowerCase("ru-RU")
            .startsWith(query);
        });
        if (index === -1) return;
        index = (focused + 1 + index) % options.length;
      }
    }
    event.preventDefault();
    focusOption(index);
  };

  return (
    <Popover.Root open={open} onOpenChange={openSelect}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="choice-select-trigger control-press"
          data-motion={motionMode(motion, false)}
          aria-label={label}
          aria-describedby={`${id}-value`}
          aria-haspopup="listbox"
          disabled={!options.length}
          onPointerDown={() => {
            keyboardOpen.current = false;
          }}
          onKeyDown={(event) => {
            keyboardOpen.current = true;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              openSelect(true);
            }
          }}
        >
          <span id={`${id}-value`}>
            {options[selectedIndex]?.label || "Выбрать"}
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="dayline-popover choice-select-list"
          data-motion={motionMode(motion, keyboardOpen.current)}
          role="listbox"
          aria-label={label}
          align="end"
          sideOffset={7}
          collisionPadding={14}
          onKeyDown={navigate}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            optionRefs.current[initialIndex]?.focus();
          }}
        >
          {options.map((option, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              tabIndex={index === focused ? 0 : -1}
              className="choice-select-option control-press"
              key={option.value}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              onFocus={() => setFocused(index)}
              onClick={() => {
                if (option.value !== value) onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {index === selectedIndex && (
                <Check size={15} aria-hidden="true" />
              )}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
