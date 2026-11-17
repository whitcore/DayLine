const { localDate, summary } = require("./model.cjs");
// Index raw sessions once. Historical days do not need to be filtered and
// aggregated again on every two-second renderer refresh.
class SummaryCache {
  constructor(state) {
    this.reset(state);
  }
  reset(state) {
    this.state = state;
    this.source = state.sessions;
    this.days = new Map();
    this.cache = new Map();
    this.period = null;
    this.indexed = 0;
    this.tail = null;
    this.tailEnd = 0;
    this.sync();
  }
  invalidate(date) {
    this.period = null;
    if (date) this.cache.delete(date);
    else this.cache.clear();
  }
  sync() {
    if (
      this.source !== this.state.sessions ||
      this.state.sessions.length < this.indexed
    ) {
      this.reset(this.state);
      return;
    }
    if (this.tail && this.tail.end !== this.tailEnd)
      this.invalidate(localDate(this.tail.start));
    for (; this.indexed < this.source.length; this.indexed++) {
      const session = this.source[this.indexed],
        date = localDate(session.start);
      if (!this.days.has(date)) this.days.set(date, []);
      this.days.get(date).push(session);
      this.invalidate(date);
    }
    this.tail = this.source.at(-1);
    this.tailEnd = this.tail?.end || 0;
  }
  get(date) {
    this.sync();
    return this.read(date);
  }
  read(date) {
    if (!this.cache.has(date))
      this.cache.set(
        date,
        summary({ ...this.state, sessions: this.days.get(date) || [] }, date),
      );
    return this.cache.get(date);
  }
  entriesBetween(from, to) {
    this.sync();
    return [...this.days.keys()]
      .filter((date) => date >= from && date <= to)
      .sort()
      .map((date) => this.read(date));
  }
}
module.exports = { SummaryCache };
