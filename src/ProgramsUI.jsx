import { useLocale } from "./i18n.jsx";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
  Code2,
  Gamepad2,
  Monitor,
  Globe,
  Search,
  EyeOff,
  ArrowUpRight,
  ArrowRight,
  Tag,
} from "lucide-react";
import {
  motion,
  AnimatePresence,
  Panel,
  Duration,
  useMotion,
} from "./motion.jsx";
import { ChoiceSelect } from "./DatePicker.jsx";
import { cssEaseOut, easeOut } from "./motion-policy.js";
import { categories } from "./shared.js";
import browsers from "../desktop/browsers.json";
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
  const { t, errorText } = useLocale();
  const [modal, setModal] = useState(null);
  const types = Object.fromEntries(Object.entries(data.types || categories).map(([id, type]) => [
    id,
    (categories[id]?.label === type.label || (id === "c-site-study" && type.label === "Учёба"))
      ? { ...type, label: t(type.label) }
      : type,
  ]));
  const run = async (action, message) => {
    try {
      const result = await action();
      await refresh();
      if (message && result !== false) notify(message);
      return true;
    } catch (e) {
      notify(errorText(e, "Не удалось сохранить изменения"));
      return false;
    }
  };
  return (
    <Context.Provider
      value={{ data, types, run, setModal }}
    >
      {children}
      <AnimatePresence>
        {modal && (
          <Modal
            key={modal.kind}
            title={
              modal.kind === "mix"
                ? t("Распределение времени")
                : modal.kind === "types"
                  ? t("Твои виды программ")
                  : modal.kind === "hide"
                    ? t("Убрать программу?")
                    : t("Скрытые программы")
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
                  <strong>{modal.app.name}</strong>{" "}{t("исчезнет из списков. Время и записи дня сохранятся. Вернуть программу можно через «Скрытые».")}</p>
                <div className="dialog-actions">
                  <button
                    className="quiet-button"
                    onClick={() => setModal(null)}
                  >{t("Отмена")}</button>
                  <button
                    className="danger-button"
                    onClick={async () => {
                      if (
                        await run(
                          () => api.hideApp(modal.app.id, true),
                          t("Программа скрыта"),
                        )
                      )
                        setModal(null);
                    }}
                  >
                    <EyeOff size={16} />{t("Убрать из списка")}</button>
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
  const { t } = useLocale();
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
          <span className="eyebrow">{t("DAYLINE / ПОД ТЕБЯ")}</span>
          <h2>{title}</h2>
        </div>
        <button className="icon-button" aria-label={t("Закрыть")} onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      {children}
    </motion.dialog>
  );
}
function MenuSurface({ children, ...props }) {
  const present = useIsPresent();
  return (
    <motion.div {...props} aria-hidden={!present || undefined} inert={!present || undefined}>
      {children}
    </motion.div>
  );
}
const menuMotion = ({ effective, inputMethod }) => {
  const mode = inputMethod.current === "keyboard" ? "off" : effective;
  return {
    opacity: 0,
    ...(mode === "on" && { transform: "translateY(-3px)" }),
    transition: { duration: mode === "on" ? 0.16 : mode === "reduced" ? 0.12 : 0, ease: easeOut },
  };
};
function Menu({ trigger, children, label }) {
  const [open, setOpen] = useState(false),
    motionPolicy = useMotion(),
    ref = useRef(null);
  const approach = menuMotion(motionPolicy);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <AnimatePresence custom={motionPolicy}>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content
              asChild
              sideOffset={5}
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
                custom={motionPolicy}
                variants={{ closed: menuMotion }}
                initial={approach.transition.duration ? "closed" : false}
                animate={{ opacity: 1, ...(approach.transform && { transform: "translateY(0px)" }) }}
                exit="closed"
                transition={approach.transition}
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
  const { t } = useLocale();
  const { types, run, setModal } = useContext(Context),
    parts = Object.entries(allocation(app)),
    mix = parts.length > 1,
    first = types[parts[0][0]] || categories.neutral,
    label = mix ? t("Смешанная") : first.label,
    hint = mix
      ? parts.map(([id, share]) => `${types[id]?.label || id} ${share}%`).join(" · ")
      : label;
  return (
    <Menu
      label={t("Выбери вид")}
      trigger={
        <button
          className={"category-trigger " + (mix ? "is-mixed" : "")}
          aria-label={t("Категория: ") + app.id}
          aria-description={hint}
          title={hint}
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
          <span>{label}</span>
          <ChevronDown size={13} />
        </button>
      }
    >
      {(close) => (
        <>
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
          {mix && <p className="category-split">{hint}</p>}
          <div className="menu-divider" />
          <button
            role="menuitem"
            onClick={() => {
              close();
              setModal({ kind: "mix", app });
            }}
          >
            <SlidersHorizontal size={16} />
            <span>{t("Распределить по долям")}</span>
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
            <span>{t("Добавить / изменить виды")}</span>
          </button>
        </>
      )}
    </Menu>
  );
}
function MixEditor({ app, onClose }) {
  const { t } = useLocale();
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
            t("Распределение сохранено"),
          )
        )
          onClose();
        setSaving(false);
      }}
    >
      <p className="dialog-description">
        {app.name} · {Object.hasOwn(browsers, app.id.toLowerCase())
          ? t("Доли применятся к сайтам без своей категории и времени без адреса.")
          : t("Доли применятся ко всему записанному времени программы.")}
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
        <SlidersHorizontal size={15} />{t("50% работа / 50% отдых")}<ArrowUpRight size={14} />
      </button>
      <div className="allocation-fields">
        {Object.entries(types).map(([id, type]) => (
          <label className="allocation-field" key={id}>
            <span>
              <i className="type-dot" style={{ background: typeColor(types, id) }} />
              {type.label}
            </span>
            <span>
              <input
                aria-label={t("Доля: ") + type.label}
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
        <span>{t("Всего")}</span>
        <strong>{total} / 100%</strong>
      </div>
      <div className="dialog-actions">
        <button type="button" className="quiet-button" onClick={onClose}>{t("Отмена")}</button>
        <button className="accent-button" disabled={total !== 100 || saving}>
          <Check size={16} />
          {saving ? t("Сохраняю…") : t("Сохранить доли")}
        </button>
      </div>
    </form>
  );
}
function TypeManager() {
  const { t } = useLocale();
  const { data, types, run } = useContext(Context),
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
      <p className="dialog-description">{t("Например, учёба, творчество или общение. Выбери, как вид влияет на фокус дня.")}</p>
      <div className="type-catalog">
        {Object.entries(types).map(([id, type]) => (
          <div key={id}>
            <i className="type-dot" style={{ background: typeColor(types, id) }} />
            <span>
              {type.label}
              <small>{t(categories[type.base || id]?.label)}</small>
            </span>
            <button
              className="icon-button"
              aria-label={t("Изменить вид ") + type.label}
              onClick={() => setDraft({ ...type, id })}
            >
              <Pencil size={15} />
            </button>
            {!categories[id] && (
              <button
                className="icon-button"
                aria-label={t("Удалить вид ") + type.label}
                onClick={async () => {
                  if (
                    await run(
                      () => api.removeType(id),
                      t("Вид удалён; время сохранено"),
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
          const oldLabel = data.types?.[draft.id]?.label;
          const label = oldLabel && draft.label === types[draft.id]?.label ? oldLabel : draft.label;
          if (await run(() => api.saveType({ ...draft, label }), t("Вид сохранён")))
            setDraft(empty());
          setSaving(false);
        }}
      >
        <div className="type-form-heading">
          <h3>{types[draft.id] ? t("Изменить вид") : t("Новый вид")}</h3>
          {types[draft.id] && (
            <button
              type="button"
              className="text-button"
              onClick={() => setDraft(empty())}
            >{t("Создать новый")}</button>
          )}
        </div>
        <input
          className="type-name"
          aria-label={t("Название вида")}
          placeholder={t("Например, Учёба")}
          maxLength={32}
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          required
        />
        <div className="color-swatches" role="group" aria-label={t("Цвет вида")}>
          {colors.map((c) => (
            <button
              type="button"
              aria-label={t("Цвет ") + c}
              aria-pressed={draft.color === c}
              style={{ background: c }}
              key={c}
              onClick={() => setDraft((d) => ({ ...d, color: c }))}
            >
              {draft.color === c && <Check size={15} />}
            </button>
          ))}
        </div>
        <div className="base-choice" role="group" aria-label={t("Влияние на фокус")}>
          {Object.entries(categories).map(([id, type]) => (
            <button
              type="button"
              key={id}
              disabled={!!categories[draft.id] && draft.id !== id}
              aria-pressed={draft.base === id}
              onClick={() => setDraft((d) => ({ ...d, base: id }))}
            >
              <i className="type-dot" style={{ background: type.color }} />
              {t(type.label)}
            </button>
          ))}
        </div>
        <button
          className="accent-button"
          disabled={saving || !draft.label.trim()}
        >
          <Plus size={16} />
          {types[draft.id] ? t("Сохранить вид") : t("Добавить вид")}
        </button>
      </form>
    </>
  );
}
function HiddenApps() {
  const { t } = useLocale();
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
                run(() => api.hideApp(id, false), t("Программа возвращена"))
              }
            >
              <RotateCcw size={15} />{t("Вернуть")}</button>
          </div>
        ))
      ) : (
        <p className="dialog-description">{t("Скрытых программ нет.")}</p>
      )}
    </div>
  );
}
function AppIcon({ item, icons, editing }) {
  const { t } = useLocale();
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
      label={t("Иконка программы")}
      trigger={
        <button
          className="icon-edit"
          aria-label={t("Изменить иконку ") + item.name}
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
          <div className="menu-label">{t("ИКОНКА ПРОГРАММЫ")}</div>
          <button
            onClick={() => {
              close();
              run(() => api.icon(item.id), t("Иконка обновлена"));
            }}
          >
            <ImagePlus size={16} />{t("Выбрать картинку или EXE")}</button>
          <button
            onClick={() => {
              close();
              run(
                () => api.icon(item.id, true),
                t("Исходная иконка восстановлена"),
              );
            }}
          >
            <RotateCcw size={16} />{t("Восстановить из программы")}</button>
        </>
      )}
    </Menu>
  );
}
function SiteCategory({ domain, app }) {
  const { t } = useLocale();
  const { data, types, run } = useContext(Context);
  const current = data.siteCategories?.[domain];
  const studyId = Object.entries(types).find(([id, type]) =>
    !categories[id] && type.base === "focus" && /^(уч[её]ба|study)$/i.test(type.label.trim()))?.[0]
    || (types["c-site-study"] ? "c-site-study" : "study");
  const options = [
    ["focus", t("Работа")],
    [studyId, t("Учёба")],
    ["rest", t("Развлечения")],
    ["neutral", t("Другое")],
    ...Object.entries(types)
      .filter(([id]) => !["focus", "rest", "neutral", studyId].includes(id))
      .map(([id, type]) => [id, type.label]),
  ];
  const label = options.find(([id]) => id === current)?.[1] || t("Как у {0}", app.name);
  const color = current === studyId && !types[studyId]
    ? "var(--violet)"
    : typeColor(types, current);
  return (
    <Menu
      label={t("Категория сайта {0}", domain)}
      trigger={
        <button className="category-trigger site-category" aria-label={t("Категория сайта: {0}", domain)} aria-description={label} title={label}>
          <i className="type-dot" style={{ background: color }} />
          <span>{label}</span><ChevronDown size={13} />
        </button>
      }
    >
      {(close) => <>
        <div className="menu-type-list">
          {options.map(([id, label]) => (
            <button key={id} role="menuitemradio" aria-checked={current === id}
              onClick={() => { close(); run(() => api.siteCategory(domain, id)); }}>
              <i className="type-dot" style={{ background: id === studyId && !types[id] ? "var(--violet)" : typeColor(types, id) }} />
              <span>{label}</span>{current === id && <Check size={15} />}
            </button>
          ))}
        </div>
        <div className="menu-divider" />
        <button role="menuitemradio" aria-checked={!current}
          onClick={() => { close(); run(() => api.siteCategory(domain, null)); }}>
          <RotateCcw size={14} /><span>{t("Как у {0}", app.name)}</span>{!current && <Check size={15} />}
        </button>
        <p className="site-category-hint">{t("Применится к статистике всех дней.")}</p>
      </>}
    </Menu>
  );
}
function Sites({ app, id, groupRef, closing, editing }) {
  const { t } = useLocale();
  const { data } = useContext(Context);
  const [more, setMore] = useState(false);
  const sites = app.sites || [];
  return (
    <div
      className="sites-collapse"
      id={id}
      ref={groupRef}
      role="presentation"
      data-closing={closing || undefined}
      aria-hidden={closing || undefined}
      inert={closing || undefined}
    >
      {sites.length ? (
        sites.slice(0, more ? undefined : 8).map((site) => (
          <div className="site-row program-columns" role="row" key={site.domain}>
            <div className="site-name" role="rowheader">
              <span className="site-mark" aria-hidden="true"><Globe size={18} strokeWidth={1.6} /></span>
              <strong title={site.domain}>{site.domain.replace(/^www\./, "")}</strong>
            </div>
            <div className="program-category" role="cell">
              <SiteCategory domain={site.domain} app={app} />
            </div>
            <div className={"program-time" + (editing ? " time-with-action" : "")} role="cell">
              <Duration ms={site.ms} />
            </div>
          </div>
        ))
      ) : (
        <div className="sites-empty" role="row">
          <div role="cell">
            {data.browserStatus === "disabled"
              ? t("Учёт сайтов выключен в настройках.")
              : t("Сайты появятся после использования {0}.", browsers[app.id.toLowerCase()])}
          </div>
        </div>
      )}
      {sites.length > 8 && (
        <div className="sites-more" role="row">
          <div role="cell">
            <button className="text-button" onClick={() => setMore((x) => !x)}>
              {more ? t("Свернуть") : t("Все сайты (") + sites.length + ")"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const clippedSites = "inset(0 0 100% 0)";
const revealedSites = "inset(0 0 0% 0)";

function useSitesDisclosure() {
  const [state, setState] = useState("closed");
  const id = useId();
  const groupRef = useRef(null);
  const pending = useRef(null);
  const running = useRef([]);
  const { effective, canFade, inputMethod } = useMotion();
  const cancel = () => {
    for (const animation of running.current) animation.cancel();
    running.current = [];
  };

  useLayoutEffect(() => {
    const change = pending.current;
    pending.current = null;
    const group = groupRef.current;
    if (!change || !group) return;

    // Read every final position before writing animation effects to the rows.
    const offsets = change.rows.map(({ element, top }) => ({
      element,
      dy: top - element.getBoundingClientRect().top,
    }));
    const open = state === "open";
    const options = {
      duration: change.full ? 180 : 120,
      easing: cssEaseOut,
    };
    const frames = [{ opacity: change.opacity }, { opacity: open ? 1 : 0 }];
    if (change.full) {
      frames[0].clipPath = change.clipPath;
      frames[1].clipPath = open ? revealedSites : clippedSites;
    }
    const groupAnimation = group.animate(frames, { ...options, fill: "both" });
    const rowAnimations = offsets
      .filter(({ dy }) => Math.abs(dy) >= 0.5)
      .map(({ element, dy }) => element.animate(
        [{ transform: "translateY(" + dy + "px)" }, { transform: "translateY(0)" }],
        options,
      ));
    running.current = [groupAnimation, ...rowAnimations];
    groupAnimation.onfinish = () => {
      if (running.current[0] !== groupAnimation) return;
      if (!open) setState("closed");
      cancel();
    };
  }, [state]);

  useLayoutEffect(() => {
    if (!canFade) {
      cancel();
      setState((current) => current === "closing" ? "closed" : current);
    }
  }, [canFade]);

  useLayoutEffect(() => cancel, []);

  function toggle(event) {
    const open = state !== "open";
    const mode = inputMethod.current === "keyboard" || event.detail === 0
      ? "off"
      : effective;
    const full = mode === "on";
    if (mode !== "off") {
      const group = groupRef.current;
      const style = group ? getComputedStyle(group) : null;
      const rows = [];
      if (full) {
        const removedHeight = !open && group ? group.offsetHeight : 0;
        // A close can also bring a row just below the viewport into view.
        let element = event.currentTarget.closest(".program-item")?.nextElementSibling;
        while (element) {
          const { top, bottom } = element.getBoundingClientRect();
          if (top - removedHeight >= window.innerHeight) break;
          if (bottom > 0) rows.push({ element, top });
          element = element.nextElementSibling;
        }
      }
      pending.current = {
        full,
        rows,
        opacity: style?.opacity ?? 0,
        clipPath: style && style.clipPath !== "none"
          ? style.clipPath
          : group ? revealedSites : clippedSites,
      };
    }
    cancel();
    if (open) setState("open");
    else setState(mode === "off" ? "closed" : "closing");
  }

  return { id, groupRef, state, toggle };
}

function ProgramItem({ app, icons, editing, sites }) {
  const { t } = useLocale();
  const { setModal } = useContext(Context);
  const open = sites?.state === "open";
  const renderSites = sites && sites.state !== "closed";
  return (
    <div className="program-item" role="presentation">
      <div
        className="program-row program-columns"
        role="row"
        data-app-id={app.id}
        data-expanded={open || undefined}
      >
        <div className="program-name" role="rowheader">
          <AppIcon item={app} icons={icons} editing={editing} />
          {sites ? (
            <button
              className="browser-expand"
              aria-label={t("Сайты {0}", browsers[app.id.toLowerCase()])}
              aria-expanded={open}
              aria-controls={renderSites ? sites.id : undefined}
              onClick={sites.toggle}
              title={app.name}
            >
              <ChevronDown className="browser-chevron" size={16} aria-hidden="true" />
              <strong>{app.name}</strong>
            </button>
          ) : (
            <strong title={app.name}>{app.name}</strong>
          )}
        </div>
        <div className="program-category" role="cell">
          <CategorySelect app={app} />
        </div>
        <div className={"program-time" + (editing ? " time-with-action" : "")} role="cell">
          <Duration ms={app.ms} />
          {editing && (
            <button
              className="remove-program icon-button"
              aria-label={t("Убрать ") + app.name + t(" из списка")}
              onClick={() => setModal({ kind: "hide", app })}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
      {renderSites && (
        <Sites
          app={app}
          id={sites.id}
          groupRef={sites.groupRef}
          closing={!open}
          editing={editing}
        />
      )}
    </div>
  );
}

function BrowserProgramItem(props) {
  const sites = useSitesDisclosure();
  return <ProgramItem {...props} sites={sites} />;
}

export default function ProgramList({
  apps,
  icons,
  all = false,
  title,
  showTitle = true,
  limit,
  onShowAll,
  headingAction,
}) {
  const { t, locale } = useLocale();
  const { data, types, setModal } = useContext(Context);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [short, setShort] = useState(false);
  const [editing, setEditing] = useState(false);
  const category = types[filter] ? filter : "all";
  const query = search.trim().toLocaleLowerCase(locale);
  const listed = apps.filter((app) => !app.hidden);
  const shortCount = listed.filter((app) => app.ms < 60000).length;
  const visible = listed.filter((app) =>
    (short || data.settings.hideShort === false || app.ms >= 60000) &&
    app.name.toLocaleLowerCase(locale).includes(query) &&
    (category === "all" || allocation(app)[category]),
  ).sort((a, b) => b.ms - a.ms || a.name.localeCompare(b.name, locale));
  const shown = limit === undefined ? visible : visible.slice(0, limit);
  const hideShort = shortCount > 0 && data.settings.hideShort !== false;
  const actions = (
    <div className="program-actions">
      <button
        className="program-action"
        aria-label={t("Редактировать список программ")}
        aria-pressed={editing}
        onClick={() => setEditing((value) => !value)}
      >
        {editing ? <Check size={15} /> : <Pencil size={15} />}
        <span>{editing ? t("Готово") : t("Редактировать список")}</span>
      </button>
      <button
        className="program-action"
        aria-label={t("Виды программ")}
        onClick={() => setModal({ kind: "types" })}
      >
        <Tag size={15} />
        <span>{t("Категории")}</span>
      </button>
    </div>
  );
  return (
    <Panel className={"programs " + (all ? "all-programs" : "programs-compact")}>
      {(showTitle || headingAction) && (
        <div className="program-heading">
          {showTitle && <h2>{title ?? t("Программы")}</h2>}
          {headingAction}
        </div>
      )}
      {all && (
        <div className="program-toolbar">
          <div className="program-query">
            <label className="search program-search">
              <Search size={16} aria-hidden="true" />
              <input
                aria-label={t("Поиск программы")}
                placeholder={t("Найти программу")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <ChoiceSelect
              label={t("Категории программ")}
              value={category}
              options={[
                { value: "all", label: t("Все категории") },
                ...Object.entries(types).map(([value, type]) => ({ value, label: type.label })),
              ]}
              onChange={setFilter}
            />
          </div>
          {actions}
        </div>
      )}
      {editing && (
        <div className="edit-hint">
          <ImagePlus size={15} aria-hidden="true" />
          <span>{t("Нажми на иконку, чтобы заменить её. Корзина уберёт программу из списка.")}</span>
        </div>
      )}
      {shown.length > 0 ? (
        <div className="program-table" role="table" aria-label={title}>
          <div className="program-columns program-table-head" role="row">
            <span role="columnheader">{t("Программа")}</span>
            <span role="columnheader">{t("Категория")}</span>
            <span className={"program-time" + (editing ? " time-with-action" : "")} role="columnheader">{t("Время")}</span>
          </div>
          <div className="program-rows" role="rowgroup">
            {shown.map((app) => {
              const Item = Object.hasOwn(browsers, app.id.toLowerCase())
                ? BrowserProgramItem
                : ProgramItem;
              return <Item key={app.id} app={app} icons={icons} editing={editing} />;
            })}
          </div>
        </div>
      ) : (
        <div className="empty-state program-empty">
          <Monitor size={24} aria-hidden="true" />
          <h3>
            {query || category !== "all"
              ? t("Ничего не найдено")
              : t("Пока нет программ дольше минуты")}
          </h3>
          <p>
            {query || category !== "all"
              ? t("Попробуй другую категорию или название.")
              : t("Они появятся автоматически по мере использования.")}
          </p>
        </div>
      )}
      <div className="program-list-footer">
        {onShowAll && (
          <button className="program-show-all" onClick={onShowAll}>{t("Все программы")}<ArrowRight size={15} aria-hidden="true" />
          </button>
        )}
        {all && (
          <div className="program-list-options">
            {hideShort && (
              <button className="program-option" onClick={() => setShort((x) => !x)} aria-pressed={short}>
                {short ? t("Скрыть короткие") : t("Меньше минуты · ") + shortCount}
              </button>
            )}
            <button className="program-option" onClick={() => setModal({ kind: "hidden" })}>{t("Скрытые")}</button>
          </div>
        )}
      </div>
    </Panel>
  );
}
