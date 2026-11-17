import { _electron as electron, expect } from "@playwright/test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const root = path.resolve("."),
  require = createRequire(import.meta.url),
  { motionFixture } = require("../tests/motion-fixture.cjs");
await mkdir("test-results", { recursive: true });
const dir = await mkdtemp(path.join(root, "test-results", "motion-details-"));
const fixture = motionFixture();
// Keep the Firefox row visible when the suite starts just after midnight.
const activeDay = new Date();
activeDay.setHours(10, 0, 0, 0);
fixture.sessions.push({ appId: "firefox.exe", start: +activeDay, end: +activeDay + 120_000 });
await writeFile(
  path.join(dir, "dayline.json"),
  JSON.stringify(fixture),
);
const env = { ...process.env, DAYLINE_DATA_DIR: dir };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  ...(process.env.DAYLINE_TEST_EXE
    ? {
        executablePath: process.env.DAYLINE_TEST_EXE,
        args: ["--hidden", "--test-mode"],
      }
    : { args: [root, "--hidden", "--test-mode"] }),
  cwd: root,
  env,
});
let page;
const errors = [];
const windowState = () =>
  app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    return {
      visible: w.isVisible(),
      throttled: w.webContents.getBackgroundThrottling(),
    };
  });
const reveal = () =>
  app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.show();
    w.focus();
  });
const effects = () =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter(
        (a) =>
          a.playState === "running" &&
          a.effect?.target instanceof Element &&
          a.effect.target.matches(".route-stage,.panel,.category-menu,.demo-mini-card"),
      )
      .map((a) => ({
        target: a.effect.target.className,
        frames: a.effect
          .getKeyframes()
          .map((f) => ({ opacity: f.opacity, transform: f.transform })),
      })),
  );
try {
  page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(page.locator("h1")).toHaveText(/^Сегодня\.?$/);
  expect((await windowState()).throttled).toBe(true);
  await page.waitForTimeout(900);
  await reveal();
  expect((await windowState()).throttled).toBe(false);
  await page.waitForTimeout(50);
  expect((await effects()).length).toBeGreaterThan(0);
  await page.waitForTimeout(350);
  await page
    .getByRole("button", { name: "Запись дня", exact: true })
    .first()
    .click();
  const input = page.getByLabel("Мысли и заметки");
  await input.fill("Черновик сохраняется при открытии из трея.");
  await input.evaluate((el) => (window.__draft = el));
  await input.press("ArrowLeft");
  await expect(page.locator("html")).toHaveAttribute("data-input", "keyboard");
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].hide(),
  );
  expect((await windowState()).throttled).toBe(true);
  await page.waitForTimeout(400);
  await reveal();
  await page.waitForTimeout(55);
  expect((await effects()).length).toBeGreaterThan(0);
  expect(await input.evaluate((el) => el === window.__draft)).toBe(true);
  await expect(input).toHaveValue("Черновик сохраняется при открытии из трея.");
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await expect(page.locator("[data-route=settings]")).toBeVisible();
  await page.getByRole("radio", { name: "По системе", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await page
    .getByRole("button", { name: "Показать анимации", exact: true })
    .click();
  await page.waitForTimeout(25);
  const gentle = (await effects()).filter((a) => a.target === "demo-mini-card");
  expect(gentle.length).toBeGreaterThan(0);
  expect(
    gentle.every((a) =>
      a.frames.every((f) => !f.transform || f.transform === "none"),
    ),
  ).toBe(true);
  await page.getByRole("radio", { name: "Полные", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
  expect(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion:reduce)").matches,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Показать анимации", exact: true })
    .click();
  await page.waitForTimeout(55);
  expect(
    (await effects()).filter((a) => a.target === "demo-mini-card").some((a) =>
      a.frames.some((f) => f.transform?.includes("translateY")),
    ),
  ).toBe(true);
  expect((await effects()).filter((a) => a.target === "route-stage")).toHaveLength(0);
  await page.waitForTimeout(350);
  await page.screenshot({
    path: "test-results/dayline-1.2.1-motion-settings.png",
    fullPage: true,
  });
  await page
    .getByRole("switch", { name: "Анимации интерфейса", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  await expect(
    page.getByRole("button", { name: "Показать анимации", exact: true }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: "Полные", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForTimeout(350);
  await page.getByRole("radio", { name: "Полные", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "Мягкие", exact: true }),
  ).toBeChecked();
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByRole("radio", { name: "Полные", exact: true }),
  ).toBeChecked();
  const programs = page.getByRole("button", { name: "Программы", exact: true });
  await programs.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-route=programs]")).toBeVisible();
  expect(await page.locator("html").getAttribute("data-input")).toBe(
    "keyboard",
  );
  expect((await effects()).length).toBe(0);
  const category = page.getByRole("button", {
    name: "Категория: firefox.exe",
    exact: true,
  });
  await category.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  expect(
    (await effects()).filter((a) => a.target === "category-menu").length,
  ).toBe(0);
  await page.keyboard.press("Escape");
  await expect(category).toBeFocused();
  await page.evaluate(() => {
    window.__frames = [];
    window.__sampling = true;
    let before = performance.now();
    const frame = (now) => {
      window.__frames.push(now - before);
      before = now;
      if (window.__sampling) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  for (const name of ["Статистика", "Дневник", "Программы", "Сегодня"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.waitForTimeout(320);
  }
  const frames = await page.evaluate(() => {
    window.__sampling = false;
    return window.__frames.slice(2);
  });
  const sorted = frames.toSorted((a, b) => a - b),
    median = sorted[Math.floor(sorted.length / 2)],
    p95 = sorted[Math.floor(sorted.length * 0.95)];
  expect(frames.length).toBeGreaterThan(50);
  expect(median).toBeLessThan(25);
  expect(errors).toEqual([]);
  const report = {
    packaged: !!process.env.DAYLINE_TEST_EXE,
    trayReveal: true,
    nativeVisibilityControlsThrottling: true,
    draftDOMPreserved: true,
    systemGentleMode: true,
    explicitFullOverride: true,
    preview: true,
    keyboardInstant: true,
    frameMedianMs: +median.toFixed(2),
    frameP95Ms: +p95.toFixed(2),
    frameCount: frames.length,
    framesOver25ms: frames.filter((v) => v > 25).length,
    errors,
  };
  await writeFile(
    "test-results/motion-details-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} catch (e) {
  if (page) console.log(JSON.stringify({ remainingMotion: await effects() }));
  if (page)
    await page
      .screenshot({
        path: "test-results/motion-details-failure.png",
        fullPage: true,
      })
      .catch(() => {});
  throw e;
} finally {
  await app.close();
}
