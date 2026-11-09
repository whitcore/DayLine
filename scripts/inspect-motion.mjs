import {_electron as electron} from '@playwright/test';
import path from 'node:path';import {writeFile} from 'node:fs/promises';
const dir=process.argv[2];if(!dir)throw Error('Isolated profile clone required');
const env={...process.env,DAYLINE_DATA_DIR:path.resolve(dir)};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({executablePath:process.env.DAYLINE_TEST_EXE||path.join(process.env.LOCALAPPDATA,'Programs','Dayline','Dayline.exe'),args:['--test-mode'],env});
try{const page=await app.firstWindow();await page.waitForSelector('h1');await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.show();w.focus();w.webContents.setBackgroundThrottling(false);});
 const settings=await page.evaluate(()=>({preference:localStorage.getItem('dayline-motion'),mode:localStorage.getItem('dayline-motion-mode'),systemReduced:matchMedia('(prefers-reduced-motion: reduce)').matches,htmlMotion:document.documentElement.dataset.motion,visibility:document.visibilityState,hover:matchMedia('(hover:hover) and (pointer:fine)').matches}));
 await page.getByRole('button',{name:'Статистика',exact:true}).click();await page.waitForTimeout(55);
 const animations=await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').map(a=>({duration:a.effect?.getTiming().duration,selector:a.effect?.target?.className?.baseVal??a.effect?.target?.className})).slice(0,12));
 const report={...settings,animations};await writeFile('test-results/user-motion-diagnosis.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await app.close();}
