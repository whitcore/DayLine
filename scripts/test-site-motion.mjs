import { _electron as electron, expect } from '@playwright/test';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve('.'), require = createRequire(import.meta.url);
const { motionFixture } = require('../tests/motion-fixture.cjs');
await mkdir('test-results', { recursive: true });
const dir = await mkdtemp(path.join(root, 'test-results', 'site-motion-'));
const fixture = motionFixture();
fixture.sessions.findLast(s => s.appId === 'firefox.exe').domain = 'example.com';
await writeFile(path.join(dir, 'dayline.json'), JSON.stringify(fixture));
const env = { ...process.env, DAYLINE_DATA_DIR: dir }; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ ...(process.env.DAYLINE_TEST_EXE ? { executablePath: process.env.DAYLINE_TEST_EXE, args: ['--test-mode'] } : { args: [root, '--test-mode'] }), cwd: root, env });
const report = [];
try {
  const page = await app.firstWindow();
  await expect(page.locator('h1')).toHaveText('Сегодня.');
  await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.show(); w.focus(); });
  for (const [style, keyboard] of [['off', false], ['gentle', false], ['full', true], ['full', false]]) {
    await page.evaluate(style => {
      localStorage.setItem('dayline-motion', style === 'off' ? 'off' : 'on');
      localStorage.setItem('dayline-motion-style', style === 'off' ? 'full' : style);
    }, style);
    await page.reload(); await expect(page.locator('h1')).toHaveText('Сегодня.');
    await page.getByRole('button', { name: 'Сайты Firefox', exact: true }).click();
    await page.getByRole('button', { name: 'Категория сайта: example.com', exact: true }).click();
    const item = page.getByRole('menuitemradio', { name: 'Работа', exact: true });
    if (keyboard) { await item.focus(); await page.keyboard.down('Space'); }
    else { const box = await item.boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); }
    await page.waitForTimeout(190);
    const transform = await item.evaluate(el => getComputedStyle(el).transform);
    const shouldScale = style === 'full' && !keyboard;
    report.push({ style, keyboard, transform });
    if (keyboard) await page.keyboard.up('Space'); else await page.mouse.up();
    if (shouldScale) expect(transform).toBe('matrix(0.98, 0, 0, 0.98, 0, 0)');
    else expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform);
  }
  await writeFile('test-results/site-motion-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await app.close(); }
