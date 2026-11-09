const MINUTE_MS = 60_000;

function duration(value, name, maximum) {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new RangeError(`${name} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

/** In-memory deadline timer. The main process owns ticking and suspend events. */
class FocusTimer {
  constructor({ settings = {}, onComplete = () => {}, now = Date.now } = {}) {
    this.now = now;
    this.onComplete = onComplete;
    this.workMinutes = duration(
      settings.focusWorkMinutes ?? settings.workMinutes ?? 25,
      'workMinutes',
      180,
    );
    this.breakMinutes = duration(
      settings.focusBreakMinutes ?? settings.breakMinutes ?? 5,
      'breakMinutes',
      60,
    );
    this.completedWorkSessions = 0;
    this._ready('idle', 'work');
  }

  _ready(status, phase) {
    this.status = status;
    this.phase = phase;
    this.totalMs = this[`${phase}Minutes`] * MINUTE_MS;
    this.remainingMs = this.totalMs;
    this.deadlineAt = null;
  }

  _sync(at) {
    if (this.status !== 'running') return;
    this.remainingMs = Math.min(this.totalMs, Math.max(0, this.deadlineAt - at));
    if (this.remainingMs > 0) return;

    const completed = {
      phase: this.phase,
      durationMinutes: this.totalMs / MINUTE_MS,
      completedAt: this.deadlineAt,
    };
    if (this.phase === 'work') {
      this.completedWorkSessions += 1;
      this._ready('break-ready', 'break');
    } else {
      this._ready('work-ready', 'work');
    }
    // Settle first so callback reads and repeated snapshots cannot notify twice.
    this.onComplete(completed);
  }

  snapshot() {
    this._sync(this.now());
    return {
      status: this.status,
      phase: this.phase,
      remainingMs: this.remainingMs,
      totalMs: this.totalMs,
      deadlineAt: this.deadlineAt,
      workMinutes: this.workMinutes,
      breakMinutes: this.breakMinutes,
      completedWorkSessions: this.completedWorkSessions,
    };
  }

  tick() {
    return this.snapshot();
  }

  configure({ workMinutes = this.workMinutes, breakMinutes = this.breakMinutes } = {}) {
    // Validate both fields before changing either value.
    const work = duration(workMinutes, 'workMinutes', 180);
    const rest = duration(breakMinutes, 'breakMinutes', 60);
    this._sync(this.now());
    this.workMinutes = work;
    this.breakMinutes = rest;
    // A chosen duration belongs to its active phase; edits apply next time.
    if (this.status !== 'running' && this.status !== 'paused') {
      this._ready(this.status, this.phase);
    }
    return this.snapshot();
  }

  start() {
    return this.startWork();
  }

  startWork() {
    this._sync(this.now());
    if (this.status === 'running' || this.status === 'paused') return this.snapshot();
    this._ready('running', 'work');
    this.deadlineAt = this.now() + this.remainingMs;
    return this.snapshot();
  }

  startBreak() {
    this._sync(this.now());
    if (this.status !== 'break-ready') return this.snapshot();
    this._ready('running', 'break');
    this.deadlineAt = this.now() + this.remainingMs;
    return this.snapshot();
  }

  pause() {
    this._sync(this.now());
    if (this.status === 'running') {
      this.status = 'paused';
      this.deadlineAt = null;
    }
    return this.snapshot();
  }

  resume() {
    if (this.status === 'paused') {
      this.status = 'running';
      this.deadlineAt = this.now() + this.remainingMs;
    }
    return this.snapshot();
  }

  stop() {
    this._sync(this.now());
    this._ready('idle', 'work');
    return this.snapshot();
  }

  skipBreak() {
    this._sync(this.now());
    if (this.phase === 'break') this._ready('work-ready', 'work');
    return this.snapshot();
  }
}

module.exports = { FocusTimer };
