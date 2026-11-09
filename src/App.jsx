import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Code2,
  Coffee,
  FolderOpen,
  Gamepad2,
  Home,
  Layers3,
  Monitor,
  NotebookPen,
  Pause,
  Play,
  Settings2,
  ShieldCheck,
  Target,
  Timer,
  ArrowUpRight,
  Search,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  Panel,
  RouteStage,
  NavigationHighlight,
  useSidebarTransition,
  Number as AnimatedNumber,
  Duration,
  Fill,
  Toggle,
  useMotion,
} from "./motion.jsx";
import Journal, { JournalEditor } from "./Journal.jsx";
const WeekChart = lazy(() => import("./WeekChart.jsx"));
import { categories, dateKey, pretty, shift, time } from "./shared.js";
import ProgramList, { ProgramsUIProvider } from "./ProgramsUI.jsx";
import Settings from "./Settings.jsx";
import DatePicker from "./DatePicker.jsx";
import FocusPanel from "./FocusPanel.jsx";
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
  return (
    <div className="legend">
      {Object.entries(categories).map(([key, c]) => (
        <span key={key}>
          <i style={{ background: c.color }} />
          {c.label}
        </span>
      ))}
    </div>
  );
}
function Timeline({ data }) {
  const { active } = useMotion();
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
      Math.abs(last.start + last.width - start) < 0.025
    )
      last.width += width;
    else groups.push({ start, width, cat, type, appId: s.appId, key: s.start });
  }
  return (
    <Panel className="timeline-panel">
      <div className="section-heading">
        <div>
          <h2>
            <span className="heading-icon cyan">
              <ChartNoAxesCombined />
            </span>
            Лента дня <span className="subtle">/ 24 часа</span>
          </h2>
          <p>Когда и на что уходило время</p>
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
          <motion.div
            key={s.key}
            className="timeline-segment"
            initial={active ? { opacity: 0, scaleX: 0 } : false}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: active ? 0.24 : 0 }}
            style={{
              left: s.start + "%",
              width: Math.max(s.width, 0.1) + "%",
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
              transformOrigin: "left",
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
            <span>сейчас</span>
          </div>
        )}
      </div>
      <div className="hour-labels">
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
          <span key={h}>{String(h).padStart(2, "0")}:00</span>
        ))}
      </div>
      {!data.sessions.length && (
        <p className="timeline-empty">
          Пользуйся компьютером как обычно — твой день начнёт складываться
          здесь.
        </p>
      )}
    </Panel>
  );
}
function Score({ data }) {
  const { active } = useMotion(),
    r = 48,
    c = 2 * Math.PI * r,
    score = data.score;
  return (
    <Panel className="score-panel">
      <div className="section-heading">
        <h2>
          <span className="heading-icon pink">
            <Target />
          </span>
          Фокус дня
        </h2>
      </div>
      <div className="score-content">
        <div className="score-ring">
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={r} className="ring-track" />
            <motion.circle
              cx="60"
              cy="60"
              r={r}
              className="ring-fill"
              strokeDasharray={c}
              initial={active ? { strokeDashoffset: c } : false}
              animate={{ strokeDashoffset: c * (1 - (score || 0) / 100) }}
              transition={{
                duration: active ? 0.28 : 0,
                ease: [0.23, 1, 0.32, 1],
              }}
            />
          </svg>
          <div>
            <strong>
              {score === null ? "—" : <AnimatedNumber value={score} />}
            </strong>
            <span>из 100</span>
          </div>
        </div>
        <div>
          <h3>
            {score === null
              ? "Без оценок"
              : score >= 70
                ? "В хорошем ритме"
                : score >= 40
                  ? "Свой баланс"
                  : "День без спешки"}
          </h3>
          <p>
            {score === null
              ? "Нужно немного активности, чтобы собрать картину дня."
              : data.scoreMode === "goal"
                ? `Выполнено ${score}% дневной цели по полезному времени.`
                : `${score}% учитываемого времени — полезное.`}
          </p>
        </div>
      </div>
      <p className="score-note">
        Формула и цель задаются в настройках фокуса. Отдых тоже нужен.
      </p>
    </Panel>
  );
}
function Today({ data, onCategory, onSave }) {
  const { active } = useMotion();
  const total = Math.floor(data.totalMs / 60000);
  return (
    <>
      <div className="overview-grid">
        <Panel className="hero-panel">
          <div className="hero-top">
            <h2>
              <span className="heading-icon lime">
                <Clock3 />
              </span>
              Экранное время
            </h2>
            <span className="device-label">
              <Monitor size={17} /> Этот компьютер
            </span>
          </div>
          <div
            className="big-time"
            aria-label={`Экранное время: ${time(data.totalMs)}`}
          >
            <strong>
              <AnimatedNumber value={Math.floor(total / 60)} />
            </strong>
            <span>ч</span>
            <strong>
              <AnimatedNumber value={total % 60} pad={2} />
            </strong>
            <span>мин</span>
          </div>
          <div className="time-distribution">
            {Object.entries(categories).map(([key, c]) => (
              <div key={key}>
                <span>
                  <i style={{ background: c.color }} />
                  {c.label}
                </span>
                <strong>
                  <Duration
                    ms={
                      data[
                        key === "focus"
                          ? "focusMs"
                          : key === "rest"
                            ? "restMs"
                            : "neutralMs"
                      ]
                    }
                  />
                </strong>
              </div>
            ))}
          </div>
          <div className="distribution-bar">
            {Object.entries(categories).map(([key, c]) => {
              const share = data.totalMs
                ? data[
                    key === "focus"
                      ? "focusMs"
                      : key === "rest"
                        ? "restMs"
                        : "neutralMs"
                  ] / data.totalMs
                : 0;
              return (
                <motion.span
                  key={key}
                  initial={false}
                  style={{ flexGrow: share }}
                >
                  <Fill value={share ? 1 : 0} color={c.color} />
                </motion.span>
              );
            })}
          </div>
        </Panel>
        <Score data={data} />
      </div>
      <FocusPanel />
      <Timeline data={data} />
      <div className="content-grid">
        <ProgramList
          apps={data.apps}
          icons={data.icons}
          onCategory={onCategory}
          totalMs={data.totalMs}
        />
        <JournalEditor
          key={data.date}
          compact
          date={data.date}
          entry={data.entry}
          onSave={onSave}
        />
      </div>
    </>
  );
}
function Statistics({ data, onDate, onCategory }) {
  const sum = (key) => data.week.reduce((n, d) => n + d[key], 0);
  return (
    <>
      <div className="stat-tiles">
        {[
          {
            label: "Активное время",
            ms: sum("totalMs"),
            Icon: Clock3,
            color: "cyan",
          },
          {
            label: "Рабочее время",
            ms: sum("focusMs"),
            Icon: Code2,
            color: "lime",
          },
          { label: "Отдых", ms: sum("restMs"), Icon: Coffee, color: "pink" },
          {
            label: "Фокус за неделю",
            value: sum("totalMs")
              ? Math.round((100 * sum("focusMs")) / sum("totalMs"))
              : null,
            Icon: Target,
            color: "violet",
          },
        ].map(({ label, ms, value, Icon, color }) => (
          <Panel className={"stat-tile " + color} key={label}>
            <span>
              {label}
              <span className={"heading-icon " + color}>
                <Icon size={18} />
              </span>
            </span>
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
      <Suspense
        fallback={
          <Panel className="week-panel">
            <div className="skeleton-loader chart-skeleton">
              <i />
              <i />
              <i />
            </div>
          </Panel>
        }
      >
        <WeekChart week={data.week} onDate={onDate} />
      </Suspense>
      <ProgramList
        apps={data.weekApps}
        icons={data.icons}
        onCategory={onCategory}
        totalMs={sum("totalMs")}
        all
        title="Программы за неделю"
      />
    </>
  );
}
function Programs({ data, onCategory }) {
  const times = Object.fromEntries(data.apps.map((a) => [a.id, a.ms]));
  const apps = Object.entries(data.catalog)
    .map(([id, a]) => ({
      id,
      ...a,
      ms: times[id] || 0,
      sites: data.apps.find((x) => x.id === id)?.sites || [],
    }))
    .sort((a, b) => b.ms - a.ms || a.name.localeCompare(b.name));
  return (
    <>
      <div className="programs-intro">
        <span className="heading-icon cyan">
          <Layers3 />
        </span>
        <p>
          Выбирай категории под свои задачи. Рейтинг фокуса пересчитается и за
          предыдущие дни.
        </p>
      </div>
      <ProgramList
        apps={apps}
        icons={data.icons}
        onCategory={onCategory}
        totalMs={data.totalMs}
        all
        title="Все программы"
      />
    </>
  );
}
const nav = [
  ["today", "Сегодня", Home, "lime"],
  ["stats", "Статистика", ChartNoAxesCombined, "violet"],
  ["journal", "Дневник", CalendarDays, "pink"],
  ["programs", "Программы", Layers3, "cyan"],
  ["settings", "Настройки", Settings2, "yellow"],
];
export default function App() {
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
  dateRef.current = date;
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
          if (requested === todayRef.current) setDate(next.today);
          todayRef.current = next.today;
        }
      }
    } catch {
      if (id === requestId.current)
        setError("Не удалось прочитать данные. Перезапусти Dayline.");
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
      setToast("Не удалось изменить категорию");
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
        <h1>Твой день живёт в Windows</h1>
        <p>Запусти Dayline через ярлык или установщик.</p>
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
        <p>{error || "Открываю твой день…"}</p>
      </div>
    );
  const selected = nav.find((n) => n[0] === page),
    title =
      page === "today"
        ? date === data.today
          ? "Сегодня"
          : pretty(date)
        : selected[1];
  const content =
    page === "today" ? (
      <Today data={data} onCategory={category} onSave={save} />
    ) : page === "stats" ? (
      <Statistics
        data={data}
        onCategory={category}
        onDate={(d) => {
          setDate(d);
          go("today");
        }}
      />
    ) : page === "journal" ? (
      <Journal data={data} onDate={setDate} onSave={save} />
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
      <div
        className={"app " + (collapsed ? "sidebar-collapsed" : "")}
        style={{ "--route-color": `var(--${selected[3]})` }}
      >
        <aside className="sidebar">
          <Brand />
          <button
            className="sidebar-collapse icon-button"
            aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
            onClick={() => {
              captureSidebar();
              setCollapsed((p) => !p);
            }}
            title={collapsed ? "Развернуть меню" : "Свернуть меню"}
          >
            {collapsed ? (
              <PanelLeftOpen size={17} />
            ) : (
              <PanelLeftClose size={17} />
            )}
          </button>
          <nav>
            <NavigationHighlight
              page={page}
              collapsed={collapsed}
              items={nav}
            />
            {nav.map(([key, label, Icon, color]) => (
              <motion.button
                key={key}
                aria-label={label}
                aria-current={page === key ? "page" : undefined}
                title={collapsed ? label : undefined}
                className={(page === key ? "active " : "") + color}
                onClick={() => go(key)}
                whileTap={active ? { scale: 0.96 } : undefined}
              >
                <span className="nav-icon">
                  <Icon size={23} strokeWidth={1.7} />
                </span>
                <span className="nav-label">{label}</span>
              </motion.button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="device">
              <Monitor size={24} />
              <div>
                <strong>Мой компьютер</strong>
                <small>Локальное хранение</small>
              </div>
              <i />
            </div>
            <div className="sidebar-footer">
              <span>v{data.version}</span>
              <ShieldCheck size={14} />
            </div>
          </div>
        </aside>
        <div className="workspace" ref={workspaceRef}>
          <header className="topbar">
            <span className="breadcrumb">
              Моё время <ChevronRight size={12} /> <b>{selected[1]}</b>
            </span>
            <div className="tracking-controls">
              <span
                className={"tracking-status " + data.status.kind}
                title={data.status.detail}
              >
                <i />
                {data.status.label}
              </span>
              <motion.button
                className="pause-button"
                aria-label={
                  data.status.kind === "paused"
                    ? "Продолжить учёт"
                    : "Приостановить учёт"
                }
                onClick={() =>
                  api
                    .pause(data.status.kind !== "paused")
                    .catch(() => setToast("Не удалось изменить учёт"))
                }
                whileTap={active ? { scale: 0.97 } : undefined}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={data.status.kind === "paused" ? "play" : "pause"}
                    initial={
                      active ? { opacity: 0, rotate: -60, scale: 0.95 } : false
                    }
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 60, scale: 0.95 }}
                    transition={{ duration: active ? 0.16 : 0 }}
                  >
                    {data.status.kind === "paused" ? (
                      <Play size={15} />
                    ) : (
                      <Pause size={15} />
                    )}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            </div>
          </header>
          <main>
            <div className="page-heading">
              <div>
                <span className="page-date">
                  {pretty(date, {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <motion.h1
                  key={title}
                  initial={active ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: active ? 0.22 : 0,
                    ease: [0.23, 1, 0.32, 1],
                  }}
                >
                  {title}
                  <span className="heading-period">.</span>
                </motion.h1>
                <p>
                  {page === "today"
                    ? "Всё, чему ты уделил внимание. В одном месте."
                    : page === "stats"
                      ? "Больше ясности о том, куда уходит время."
                      : page === "journal"
                        ? "Не только цифры. Твои мысли, настроение и маленькие победы."
                        : page === "programs"
                          ? "Каждой программе — своё место в твоём дне."
                          : "Твой ритм. Твои настройки."}
                </p>
              </div>
              {page !== "settings" && (
                <DatePicker value={date} max={data.today} onChange={setDate} />
              )}
            </div>
            {(error || data.storageWarning || data.status.kind === "error") && (
              <div className="notice" role="alert">
                {error || data.status.detail || data.storageWarning}
              </div>
            )}
            <AnimatePresence mode="wait" initial={false}>
              <RouteStage key={page} route={page} contentKey={data.date}>
                {content}
              </RouteStage>
            </AnimatePresence>
            <footer className="page-footer">
              <span>
                <span className="footer-dot" />
                {data.current && data.status.kind === "active"
                  ? `Сейчас: ${data.current.name}`
                  : "Твой день в твоём темпе"}
              </span>
              <span>
                Фоновое время не учитывается <span>·</span> Dayline
              </span>
            </footer>
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
