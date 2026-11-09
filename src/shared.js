export const categories = {
  focus: { label: "Работа", color: "var(--lime)" },
  neutral: { label: "Нейтрально", color: "var(--yellow)" },
  rest: { label: "Отдых", color: "var(--pink)" },
};
export const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const shift = (date, n) => {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return dateKey(d);
};
export const pretty = (date, options = { day: "numeric", month: "long" }) =>
  new Date(date + "T12:00:00").toLocaleDateString("ru-RU", options);
export const time = (ms) => {
  const mins = Math.floor(ms / 60000),
    h = Math.floor(mins / 60);
  return h
    ? `${h} ч ${String(mins % 60).padStart(2, "0")} мин`
    : mins
      ? `${mins} мин`
      : ms > 0
        ? "< 1 мин"
        : "0 мин";
};
