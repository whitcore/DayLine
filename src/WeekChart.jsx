import { useLocale } from "./i18n.jsx";
import { useId, useState } from "react";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { Panel } from "./motion.jsx";
const weekday = { weekday: "short" };
const fullDay = { weekday: "long", day: "numeric", month: "long" };
const shortDay = { day: "numeric", month: "short" };
const minute = 60_000;

function CategoryFilter({ category, checked, onChange }) {
  const { t } = useLocale();
  return (
    <label className="colored-checkbox" style={{ "--check-color": category.color }}>
      <Checkbox.Root checked={checked} onCheckedChange={onChange} aria-label={t("Показать ") + category.label}>
        <Checkbox.Indicator><Check size={12} aria-hidden="true" /></Checkbox.Indicator>
      </Checkbox.Root>
      <span>{category.label}</span>
    </label>
  );
}

export default function ActivityChart({ rows, types, week, onDate, onRange }) {
  const { t, pretty, time } = useLocale();
  const [hidden, setHidden] = useState({});
  const title = useId();
  const maximum = Math.max(60, ...rows.map((row) => row.totalMs / minute));
  const step = maximum <= 60 ? 15 : Math.ceil(maximum / 240) * 60;
  const scale = step * 4 * minute;
  const series = types.filter(({ id }) => ["focus", "neutral", "rest"].includes(id) ||
    rows.some((row) => row.typeTotals[id] > 0));
  const visibleSeries = series.filter(({ id }) => !hidden[id]);
  return (
    <Panel className="week-panel" aria-labelledby={title}>
      <div className="section-heading"><h2 id={title}>{t(week ? "Активность за неделю" : "Активность за период")}</h2></div>
      <div className="week-chart">
        <div className={"week-plot" + (week ? "" : " range-plot")} style={{ "--plot-rows": rows.length }}>
          {rows.map((day) => {
            const multipleDays = day.to && day.to !== day.date;
            const label = multipleDays ? `${pretty(day.date, shortDay)} – ${pretty(day.to, shortDay)}` : pretty(day.date, week ? weekday : shortDay);
            const fullDate = multipleDays ? label : pretty(day.date, fullDay);
            const breakdown = visibleSeries
              .filter(({ id }) => day.typeTotals[id] > 0)
              .map(({ id, label }) => `${label}: ${time(day.typeTotals[id])}`);
            return (
              <button
                type="button"
                key={day.date}
                className="week-column"
                onClick={() => multipleDays ? onRange(day.date, day.to) : onDate(day.date)}
                aria-label={t("Открыть {0}: {1}", multipleDays ? label : pretty(day.date), time(day.totalMs))}
                aria-description={breakdown.join(", ") || undefined}
              >
                <span className="week-day">
                  {label}
                </span>
                <span className="week-bar" aria-hidden="true">
                  {visibleSeries.map(({ id, color }) => (
                    <i key={id} style={{ width: `${100 * (day.typeTotals[id] || 0) / scale}%`, background: color }} />
                  ))}
                </span>
                <span className="chart-tooltip" aria-hidden="true">
                  <strong>{fullDate} · {time(day.totalMs)}</strong>
                  {breakdown.map((line) => <span key={line}>{line}</span>)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="week-axis" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => {
            const value = step * i;
            return <span key={i}>{value === 0 ? "0" : value >= 60 ? t("{0} ч", value / 60) : t("{0} мин", value)}</span>;
          })}
        </div>
      </div>
      <div className="chart-filters">
        {series.map((category) => (
          <CategoryFilter key={category.id} category={category} checked={!hidden[category.id]} onChange={(checked) => (
            setHidden((current) => ({ ...current, [category.id]: !checked }))
          )} />
        ))}
      </div>
      {!rows.some((day) => day.totalMs > 0) && (
        <p className="chart-empty">{t(week ? "За выбранную неделю нет активности." : "За выбранный период нет активности.")}</p>
      )}
    </Panel>
  );
}
