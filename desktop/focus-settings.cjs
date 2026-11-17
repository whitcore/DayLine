const DEFAULT_FOCUS = {
  focusWorkMinutes: 25,
  focusBreakMinutes: 5,
  focusScoreMode: "share",
  focusNeutralWeight: 0,
  focusIncludeRest: true,
  focusDailyGoalMinutes: 120,
};
function focusSettings(settings) {
  const result = { ...DEFAULT_FOCUS, ...settings };
  if (
    !Number.isInteger(result.focusWorkMinutes) ||
    result.focusWorkMinutes < 1 ||
    result.focusWorkMinutes > 180 ||
    !Number.isInteger(result.focusBreakMinutes) ||
    result.focusBreakMinutes < 1 ||
    result.focusBreakMinutes > 60 ||
    !["share", "goal"].includes(result.focusScoreMode) ||
    ![0, 25, 50, 75, 100].includes(result.focusNeutralWeight) ||
    (result.showFocusTimer !== undefined && typeof result.showFocusTimer !== "boolean") ||
    typeof result.focusIncludeRest !== "boolean" ||
    !Number.isInteger(result.focusDailyGoalMinutes) ||
    result.focusDailyGoalMinutes < 15 ||
    result.focusDailyGoalMinutes > 720
  )
    throw Error("Проверь настройки фокуса.");
  return result;
}
function scoreFor(settings, { totalMs, focusMs, neutralMs }) {
  const s = focusSettings(settings),
    weightedFocusMs = focusMs + (neutralMs * s.focusNeutralWeight) / 100;
  const scoreBaseMs =
    s.focusScoreMode === "goal"
      ? s.focusDailyGoalMinutes * 60000
      : s.focusIncludeRest
        ? totalMs
        : focusMs + neutralMs;
  return {
    score: totalMs
      ? Math.min(
          100,
          Math.round(scoreBaseMs ? (100 * weightedFocusMs) / scoreBaseMs : 0),
        )
      : null,
    weightedFocusMs,
    scoreBaseMs,
    scoreMode: s.focusScoreMode,
  };
}
module.exports = { DEFAULT_FOCUS, focusSettings, scoreFor };
