import {_electron as electron,expect} from '@playwright/test';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=path.resolve('.');await mkdir('test-results',{recursive:true});const dir=await mkdtemp(path.join(root,'test-results','desktop-'));
const require=createRequire(import.meta.url),{initialState,addInterval}=require('../desktop/model.cjs');
// Isolated UI fixtures: the real desktop may correctly report idle or no foreground app.
const fixture=initialState();fixture.settings.idleMinutes=0;fixture.apps['code.exe']={exe:'Code.exe',name:'Visual Studio Code',category:'focus'};fixture.apps['telegram.exe']={exe:'Telegram.exe',name:'Telegram',category:'neutral'};
const now=Date.now();addInterval(fixture,{appId:'code.exe',start:now-136000,end:now-46000});addInterval(fixture,{appId:'telegram.exe',start:now-46000,end:now-1000});await writeFile(path.join(dir,'dayline.json'),JSON.stringify(fixture));
const env={...process.env,DAYLINE_DATA_DIR:dir};delete env.ELECTRON_RUN_AS_NODE;
let app,page;const errors=[];
async function launch(){app=await electron.launch({...(process.env.DAYLINE_TEST_EXE?{executablePath:process.env.DAYLINE_TEST_EXE,args:[]}:{args:[root]}),cwd:root,env,timeout:30000});page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await expect(page.locator('h1')).toHaveText(/^Сегодня\.?$/);await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.show();w.focus();});await page.waitForTimeout(700);}
try{
 await launch();await expect(page.locator('.tracking-status')).not.toHaveText('Учёт недоступен',{timeout:15000});
 await page.screenshot({path:'test-results/dayline-first-launch.png',fullPage:true});
 await page.getByRole('button',{name:'Дневник',exact:true}).click();
 await page.getByRole('button',{name:'Хорошо',exact:true}).click();
 await page.getByLabel('Что получилось сделать').fill('Проверил настоящее Windows-приложение');
 await page.getByLabel('Мысли и заметки').fill('Данные должны сохраниться после перезапуска.');
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(page.getByRole('button',{name:'Сохранено',exact:true})).toBeVisible();
 const snapshot=await page.evaluate(()=>window.dayline.snapshot());expect(snapshot.entry.mood).toBe(4);expect(snapshot.entry.note).toContain('перезапуска');expect(Object.keys(snapshot.catalog).length).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Приостановить учёт',exact:true}).click();const before=await page.evaluate(()=>window.dayline.snapshot());await new Promise(r=>setTimeout(r,2300));const after=await page.evaluate(()=>window.dayline.snapshot());expect(after.totalMs).toBe(before.totalMs);expect(after.status.kind).toBe('paused');
 await page.getByRole('button',{name:'Продолжить учёт',exact:true}).click();
 await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.getByRole('button',{name:'Порог бездействия',exact:true}).click();await page.getByRole('option',{name:'5 мин',exact:true}).click();
 await page.getByRole('button',{name:'Программы',exact:true}).click();
 const id=Object.keys(snapshot.catalog)[0];await page.getByLabel('Категория: '+id).click();await page.getByRole('menuitemradio',{name:'Работа',exact:true}).click();expect((await page.evaluate(()=>window.dayline.snapshot())).catalog[id].category).toBe('focus');
 await page.getByRole('button',{name:'Статистика',exact:true}).click();await expect(page.locator('.week-column')).toHaveCount(7);
 await page.getByRole('button',{name:'Сегодня',exact:true}).click();await expect(page.locator('.program-row').first()).toBeVisible({timeout:15000});
 await page.getByRole('button',{name:'Запись дня',exact:true}).click();await page.getByLabel('Мысли и заметки').fill('Автосохранение работает после перезапуска.');
 await expect.poll(()=>page.evaluate(async()=>(await window.dayline.snapshot()).entry.note)).toBe('Автосохранение работает после перезапуска.');
 await page.screenshot({path:'test-results/dayline-live.png',fullPage:true});
 await app.close();app=null;
 const persisted=JSON.parse(await readFile(path.join(dir,'dayline.json'),'utf8'));expect(persisted.settings.idleMinutes).toBe(5);expect(persisted.entries[snapshot.today].mood).toBe(4);expect(persisted.sessions.length).toBeGreaterThan(0);
 await launch();await page.getByRole('button',{name:'Дневник',exact:true}).click();await expect(page.getByLabel('Мысли и заметки')).toHaveValue('Автосохранение работает после перезапуска.');
 await page.getByRole('button',{name:'Настройки',exact:true}).click();await expect(page.getByRole('button',{name:'Порог бездействия',exact:true})).toContainText('5 мин');expect(errors).toEqual([]);
 await page.setViewportSize({width:900,height:760});await page.screenshot({path:'test-results/dayline-compact.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 console.log(JSON.stringify({packaged:!!process.env.DAYLINE_TEST_EXE,nativeProbe:true,foregroundRecords:persisted.sessions.length,journal:true,autosave:true,pause:true,category:true,settings:true,restartPersistence:true,statistics:true,runtimeErrors:errors,dataDirectory:dir}));
}finally{if(app)await app.close();}
