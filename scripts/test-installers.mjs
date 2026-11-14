import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "@playwright/test";

const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const { version: releaseVersion } = require("../package.json");
const { addInterval, initialState, saveType, setAllocation, setSiteCategory } =
  require("../desktop/model.cjs");
const baselineVersion = "1.4.0";
const [baselineInstaller, releaseInstaller] = process.argv.slice(2);
if (!baselineInstaller || !releaseInstaller) {
  console.error(
    "Usage: npm run test:installers -- <Dayline-Setup-1.4.0.exe> <Dayline-Setup-1.5.0.exe>",
  );
  process.exit(1);
}

const sevenZip =
  process.env.SEVEN_ZIP ||
  path.join(process.env.ProgramFiles || "C:\\Program Files", "7-Zip", "7z.exe");
await access(sevenZip);
await Promise.all([baselineInstaller, releaseInstaller].map((file) => access(file)));

const previousDay = "2025-11-06";
const populatedDay = "2025-11-07";
const weekEnd = "2025-11-09";
const emptyDay = "2025-11-16";
const dates = [previousDay, populatedDay, weekEnd, emptyDay];
const firefox = "firefox.exe";
const minute = 60_000;
const preferences = { theme: "soft-light", motion: "on", style: "gentle" };
const resultsDirectory = path.join(root, "test-results");
await mkdir(resultsDirectory, { recursive: true });
const testDirectory = await mkdtemp(path.join(resultsDirectory, "installers-"));
const profile = path.join(testDirectory, "profile");
const installPath = path.join(testDirectory, "Dayline");
const historyPath = path.join(profile, "dayline.json");
const iconPath = path.join(profile, "icons", `${sha256(firefox)}.custom.png`);
await mkdir(path.dirname(iconPath), { recursive: true });

function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

function fixture() {
  const state = initialState();
  state.createdAt = new Date("2025-11-01T12:00:00").getTime();
  state.apps = {
    [firefox]: {
      name: "Firefox",
      exe: "firefox.exe",
      category: "neutral",
      customIcon: true,
    },
    "code.exe": {
      name: "Visual Studio Code",
      exe: "Code.exe",
      category: "focus",
    },
    "discord.exe": {
      name: "Discord",
      exe: "Discord.exe",
      category: "rest",
      hidden: true,
    },
    "notes.exe": { name: "Заметки", exe: "notes.exe", category: "neutral" },
  };
  saveType(state, { id: "c-study", label: "Учёба", color: "#ca8cf6", base: "focus" });
  setAllocation(state, firefox, { focus: 50, rest: 50 });
  setSiteCategory(state, "developer.mozilla.org", "c-study");
  Object.assign(state.settings, {
    idleMinutes: 5,
    hideShort: false,
    focusWorkMinutes: 35,
    focusBreakMinutes: 8,
    focusScoreMode: "goal",
    focusNeutralWeight: 50,
    focusDailyGoalMinutes: 90,
  });
  state.entries[previousDay] = { mood: 2, note: "Запись за четверг", done: "" };
  state.entries[populatedDay] = {
    mood: 4,
    note: "Изучил документацию.\nСохранил заметки.",
    done: "Закончил задачу в VS Code",
  };
  const sessions = [
    [previousDay, "09:00", firefox, 11, "example.org"],
    [populatedDay, "09:00", "code.exe", 42],
    [populatedDay, "10:00", firefox, 15, "developer.mozilla.org"],
    [populatedDay, "10:30", firefox, 12],
    [populatedDay, "11:00", "discord.exe", 8],
    [populatedDay, "13:00", "notes.exe", 5],
    [weekEnd, "16:00", "code.exe", 21],
  ];
  for (const [date, time, appId, minutes, domain] of sessions) {
    const start = new Date(`${date}T${time}:00`).getTime();
    addInterval(state, { appId, start, end: start + minutes * minute, domain });
  }
  return state;
}

const source = fixture();
await writeFile(historyPath, JSON.stringify(source, null, 2));
await copyFile(path.join(root, "assets", "icon.png"), iconPath);
const initialHashes = await profileHashes();

async function profileHashes() {
  const [history, icon] = await Promise.all([readFile(historyPath), readFile(iconPath)]);
  return { history: sha256(history), icon: sha256(icon) };
}

