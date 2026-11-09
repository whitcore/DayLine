const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Tracker}=require('../desktop/tracker.cjs');
const {addInterval,summary,localDate,initialState}=require('../desktop/model.cjs');
const sample=(exe='Code.exe',idleMs=0)=>({exe,name:exe,path:'C:\\Apps\\'+exe,idleMs,locked:false});
test('only foreground time accrues, never background process uptime',()=>{
 const intervals=[],tracker=new Tracker({onInterval:i=>intervals.push(i),idleMinutes:3});
 tracker.sample(sample(),100000,1000);tracker.sample(sample(),101000,2000);
 tracker.sample(sample('Telegram.exe'),102000,3000);tracker.sample(sample('Telegram.exe'),103000,4000);
 assert.deepEqual(intervals.map(i=>[i.appId,i.end-i.start]),[['code.exe',1000],['code.exe',1000],['telegram.exe',1000]]);
});
test('idle threshold clips a boundary; lock, pause, suspend and long gaps do not accrue',()=>{
 const intervals=[],tracker=new Tracker({onInterval:i=>intervals.push(i),idleMinutes:3});
 tracker.sample(sample('Code.exe',179500),100000,1000);tracker.sample(sample('Code.exe',180500),101000,2000);
 assert.equal(intervals[0].end-intervals[0].start,500);
 tracker.sample(sample('Code.exe',181500),102000,3000);assert.equal(intervals.length,1);
 tracker.reset();tracker.sample(sample(),104000,5000);tracker.sample({...sample(),locked:true},105000,6000);assert.equal(intervals.length,1);
 tracker.reset();tracker.sample(sample(),106000,7000);tracker.paused=true;tracker.sample(sample(),107000,8000);assert.equal(intervals.length,1);
 tracker.paused=false;tracker.reset();tracker.sample(sample(),108000,9000);tracker.sample(sample(),168000,69000);assert.equal(intervals.length,1);
});
test('clock jumps do not fabricate time and helper failures break attribution',()=>{
 const intervals=[],tracker=new Tracker({onInterval:i=>intervals.push(i)});
 tracker.sample(sample(),100000,1000);tracker.sample(sample(),999000,2000);assert.equal(intervals.length,0);
 tracker.reset();tracker.sample(sample('Telegram.exe'),1000000,3000);tracker.sample(sample(),1001000,4000);
 assert.equal(intervals[0].appId,'telegram.exe');
});
test('intervals split across local midnight, merge adjacent sessions and ratings stay transparent',()=>{
 const state=initialState(),start=new Date(2026,10,7,23,59,59).getTime();
 state.apps['code.exe']={name:'Visual Studio Code',exe:'Code.exe',category:'focus'};
 state.apps['telegram.exe']={name:'Telegram',exe:'Telegram.exe',category:'neutral'};
 addInterval(state,{appId:'code.exe',start,end:start+2000});
 assert.equal(state.sessions.length,2);assert.notEqual(localDate(state.sessions[0].start),localDate(state.sessions[1].start));
 addInterval(state,{appId:'code.exe',start:start+2000,end:start+3000});assert.equal(state.sessions.length,2);
 addInterval(state,{appId:'telegram.exe',start:start+3000,end:start+5000});
 const day=summary(state,localDate(start+4000));assert.equal(day.totalMs,4000);assert.equal(day.focusMs,2000);assert.equal(day.score,50);
 assert.equal(summary(state,'2000-01-01').score,null);
 state.apps['telegram.exe'].category='focus';assert.equal(summary(state,localDate(start+4000)).score,100);
});
