import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { _electron as electron, expect } from "@playwright/test";

const root = path.resolve(".");
const require = createRequire(import.meta.url);
const { version } = require("../package.json");
const { initialState, addInterval, localDate, saveType, setSiteCategory } = require("../desktop/model.cjs");
const results = path.join(root, "test-results");
await mkdir(results, { recursive: true });
const profile = await mkdtemp(path.join(results, "v152-"));
const state = initialState();
state.apps["firefox.exe"] = { name: "Firefox", category: "neutral", exe: "firefox.exe" };
saveType(state, { id: "c-learning", label: "Учёба", color: "#38dce8", base: "focus" });
setSiteCategory(state, "example.net", "c-learning");
const today = localDate(Date.now());
const selectedDay = new Date(today + "T12:00:00");
selectedDay.setDate(selectedDay.getDate() - 1);
const previous = new Date(selectedDay);
previous.setDate(previous.getDate() - 11);
for (const [date, minutes] of [[localDate(previous), 26], [localDate(selectedDay), 47]]) {
  const start = new Date(date + "T10:00:00").getTime();
  addInterval(state, { appId: "firefox.exe", start, end: start + minutes * 60_000, domain: "example.net" });
}
const history = path.join(profile, "dayline.json");
await writeFile(history, JSON.stringify(state, null, 2));
const env = { ...process.env, DAYLINE_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.env.DAYLINE_TEST_EXE || path.join(root, "release", version, "win-unpacked", "Dayline.exe");
const app = await electron.launch({ executablePath, args: ["--test-mode", "--autostart"], cwd: root, env });
const releaseWindow = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible());
const openAnother = (...args) => new Promise((resolve, reject) => {
  const process = spawn(executablePath, ["--test-mode", ...args], { cwd: root, env, stdio: "ignore" });
  const timeout = setTimeout(() => { process.kill(); reject(new Error("Second instance did not exit")); }, 8_000);
  process.once("error", (error) => { clearTimeout(timeout); reject(error); });
  process.once("exit", () => { clearTimeout(timeout); resolve(); });
});
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(page.locator("h1")).toHaveText("Сегодня");
  assert.equal(await releaseWindow(), false);
  await openAnother("--hidden");
  assert.equal(await releaseWindow(), false);
  await openAnother();
  await expect.poll(releaseWindow).toBe(true);
  await page.setViewportSize({ width: 880, height: 680 });
  const button = (name) => page.getByRole("button", { name, exact: true });
  const select = async (label, option) => {
    await button(label).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };

  await button("Предыдущий день").click();
  await expect(page.locator(".time-distribution")).toContainText("Учёба");
  await expect(page.locator(".legend")).toContainText("Учёба");
  await expect(page.locator(".timeline-segment").first()).toHaveAttribute("title", /Учёба/);
  assert.equal(await page.locator("h1").evaluate((element) => getComputedStyle(element).userSelect), "none");

  await button("Статистика").click();
  await expect(page.locator(".week-column")).toHaveCount(7);
  await select("Период", "Всё время");
  await expect(page.locator(".stat-tiles .duration").first()).toHaveAttribute("aria-label", "1 ч 13 мин");
  await expect(page.getByRole("checkbox", { name: "Показать Учёба" })).toBeVisible();
  await select("Период", "Свой период");
  await expect(page.locator(".stat-tiles .duration").first()).toHaveAttribute("aria-label", "47 мин");
  await button("Начало периода").click();
  const dayLabel = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(previous);
  const rangeStart = new Date(selectedDay);
  rangeStart.setDate(rangeStart.getDate() - 6);
  if (previous.getMonth() !== rangeStart.getMonth())
    await page.getByRole("dialog").getByRole("button", { name: "Предыдущий месяц" }).click();
  await page.getByRole("button", { name: dayLabel, exact: true }).click();
  await expect(page.locator(".stat-tiles .duration").first()).toHaveAttribute("aria-label", "1 ч 13 мин");
  await page.screenshot({ path: path.join(results, `dayline-${version}-custom-range.png`) });

  await button("Сегодня").click();
  await button("Начать фокус").click();
  await button("Настройки").click();
  const timer = page.getByRole("switch", { name: "Показывать таймер фокуса", exact: true });
  await timer.click();
  await expect(timer).toHaveAttribute("aria-checked", "false");
  await expect.poll(() => page.evaluate(async () => (await window.dayline.focusSnapshot()).status)).toBe("paused");
  await button("Сегодня").click();
  await expect(page.locator(".focus-panel")).toHaveCount(0);
  await button("Настройки").click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("radio", { name: "По системе", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  const preview = button("Показать анимации");
  await preview.press("Enter");
  await expect(page.locator(".demo-mini-card")).toBeVisible();
  await page.getByRole("radio", { name: "Полные", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
  await preview.press("Enter");
  await expect(page.locator(".demo-mini-card")).toContainText("Появление с движением");
  await page.getByRole("switch", { name: "Анимации интерфейса", exact: true }).click();
  await expect(preview).toBeDisabled();
  await select("Язык", "English");
  await expect(page.getByRole("switch", { name: "Show focus timer" })).toHaveAttribute("aria-checked", "false");
  await button("Journal").click();
  assert.equal(await page.getByLabel("Thoughts and notes").evaluate((element) => getComputedStyle(element).userSelect), "text");
  const saved = JSON.parse(await readFile(history, "utf8"));
  assert.deepEqual(saved.sessions, state.sessions);
  assert.deepEqual(saved.siteCategories, state.siteCategories);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ hiddenStartup: true, allTime: true, customRange: true, categories: true,
    focusTimer: true, motion: true, english: true, selection: true, errors }));
} finally {
  await app.close();
}
