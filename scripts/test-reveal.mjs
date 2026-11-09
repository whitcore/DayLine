import { _electron as electron, expect } from "@playwright/test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  { motionFixture } = require("../tests/motion-fixture.cjs");
const root = path.resolve(".");
await mkdir("test-results", { recursive: true });
const dir = await mkdtemp(path.join(root, "test-results", "reveal-"));
await writeFile(
  path.join(dir, "dayline.json"),
  JSON.stringify(motionFixture()),
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
try {
  const page = await app.firstWindow();
  await expect(page.locator("h1")).toHaveText("Сегодня.");
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false),
  );
  await page.waitForTimeout(1300);
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.show();
    w.focus();
  });
  await page.waitForTimeout(60);
  const sample = await page.evaluate(() => ({
    enabled: localStorage.getItem("dayline-motion"),
    systemReduced: matchMedia("(prefers-reduced-motion:reduce)").matches,
    motion: document.documentElement.dataset.motion,
    visible: document.visibilityState,
    running: document
      .getAnimations()
      .filter(
        (a) =>
          a.playState === "running" &&
          a.effect?.target instanceof Element &&
          a.effect.target.matches(".route-stage,.panel"),
      ).length,
  }));
  console.log(JSON.stringify(sample));
  expect(sample.running).toBeGreaterThan(0);
} finally {
  await app.close();
}
