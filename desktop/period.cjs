const DAY = 86_400_000;

function aggregateApps(days, catalog) {
  const apps = new Map();
  for (const day of days) {
    for (const app of day.apps) {
      if (!apps.has(app.id)) apps.set(app.id, { ms: 0, sites: new Map() });
      const total = apps.get(app.id);
      total.ms += app.ms;
      for (const site of app.sites)
        total.sites.set(site.domain, (total.sites.get(site.domain) || 0) + site.ms);
    }
  }
  return [...apps].map(([id, app]) => ({
    ...catalog[id],
    id,
    ms: app.ms,
    sites: [...app.sites].map(([domain, ms]) => ({ domain, ms })).sort((a, b) => b.ms - a.ms),
  })).sort((a, b) => b.ms - a.ms);
}

function dateNumber(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const date = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(date) && dateKey(date / DAY) === value ? date / DAY : NaN;
}

const dateKey = (day) => new Date(day * DAY).toISOString().slice(0, 10);
const emptyTotals = () => ({ totalMs: 0, focusMs: 0, neutralMs: 0, restMs: 0, typeTotals: {} });
function addTotals(target, summary) {
  for (const key of ["totalMs", "focusMs", "neutralMs", "restMs"]) target[key] += summary[key];
  for (const [id, ms] of Object.entries(summary.typeTotals))
    target.typeTotals[id] = (target.typeTotals[id] || 0) + ms;
}

function periodSummary(summaries, catalog, range, today) {
  const all = range?.mode === "all";
  if (!all && (
    range?.mode !== "range" ||
    !(dateNumber(range.from) <= dateNumber(range.to)) ||
    range.to > today
  )) throw Error("Invalid statistics period");

  const from = all ? "0001-01-01" : range.from;
  const to = all ? today : range.to;
  const key = range.mode + "/" + from + "/" + to;
  summaries.sync();
  if (summaries.period?.key === key) return summaries.period.data;

  const days = summaries.entriesBetween(from, to);
  const first = all ? (days[0]?.date || today) : from;
  const start = dateNumber(first);
  const end = dateNumber(to);
  const length = end - start + 1;
  const step = length <= 14 ? 1 : length <= 98 ? 7 : Math.ceil(length / 14);
  const rows = Array.from({ length: Math.ceil(length / step) }, (_, index) => ({
    date: dateKey(start + index * step),
    to: dateKey(Math.min(end, start + (index + 1) * step - 1)),
    ...emptyTotals(),
  }));
  const totals = emptyTotals();
  for (const day of days) {
    addTotals(totals, day);
    addTotals(rows[Math.floor((dateNumber(day.date) - start) / step)], day);
  }
  const data = { from: first, to, ...totals, rows, apps: aggregateApps(days, catalog) };
  summaries.period = { key, data };
  return data;
}

module.exports = { aggregateApps, periodSummary };
