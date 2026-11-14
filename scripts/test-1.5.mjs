import { _electron as electron, expect } from "@playwright/test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { localDate, addInterval } = require("../desktop/model.cjs");
const { motionFixture } = require("../tests/motion-fixture.cjs");
const fixture = motionFixture();
const today = localDate(Date.now());
const priorDay = (days) => {
  const date = new Date(today + "T12:00:00");
  date.setDate(date.getDate() - days);
  return localDate(date);
};
const dayTitle = (date) =>
  new Date(date + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
fixture.entries[today] = { note: "Заметка тестового профиля", done: "Собрал обновление", mood: 4 };
fixture.entries[priorDay(1)] = { note: "Вчерашняя запись", done: "", mood: 3 };
fixture.sessions = fixture.sessions.filter((session) => localDate(session.start) !== today);
let cursor = new Date(today + "T09:00:00").getTime();
for (const [appId, minutes] of [["code.exe", 63], ["firefox.exe", 32], ["telegram.exe", 18], ["hades.exe", 25]]) {
  const end = cursor + minutes * 60000;
  addInterval(fixture, { appId, start: cursor, end, domain: appId === "firefox.exe" ? "docs.example.org" : undefined });
  cursor = end;
}
fixture.apps["long.exe"] = { name: "Длинноеназваниепрограммы".repeat(18), exe: "long.exe", category: "focus" };
const extraStart = cursor + 3600000;
for (let i = 0; i < 3; i++) {
  const appId = ["long.exe", "notes.exe", "music.exe"][i];
  fixture.apps[appId] ??= { name: ["", "Заметки", "Музыка"][i], exe: appId, category: "neutral" };
  addInterval(fixture, { appId, start: extraStart + i * 180000, end: extraStart + (i + 1) * 180000 });
}

const root = path.resolve(".");
await mkdir("test-results", { recursive: true });
const profile = await mkdtemp(path.join(root, "test-results", "v15-"));
await writeFile(path.join(profile, "dayline.json"), JSON.stringify(fixture));
const env = { ...process.env, DAYLINE_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  ...(env.DAYLINE_TEST_EXE
    ? { executablePath: env.DAYLINE_TEST_EXE, args: ["--test-mode"] }
    : { args: [root, "--test-mode"] }),
  cwd: root,
  env,
});
const sizes = [[1536, 1024], [880, 680]];
const routes = [
  ["Сегодня", "today"],
  ["Статистика", "stats"],
  ["Программы", "programs"],
  ["Дневник", "journal"],
  ["Настройки", "settings"],
];
const errors = [];
try {
  const page = await app.firstWindow();
  page.on("pageerror", (error) => errors.push(error.message));
  const button = (name) => page.getByRole("button", { name, exact: true });
  const noOverflow = () =>
    expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const heading = page.locator("h1");
  await expect(heading).toHaveText("Сегодня");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "graphite");
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.show();
    window.focus();
  });

  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const [label, route] of routes) {
      await button(label).click();
      await expect(page.locator(`[data-route=${route}]`)).toBeVisible();
      if (route === "stats") {
        await expect(page.locator(".week-plot")).toBeVisible();
        const [label, bar] = await Promise.all([
          page.locator(".week-day").first().boundingBox(),
          page.locator(".week-bar").first().boundingBox(),
        ]);
        expect(label.x + label.width).toBeLessThanOrEqual(bar.x);
      }
      if (route === "journal") {
        const [history, editor] = await Promise.all([
          page.locator(".journal-history").boundingBox(),
          page.locator(".journal-editor").boundingBox(),
        ]);
        expect(width < 1040 ? history.y < editor.y : history.x < editor.x).toBe(true);
      }
      await noOverflow();
      await page.waitForTimeout(160);
      await page.screenshot({ path: `test-results/dayline-1.5-${route}-${width}.png` });
    }
  }

  for (const [theme, label] of [
    ["light", "Яркая светлая"], ["soft-light", "Мягкая светлая"],
    ["dark", "Яркая тёмная"], ["soft-dark", "Мягкая тёмная"], ["graphite", "Графит"],
  ]) {
    await button("Тема").click();
    await page.getByRole("option", { name: label, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await noOverflow();
  }

  await button("Свернуть меню").click();
  await expect(page.locator(".app")).toHaveClass(/sidebar-collapsed/);
  await button("Сегодня").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-route=today]")).toBeVisible();
  expect(await page.locator(".route-stage").evaluate((element) => element.getAnimations().length)).toBe(0);
  await expect(page.locator(".program-row")).toHaveCount(5);
  await button("Запись дня").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Что получилось сделать")).toBeFocused();
  await expect(page.getByLabel("Мысли и заметки")).toHaveValue("Заметка тестового профиля");
  await button("Свернуть заметку").click();
  await expect(button("Запись дня")).toBeFocused();
  await noOverflow();

  await button("Статистика").click();
  await expect(page.locator(".week-column")).toHaveCount(7);
  await expect(page.locator(".stat-tile")).toHaveCount(3);
  await expect(button("Следующая неделя")).toBeDisabled();
  await button("Предыдущая неделя").click();
  await expect(page.locator(".week-column").last()).toHaveAttribute("aria-label", new RegExp(dayTitle(priorDay(7))));
  await expect(page.getByText("За выбранную неделю нет активности.")).toBeVisible();
  await page.locator(".week-column").last().focus();
  await page.keyboard.press("Enter");
  await expect(heading).toHaveText(dayTitle(priorDay(7)));
  await button("Вернуться к сегодняшнему дню").click();
  await expect(heading).toHaveText("Сегодня");
  // Dispatch three real input events before any asynchronous snapshot can settle.
  await button("Предыдущий день").evaluate(async (element) => {
    for (let i = 0; i < 3; i++) {
      element.click();
      await Promise.resolve();
    }
  });
  await expect(heading).toHaveText(dayTitle(priorDay(3)));
  await expect(button("Выбрать дату")).toContainText(dayTitle(priorDay(3)));
  await button("Вернуться к сегодняшнему дню").click();
  await expect(heading).toHaveText("Сегодня");

  await button("Программы").click();
  const firefox = button("Сайты Firefox");
  await page.evaluate(() => {
    window.__firefoxFrames = [];
    window.__sampleFirefox = true;
    let previous;
    const sample = (now) => {
      if (previous !== undefined) window.__firefoxFrames.push(now - previous);
      previous = now;
      if (window.__sampleFirefox) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await firefox.click();
  await expect(page.getByText("docs.example.org", { exact: true })).toBeVisible();
  await noOverflow();
  await firefox.click();
  await firefox.click();
  await expect(firefox).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("docs.example.org", { exact: true })).toBeVisible();
  await firefox.focus();
  await page.keyboard.press("Enter");
  await expect(firefox).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("docs.example.org", { exact: true })).toHaveCount(0);
  await page.waitForFunction(() => window.__firefoxFrames.length >= 24);
  const firefoxFrames = await page.evaluate(() => {
    window.__sampleFirefox = false;
    return window.__firefoxFrames.slice(2).sort((a, b) => a - b);
  });
  expect(firefoxFrames.length).toBeGreaterThan(10);
  const firefoxP95Ms = +firefoxFrames[Math.floor(firefoxFrames.length * 0.95)].toFixed(2);
  await expect(page.locator('[data-app-id="long.exe"]')).toBeVisible();
  await noOverflow();
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ packaged: !!env.DAYLINE_TEST_EXE, sizes, screens: routes.length, themes: 5, dateRace: true, keyboard: true, firefoxP95Ms, errors }));
} finally {
  await app.close();
}
