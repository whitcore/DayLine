const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {Storage}=require('../desktop/storage.cjs');const {initialState,validateState}=require('../desktop/model.cjs');
test('atomic storage persists and recovers a previous valid copy without overwriting it',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dayline-storage-'));
 try{const s=new Storage(dir);s.data.entries['2026-11-07']={mood:4,note:'First',done:'Done'};s.dirty=true;s.save();s.data.entries['2026-11-07'].note='Second';s.dirty=true;s.save();assert.equal(new Storage(dir).data.entries['2026-11-07'].note,'Second');fs.writeFileSync(path.join(dir,'dayline.json'),'corrupted');const recovered=new Storage(dir);assert.equal(recovered.data.entries['2026-11-07'].note,'First');assert.ok(recovered.warning);recovered.dirty=true;recovered.save();assert.equal(new Storage(dir).data.entries['2026-11-07'].mood,4);}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('invalid backup sessions, settings, categories and journal entries are rejected',()=>{
 for(const mutate of [s=>s.sessions.push({appId:'x',start:10,end:1}),s=>s.sessions.push({appId:'missing',start:1,end:10}),s=>s.settings.idleMinutes=-1,s=>s.apps.x={name:'x',exe:'x',category:'other'},s=>s.entries['2026-11-07']={mood:99,note:'',done:''}]){const s=initialState();mutate(s);assert.throws(()=>validateState(s));}
});
