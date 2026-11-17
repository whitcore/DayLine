import { useEffect, useState } from "react";
import ActivityChart from "./WeekChart.jsx";
import DatePicker, { ChoiceSelect } from "./DatePicker.jsx";
import { useLocale } from "./i18n.jsx";
import { Duration, Number as AnimatedNumber, Panel } from "./motion.jsx";
import ProgramList from "./ProgramsUI.jsx";
import { describeTypes, shift } from "./shared.js";

export default function Statistics({ data, date, onSelectDate, onDate }) {
  const { t, pretty } = useLocale();
  const [mode, setMode] = useState("week");
  const [range, setRange] = useState(() => ({ from: shift(data.date, -6), to: data.date }));
  const [result, setResult] = useState(null);
  const [failed, setFailed] = useState(null);
  const query = mode === "range" ? `${range.from}/${range.to}` : mode;

  useEffect(() => {
    if (mode === "week") return;
    let current = true;
    window.dayline.period({ mode, ...range })
      .then((period) => {
        if (!current) return;
        setResult({ query, period });
        setFailed(null);
      })
      .catch(() => { if (current) setFailed(query); });
    return () => { current = false; };
  }, [data, mode, range, query]);

  const summary = mode === "week"
    ? {
        rows: data.week,
        apps: data.weekApps,
        totalMs: data.week.reduce((sum, day) => sum + day.totalMs, 0),
        focusMs: data.week.reduce((sum, day) => sum + day.focusMs, 0),
      }
    : result?.query === query ? result.period : null;

  return (
    <>
      <div className="stats-period">
        <ChoiceSelect
          label={t("Период")}
          value={mode}
          options={[
            { value: "week", label: t("Неделя") },
            { value: "range", label: t("Свой период") },
            { value: "all", label: t("Всё время") },
          ]}
          onChange={setMode}
        />
        {mode === "week" && (
          <DatePicker value={data.date} navigationValue={date} max={data.today} onChange={onSelectDate}
            stepDays={7} rangeStart={data.week[0]?.date} />
        )}
        {mode === "range" && (
          <div className="range-controls">
            <div><span>{t("Начало")}</span>
              <DatePicker compact value={range.from} max={range.to} pickerLabel={t("Начало периода")}
                onChange={(from) => setRange((previous) => ({ ...previous, from }))} />
            </div>
            <div><span>{t("Конец")}</span>
              <DatePicker compact value={range.to} max={data.today} pickerLabel={t("Конец периода")}
                onChange={(to) => setRange((previous) => ({ from: previous.from > to ? to : previous.from, to }))} />
            </div>
          </div>
        )}
        {mode === "all" && summary && (
          <span className="stats-date-range">
            {pretty(summary.from, { day: "numeric", month: "long", year: "numeric" })}
            {" – "}
            {pretty(summary.to, { day: "numeric", month: "long", year: "numeric" })}
          </span>
        )}
      </div>
      {failed === query && mode !== "week" && <p className="notice" role="alert">{t("Не удалось загрузить статистику.")}</p>}
      {summary ? (
        <>
          <div className="stat-tiles">
            <Panel className="stat-tile">
              <h2>{t("Активное время")}</h2>
              <strong><Duration ms={summary.totalMs} /></strong>
            </Panel>
            <Panel className="stat-tile">
              <h2>{t("Рабочее время")}</h2>
              <strong><Duration ms={summary.focusMs} /></strong>
            </Panel>
            <Panel className="stat-tile">
              <h2>{t(mode === "week" ? "Фокус за неделю" : "Фокус за период")}</h2>
              <strong>{summary.totalMs
                ? <AnimatedNumber value={Math.round(100 * summary.focusMs / summary.totalMs)} suffix="%" />
                : "—"}</strong>
            </Panel>
          </div>
          <ActivityChart rows={summary.rows} types={describeTypes(data.types, t)} week={mode === "week"}
            onDate={onDate} onRange={(from, to) => {
              setRange({ from, to });
              setMode("range");
            }} />
          <ProgramList apps={summary.apps} icons={data.icons} totalMs={summary.totalMs} all
            title={t(mode === "week" ? "Программы за неделю" : "Программы за период")} />
        </>
      ) : failed !== query && <p role="status" className="stats-date-range">{t("Загружаем статистику…")}</p>}
    </>
  );
}
