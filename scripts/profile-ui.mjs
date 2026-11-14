import { _electron as electron, expect } from "@playwright/test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(".");
const require = createRequire(import.meta.url);
const { motionFixture } = require("../tests/motion-fixture.cjs");
await mkdir("test-results", { recursive: true });
const dir = await mkdtemp(path.join(root, "test-results", "profile-"));
const fixture = motionFixture();
const benchmarkDay = new Date();
benchmarkDay.setDate(benchmarkDay.getDate() - 1);
benchmarkDay.setHours(18, 0, 0, 0);
let cursor = benchmarkDay.getTime();
for (let i = 0; i < 30; i++) {
  const id = `stress-${i}.exe`;
  fixture.apps[id] = { exe: id, name: `Программа ${i}`, category: "neutral" };
  fixture.sessions.push({ appId: id, start: cursor, end: cursor + 90000 });
  cursor += 90000;
}
await writeFile(path.join(dir, "dayline.json"), JSON.stringify(fixture));
const env = { ...process.env, DAYLINE_DATA_DIR: dir };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  ...(env.DAYLINE_TEST_EXE
    ? { executablePath: env.DAYLINE_TEST_EXE, args: ["--test-mode"] }
    : { args: [root, "--test-mode"] }),
  cwd: root,
  env,
});

try {
  const page = await app.firstWindow();
  await expect(page.locator("h1")).toHaveText(/^Сегодня\.?$/);
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.show();
    window.focus();
    window.webContents.setBackgroundThrottling(false);
  });
  await page.getByRole("button", { name: "Предыдущий день", exact: true }).click();
  await expect(page.locator("h1")).not.toHaveText(/^Сегодня\.?$/);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const metrics = async () =>
    Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(({ name, value }) => [name, value]));
  await page.waitForTimeout(1000);
  const phases = [];
  for (const [label, key] of [
    ["Статистика", "stats"],
    ["Программы", "programs"],
    ["Сегодня", "today"],
    ["Статистика", "stats"],
    ["Сегодня", "today"],
  ]) {
    const before = await metrics();
    await page.evaluate(() => {
      const sample = { frames: [], request: null };
      let previous;
      const tick = (now) => {
        if (previous !== undefined) sample.frames.push(now - previous);
        previous = now;
        sample.request = requestAnimationFrame(tick);
      };
      sample.request = requestAnimationFrame(tick);
      window.__daylineSample = sample;
    });
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator(`[data-route=${key}]`)).toBeVisible();
    await page.waitForTimeout(400);
    const frames = await page.evaluate(() => {
      const sample = window.__daylineSample;
      cancelAnimationFrame(sample.request);
      return sample.frames.toSorted((a, b) => a - b);
    });
    expect(frames.length).toBeGreaterThan(10);
    const after = await metrics();
    const elapsedMs = (key) => +((after[key] - before[key]) * 1000).toFixed(2);
    phases.push({
      label,
      p95: +frames[Math.ceil(frames.length * 0.95) - 1].toFixed(2),
      frames: frames.length,
      over25: frames.filter((ms) => ms > 25).length,
      layouts: after.LayoutCount - before.LayoutCount,
      layoutMs: elapsedMs("LayoutDuration"),
      styleMs: elapsedMs("RecalcStyleDuration"),
      scriptMs: elapsedMs("ScriptDuration"),
      taskMs: elapsedMs("TaskDuration"),
    });
  }
  const report = { fixture: "34 programs on previous day", exe: env.DAYLINE_TEST_EXE || "source", phases };
  await writeFile(env.PROFILE_REPORT || "test-results/ui-profile.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await app.close();
}
