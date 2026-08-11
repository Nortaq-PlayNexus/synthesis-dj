import { describe, it, expect, beforeEach } from 'vitest';
import { Playlist } from '../../src/renderer/js/playlist.js';

const makeTrack = (name, path = `/music/${name}.mp3`) => ({
  name,
  path,
  analysis: { bpm: 128, key: { name: 'A minor', camelot: '8A' } },
});

function stubStorage() {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
  };
}

describe('Playlist queue', () => {
  beforeEach(() => {
    stubStorage();
  });

  it('adds tracks and reports the queue length', () => {
    const pl = new Playlist();
    pl.add(makeTrack('ALPHA'));
    pl.add(makeTrack('BRAVO'));
    expect(pl.length).toBe(2);
    expect(pl.queue[0].name).toBe('ALPHA');
    expect(pl.queue[1].name).toBe('BRAVO');
  });

  it('adds many tracks in order', () => {
    const pl = new Playlist();
    pl.addMany([makeTrack('ALPHA'), makeTrack('BRAVO'), makeTrack('CHARLIE')]);
    expect(pl.length).toBe(3);
    expect(pl.queue.map((t) => t.name)).toEqual(['ALPHA', 'BRAVO', 'CHARLIE']);
  });

  it('removes a track at an index and fixes the current pointer', () => {
    const pl = new Playlist();
    pl.addMany([makeTrack('ALPHA'), makeTrack('BRAVO'), makeTrack('CHARLIE')]);
    pl.markCurrent(1);
    pl.removeAt(0);
    expect(pl.queue.map((t) => t.name)).toEqual(['BRAVO', 'CHARLIE']);
    expect(pl.currentIndex).toBe(0);
    expect(pl.current.name).toBe('BRAVO');
  });

  it('moves a track up and down', () => {
    const pl = new Playlist();
    pl.addMany([makeTrack('ALPHA'), makeTrack('BRAVO'), makeTrack('CHARLIE')]);
    pl.move(2, -1);
    expect(pl.queue.map((t) => t.name)).toEqual(['ALPHA', 'CHARLIE', 'BRAVO']);
    pl.move(0, 2);
    expect(pl.queue.map((t) => t.name)).toEqual(['CHARLIE', 'BRAVO', 'ALPHA']);
  });

  it('refuses to move beyond the queue bounds', () => {
    const pl = new Playlist();
    pl.addMany([makeTrack('ALPHA'), makeTrack('BRAVO')]);
    pl.move(0, -1);
    expect(pl.queue.map((t) => t.name)).toEqual(['ALPHA', 'BRAVO']);
    pl.move(1, 1);
    expect(pl.queue.map((t) => t.name)).toEqual(['ALPHA', 'BRAVO']);
  });

  it('clears the queue and resets the current pointer', () => {
    const pl = new Playlist();
    pl.addMany([makeTrack('ALPHA'), makeTrack('BRAVO')]);
    pl.markCurrent(0);
    pl.clear();
    expect(pl.length).toBe(0);
    expect(pl.currentIndex).toBe(-1);
    expect(pl.current).toBeNull();
  });

  it('tracks current, next and advance behavior', () => {
    const pl = new Playlist();
    pl.addMany([makeTrack('ALPHA'), makeTrack('BRAVO'), makeTrack('CHARLIE')]);
    expect(pl.current).toBeNull();
    expect(pl.hasNext).toBe(true);
    expect(pl.next().name).toBe('ALPHA');
    pl.markCurrent(0);
    expect(pl.current.name).toBe('ALPHA');
    expect(pl.hasNext).toBe(true);
    expect(pl.next().name).toBe('BRAVO');
    expect(pl.advance().name).toBe('BRAVO');
    expect(pl.currentIndex).toBe(1);
    expect(pl.advance().name).toBe('CHARLIE');
    expect(pl.hasNext).toBe(false);
    expect(pl.next()).toBeNull();
    expect(pl.advance()).toBeNull();
  });

  it('persists and hydrates the queue through localStorage', () => {
    const pl = new Playlist();
    pl.addMany([makeTrack('ALPHA'), makeTrack('BRAVO')]);
    pl.markCurrent(1);
    pl.autoAdvance = false;
    pl.persist();

    const pl2 = new Playlist();
    const data = pl2.hydrate();
    expect(data.tracks.map((t) => t.name)).toEqual(['ALPHA', 'BRAVO']);
    expect(data.currentIndex).toBe(1);
    expect(data.autoAdvance).toBe(false);
  });

  it('notifies listeners on every mutation', () => {
    const pl = new Playlist();
    let calls = 0;
    pl.onChange = () => calls++;
    pl.add(makeTrack('ALPHA'));
    pl.add(makeTrack('BRAVO'));
    pl.move(1, -1);
    pl.removeAt(0);
    pl.clear();
    expect(calls).toBe(5);
  });
});
