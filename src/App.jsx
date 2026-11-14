import { useLocale } from "./i18n.jsx";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  Home,
  Layers3,
  Monitor,
  NotebookPen,
  Pause,
  Play,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  Panel,
  RouteStage,
  useSidebarTransition,
  Number as AnimatedNumber,
  Duration,
  useMotion,
} from "./motion.jsx";
import Journal, { JournalEditor } from "./Journal.jsx";
import { categories, dateKey, shift } from "./shared.js";
import ProgramList, { ProgramsUIProvider } from "./ProgramsUI.jsx";
import Settings from "./Settings.jsx";
import DatePicker from "./DatePicker.jsx";
import FocusPanel from "./FocusPanel.jsx";
import WeekChart from "./WeekChart.jsx";
const api = window.dayline;
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <i />
        <i />
        <i />
      </span>
      <span className="brand-name">
        Dayline<span>.</span>
      </span>
    </div>
  );
}
function Legend() {
  const { t } = useLocale();
  return (
    <div className="legend">
      {Object.entries(categories).map(([key, c]) => (
        <span key={key}>
          <i style={{ background: c.color }} />
          {t(c.label)}
        </span>
      ))}
    </div>
  );
}
function Timeline({ data }) {
  const { t, time } = useLocale();
  const groups = [],
    midnight = new Date(data.date + "T00:00:00").getTime(),
    dayLength =
      new Date(shift(data.date, 1) + "T00:00:00").getTime() - midnight;
  for (const s of data.sessions) {
    const type = data.siteCategories?.[s.domain?.toLowerCase()],
      cat = data.types?.[type]?.base || data.catalog[s.appId]?.category || "neutral",
      start = ((s.start - midnight) / dayLength) * 100,
      width = ((s.end - s.start) / dayLength) * 100,
      last = groups.at(-1);
    if (
      last &&
      last.cat === cat &&
      last.type === type &&
      last.appId === s.appId &&
      Math.abs(last.start + last.width - start) < 0.000001
    )
      last.width += width;
    else groups.push({ start, width, cat, type, appId: s.appId, key: s.start });
  }
  return (
    <Panel className="timeline-panel">
      <div className="section-heading">
        <div>
          <h2>{t("Лента дня")}</h2>
        </div>
        <Legend />
      </div>
      <div className="timeline">
        <div className="timeline-grid">
          {Array.from({ length: 49 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        {groups.map((s) => (
          <div
            key={s.key}
            className="timeline-segment"
            style={{
              left: s.start + "%",
              width: s.width + "%",
              background: (() => {
                const app = data.catalog[s.appId],
                  parts = Object.entries(s.type ? { [s.type]: 100 } : app?.allocations || { [s.cat]: 100 }),
                  color = (id) => categories[id]?.color || data.types?.[id]?.color || "var(--muted)";
                let from = 0;
                return parts.length === 1
                  ? color(parts[0][0])
                  : "linear-gradient(90deg," +
                      parts
                        .map(([id, pct]) => {
                          const start = from;
                          from += pct;
                          return (
                            color(id) +
                            " " +
                            start +
                            "% " +
                            from +
                            "%"
                          );
                        })
                        .join(",") +
                      ")";
              })(),
            }}
            title={`${data.catalog[s.appId]?.name || s.appId} · ${time((s.width / 100) * dayLength)}`}
          />
        ))}
        {data.date === data.today && (
          <div
            className="now-marker"
            style={{
              left:
                Math.min(99.6, ((Date.now() - midnight) / dayLength) * 100) +
                "%",
            }}
          >
            <i />
            <span>{t("сейчас")}</span>
          </div>
        )}
      </div>
      <div className="hour-labels">
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
          <span key={h}>{String(h).padStart(2, "0")}:00</span>
        ))}
      </div>
      {!data.sessions.length && (
        <p className="timeline-empty">{t("За этот день нет записей активности.")}</p>
      )}
    </Panel>
  );
}
function Score({ data }) {
  const { t } = useLocale();
  const score = data.score;
  return (
    <Panel className="score-panel">
      <h2>{t("Фокус дня")}</h2>
      <div className="score-content">
        <strong>{score === null ? "—" : score}</strong>
        {score !== null && <span> / 100</span>}
      </div>
      <p className="score-caption">
        {score === null
          ? t("Недостаточно данных")
          : data.scoreMode === "goal"
            ? t("Доля дневной цели")
            : t("Доля полезного времени")}
      </p>
    </Panel>
  );
}
function TodayPrograms({ data, onCategory, onSave, onShowAll }) {
  const { t } = useLocale();
  const [openRequest, setOpenRequest] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const editorId = useId();
  return (
    <div className="today-programs">
      <ProgramList
        apps={data.apps}
        icons={data.icons}
        onCategory={onCategory}
        totalMs={data.totalMs}
        limit={5}
        onShowAll={onShowAll}
        headingAction={
          <button
            type="button"
            className="quiet-button day-entry-button"
            aria-expanded={expanded}
            aria-controls={expanded ? editorId : undefined}
            onClick={() => setOpenRequest((n) => n + 1)}
          >
            <NotebookPen size={15} aria-hidden="true" />{t("Запись дня")}</button>
        }
      />
      <JournalEditor
        key={data.date}
        id={editorId}
        compact
        date={data.date}
        entry={data.entry}
        onSave={onSave}
        openRequest={openRequest}
        onExpandedChange={setExpanded}
      />
    </div>
  );
}
function Today({ data, onCategory, onSave, onShowAll }) {
  const { t, time } = useLocale();
  const total = Math.floor(data.totalMs / 60000);
  const parts = Object.entries(categories).map(([key, category]) => ({
    ...category,
    key,
    ms: data[`${key}Ms`],
  }));
  return (
    <>
      <div className="overview-grid">
        <Panel className="hero-panel">
          <div className="hero-top">
            <h2>{t("Экранное время")}</h2>
          </div>
          <div
            className="big-time"
            aria-label={t("Экранное время: {0}", time(data.totalMs))}
          >
            <strong>
              <AnimatedNumber value={Math.floor(total / 60)} />
            </strong>
            <span>{t("ч")}</span>
            <strong>
              <AnimatedNumber value={total % 60} pad={2} />
            </strong>
            <span>{t("мин")}</span>
          </div>
          <div className="distribution-bar" aria-hidden="true">
            {parts.filter(({ ms }) => ms > 0).map(({ key, color, ms }) => (
              <span key={key} style={{ flexGrow: ms, background: color }} />
            ))}
          </div>
          <div className="time-distribution">
            {parts.map(({ key, color, label, ms }) => (
              <div key={key}>
                <span><i style={{ background: color }} />{t(label)}</span>
                <strong><Duration ms={ms} /></strong>
              </div>
            ))}
          </div>
        </Panel>
        <Score data={data} />
      </div>
      <FocusPanel />
      <Timeline data={data} />
      <TodayPrograms key={data.date} {...{ data, onCategory, onSave, onShowAll }} />
    </>
  );
}
function Statistics({ data, onDate, onCategory }) {
  const { t } = useLocale();
  const sum = (key) => data.week.reduce((n, d) => n + d[key], 0);
  return (
    <>
      <div className="stat-tiles">
        {[
          {
            label: t("Активное время"),
            ms: sum("totalMs"),
          },
          {
            label: t("Рабочее время"),
            ms: sum("focusMs"),
          },
          {
            label: t("Фокус за неделю"),
            value: sum("totalMs")
              ? Math.round((100 * sum("focusMs")) / sum("totalMs"))
              : null,
          },
        ].map(({ label, ms, value }) => (
          <Panel className="stat-tile" key={label}>
            <h2>{label}</h2>
            <strong>
              {ms !== undefined ? (
                <Duration ms={ms} />
              ) : value === null ? (
                "—"
              ) : (
                <AnimatedNumber value={value} suffix="%" />
              )}
            </strong>
          </Panel>
        ))}
      </div>
      <WeekChart week={data.week} onDate={onDate} />
      <ProgramList
        apps={data.weekApps}
        icons={data.icons}
        onCategory={onCategory}
        totalMs={sum("totalMs")}
        all
        title={t("Программы за неделю")}
      />
    </>
  );
}
function Programs({ data, onCategory }) {
  const { t, locale } = useLocale();
  const used = new Map(data.apps.map((app) => [app.id, app]));
  const apps = Object.entries(data.catalog)
    .map(([id, a]) => ({
      id,
      ...a,
      ms: used.get(id)?.ms || 0,
      sites: used.get(id)?.sites || [],
    }))
    .sort((a, b) => b.ms - a.ms || a.name.localeCompare(b.name, locale));
  return (
    <ProgramList
      apps={apps}
      icons={data.icons}
      onCategory={onCategory}
      totalMs={data.totalMs}
      all
      title={t("Все программы")}
      showTitle={false}
    />
  );
}
const nav = [
  ["today", "Сегодня", Home],
  ["stats", "Статистика", ChartNoAxesCombined],
  ["journal", "Дневник", CalendarDays],
  ["programs", "Программы", Layers3],
  ["settings", "Настройки", Settings2],
];
export default function App() {
  const { t, pretty } = useLocale();
  const { active, visible } = useMotion();
  const [date, setDate] = useState(dateKey(new Date())),
    [page, setPage] = useState("today"),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [collapsed, setCollapsed] = useState(
      () => localStorage.getItem("dayline-sidebar") === "collapsed",
    );
  const [workspaceRef, captureSidebar] = useSidebarTransition(collapsed);
  const todayRef = useRef(dateKey(new Date())),
    dateRef = useRef(date),
    requestId = useRef(0),
    iconCache = useRef({ revision: -1, icons: {} });
  const selectDate = useCallback((next) => {
    if (next === dateRef.current) return;
    dateRef.current = next;
    setDate(next);
  }, []);
  const openDay = useCallback((next) => {
    selectDate(next);
    setPage("today");
  }, [selectDate]);
  const refresh = async () => {
    if (!api) return;
    const id = ++requestId.current,
      requested = dateRef.current;
    try {
      const next = await api.snapshot(requested, iconCache.current.revision);
      if (next.icons && next.iconRevision >= iconCache.current.revision)
        iconCache.current = { revision: next.iconRevision, icons: next.icons };
      next.icons = iconCache.current.icons;
      if (id === requestId.current && requested === dateRef.current) {
        setData(next);
        setError("");
        if (todayRef.current !== next.today) {
          if (requested === todayRef.current) selectDate(next.today);
          todayRef.current = next.today;
        }
      }
    } catch {
      if (id === requestId.current && requested === dateRef.current)
        setError(t("Не удалось прочитать данные. Перезапусти Dayline."));
    }
  };
  useEffect(() => {
    refresh();
    if (!api) return;
    const onVisible = () => {
      if (visible && !document.hidden) refresh();
    };
    const unsubscribe = api.onChanged(onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [date, visible]);
  useEffect(() => {
    localStorage.setItem(
      "dayline-sidebar",
      collapsed ? "collapsed" : "expanded",
    );
  }, [collapsed]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  const category = async (id, value) => {
    try {
      await api.category(id, value);
      await refresh();
    } catch {
      setToast(t("Не удалось изменить категорию"));
    }
  };
  const save = async (day, entry) => {
    await api.entry(day, {
      mood: entry.mood,
      note: entry.note,
      done: entry.done,
    });
    await refresh();
  };
  const go = (next) => setPage(next);
  if (!api)
    return (
      <div className="launch-message">
        <Brand />
        <h1>{t("Твой день живёт в Windows")}</h1>
        <p>{t("Запусти Dayline через ярлык или установщик.")}</p>
      </div>
    );
  if (!data)
    return (
      <div className="launch-message">
        <Brand />
        <div className="skeleton-loader">
          <i />
          <i />
          <i />
        </div>
        <p>{error || t("Открываю твой день…")}</p>
      </div>
    );
  const selected = nav.find((n) => n[0] === page),
    title =
      page === "today"
        ? data.date === data.today
          ? t("Сегодня")
          : pretty(data.date)
        : t(selected[1]);
  const content =
    page === "today" ? (
      <Today data={data} onCategory={category} onSave={save} onShowAll={() => go("programs")} />
    ) : page === "stats" ? (
      <Statistics
        data={data}
        onCategory={category}
        onDate={openDay}
      />
    ) : page === "journal" ? (
      <Journal data={data} navigationDate={date} onDate={selectDate} onSave={save} />
    ) : page === "programs" ? (
      <Programs data={data} onCategory={category} />
    ) : (
      <Settings
        data={data}
        onSettings={async (s) => {
          await api.settings(s);
          await refresh();
        }}
        notify={setToast}
        onPrograms={() => go("programs")}
      />
    );
  return (
    <ProgramsUIProvider data={data} refresh={refresh} notify={setToast}>
      <div className={"app " + (collapsed ? "sidebar-collapsed" : "")}>
        <aside className="sidebar">
          <Brand />
          <button
            className="sidebar-collapse icon-button"
            aria-label={collapsed ? t("Развернуть меню") : t("Свернуть меню")}
            onClick={() => {
              captureSidebar();
              setCollapsed((p) => !p);
            }}
            title={collapsed ? t("Развернуть меню") : t("Свернуть меню")}
          >
            {collapsed ? (
              <PanelLeftOpen size={17} />
            ) : (
              <PanelLeftClose size={17} />
            )}
          </button>
          <nav aria-label={t("Разделы")}>
            {nav.map(([key, label, Icon]) => (
              <button
                key={key}
                aria-label={t(label)}
                aria-current={page === key ? "page" : undefined}
                title={collapsed ? t(label) : undefined}
                className={page === key ? "active" : undefined}
                onClick={() => go(key)}
              >
                <span className="nav-icon">
                  <Icon size={18} strokeWidth={1.7} />
                </span>
                <span className="nav-label">{t(label)}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="device">
              <Monitor size={18} aria-hidden="true" />
              <div>
                <strong>{t("Мой компьютер")}</strong>
                <small>Dayline {data.version}</small>
              </div>
            </div>
          </div>
        </aside>
        <div className="workspace" ref={workspaceRef}>
          <header className="topbar">
            <div className="tracking-controls">
              <span
                className={"tracking-status " + data.status.kind}
                title={data.status.detail}
              >
                <i />
                {data.status.label}
              </span>
              <button
                className="pause-button"
                aria-label={
                  data.status.kind === "paused"
                    ? t("Продолжить учёт")
                    : t("Приостановить учёт")
                }
                onClick={() =>
                  api
                    .pause(data.status.kind !== "paused")
                    .catch(() => setToast(t("Не удалось изменить учёт")))
                }
              >
                {data.status.kind === "paused" ? <Play size={14} /> : <Pause size={14} />}
              </button>
            </div>
          </header>
          <main>
            <div className="page-heading">
              <h1>{title}</h1>
              {page !== "settings" && page !== "journal" && (
                <DatePicker
                  value={data.date}
                  navigationValue={date}
                  max={data.today}
                  onChange={selectDate}
                  stepDays={page === "stats" ? 7 : 1}
                  rangeStart={page === "stats" ? data.week[0]?.date : undefined}
                />
              )}
            </div>
            {(error || data.storageWarning || data.status.kind === "error") && (
              <div className="notice" role="alert">
                {error || data.status.detail || data.storageWarning}
              </div>
            )}
            <RouteStage key={page} route={page}>
              {content}
            </RouteStage>
          </main>
        </div>
        <AnimatePresence>
          {toast && (
            <motion.div
              className="toast"
              role="status"
              key={toast}
              initial={active ? { opacity: 0, y: 20, scale: 0.94 } : false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={
                active
                  ? { duration: 0.22, ease: [0.23, 1, 0.32, 1] }
                  : { duration: 0 }
              }
            >
              <motion.span
                initial={active ? { scale: 0.95, rotate: -20 } : false}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.12 }}
              >
                <Check size={18} />
              </motion.span>
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ProgramsUIProvider>
  );
}
