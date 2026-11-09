const { test } = require('node:test');
const assert = require('node:assert/strict');
const { FocusTimer } = require('../desktop/focus.cjs');

function clock(settings = {}) {
  let now = 100000;
  const completed = [];
  const timer = new FocusTimer({
    settings,
    now: () => now,
    onComplete: (event) => completed.push(event),
  });
  return { timer, completed, advance: (ms) => { now += ms; } };
}

test('a work deadline remains accurate when ticks are delayed', () => {
  const { timer, completed, advance } = clock({ focusWorkMinutes: 2 });
  assert.equal(timer.snapshot().status, 'idle');
  timer.start();
  advance(61500);
  assert.equal(timer.tick().remainingMs, 58500);
  advance(100000);
  const ready = timer.tick();
  assert.equal(ready.status, 'break-ready');
  assert.equal(ready.phase, 'break');
  assert.equal(ready.remainingMs, 300000);
  assert.equal(ready.deadlineAt, null);
  assert.deepEqual(completed, [{
    phase: 'work', durationMinutes: 2, completedAt: 220000,
  }]);
});

test('pausing before suspend excludes all paused time and resumes the remainder', () => {
  const { timer, completed, advance } = clock({ workMinutes: 1 });
  timer.start();
  advance(10000);
  assert.equal(timer.pause().remainingMs, 50000);
  advance(8 * 60 * 60 * 1000);
  assert.equal(timer.snapshot().remainingMs, 50000);
  assert.equal(completed.length, 0);
  timer.resume();
  advance(49999);
  assert.equal(timer.snapshot().remainingMs, 1);
  advance(1);
  assert.equal(timer.snapshot().status, 'break-ready');
  assert.equal(completed.length, 1);
});

test('work and break require explicit starts and complete exactly once', () => {
  const { timer, completed, advance } = clock({ workMinutes: 1, breakMinutes: 1 });
  timer.startWork();
  advance(60000);
  assert.equal(timer.snapshot().status, 'break-ready');
  advance(600000);
  timer.tick();
  timer.pause();
  assert.equal(completed.length, 1);
  assert.equal(timer.startBreak().status, 'running');
  assert.equal(timer.snapshot().phase, 'break');
  advance(60000);
  assert.equal(timer.tick().status, 'work-ready');
  advance(600000);
  assert.equal(timer.tick().status, 'work-ready');
  assert.equal(timer.snapshot().completedWorkSessions, 1);
  assert.deepEqual(completed.map((event) => event.phase), ['work', 'break']);
  timer.startWork();
  assert.equal(timer.snapshot().remainingMs, 60000);
});

test('repeated start and resume commands cannot reset an active phase', () => {
  const { timer, advance } = clock({ workMinutes: 1 });
  timer.start();
  advance(12000);
  assert.equal(timer.start().remainingMs, 48000);
  assert.equal(timer.resume().remainingMs, 48000);
  timer.pause();
  assert.equal(timer.startWork().status, 'paused');
  assert.equal(timer.startBreak().status, 'paused');
  assert.equal(timer.skipBreak().status, 'paused');
});

test('stopping a partial phase never reports completion', () => {
  const { timer, completed, advance } = clock({ workMinutes: 1 });
  timer.start();
  advance(20000);
  assert.equal(timer.stop().status, 'idle');
  advance(120000);
  assert.equal(timer.snapshot().remainingMs, 60000);
  assert.equal(completed.length, 0);
});

test('skipping a break readies work without starting it or completing the break', () => {
  const { timer, completed, advance } = clock({ workMinutes: 1, breakMinutes: 1 });
  timer.start();
  advance(60000);
  timer.tick();
  timer.startBreak();
  advance(15000);
  const ready = timer.skipBreak();
  assert.equal(ready.status, 'work-ready');
  assert.equal(ready.phase, 'work');
  assert.equal(ready.remainingMs, 60000);
  assert.equal(ready.deadlineAt, null);
  advance(120000);
  assert.equal(timer.snapshot().status, 'work-ready');
  assert.equal(completed.length, 1);
});

test('configuration affects the next phase without shortening a running or paused phase', () => {
  const { timer, completed, advance } = clock({ workMinutes: 2, breakMinutes: 5 });
  timer.start();
  advance(30000);
  timer.configure({ workMinutes: 1, breakMinutes: 3 });
  assert.equal(timer.snapshot().remainingMs, 90000);
  assert.equal(timer.snapshot().totalMs, 120000);
  timer.pause();
  timer.configure({ workMinutes: 4 });
  assert.equal(timer.snapshot().remainingMs, 90000);
  timer.resume();
  advance(90000);
  assert.equal(timer.tick().remainingMs, 180000);
  assert.equal(completed[0].durationMinutes, 2);
  timer.configure({ breakMinutes: 2 });
  assert.equal(timer.snapshot().remainingMs, 120000);
  timer.skipBreak();
  assert.equal(timer.snapshot().remainingMs, 240000);
});

test('duration validation is strict and rejects both fields atomically', () => {
  const { timer } = clock();
  for (const value of [0, -1, 181, 1.5, NaN, Infinity, '25', null]) {
    assert.throws(() => timer.configure({ workMinutes: value }));
  }
  for (const value of [0, -1, 61, 1.5, NaN, Infinity, '5', null]) {
    assert.throws(() => timer.configure({ breakMinutes: value }));
  }
  assert.throws(() => timer.configure({ workMinutes: 60, breakMinutes: 0 }));
  assert.equal(timer.snapshot().workMinutes, 25);
  assert.equal(timer.snapshot().breakMinutes, 5);
  timer.configure({ workMinutes: 180, breakMinutes: 60 });
  assert.equal(timer.snapshot().remainingMs, 10800000);
});

test('completion is settled before a callback reads the timer again', () => {
  let now = 0;
  let completed = 0;
  const timer = new FocusTimer({
    settings: { workMinutes: 1 }, now: () => now,
    onComplete: () => {
      completed += 1;
      assert.equal(timer.snapshot().status, 'break-ready');
    },
  });
  timer.start();
  now = 60000;
  timer.tick();
  timer.tick();
  assert.equal(completed, 1);
});
