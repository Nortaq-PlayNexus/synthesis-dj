/* SYNTHESIS - Playlist Queue Intelligence
 * Ordered mission roster of analyzed tracks. Supports add/remove/reorder,
 * current-track tracking, auto-advance when a deck finishes, and
 * in-session persistence of the queue order via localStorage.
 */

const STORAGE_KEY = 'synthesis-playlist';

export class Playlist {
  constructor() {
    this.queue = [];
    this.currentIndex = -1;
    this.autoAdvance = true;
    this._onChange = null;
  }

  set onChange(fn) {
    this._onChange = fn;
  }

  get length() {
    return this.queue.length;
  }

  get current() {
    return this.currentIndex >= 0 && this.currentIndex < this.queue.length
      ? this.queue[this.currentIndex]
      : null;
  }

  get hasNext() {
    return this.next() !== null;
  }

  add(track) {
    this.queue.push(track);
    this._changed();
    return this.queue.length - 1;
  }

  addMany(tracks) {
    this.queue.push(...tracks);
    this._changed();
  }

  removeAt(i) {
    if (i < 0 || i >= this.queue.length) return null;
    const [removed] = this.queue.splice(i, 1);
    if (i < this.currentIndex) this.currentIndex -= 1;
    else if (i === this.currentIndex) this.currentIndex = -1;
    this._changed();
    return removed;
  }

  move(i, delta) {
    const j = i + delta;
    if (i < 0 || j < 0 || i >= this.queue.length || j >= this.queue.length) return;
    const [track] = this.queue.splice(i, 1);
    this.queue.splice(j, 0, track);
    if (this.currentIndex === i) this.currentIndex = j;
    else if (i < this.currentIndex && j >= this.currentIndex) this.currentIndex -= 1;
    else if (i > this.currentIndex && j <= this.currentIndex) this.currentIndex += 1;
    this._changed();
  }

  clear() {
    this.queue = [];
    this.currentIndex = -1;
    this._changed();
  }

  markCurrent(i) {
    if (i >= 0 && i < this.queue.length) {
      this.currentIndex = i;
      this._changed();
    }
  }

  next() {
    if (this.queue.length === 0) return null;
    if (this.currentIndex < 0) return this.queue[0];
    if (this.currentIndex >= this.queue.length - 1) return null;
    return this.queue[this.currentIndex + 1];
  }

  advance() {
    if (this.queue.length === 0) return null;
    if (this.currentIndex < 0) this.currentIndex = 0;
    else if (this.currentIndex >= this.queue.length - 1) return null;
    else this.currentIndex += 1;
    this._changed();
    return this.queue[this.currentIndex];
  }

  serialize() {
    return {
      tracks: this.queue.map((t) => ({ name: t.name, path: t.path })),
      currentIndex: this.currentIndex,
      autoAdvance: this.autoAdvance,
    };
  }

  persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.serialize()));
    } catch {}
  }

  hydrate() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch {
      return null;
    }
  }

  _changed() {
    this.persist();
    if (this._onChange) this._onChange();
  }
}
