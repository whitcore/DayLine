import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { _electron as electron, expect } from '@playwright/test';

const require = createRequire(import.meta.url);
const { initialState, addInterval } = require('../desktop/model.cjs');
const root = path.resolve('.');
const results = path.join(root, 'test-results');
await mkdir(results, { recursive: true });
const profile = await mkdtemp(path.join(results, 'browser-sites-'));
const profileFile = path.join(profile, 'dayline.json');
const state = initialState();
delete state.settings.trackBrowserSites;
state.settings.trackSites = true;
const start = new Date();
start.setHours(9, 0, 0, 0);
for (const [index, id, name, domain] of [
  [0, 'chrome.exe', 'Chrome', 'example.com'],
  [1, 'firefox.exe', 'Firefox', 'mozilla.org'],
]) {
  state.apps[id] = { exe: id, name, category: 'neutral' };
  addInterval(state, { appId: id, start: +start + index * 120000, end: +start + (index + 1) * 120000, domain });
}
await writeFile(profileFile, JSON.stringify(state));
const env = { ...process.env, DAYLINE_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const executablePath = env.DAYLINE_TEST_EXE;
const app = await electron.launch({
  ...(executablePath ? { executablePath } : {}),
  args: executablePath ? ['--test-mode'] : [root, '--test-mode'],
  cwd: root,
  env,
});
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const button = name => page.getByRole('button', { name, exact: true });
  await expect(page.locator('h1')).toHaveText('Сегодня');
  await page.setViewportSize({ width: 1536, height: 1024 });
  await button('Настройки').click();
  const toggle = page.getByRole('switch', { name: 'Учёт сайтов', exact: true });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  assert.equal(JSON.parse(await readFile(profileFile)).settings.trackBrowserSites, true);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  assert.equal(JSON.parse(await readFile(profileFile)).settings.trackBrowserSites, false);
  await button('Язык').click();
  await page.getByRole('option', { name: 'English', exact: true }).click();
  const englishToggle = page.getByRole('switch', { name: 'Website tracking', exact: true });
  await expect(englishToggle).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('region', { name: 'Time tracking' }).screenshot({
    path: path.join(results, 'browser-sites-settings.png'),
  });
  await button('Apps').click();
  for (const [width, height] of [[1536, 1024], [880, 680]]) {
    await page.setViewportSize({ width, height });
    const chrome = button('Chrome sites');
    const firefox = button('Firefox sites');
    await chrome.press('Enter');
    await firefox.press('Enter');
    await expect(chrome).toHaveAttribute('aria-expanded', 'true');
    await expect(firefox).toHaveAttribute('aria-expanded', 'true');
    assert.notEqual(await chrome.getAttribute('aria-controls'), await firefox.getAttribute('aria-controls'));
    await expect(page.getByText('example.com', { exact: true })).toBeVisible();
    await expect(page.getByText('mozilla.org', { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(results, 'browser-sites-' + width + '.png') });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await chrome.press('Enter');
    await firefox.press('Enter');
  }
  assert.deepEqual(JSON.parse(await readFile(profileFile)).sessions, state.sessions);
  assert.deepEqual(errors, []);
  console.log('Website setting, migration, localized controls and independent site disclosures passed');
} finally {
  await app.close();
}
