import { useLocale } from "./i18n.jsx";
import { memo, useId, useState } from "react";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { Panel } from "./motion.jsx";
import { categories } from "./shared.js";

const series = Object.entries(categories);
const weekday = { weekday: "short" };
const fullDay = { weekday: "long", day: "numeric", month: "long" };
const minute = 60_000;

function CategoryFilter({ category, checked, onChange }) {
  const { t } = useLocale();
  return (
    <label className="colored-checkbox" style={{ "--check-color": category.color }}>
      <Checkbox.Root checked={checked} onCheckedChange={onChange} aria-label={t("Показать ") + t(category.label)}>
        <Checkbox.Indicator><Check size={12} aria-hidden="true" /></Checkbox.Indicator>
      </Checkbox.Root>
      <span>{t(category.label)}</span>
    </label>
  );
}

export default memo(function WeekChart({ week, onDate }) {
  const { t, pretty, time } = useLocale();
  const [hidden, setHidden] = useState({});
  const title = useId();
  const maximum = Math.max(60, ...week.map((day) => day.totalMs / minute));
  const step = maximum <= 60 ? 15 : Math.ceil(maximum / 240) * 60;
  const scale = step * 4 * minute;
  const visibleSeries = series.filter(([key]) => !hidden[key]);
  return (
    <Panel className="week-panel" aria-labelledby={title}>
      <div className="section-heading"><h2 id={title}>{t("Активность за неделю")}</h2></div>
      <div className="week-chart">
        <div className="week-plot">
          {week.map((day) => {
            const fullDate = pretty(day.date, fullDay);
            const breakdown = visibleSeries.map(([key, category]) => (
              `${t(category.label)}: ${time(day[`${key}Ms`])}`
            ));
            return (
              <button
                type="button"
                key={day.date}
                className="week-column"
                onClick={() => onDate(day.date)}
                aria-label={t("Открыть {0}: {1}", pretty(day.date), time(day.totalMs))}
                aria-description={breakdown.join(", ") || undefined}
              >
                <span className="week-day">
                  {pretty(day.date, weekday)}
                </span>
                <span className="week-bar" aria-hidden="true">
                  {visibleSeries.map(([key, category]) => (
                    <i key={key} style={{ width: `${100 * day[`${key}Ms`] / scale}%`, background: category.color }} />
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
        {series.map(([key, category]) => (
          <CategoryFilter key={key} category={category} checked={!hidden[key]} onChange={(checked) => (
            setHidden((current) => ({ ...current, [key]: !checked }))
          )} />
        ))}
      </div>
      {!week.some((day) => day.totalMs > 0) && (
        <p className="chart-empty">{t("За выбранную неделю нет активности.")}</p>
      )}
    </Panel>
  );
}, (a, b) =>
  a.onDate === b.onDate &&
  a.week.length === b.week.length &&
  a.week.every((day, index) => day.date === b.week[index].date &&
    ["totalMs", "focusMs", "neutralMs", "restMs"].every((key) => day[key] === b.week[index][key]),
  ),
);
