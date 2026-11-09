const fs=require('node:fs'),path=require('node:path');
const {validateState}=require('../desktop/model.cjs');
const root=path.resolve(__dirname,'..');
const target=require('../package.json').version;
const backups=fs.readdirSync(path.join(root,'archive')).filter(n=>n.startsWith('dayline-before-'+target+'-')).sort();
const backup=path.join(root,'archive',backups.at(-1)||'missing');
const before=JSON.parse(fs.readFileSync(path.join(backup,'dayline.json'),'utf8'));
const profile=path.join(process.env.APPDATA,'Dayline');
const after=validateState(JSON.parse(fs.readFileSync(path.join(profile,'dayline.json'),'utf8')));
const installedAsar=path.join(process.env.LOCALAPPDATA,'Programs','Dayline','resources','app.asar');
const version=JSON.parse(require('@electron/asar').extractFile(installedAsar,'package.json').toString()).version;
if(version!==target||after.createdAt!==before.createdAt)throw Error('Wrong version or profile');
const keys=new Map(after.sessions.map(s=>[s.appId+'|'+s.start+'|'+(s.domain||''),s]));
if(!before.sessions.every(s=>{const next=keys.get(s.appId+'|'+s.start+'|'+(s.domain||''));return next&&next.end>=s.end;}))throw Error('A historical interval is missing');
if(!Object.entries(before.entries).every(([date,entry])=>JSON.stringify(after.entries[date])===JSON.stringify(entry)))throw Error('Journal changed');
if(!Object.keys(before.apps).every(id=>Object.hasOwn(after.apps,id)))throw Error('An application is missing');
for (const [id, definition] of Object.entries(before.types || {}))
  if (JSON.stringify(after.types[id]) !== JSON.stringify(definition)) throw Error('A category definition changed');
for (const [key, value] of Object.entries(before.settings))
  if (JSON.stringify(after.settings[key]) !== JSON.stringify(value)) throw Error('A saved setting changed');
for (const [id, app] of Object.entries(before.apps))
  for (const key of ['category','allocations','hidden','customIcon'])
    if (JSON.stringify(after.apps[id][key]) !== JSON.stringify(app[key])) throw Error('An app preference changed');
for (const [domain, type] of Object.entries(before.siteCategories || {}))
  if (after.siteCategories[domain] !== type) throw Error('A website category changed');
const result={version,allHistoricalSessionsPreserved:true,sessionsBefore:before.sessions.length,sessionsNow:after.sessions.length,journalPreserved:true,journalDays:Object.keys(before.entries).length,appsPreserved:true,preferencesAndTypesPreserved:true,firefoxAllocation:after.apps['firefox.exe']?.allocations,backup};
fs.writeFileSync(path.join(backup,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
