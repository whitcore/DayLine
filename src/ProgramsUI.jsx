import { createContext, useContext, useState, useEffect, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useIsPresent } from "motion/react";
import {
  Check,
  ChevronDown,
  Plus,
  SlidersHorizontal,
  X,
  Pencil,
  Trash2,
  RotateCcw,
  ImagePlus,
  Layers3,
  Code2,
  Gamepad2,
  Monitor,
  Globe,
  ShieldCheck,
  Search,
  EyeOff,
  ArrowUpRight,
} from "lucide-react";
import {
  motion,
  AnimatePresence,
  Panel,
  Fill,
  Duration,
  useMotion,
} from "./motion.jsx";
import { categories } from "./shared.js";
const Context = createContext(null);
const api = window.dayline;
const allocation = (a) => a.allocations || { [a.category || "neutral"]: 100 };
const typeColor = (types, id) => {
  const original = { focus: "#b9ff4b", neutral: "#ffe34d", rest: "#ff5ca8" };
  const color = types[id]?.color;
  return categories[id] && color === original[id] ? categories[id].color : color || "var(--muted)";
};
const colors = [
  "#b9ff4b",
  "#38dce8",
  "#ca8cf6",
  "#ff5ca8",
  "#ffe34d",
  "#ff9c5a",
  "#6b9fff",
  "#f47171",
];
export function ProgramsUIProvider({ data, refresh, notify, children }) {
  const [modal, setModal] = useState(null);
  const run = async (action, message) => {
    try {
      const result = await action();
      await refresh();
      if (message && result !== false) notify(message);
      return true;
    } catch (e) {
      notify(e.message || "Не удалось сохранить изменения");
      return false;
    }
  };
  return (
    <Context.Provider
      value={{ data, types: data.types || categories, run, setModal }}
    >
      {children}
      <AnimatePresence>
        {modal && (
          <Modal
            key={modal.kind}
            title={
              modal.kind === "mix"
                ? "Распределение времени"
                : modal.kind === "types"
                  ? "Твои виды программ"
                  : modal.kind === "hide"
                    ? "Убрать программу?"
                    : "Скрытые программы"
            }
            onClose={() => setModal(null)}
          >
            {modal.kind === "mix" ? (
              <MixEditor app={modal.app} onClose={() => setModal(null)} />
            ) : modal.kind === "types" ? (
              <TypeManager />
            ) : modal.kind === "hide" ? (
              <div className="remove-app">
                <p>
                  <strong>{modal.app.name}</strong> исчезнет из списков. Время и
                  записи дня сохранятся. Вернуть программу можно через
                  «Скрытые».
                </p>
                <div className="dialog-actions">
                  <button
                    className="quiet-button"
                    onClick={() => setModal(null)}
                  >
                    Отмена
                  </button>
                  <button
                    className="danger-button"
                    onClick={async () => {
                      if (
                        await run(
                          () => api.hideApp(modal.app.id, true),
                          "Программа скрыта",
                        )
                      )
                        setModal(null);
                    }}
                  >
                    <EyeOff size={16} />
                    Убрать из списка
                  </button>
                </div>
              </div>
            ) : (
              <HiddenApps />
            )}
          </Modal>
        )}
      </AnimatePresence>
    </Context.Provider>
  );
}
function Modal({ title, onClose, children }) {
  const present = useIsPresent();
  const ref = useRef(null),
    { active, canFade } = useMotion();
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <motion.dialog
      ref={ref}
      className="dayline-dialog"
      data-closing={!present}
      aria-label={title}
      initial={
        canFade
          ? { opacity: 0, y: active ? 18 : 0, scale: active ? 0.97 : 1 }
          : false
      }
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{
        opacity: 0,
        y: active ? 10 : 0,
        scale: active ? 0.98 : 1,
        transition: { duration: canFade ? 0.12 : 0 },
      }}
      transition={{
        duration: canFade ? (active ? 0.22 : 0.12) : 0,
        ease: [0.23, 1, 0.32, 1],
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-header">
        <div>
          <span className="eyebrow">DAYLINE / ПОД ТЕБЯ</span>
          <h2>{title}</h2>
        </div>
        <button className="icon-button" aria-label="Закрыть" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      {children}
    </motion.dialog>
  );
}
function MenuSurface({ children, ...props }) {
  const present = useIsPresent();
  return <motion.div {...props} aria-hidden={present ? undefined : true} inert={present ? undefined : true}>
    {children}
  </motion.div>;
}
function Menu({ trigger, children, label }) {
  const [open, setOpen] = useState(false),
    { active, canFade } = useMotion(),
    ref = useRef(null);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content
              asChild
              sideOffset={8}
              align="end"
              collisionPadding={16}
              onOpenAutoFocus={(e) => {
                e.preventDefault();
                ref.current?.querySelector("button")?.focus();
              }}
            >
              <MenuSurface
                ref={ref}
                className="category-menu"
                aria-label={label}
                role="menu"
                initial={
                  canFade
                    ? {
                        opacity: 0,
                        y: active ? -6 : 0,
                        scale: active ? 0.96 : 1,
                      }
                    : false
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: active ? -3 : 0,
                  scale: active ? 0.98 : 1,
                  transition: { duration: canFade ? 0.1 : 0 },
                }}
                transition={{
                  duration: canFade ? (active ? 0.18 : 0.12) : 0,
                  ease: [0.23, 1, 0.32, 1],
                }}
                onKeyDown={(e) => {
                  if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
                    e.preventDefault();
                    const items = [
                      ...e.currentTarget.querySelectorAll(
                        "button:not(:disabled)",
                      ),
                    ];
                    const n = items.indexOf(document.activeElement),
                      i =
                        e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? items.length - 1
                            : (n +
                                (e.key === "ArrowDown" ? 1 : -1) +
                                items.length) %
                              items.length;
                    items[i]?.focus();
                  }
                }}
              >
                {children(() => setOpen(false))}
              </MenuSurface>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
}
function CategorySelect({ app }) {
  const { types, run, setModal } = useContext(Context),
    parts = Object.entries(allocation(app)),
    mix = parts.length > 1,
    first = types[parts[0][0]] || categories.neutral;
  return (
    <Menu
      label="Выбери вид"
      trigger={
        <button
          className={"category-trigger " + (mix ? "is-mixed" : "")}
          aria-label={"Категория: " + app.id}
          style={{ "--cat": typeColor(types, parts[0][0]) }}
        >
          <span
            className="type-dot"
            style={{
              background: mix
                ? "conic-gradient(" +
                  parts
                    .map(([id, p], i) => {
                      const from = parts
                        .slice(0, i)
                        .reduce((n, x) => n + x[1], 0);
                      return (
                        typeColor(types, id) +
                        " " +
                        from +
                        "% " +
                        (from + p) +
                        "%"
                      );
                    })
                    .join(",") +
                  ")"
                : typeColor(types, parts[0][0]),
            }}
          />
          <span>{mix ? "Смешанный" : first.label}</span>
          <ChevronDown size={13} />
        </button>
      }
    >
      {(close) => (
        <>
          <div className="menu-label">ВИД ПРОГРАММЫ</div>
          <div className="menu-type-list">
            {Object.entries(types).map(([id, t]) => (
              <button
                key={id}
                role="menuitemradio"
                aria-checked={!mix && parts[0][0] === id}
                onClick={async () => {
                  close();
                  await run(() => api.category(app.id, id));
                }}
              >
                <i className="type-dot" style={{ background: typeColor(types, id) }} />
                <span>{t.label}</span>
                {!mix && parts[0][0] === id && <Check size={15} />}
              </button>
            ))}
          </div>
          <div className="menu-divider" />
          <button
            role="menuitem"
            onClick={() => {
              close();
              setModal({ kind: "mix", app });
            }}
          >
            <SlidersHorizontal size={16} />
            <span>Распределить по долям</span>
            <span className="menu-hint">%</span>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              close();
              setModal({ kind: "types" });
            }}
          >
            <Plus size={16} />
            <span>Добавить / изменить виды</span>
          </button>
        </>
      )}
    </Menu>
  );
}
function MixEditor({ app, onClose }) {
  const { types, run } = useContext(Context),
    [values, setValues] = useState(allocation(app)),
    [saving, setSaving] = useState(false);
  const total = Object.values(values).reduce((n, x) => n + (Number(x) || 0), 0),
    parts = Object.entries(values).filter(([, p]) => p > 0);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        if (
          await run(
            () => api.allocation(app.id, Object.fromEntries(parts)),
            "Распределение сохранено",
          )
        )
          onClose();
        setSaving(false);
      }}
    >
      <p className="dialog-description">
        {app.name} · {/firefox/i.test(app.id)
          ? "Доли применятся к сайтам без своей категории и времени без адреса."
          : "Доли применятся ко всему записанному времени программы."}
      </p>
      <div className="mix-preview">
        {parts.map(([id, p]) => (
          <motion.span
            key={id}
            layout
            style={{ width: p + "%", background: typeColor(types, id) }}
          />
        ))}
      </div>
      <button
        type="button"
        className="split-preset"
        onClick={() => setValues({ focus: 50, rest: 50 })}
      >
        <SlidersHorizontal size={15} />
        50% работа / 50% отдых
        <ArrowUpRight size={14} />
      </button>
      <div className="allocation-fields">
        {Object.entries(types).map(([id, t]) => (
          <label className="allocation-field" key={id}>
            <span>
              <i className="type-dot" style={{ background: typeColor(types, id) }} />
              {t.label}
            </span>
            <span>
              <input
                aria-label={"Доля: " + t.label}
                type="number"
                min="0"
                max="100"
                step="1"
                value={values[id] || 0}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [id]: Number(e.target.value) }))
                }
              />
              <small>%</small>
            </span>
          </label>
        ))}
      </div>
      <div
        className={"allocation-total " + (total === 100 ? "valid" : "invalid")}
      >
        <span>Всего</span>
        <strong>{total} / 100%</strong>
      </div>
      <div className="dialog-actions">
        <button type="button" className="quiet-button" onClick={onClose}>
          Отмена
        </button>
        <button className="accent-button" disabled={total !== 100 || saving}>
          <Check size={16} />
          {saving ? "Сохраняю…" : "Сохранить доли"}
        </button>
      </div>
    </form>
  );
}
function TypeManager() {
  const { types, run } = useContext(Context),
    empty = () => ({
      id: "c-" + crypto.randomUUID(),
      label: "",
      color: colors[2],
      base: "focus",
    }),
    [draft, setDraft] = useState(empty),
    [saving, setSaving] = useState(false);
  return (
    <>
      <p className="dialog-description">
        Например, учёба, творчество или общение. Выбери, как вид влияет на фокус
        дня.
      </p>
      <div className="type-catalog">
        {Object.entries(types).map(([id, t]) => (
          <div key={id}>
            <i className="type-dot" style={{ background: typeColor(types, id) }} />
            <span>
              {t.label}
              <small>{categories[t.base || id]?.label}</small>
            </span>
            <button
              className="icon-button"
              aria-label={"Изменить вид " + t.label}
              onClick={() => setDraft({ ...t, id })}
            >
              <Pencil size={15} />
            </button>
            {!categories[id] && (
              <button
                className="icon-button"
                aria-label={"Удалить вид " + t.label}
                onClick={async () => {
                  if (
                    await run(
                      () => api.removeType(id),
                      "Вид удалён; время сохранено",
                    )
                  )
                    setDraft(empty());
                }}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
      <form
        className="type-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          if (await run(() => api.saveType(draft), "Вид сохранён"))
            setDraft(empty());
          setSaving(false);
        }}
      >
        <div className="type-form-heading">
          <h3>{types[draft.id] ? "Изменить вид" : "Новый вид"}</h3>
          {types[draft.id] && (
            <button
              type="button"
              className="text-button"
              onClick={() => setDraft(empty())}
            >
              Создать новый
            </button>
          )}
        </div>
        <input
          className="type-name"
          aria-label="Название вида"
          placeholder="Например, Учёба"
          maxLength={32}
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          required
        />
        <div className="color-swatches" role="group" aria-label="Цвет вида">
          {colors.map((c) => (
            <button
              type="button"
              aria-label={"Цвет " + c}
              aria-pressed={draft.color === c}
              style={{ background: c }}
              key={c}
              onClick={() => setDraft((d) => ({ ...d, color: c }))}
            >
              {draft.color === c && <Check size={15} />}
            </button>
          ))}
        </div>
        <div className="base-choice" role="group" aria-label="Влияние на фокус">
          {Object.entries(categories).map(([id, t]) => (
            <button
              type="button"
              key={id}
              disabled={!!categories[draft.id] && draft.id !== id}
              aria-pressed={draft.base === id}
              onClick={() => setDraft((d) => ({ ...d, base: id }))}
            >
              <i className="type-dot" style={{ background: t.color }} />
              {t.label}
            </button>
          ))}
        </div>
        <button
          className="accent-button"
          disabled={saving || !draft.label.trim()}
        >
          <Plus size={16} />
          {types[draft.id] ? "Сохранить вид" : "Добавить вид"}
        </button>
      </form>
    </>
  );
}
function HiddenApps() {
  const { data, run } = useContext(Context),
    apps = Object.entries(data.catalog).filter(([, a]) => a.hidden);
  return (
    <div className="hidden-apps">
      {apps.length ? (
        apps.map(([id, a]) => (
          <div key={id}>
            <Monitor size={20} />
            <span>{a.name}</span>
            <button
              className="quiet-button"
              onClick={() =>
                run(() => api.hideApp(id, false), "Программа возвращена")
              }
            >
              <RotateCcw size={15} />
              Вернуть
            </button>
          </div>
        ))
      ) : (
        <p className="dialog-description">Скрытых программ нет.</p>
      )}
    </div>
  );
}
function AppIcon({ item, icons, editing }) {
  const { run } = useContext(Context);
  const image = (
    <span className={"app-icon " + item.category}>
      {icons?.[item.id] ? (
        <img alt="" src={icons[item.id]} />
      ) : item.category === "focus" ? (
        <Code2 size={22} />
      ) : item.category === "rest" ? (
        <Gamepad2 size={22} />
      ) : (
        <span className="monogram">{item.name.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
  if (!editing) return image;
  return (
    <Menu
      label="Иконка программы"
      trigger={
        <button
          className="icon-edit"
          aria-label={"Изменить иконку " + item.name}
        >
          {image}
          <i>
            <ImagePlus size={12} />
          </i>
        </button>
      }
    >
      {(close) => (
        <>
          <div className="menu-label">ИКОНКА ПРОГРАММЫ</div>
          <button
            onClick={() => {
              close();
              run(() => api.icon(item.id), "Иконка обновлена");
            }}
          >
            <ImagePlus size={16} />
            Выбрать картинку или EXE
          </button>
          <button
            onClick={() => {
              close();
              run(
                () => api.icon(item.id, true),
                "Исходная иконка восстановлена",
              );
            }}
          >
            <RotateCcw size={16} />
            Восстановить из программы
          </button>
        </>
      )}
    </Menu>
  );
}
function SiteCategory({ domain, app }) {
  const { data, types, run } = useContext(Context);
  const current = data.siteCategories?.[domain];
  const studyId = Object.entries(types).find(([id, type]) =>
    !categories[id] && type.base === "focus" && /^уч[её]ба$/i.test(type.label.trim()))?.[0]
    || (types["c-site-study"] ? "c-site-study" : "study");
  const options = [
    ["focus", "Работа"],
    [studyId, "Учёба"],
    ["rest", "Развлечения"],
    ["neutral", "Другое"],
    ...Object.entries(types)
      .filter(([id]) => !["focus", "rest", "neutral", studyId].includes(id))
      .map(([id, type]) => [id, type.label]),
  ];
  const label = options.find(([id]) => id === current)?.[1] || `Как у ${app.name}`;
  return (
    <Menu
      label={`Категория сайта ${domain}`}
      trigger={
        <button className="site-category" aria-label={`Категория сайта: ${domain}`} title={label}>
          <span>{label}</span><ChevronDown size={12} />
        </button>
      }
    >
      {(close) => <>
        <div className="menu-label">КАТЕГОРИЯ САЙТА</div>
        <div className="menu-type-list">
          {options.map(([id, label]) => (
            <button key={id} role="menuitemradio" aria-checked={current === id}
              onClick={() => { close(); run(() => api.siteCategory(domain, id)); }}>
              <span>{label}</span>{current === id && <Check size={15} />}
            </button>
          ))}
        </div>
        <div className="menu-divider" />
        <button role="menuitemradio" aria-checked={!current}
          onClick={() => { close(); run(() => api.siteCategory(domain, null)); }}>
          <RotateCcw size={14} /><span>Как у {app.name}</span>{!current && <Check size={15} />}
        </button>
        <p className="site-category-hint">Применится к статистике всех дней.</p>
      </>}
    </Menu>
  );
}
function Sites({ app }) {
  const { data } = useContext(Context),
    { active, canFade } = useMotion(),
    [more, setMore] = useState(false),
    sites = app.sites || [];
  return (
    <div className="sites-detail">
      <div className="sites-heading">
        <span>
          Сайты <small>{sites.length}</small>
        </span>
        <small>Категория</small>
      </div>
      {sites.length ? (
        sites.slice(0, more ? undefined : 8).map((s, i) => (
          <motion.div
            className="site-row"
            key={s.domain}
            initial={canFade ? { opacity: 0, x: active ? -6 : 0 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: canFade ? 0.16 : 0, delay: active ? Math.min(i * 0.02, 0.1) : 0 }}
          >
            <span className="site-mark">
              <Globe size={17} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div>
              <strong title={s.domain}>{s.domain.replace(/^www\./, "")}</strong>
              <div className="site-track">
                <Fill value={app.ms ? s.ms / app.ms : 0} color="var(--muted)" />
              </div>
            </div>
            <SiteCategory domain={s.domain} app={app} />
            <Duration ms={s.ms} />
          </motion.div>
        ))
      ) : (
        <div className="sites-empty">
          <Globe size={23} />
          <p>
            {data.browserStatus === "disabled"
              ? "Учёт сайтов выключен в настройках."
              : "Сайты появятся после использования Firefox."}
          </p>
        </div>
      )}
      {sites.length > 8 && (
        <button className="text-button" onClick={() => setMore((x) => !x)}>
          {more ? "Свернуть" : "Все сайты (" + sites.length + ")"}
        </button>
      )}
    </div>
  );
}
export default function ProgramList({
  apps,
  icons,
  totalMs,
  all = false,
  title = "Программы",
}) {
  const { data, types, setModal } = useContext(Context),
    { active } = useMotion(),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [short, setShort] = useState(false),
    [editing, setEditing] = useState(false),
    [expanded, setExpanded] = useState({});
  const list = apps.filter(
      (a) =>
        !a.hidden &&
        (short || data.settings.hideShort === false || a.ms >= 60000),
    ),
    shortCount = apps.filter((a) => !a.hidden && a.ms < 60000).length;
  const visible = list.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" || allocation(a)[filter]),
  );
  return (
    <Panel className={"programs " + (all ? "all-programs" : "")}>
      <div className="section-heading">
        <div>
          <h2>
            <span className="heading-icon violet">
              <Layers3 />
            </span>
            {title}
            <span className="count">{list.length}</span>
          </h2>
          <p>Только время активного окна</p>
        </div>
        <div className="program-actions">
          <button
            className="icon-button"
            aria-label="Виды программ"
            title="Свои виды"
            onClick={() => setModal({ kind: "types" })}
          >
            <Plus size={18} />
          </button>
          <button
            className={"icon-button " + (editing ? "editing" : "")}
            aria-label="Редактировать список программ"
            title="Иконки и удаление из списка"
            aria-pressed={editing}
            onClick={() => setEditing((x) => !x)}
          >
            {editing ? <Check size={17} /> : <Pencil size={16} />}
          </button>
        </div>
      </div>
      {all && (
        <>
          <label className="search program-search">
            <Search size={16} />
            <input
              aria-label="Поиск программы"
              placeholder="Найти программу"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div
            className="program-filters"
            role="group"
            aria-label="Категории программ"
          >
            {[["all", { label: "Все" }], ...Object.entries(types)].map(
              ([id, t]) => (
                <button
                  key={id}
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                  className={filter === id ? "selected" : ""}
                >
                  {filter === id && (
                    <motion.span
                      className="filter-pill"
                      transition={{ duration: active ? 0.22 : 0 }}
                    />
                  )}
                  <span>{t.label}</span>
                </button>
              ),
            )}
          </div>
        </>
      )}
      {editing && (
        <div className="edit-hint">
          <ImagePlus size={15} />
          <span>
            Нажми на иконку, чтобы заменить её. Корзина уберёт программу из
            списка.
          </span>
          <button onClick={() => setModal({ kind: "hidden" })}>Скрытые</button>
        </div>
      )}
      <motion.div
        className={"program-rows " + (all ? "scroll-fade" : "")}
        layoutScroll
      >
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((a, i) => {
            const parts = Object.entries(allocation(a)),
              color = typeColor(types, parts[0][0]),
              firefox = a.id.toLowerCase() === "firefox.exe";
            return (
              <motion.div
                key={a.id}
                className="program-item"
                layout={false}
                initial={active ? { opacity: 0, y: 12 } : false}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{
                  duration: active ? 0.22 : 0,
                  delay: Math.min(i * 0.02, 0.15),
                }}
              >
                <div className="program-row" data-app-id={a.id}>
                  <AppIcon item={a} icons={icons} editing={editing} />
                  <div className="program-info">
                    <div className="program-name-line">
                      {firefox ? (
                        <button
                          className="browser-expand"
                          aria-label="Сайты Firefox"
                          aria-expanded={!!expanded[a.id]}
                          onClick={() =>
                            setExpanded((x) => ({ ...x, [a.id]: !x[a.id] }))
                          }
                        >
                          <strong>{a.name}</strong>
                          <motion.span
                            animate={{ rotate: expanded[a.id] ? 180 : 0 }}
                          >
                            <ChevronDown size={14} />
                          </motion.span>
                        </button>
                      ) : (
                        <strong title={a.name}>{a.name}</strong>
                      )}
                    </div>
                    <div className="app-track">
                      <Fill
                        value={totalMs ? a.ms / totalMs : 0}
                        color={color}
                      />
                    </div>
                    {parts.length > 1 && (
                      <div className="mix-caption">
                        {parts.map(([id, p]) => (
                          <span key={id}>
                            {p}% {types[id]?.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <CategorySelect app={a} />
                  <span className="program-time">
                    <Duration ms={a.ms} />
                  </span>
                  {editing && (
                    <button
                      className="remove-program icon-button"
                      aria-label={"Убрать " + a.name + " из списка"}
                      onClick={() => setModal({ kind: "hide", app: a })}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <AnimatePresence initial={false}>
                  {firefox && expanded[a.id] && (
                    <motion.div
                      className="sites-collapse"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        duration: active ? 0.2 : 0,
                        ease: [0.23, 1, 0.32, 1],
                      }}
                    >
                      <Sites app={a} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
      {!visible.length && (
        <div className="empty-state">
          <Monitor size={30} />
          <h3>
            {search || filter !== "all"
              ? "Ничего не найдено"
              : "Пока нет программ дольше минуты"}
          </h3>
          <p>
            {search || filter !== "all"
              ? "Попробуй другой вид или название."
              : "Они появятся автоматически по мере использования."}
          </p>
        </div>
      )}
      <div className="program-list-footer">
        <span>
          <ShieldCheck size={13} />
          Фоновое время не учитывается
        </span>
        <div>
          {shortCount > 0 && data.settings.hideShort !== false && (
            <button onClick={() => setShort((x) => !x)} aria-pressed={short}>
              {short ? "Скрыть короткие" : "Меньше минуты · " + shortCount}
            </button>
          )}
          <button onClick={() => setModal({ kind: "hidden" })}>Скрытые</button>
        </div>
      </div>
    </Panel>
  );
}
