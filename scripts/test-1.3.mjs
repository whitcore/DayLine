import { _electron as electron, expect } from "@playwright/test";
import { mkdir, mkdtemp, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const root = path.resolve("."),
  require = createRequire(import.meta.url),
  { motionFixture } = require("../tests/motion-fixture.cjs");
await mkdir("test-results", { recursive: true });
const dir = await mkdtemp(path.join(root, "test-results", "v13-"));
const fixture = motionFixture();
await writeFile(path.join(dir, "dayline.json"), JSON.stringify(fixture));
const env = { ...process.env, DAYLINE_DATA_DIR: dir };
delete env.ELECTRON_RUN_AS_NODE;
let app, page;
const errors = [];
async function launch() {
  app = await electron.launch({
    ...(process.env.DAYLINE_TEST_EXE
      ? { executablePath: process.env.DAYLINE_TEST_EXE, args: ["--test-mode"] }
      : { args: [root, "--test-mode"] }),
    cwd: root,
    env,
  });
  page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(page.locator("h1")).toHaveText("Сегодня.");
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.show();
    w.focus();
  });
  await page.waitForTimeout(350);
}
const choose = async (label, option) => {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};
try {
  await launch();
  const before = await page.evaluate(() => window.dayline.snapshot());
  expect(await page.locator("input[type=date],select").count()).toBe(0);
  expect(
    await page.evaluate(() => getComputedStyle(document.body).fontFamily),
  ).toContain("Inter");
  expect(
    Number(
      await page.locator("h1").evaluate((e) => getComputedStyle(e).fontWeight),
    ),
  ).toBeLessThanOrEqual(600);
  const dateButton = page.getByRole("button", {
    name: "Выбрать дату",
    exact: true,
  });
  await dateButton.click();
  await expect(page.getByRole("grid")).toBeVisible();
  await page.screenshot({
    path: "test-results/dayline-1.3-calendar-dark.png",
    fullPage: true,
  });
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("grid")).toHaveCount(0);
  const previousDay = new Date(before.date + "T12:00:00");
  previousDay.setDate(previousDay.getDate() - 1);
  await expect(dateButton).toContainText(String(previousDay.getDate()));
  await page
    .getByRole("button", { name: "Следующий день", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Следующий день", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await expect(page.locator("[data-route=settings]")).toBeVisible();
  const themes = [
    ["dark", "Яркая тёмная"],
    ["light", "Яркая светлая"],
    ["soft-dark", "Мягкая тёмная"],
    ["soft-light", "Мягкая светлая"],
  ];
  for (const [id, label] of themes) {
    await page.getByRole("radio", { name: label, exact: true }).check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", id);
    await page.waitForTimeout(180);
    await page.screenshot({
      path: `test-results/dayline-1.3-${id}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const panels = await page
      .locator(".settings-column>.panel")
      .evaluateAll((nodes) =>
        nodes.map((e) => ({
          height: e.getBoundingClientRect().height,
          scroll: e.scrollHeight,
        })),
      );
    expect(panels.every((p) => Math.abs(p.height - p.scroll) < 6)).toBe(true);
  }
  await choose("Порог бездействия", "5 мин");
  await choose("Польза нейтральных программ", "50%");
  const custom = await page.evaluate(() => window.dayline.snapshot());
  expect(custom.settings.idleMinutes).toBe(5);
  expect(custom.score).toBe(
    Math.round(
      (100 * (custom.focusMs + custom.neutralMs * 0.5)) / custom.totalMs,
    ),
  );
  await choose("Расчёт фокуса", "Цель по работе");
  await page.getByLabel("Цель работы за день", { exact: true }).fill("180");
  await page.getByLabel("Цель работы за день", { exact: true }).blur();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await window.dayline.snapshot()).settings.focusDailyGoalMinutes,
      ),
    )
    .toBe(180);
  await page.getByRole("spinbutton", { name: /Работа/ }).fill("1");
  await page.getByRole("spinbutton", { name: /Перерыв/ }).fill("1");
  await page
    .getByRole("button", { name: "Сохранить длительности", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await window.dayline.focusSnapshot()).workMinutes,
      ),
    )
    .toBe(1);
  await page.getByRole("radio", { name: "Мягкие", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await page.getByRole("radio", { name: "Полные", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
  await page
    .getByRole("button", { name: "Показать анимации", exact: true })
    .click();
  await page.getByRole("button", { name: "Сегодня", exact: true }).click();
  await expect(page.locator(".focus-panel")).toBeVisible();
  await page.getByRole("button", { name: "Начать фокус", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => (await window.dayline.focusSnapshot()).status),
    )
    .toBe("running");
  await page.waitForTimeout(1100);
  const running = await page.evaluate(() => window.dayline.focusSnapshot());
  expect(running.remainingMs).toBeLessThan(60000);
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].hide(),
  );
  await page.waitForTimeout(500);
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.show();
    w.focus();
  });
  expect(
    (await page.evaluate(() => window.dayline.focusSnapshot())).remainingMs,
  ).toBeLessThan(running.remainingMs);
  await page.evaluate(() => window.dayline.focusAction("pause"));
  const paused = await page.evaluate(() => window.dayline.focusSnapshot());
  await page.waitForTimeout(400);
  expect(
    (await page.evaluate(() => window.dayline.focusSnapshot())).remainingMs,
  ).toBe(paused.remainingMs);
  await page.evaluate(() => window.dayline.focusAction("resume"));
  await page.evaluate(() => window.dayline.focusAction("stop"));
  await dateButton.click();
  await page.waitForTimeout(220);
  await page.screenshot({
    path: "test-results/dayline-1.3-calendar-light.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(dateButton).toBeFocused();
  await app.close();
  app = null;
  await launch();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    "soft-light",
  );
  const after = await page.evaluate(() => window.dayline.snapshot());
  expect(after.sessions).toEqual(before.sessions);
  expect(after.settings.focusDailyGoalMinutes).toBe(180);
  expect(after.settings.focusWorkMinutes).toBe(1);
  expect(after.entries).toEqual(before.entries);
  await page.setViewportSize({ width: 900, height: 760 });
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await page.screenshot({
    path: "test-results/dayline-1.3-compact.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  const report = {
    packaged: !!process.env.DAYLINE_TEST_EXE,
    themes: 4,
    themePersistence: true,
    calendar: true,
    calendarKeyboard: true,
    font: "Inter",
    lighterTypography: true,
    compactSettings: true,
    configurableScore: true,
    focusTimer: true,
    timerInTray: true,
    timerPauseResume: true,
    historyPreserved: true,
    errors,
  };
  await writeFile(
    "test-results/v13-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} catch (e) {
  if (page)
    await page
      .screenshot({ path: "test-results/v13-failure.png", fullPage: true })
      .catch(() => {});
  throw e;
} finally {
  if (app) await app.close();
}
