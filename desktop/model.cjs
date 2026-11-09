const CATEGORIES = ["focus", "neutral", "rest"];
const {
  DEFAULT_FOCUS,
  focusSettings,
  scoreFor,
} = require("./focus-settings.cjs");
const DEFAULT_TYPES = {
  focus: { label: "Работа", color: "#b9ff4b", base: "focus" },
  neutral: { label: "Нейтрально", color: "#ffe34d", base: "neutral" },
  rest: { label: "Отдых", color: "#ff5ca8", base: "rest" },
};
const safeKey = (id) =>
  typeof id === "string" &&
  !["__proto__", "constructor", "prototype"].includes(id);
const localDate = (ms) => {
  const d = new Date(ms);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};
function initialState() {
  return {
    version: 1,
    createdAt: Date.now(),
    apps: {},
    sessions: [],
    entries: {},
    siteCategories: {},
    types: structuredClone(DEFAULT_TYPES),
    settings: {
      idleMinutes: 3,
      launchAtLogin: false,
      hideShort: true,
      trackSites: true,
      ...DEFAULT_FOCUS,
    },
  };
}
function categoryFor(exe, path = "") {
  if (
    /^(code|devenv|rider64|idea64|pycharm64|webstorm64|figma|photoshop|illustrator|blender|obsidian|notion|winword|excel|powerpnt|windowsterminal)\.exe$/i.test(
      exe,
    )
  )
    return "focus";
  if (
    /steamapps[\\/]common[\\/]|[\\/](games|riot games|epic games)[\\/]/i.test(
      path,
    ) ||
    /^(steam|epicgameslauncher|discord|vlc|spotify)\.exe$/i.test(exe)
  )
    return "rest";
  return "neutral";
}
function allocationFor(state, app) {
  return app?.allocations || { [app?.category || "neutral"]: 100 };
}
function checkAllocation(state, values) {
  if (
    !values ||
    typeof values !== "object" ||
    Array.isArray(values) ||
    !Object.keys(values).length ||
    Object.keys(values).length > 50
  )
    throw Error("Укажи доли категорий.");
  let sum = 0;
  for (const [key, n] of Object.entries(values)) {
    if (
      !safeKey(key) ||
      !Object.hasOwn(state.types, key) ||
      !Number.isInteger(n) ||
      n <= 0 ||
      n > 100
    )
      throw Error("Доля должна быть от 1 до 100%.");
    sum += n;
  }
  if (sum !== 100) throw Error("Сумма долей должна быть 100%.");
}
function setAllocation(state, id, values) {
  if (!Object.hasOwn(state.apps, id)) throw Error("Программа не найдена.");
  checkAllocation(state, values);
  const a = state.apps[id];
  a.allocations = { ...values };
  const largest = Object.entries(values).sort((a, b) => b[1] - a[1])[0][0];
  a.category = state.types[largest].base;
}
function saveType(state, { id, label, color, base }) {
  if (
    !safeKey(id) ||
    (!CATEGORIES.includes(id) && !/^c-[a-zA-Z0-9-]{1,64}$/.test(id)) ||
    typeof label !== "string" ||
    !label.trim() ||
    label.trim().length > 32 ||
    !/^#[a-fA-F0-9]{6}$/.test(color) ||
    !CATEGORIES.includes(base) ||
    (CATEGORIES.includes(id) && base !== id)
  )
    throw Error("Проверь название и цвет вида.");
  // The built-in website Study preset has its own slot, so existing profiles
  // retain every custom type even when their previous allowance is full.
  if (!Object.hasOwn(state.types, id) && id !== "c-site-study" &&
      Object.keys(state.types).filter(key => key !== "c-site-study").length >= 30)
    throw Error("Можно добавить до 30 видов.");
  state.types[id] = { label: label.trim(), color, base };
  for (const app of Object.values(state.apps)) {
    if (app.allocations?.[id]) {
      const largest = Object.entries(app.allocations).sort(
        (a, b) => b[1] - a[1],
      )[0][0];
      if (state.types[largest]) app.category = state.types[largest].base;
    }
  }
}
function removeType(state, id) {
  if (CATEGORIES.includes(id) || !Object.hasOwn(state.types, id))
    throw Error("Этот вид нельзя удалить.");
  const base = state.types[id].base;
  for (const [key, app] of Object.entries(state.apps)) {
    if (app.allocations?.[id]) {
      const next = { ...app.allocations };
      next[base] = (next[base] || 0) + next[id];
      delete next[id];
      setAllocation(state, key, next);
    }
  }
  for (const [domain, type] of Object.entries(state.siteCategories || {}))
    if (type === id) state.siteCategories[domain] = base;
  delete state.types[id];
}
function visibleApps(apps, hideShort = true) {
  return apps.filter((a) => !a.hidden && (!hideShort || a.ms >= 60000));
}
function validDomain(value) {
  return (
    typeof value === "string" &&
    value.length <= 253 &&
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/i.test(value)
  );
}
function setSiteCategory(state, domain, type) {
  if (!validDomain(domain)) throw Error("Некорректный адрес сайта.");
  domain = domain.toLowerCase();
  if (type === "study") {
    type = Object.entries(state.types).find(([id, t]) =>
      !CATEGORIES.includes(id) && t.base === "focus" && /^уч[её]ба$/i.test(t.label.trim()))?.[0] || "c-site-study";
    if (!Object.hasOwn(state.types, type))
      saveType(state, { id: type, label: "Учёба", color: "#ca8cf6", base: "focus" });
  }
  if (type !== null && (!safeKey(type) || !Object.hasOwn(state.types, type)))
    throw Error("Выбери существующий вид.");
  state.siteCategories ??= {};
  if (type === null) delete state.siteCategories[domain];
  else state.siteCategories[domain] = type;
}
function sessionAllocation(state, session) {
  const type = state.siteCategories?.[session.domain?.toLowerCase()];
  return type && Object.hasOwn(state.types || DEFAULT_TYPES, type)
    ? { [type]: 100 }
    : allocationFor(state, state.apps[session.appId]);
}
function addInterval(state, { appId, start, end, domain }) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
  const site = validDomain(domain) ? domain.toLowerCase() : undefined;
  while (start < end) {
    const d = new Date(start);
    const midnight = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate() + 1,
    ).getTime();
    const stop = Math.min(end, midnight),
      last = state.sessions.at(-1);
    if (
      last &&
      last.appId === appId &&
      last.domain === site &&
      Math.abs(last.end - start) < 2 &&
      localDate(last.start) === localDate(start)
    )
      last.end = stop;
    else
      state.sessions.push({
        appId,
        start,
        end: stop,
        ...(site ? { domain: site } : {}),
      });
    start = stop;
  }
}
function summary(state, date) {
  const sessions = state.sessions.filter((s) => localDate(s.start) === date),
    totals = {},
    sites = {};
  for (const s of sessions) {
    totals[s.appId] = (totals[s.appId] || 0) + s.end - s.start;
    if (s.domain) {
      const domain = s.domain.toLowerCase();
      sites[s.appId] ??= {};
      sites[s.appId][domain] =
        (sites[s.appId][domain] || 0) + s.end - s.start;
    }
  }
  const apps = Object.entries(totals)
    .map(([id, ms]) => ({
      id,
      ms,
      ...state.apps[id],
      category: state.apps[id]?.category || "neutral",
      sites: Object.entries(sites[id] || {})
        .map(([domain, ms]) => ({ domain, ms }))
        .sort((a, b) => b.ms - a.ms),
    }))
    .sort((a, b) => b.ms - a.ms);
  const basis = { focus: 0, neutral: 0, rest: 0 },
    typeTotals = {};
  let totalMs = 0;
  for (const session of sessions) {
    const ms = session.end - session.start;
    totalMs += ms;
    for (const [id, pct] of Object.entries(sessionAllocation(state, session))) {
      const value = (ms * pct) / 100;
      typeTotals[id] = (typeTotals[id] || 0) + value;
      basis[(state.types || DEFAULT_TYPES)[id]?.base || "neutral"] += value;
    }
  }
  return {
    date,
    totalMs,
    focusMs: basis.focus,
    restMs: basis.rest,
    neutralMs: basis.neutral,
    typeTotals,
    ...scoreFor(state.settings, {
      totalMs,
      focusMs: basis.focus,
      neutralMs: basis.neutral,
    }),
    apps,
    sessions,
    entry: state.entries[date] || { mood: null, note: "", done: "" },
  };
}
function validateState(data) {
  if (
    data?.version !== 1 ||
    !Array.isArray(data.sessions) ||
    !data.apps ||
    !data.entries ||
    !data.settings
  )
    throw Error("Invalid Dayline backup");
  if (
    data.sessions.length > 2000000 ||
    !data.sessions.every(
      (s) =>
        typeof s.appId === "string" &&
        Object.hasOwn(data.apps, s.appId) &&
        Number.isFinite(s.start) &&
        Number.isFinite(s.end) &&
        s.end > s.start &&
        s.end - s.start <= 90000000 &&
        (!s.domain || validDomain(s.domain)),
    )
  )
    throw Error("Invalid sessions");
  if (
    ![0, 1, 3, 5, 10, 15, 30].includes(data.settings.idleMinutes) ||
    typeof data.settings.launchAtLogin !== "boolean"
  )
    throw Error("Invalid settings");
  data.settings.hideShort ??= true;
  data.settings = focusSettings(data.settings);
  data.settings.trackSites ??= true;
  if (
    typeof data.settings.hideShort !== "boolean" ||
    typeof data.settings.trackSites !== "boolean"
  )
    throw Error("Invalid settings");
  data.types ??= structuredClone(DEFAULT_TYPES);
  for (const [id, t] of Object.entries(data.types))
    saveType(data, { ...t, id });
  for (const id of CATEGORIES)
    if (!Object.hasOwn(data.types, id)) throw Error("Missing base type");
  data.siteCategories ??= {};
  if (
    typeof data.siteCategories !== "object" ||
    Array.isArray(data.siteCategories) ||
    Object.entries(data.siteCategories).some(([domain, type]) =>
      !validDomain(domain) || domain !== domain.toLowerCase() ||
      !safeKey(type) || !Object.hasOwn(data.types, type))
  ) throw Error("Invalid site categories");
  for (const [key, a] of Object.entries(data.apps)) {
    if (
      !safeKey(key) ||
      !CATEGORIES.includes(a.category) ||
      typeof a.name !== "string" ||
      typeof a.exe !== "string" ||
      (a.hidden !== undefined && typeof a.hidden !== "boolean")
    )
      throw Error("Invalid app");
    if (a.allocations) checkAllocation(data, a.allocations);
  }
  for (const [date, e] of Object.entries(data.entries))
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !e ||
      !(
        e.mood === null ||
        (Number.isInteger(e.mood) && e.mood >= 1 && e.mood <= 5)
      ) ||
      typeof e.note !== "string" ||
      e.note.length > 20000 ||
      typeof e.done !== "string" ||
      e.done.length > 20000
    )
      throw Error("Invalid journal");
  return data;
}
module.exports = {
  localDate,
  initialState,
  categoryFor,
  addInterval,
  summary,
  validateState,
  CATEGORIES,
  DEFAULT_TYPES,
  allocationFor,
  setAllocation,
  saveType,
  removeType,
  visibleApps,
  validDomain,
  setSiteCategory,
  sessionAllocation,
};
