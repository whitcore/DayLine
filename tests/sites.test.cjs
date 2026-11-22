const {test}=require('node:test');const assert=require('node:assert/strict');
const {initialState,addInterval,summary,validateState,validDomain,visibleApps,setSiteCategory}=require('../desktop/model.cjs');const {Tracker}=require('../desktop/tracker.cjs');
test('site switches stay within browser time, unknown historical time is preserved',()=>{
 const state=initialState();state.apps['firefox.exe']={name:'Firefox',exe:'firefox.exe',category:'neutral'};const start=new Date(2026,10,8,10).getTime();
 addInterval(state,{appId:'firefox.exe',start,end:start+60000,domain:'example.com'});addInterval(state,{appId:'firefox.exe',start:start+60000,end:start+180000,domain:'mozilla.org'});addInterval(state,{appId:'firefox.exe',start:start+180000,end:start+240000});
 const day=summary(state,'2026-11-08');assert.equal(day.totalMs,240000);assert.deepEqual(day.apps[0].sites,[{domain:'mozilla.org',ms:120000},{domain:'example.com',ms:60000}]);assert.equal(state.sessions.length,3);
 state.apps['firefox.exe'].hidden=true;assert.equal(visibleApps(day.apps.map(a=>({...a,hidden:true}))).length,0);assert.equal(summary(state,'2026-11-08').totalMs,240000);assert.equal(validateState(state).sessions.length,3);
});
test('URLs, queries, local addresses and malformed domains never enter stored site data',()=>{for(const domain of ['https://example.com/a?token=123','example.com/search?q=x','localhost','a b.com','__proto__'])assert.equal(validDomain(domain),false);assert.equal(validDomain('xn--e1afmkfd.xn--p1ai'),true);});
test('site attribution follows previous active sample and stops during idle or pause',()=>{const intervals=[],t=new Tracker({idleMinutes:1,onInterval:x=>intervals.push(x)});t.sample({exe:'firefox.exe',domain:'example.com',idleMs:0},1000,0);t.sample({exe:'code.exe',idleMs:0},2000,1000);assert.equal(intervals[0].appId,'firefox.exe');assert.equal(intervals[0].domain,'example.com');t.sample({exe:'code.exe',idleMs:0},3000,2000);assert.equal(intervals[1].domain,undefined);t.paused=true;t.sample({exe:'firefox.exe',domain:'example.com',idleMs:0},4000,3000);assert.equal(intervals.length,2);});

test('existing Firefox preferences require consent for combined browser tracking', () => {
 const state = initialState();
 assert.equal(state.settings.trackBrowserSites, false);
 delete state.settings.trackBrowserSites;
 state.settings.trackSites = true;
 const migrated = validateState(state);
 assert.equal(migrated.settings.trackBrowserSites, false);
 migrated.settings.trackBrowserSites = true;
 assert.equal(validateState(structuredClone(migrated)).settings.trackBrowserSites, true);
});

test('Chrome and Firefox have separate hostname totals and share a site category', () => {
 const state = initialState();
 const start = new Date(2026, 10, 8, 10).getTime();
 state.apps['chrome.exe'] = { name: 'Chrome', exe: 'chrome.exe', category: 'neutral' };
 state.apps['firefox.exe'] = { name: 'Firefox', exe: 'firefox.exe', category: 'neutral' };
 addInterval(state, { appId: 'chrome.exe', start, end: start + 180000, domain: 'example.com' });
 addInterval(state, { appId: 'firefox.exe', start: start + 180000, end: start + 240000, domain: 'example.com' });
 setSiteCategory(state, 'example.com', 'focus');
 const day = summary(state, '2026-11-08');
 assert.equal(day.focusMs, 240000);
 assert.deepEqual(day.apps.map(app => [app.id, app.sites[0].ms]), [
  ['chrome.exe', 180000],
  ['firefox.exe', 60000],
 ]);
});