async function extractInstaller(installer, version) {
  const archiveDirectory = path.join(testDirectory, `archive-${version}`);
  await mkdir(archiveDirectory);
  const archive = path.join(archiveDirectory, "app-64.7z");
  execFileSync(
    sevenZip,
    ["e", "-y", "-bso0", "-bsp0", `-o${archiveDirectory}`, path.resolve(installer), "-ir!app-64.7z"],
    { windowsHide: true },
  );
  await access(archive);
  execFileSync(
    sevenZip,
    ["x", "-y", "-bso0", "-bsp0", `-o${installPath}`, archive],
    { windowsHide: true },
  );
  await unlink(archive);
  const executable = path.join(installPath, "Dayline.exe");
  await access(executable);
  return executable;
}

async function readPreferences(page) {
  await page.waitForFunction(() =>
    document.documentElement.dataset.theme && document.documentElement.dataset.motion,
  );
  return page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    motion: localStorage.getItem("dayline-motion"),
    style: localStorage.getItem("dayline-motion-style"),
  }));
}

async function runInstalledVersion(installer, version) {
  const executablePath = await extractInstaller(installer, version);
  const env = { ...process.env, DAYLINE_DATA_DIR: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    executablePath,
    args: ["--test-mode"],
    cwd: installPath,
    env,
    timeout: 30_000,
  });
  try {
    assert.equal(await app.evaluate(({ app }) => app.getPath("userData")), profile);
    const page = await app.firstWindow();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.locator("h1").waitFor();
    if (version === baselineVersion) {
      await page.evaluate(({ theme, motion, style }) => {
        localStorage.setItem("dayline-theme", theme);
        localStorage.setItem("dayline-motion", motion);
        localStorage.setItem("dayline-motion-style", style);
      }, preferences);
      await page.reload();
    }
    assert.deepEqual(
      await readPreferences(page),
      preferences,
      `${version} did not preserve appearance preferences`,
    );
    const raw = await page.evaluate(
      (selectedDates) => Promise.all(selectedDates.map((date) => window.dayline.snapshot(date))),
      dates,
    );
    const snapshots = raw.map((snapshot) => {
      assert.equal(snapshot.version, version);
      assert.equal(snapshot.packaged, true);
      assert.equal(snapshot.storageWarning, "");
      const {
        version: _version,
        packaged,
        storageWarning,
        today,
        browserStatus,
        iconRevision,
        current,
        status,
        ...persisted
      } = snapshot;
      return persisted;
    });
    assert.deepEqual(errors, []);
    return snapshots;
  } finally {
    await app.close();
  }
}

const baseline = await runInstalledVersion(baselineInstaller, baselineVersion);
assert.deepEqual(await profileHashes(), initialHashes, "1.4.0 changed the input history or icon");
// Both versions should load from the same path, as in an in-place update.
await rename(installPath, path.join(testDirectory, `Dayline-${baselineVersion}`));
const updated = await runInstalledVersion(releaseInstaller, releaseVersion);
assert.deepEqual(await profileHashes(), initialHashes, "1.5.0 changed the input history or icon");
assert.deepEqual(updated, baseline, "The update changed historical snapshots");

const populated = updated.find(({ date }) => date === populatedDay);
const week = updated.find(({ date }) => date === weekEnd).week;
assert.equal(populated.totalMs, 82 * minute);
assert.equal(populated.score, 73);
assert.equal(populated.typeTotals["c-study"], 15 * minute);
assert.equal(week.reduce((total, row) => total + row.totalMs, 0), 114 * minute);
assert.equal(updated.find(({ date }) => date === emptyDay).totalMs, 0);
assert.deepEqual(populated.entry, source.entries[populatedDay]);
assert.deepEqual(populated.entries, source.entries);
assert.deepEqual(populated.settings, source.settings);
assert.deepEqual(populated.types, source.types);
assert.deepEqual(populated.siteCategories, source.siteCategories);
assert.deepEqual(populated.catalog, source.apps);
assert.match(populated.icons[firefox], /^data:image\/png;base64,.+/);

const report = {
  baselineVersion,
  releaseVersion,
  dates,
  equalSnapshots: true,
  preservedPreferences: preferences,
  unchangedFileHashes: initialHashes,
  isolatedProfile: profile,
  method: "Ran both x64 executables extracted from NSIS at the same install path.",
};
await writeFile(path.join(testDirectory, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
