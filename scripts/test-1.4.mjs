import { _electron as electron, expect } from '@playwright/test';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve('.'), require = createRequire(import.meta.url);
const { initialState, addInterval, localDate, setAllocation } = require('../desktop/model.cjs');
await mkdir('test-results', { recursive: true });
const dir = await mkdtemp(path.join(root, 'test-results', 'v14-'));
const fixture = initialState(), today = localDate(Date.now());
fixture.types['c-existing-study'] = { label: 'Учёба', color: '#ca8cf6', base: 'focus' };
fixture.apps['firefox.exe'] = { name: 'Firefox', exe: 'firefox.exe', category: 'neutral' };
setAllocation(fixture, 'firefox.exe', { focus: 50, rest: 50 });
fixture.entries[today] = { mood: 4, note: 'Не потерять запись', done: 'Обновление' };
const start = new Date(today + 'T09:00:00').getTime();
const domains = ['work.example', 'study.example', 'rest.example', undefined];
domains.forEach((domain, i) => addInterval(fixture, { appId: 'firefox.exe', start: start + i * 600000, end: start + (i + 1) * 600000, domain }));
await writeFile(path.join(dir, 'dayline.json'), JSON.stringify(fixture));
const env = { ...process.env, DAYLINE_DATA_DIR: dir };
delete env.ELECTRON_RUN_AS_NODE;
let app, page;
const errors = [], report = { packaged: !!process.env.DAYLINE_TEST_EXE };
const snapshot = () => page.evaluate(() => window.dayline.snapshot());
const nav = name => page.getByRole('button', { name, exact: true });
async function launch() {
  app = await electron.launch({ ...(process.env.DAYLINE_TEST_EXE ? { executablePath: process.env.DAYLINE_TEST_EXE, args: ['--test-mode'] } : { args: [root, '--test-mode'] }), cwd: root, env });
  page = await app.firstWindow(); page.on('pageerror', error => errors.push(error.message));
  await expect(page.locator('h1')).toHaveText('Сегодня.');
  await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.show(); w.focus(); });
  await page.waitForTimeout(200);
}
async function category(domain, label) {
  await nav('Категория сайта: ' + domain).click();
  await page.getByRole('menuitemradio', { name: label, exact: true }).click();
  await expect(nav('Категория сайта: ' + domain)).toContainText(label);
}
try {
  await launch();
  await nav('Предыдущий день').click();
  await expect(nav('Вернуться к сегодняшнему дню')).toBeVisible();
  await nav('Вернуться к сегодняшнему дню').click();
  await expect(page.locator('h1')).toHaveText('Сегодня.');
  await expect(nav('Вернуться к сегодняшнему дню')).toHaveCount(0);
  report.returnToday = true;
  await nav('Настройки').click();
  const palettes = {};
  for (const [id, label] of [['dark', 'Яркая тёмная'], ['soft-dark', 'Мягкая тёмная'], ['light', 'Яркая светлая'], ['soft-light', 'Мягкая светлая']]) {
    await page.getByRole('radio', { name: label, exact: true }).check();
    palettes[id] = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return Object.fromEntries(['--bg', '--sidebar-bg', '--surface', '--surface-alt', '--surface-raised', '--surface-input', '--lime', '--pink', '--cyan'].map(key => [key, s.getPropertyValue(key).trim()]));
    });
    await page.screenshot({ path: `test-results/dayline-1.4-${id}.png`, fullPage: true });
  }
  for (const key of ['--bg', '--sidebar-bg', '--surface', '--surface-alt', '--surface-raised', '--surface-input']) {
    expect(palettes['dark'][key]).toBe(palettes['soft-dark'][key]);
    expect(palettes['light'][key]).toBe(palettes['soft-light'][key]);
    const rgb = palettes['light'][key].replace('#', '').match(/../g).map(x => parseInt(x, 16));
    expect(Math.max(...rgb) - Math.min(...rgb)).toBeLessThanOrEqual(3);
  }
  expect(palettes.dark['--bg']).toBe('#070707');
  expect(palettes.dark['--lime']).toBe('#b9ff4b');
  expect(palettes.dark['--pink']).not.toBe(palettes['soft-dark']['--pink']);
  report.neutralPalettes = palettes;
  await page.getByRole('radio', { name: 'Яркая тёмная', exact: true }).check();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('radio', { name: 'По системе', exact: true }).click();
  await expect(page.locator('.motion-mode-description')).toContainText('Windows разрешает движение');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.motion-mode-description')).toContainText('Windows просит уменьшить');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('radio', { name: 'Мягкие', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await nav('Показать анимации').click();
  const gentleAnimations = await page.locator('.demo-mini-card').evaluate(el => el.getAnimations().map(a => a.effect.getKeyframes()));
  expect(gentleAnimations.length).toBeGreaterThan(0);
  report.gentlePreviewFades = gentleAnimations.some(frames => frames.some(frame => 'opacity' in frame));
  expect(report.gentlePreviewFades).toBe(true);
  expect(gentleAnimations.flat().filter(frame => frame.transform && !['none', 'translateX(0px) translateY(0px) scale(1)', 'translateY(0px) scale(1)'].includes(frame.transform))).toEqual([]);
  await page.getByRole('radio', { name: 'Полные', exact: true }).click();
  await nav('Сегодня').click();
  await nav('Сайты Firefox').click();
  await expect(page.locator('.site-mark svg')).toHaveCount(3);
  await expect(page.getByText('Только домены · локально')).toHaveCount(0);
  await expect(page.getByText('Без детализации', { exact: false })).toHaveCount(0);
  const before = await snapshot();
  await category('work.example', 'Работа');
  await category('study.example', 'Учёба');
  await category('rest.example', 'Развлечения');
  let after = await snapshot();
  expect(after.totalMs).toBe(2400000); expect(after.focusMs).toBe(1500000); expect(after.restMs).toBe(900000); expect(after.score).toBe(63);
  expect(after.week.at(-1).score).toBe(63);
  expect(after.sessions).toEqual(before.sessions);
  expect(after.catalog['firefox.exe'].allocations).toEqual({ focus: 50, rest: 50 });
  report.classificationNoDoubleTime = true;
  await nav('Категория сайта: work.example').click();
  await page.screenshot({ path: 'test-results/dayline-1.4-sites-menu.png', fullPage: true });
  await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await expect(nav('Категория сайта: work.example')).toContainText('Как у Firefox');
  after = await snapshot(); expect(after.focusMs).toBe(1200000);
  await category('work.example', 'Работа');
  const backup = path.join(dir, 'export.json');
  await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, backup);
  await page.evaluate(() => window.dayline.exportData());
  const exported = JSON.parse(await readFile(backup, 'utf8'));
  expect(exported.siteCategories).toEqual({ 'work.example': 'focus', 'study.example': 'c-existing-study', 'rest.example': 'rest' });
  expect(Object.keys(exported.types).length).toBe(4);
  expect(exported.sessions).toEqual(fixture.sessions);
  report.exportPreservesOverrides = true;
  await category('work.example', 'Развлечения');
  expect((await snapshot()).focusMs).toBe(900000);
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    dialog.showMessageBox = async () => ({ response: 1 });
  }, backup);
  await page.evaluate(() => window.dayline.importData());
  after = await snapshot();
  expect(after.siteCategories).toEqual(exported.siteCategories);
  expect(after.score).toBe(63); expect(after.sessions).toEqual(fixture.sessions);
  await expect(nav('Категория сайта: work.example')).toContainText('Работа');
  report.importPreservesOverrides = true;
  await page.setViewportSize({ width: 900, height: 760 });
  await page.screenshot({ path: 'test-results/dayline-1.4-sites-compact.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await app.close(); app = null; await launch();
  after = await snapshot(); expect(after.siteCategories).toEqual(exported.siteCategories); expect(after.score).toBe(63); expect(after.entries).toEqual(fixture.entries);
  report.persistence = true; report.errors = errors; expect(errors).toEqual([]);
  await writeFile('test-results/v14-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (e) {
  if (page) await page.screenshot({ path: 'test-results/v14-failure.png', fullPage: true }).catch(() => {});
  throw e;
} finally { if (app) await app.close(); }
