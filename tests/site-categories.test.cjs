const { test } = require('node:test');
const assert = require('node:assert/strict');
const { initialState, addInterval, summary, setAllocation, setSiteCategory, removeType, validateState } = require('../desktop/model.cjs');
const { SummaryCache } = require('../desktop/summary-cache.cjs');
function fixture() {
  const state = initialState();
  state.apps['firefox.exe'] = { name: 'Firefox', exe: 'firefox.exe', category: 'neutral' };
  setAllocation(state, 'firefox.exe', { focus: 50, rest: 50 });
  const start = new Date(2026, 10, 8, 10).getTime();
  for (const [i, domain] of ['work.example', 'study.example', 'rest.example', undefined].entries())
    addInterval(state, { appId: 'firefox.exe', start: start + i * 60000, end: start + (i + 1) * 60000, domain });
  return state;
}
test('domain overrides classify existing intervals without duplicating browser time', () => {
  const s = fixture(), original = structuredClone(s.sessions);
  setSiteCategory(s, 'WORK.EXAMPLE', 'focus');
  setSiteCategory(s, 'study.example', 'study');
  setSiteCategory(s, 'rest.example', 'rest');
  const result = summary(s, '2026-11-08');
  assert.equal(result.totalMs, 240000);
  assert.equal(result.focusMs, 150000);
  assert.equal(result.restMs, 90000);
  assert.equal(result.typeTotals['c-site-study'], 60000);
  assert.equal(result.score, 63);
  assert.deepEqual(s.sessions, original);
  setSiteCategory(s, 'work.example', null);
  assert.equal(summary(s, '2026-11-08').focusMs, 120000);
  assert.deepEqual(s.apps['firefox.exe'].allocations, { focus: 50, rest: 50 });
});
test('cache and custom category deletion preserve domain contributions and total time', () => {
  const s = fixture(), cache = new SummaryCache(s);
  assert.equal(cache.get('2026-11-08').focusMs, 120000);
  setSiteCategory(s, 'study.example', 'study');
  cache.invalidate();
  assert.equal(cache.get('2026-11-08').focusMs, 150000);
  removeType(s, 'c-site-study');
  assert.equal(s.siteCategories['study.example'], 'focus');
  assert.equal(summary(s, '2026-11-08').focusMs, 150000);
});
test('old backups default to inherited classification and overrides survive JSON roundtrip', () => {
  const s = fixture(); delete s.siteCategories;
  const restored = validateState(s);
  assert.deepEqual(restored.siteCategories, {});
  setSiteCategory(restored, 'study.example', 'study');
  const roundtrip = validateState(JSON.parse(JSON.stringify(restored)));
  assert.deepEqual(roundtrip.siteCategories, { 'study.example': 'c-site-study' });
  assert.equal(summary(roundtrip, '2026-11-08').focusMs, 150000);
});
test('domain classification rejects URLs, missing types and malformed backups', () => {
  const s = fixture();
  assert.throws(() => setSiteCategory(s, 'https://example.com/path', 'focus'));
  assert.throws(() => setSiteCategory(s, 'example.com', 'missing'));
  for (const overrides of [[], 'invalid', { '__proto__.com': 'missing' }, { 'https://example.com': 'focus' }]) {
    const bad = structuredClone(s); bad.siteCategories = overrides;
    assert.throws(() => validateState(bad));
  }
});
test('imported domain casing has one identity without rewriting historical intervals', () => {
  const s = fixture();
  s.sessions[0].domain = 'WORK.EXAMPLE';
  const original = structuredClone(s.sessions);
  setSiteCategory(s, 'work.example', 'focus');
  const day = summary(validateState(s), '2026-11-08');
  assert.equal(day.focusMs, 150000);
  assert.equal(day.apps[0].sites.find(site => site.domain === 'work.example').ms, 60000);
  assert.deepEqual(s.sessions, original);
});
test('Study preset works when an old profile has used every custom type slot', () => {
  const s = fixture();
  const { saveType } = require('../desktop/model.cjs');
  for (let i = 0; i < 27; i++) saveType(s, { id: `c-old-${i}`, label: `Вид ${i}`, color: '#ca8cf6', base: 'focus' });
  assert.equal(Object.keys(s.types).length, 30);
  setSiteCategory(s, 'study.example', 'study');
  assert.equal(summary(s, '2026-11-08').focusMs, 150000);
  assert.equal(validateState(JSON.parse(JSON.stringify(s))).siteCategories['study.example'], 'c-site-study');
  assert.throws(() => saveType(s, { id: 'c-over-limit', label: 'Лишний', color: '#ca8cf6', base: 'focus' }));
  assert.equal(Object.keys(s.types).length, 31);
});
test('Study reuses an existing productive study type rather than creating a duplicate', () => {
  const s = fixture();
  s.types['c-my-study'] = { label: 'Учёба', color: '#ca8cf6', base: 'focus' };
  setSiteCategory(s, 'study.example', 'study');
  assert.equal(s.siteCategories['study.example'], 'c-my-study');
  assert.equal(Object.keys(s.types).length, 4);
  assert.equal(summary(s, '2026-11-08').focusMs, 150000);
});
