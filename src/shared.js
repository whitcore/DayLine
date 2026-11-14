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
export const pretty = (date, options = { day: "numeric", month: "long" }, locale = "ru-RU") =>
  new Date(date + "T12:00:00").toLocaleDateString(locale, options);
export const time = (ms, t) => {
  const mins = Math.floor(ms / 60000),
    h = Math.floor(mins / 60);
  return h
    ? t("{0} ч {1} мин", h, String(mins % 60).padStart(2, "0"))
    : mins
      ? t("{0} мин", mins)
      : ms > 0
        ? t("< 1 мин")
        : t("0 мин");
};
