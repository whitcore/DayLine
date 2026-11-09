import { memo, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Check, ChartNoAxesCombined } from "lucide-react";
import { motion, Panel, useMotion } from "./motion.jsx";
import { categories, pretty, time } from "./shared.js";

// Adapted from ReUI c-chart-1 / c-checkbox-6: local data and Dayline tokens.
export function ColoredCheckbox({ value, checked, onChange }) {
  const { active } = useMotion();
  return (
    <label
      className="colored-checkbox"
      style={{ "--check-color": categories[value].color }}
    >
      <Checkbox.Root
        checked={checked}
        onCheckedChange={onChange}
        aria-label={"Показать " + categories[value].label}
      >
        <Checkbox.Indicator forceMount>
          <motion.svg
            viewBox="0 0 16 16"
            animate={{ opacity: checked ? 1 : 0 }}
            transition={{ duration: active ? 0.12 : 0 }}
          >
            <motion.path
              d="m4 8 2.5 2.5L12 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={{ pathLength: checked ? 1 : 0 }}
              transition={{ duration: active ? 0.23 : 0 }}
            />
          </motion.svg>
        </Checkbox.Indicator>
      </Checkbox.Root>
      <span>{categories[value].label}</span>
    </label>
  );
}
function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const day = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>
        {pretty(day.date, { weekday: "long", day: "numeric", month: "long" })}
      </strong>
      {payload.map((p) => (
        <div key={p.dataKey}>
          <span>
            <i style={{ background: p.fill }} />
            {categories[p.dataKey].label}
          </span>
          <b>{time(p.value * 60000)}</b>
        </div>
      ))}
    </div>
  );
}
export default memo(
  function WeekChart({ week, onDate }) {
    const { active } = useMotion(),
      [visible, setVisible] = useState({
        focus: true,
        neutral: true,
        rest: true,
      });
    const signature = week
      .map((d) =>
        [
          d.date,
          Math.floor(d.focusMs / 60000),
          Math.floor(d.neutralMs / 60000),
          Math.floor(d.restMs / 60000),
        ].join(":"),
      )
      .join("|");
    const rows = useMemo(
      () =>
        week.map((d) => ({
          date: d.date,
          label: pretty(d.date, { weekday: "short" }),
          focus: Math.floor(d.focusMs / 60000),
          neutral: Math.floor(d.neutralMs / 60000),
          rest: Math.floor(d.restMs / 60000),
        })),
      [signature],
    );
    return (
      <Panel className="week-panel">
        <div className="section-heading">
          <div>
            <h2>
              <span className="heading-icon violet">
                <ChartNoAxesCombined />
              </span>
              Твой ритм за неделю
            </h2>
            <p>
              {pretty(week[0].date)} — {pretty(week.at(-1).date)}
            </p>
          </div>
          <div className="chart-filters">
            {Object.keys(categories).map((key) => (
              <ColoredCheckbox
                key={key}
                value={key}
                checked={visible[key]}
                onChange={(checked) =>
                  setVisible((v) => ({ ...v, [key]: checked }))
                }
              />
            ))}
          </div>
        </div>
        <div className="week-chart reui-chart">
          <ResponsiveContainer width="100%" height="100%" debounce={80}>
            <BarChart
              data={rows}
              accessibilityLayer
              margin={{ top: 15, right: 12, left: 0, bottom: 0 }}
              barSize={38}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--chart-grid)"
                strokeDasharray="3 6"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                tickMargin={14}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={35}
                tick={{ fill: "var(--muted)", fontSize: 10 }}
                tickFormatter={(v) =>
                  v >= 60 ? `${Math.round(v / 60)}ч` : `${v}м`
                }
              />
              <Tooltip
                cursor={{ fill: "var(--hover)", radius: 10 }}
                content={<ChartTooltip />}
              />
              {Object.entries(categories).map(([key, c]) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="time"
                  fill={c.color}
                  hide={!visible[key]}
                  radius={key === "rest" ? [5, 5, 0, 0] : [2, 2, 0, 0]}
                  isAnimationActive={false}
                  animationBegin={120}
                  animationDuration={750}
                  animationEasing="ease-out"
                  onClick={(entry) => {
                    const date = entry?.payload?.date || entry?.date;
                    if (date) onDate(date);
                  }}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-day-buttons">
          {week.map((d) => (
            <button
              key={d.date}
              className="week-column"
              onClick={() => onDate(d.date)}
              aria-label={`Открыть ${pretty(d.date)}: ${time(d.totalMs)}`}
            >
              <span>{pretty(d.date, { day: "numeric", month: "short" })}</span>
              <b>{time(d.totalMs)}</b>
            </button>
          ))}
        </div>
        {!week.some((d) => d.totalMs > 0) && (
          <p className="chart-empty">Здесь появится твоя первая неделя</p>
        )}
      </Panel>
    );
  },
  (a, b) =>
    a.week.every(
      (d, i) =>
        d.date === b.week[i]?.date &&
        ["focusMs", "neutralMs", "restMs"].every(
          (k) => Math.floor(d[k] / 60000) === Math.floor(b.week[i][k] / 60000),
        ),
    ),
);
