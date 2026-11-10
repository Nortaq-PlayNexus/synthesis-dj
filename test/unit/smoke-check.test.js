import { afterEach, describe, expect, it, vi } from 'vitest';
import smoke from '../../src/main/smoke-check.js';
const { runSmokeCheck } = smoke;

afterEach(() => vi.useRealTimers());

describe('smoke check exit status', () => {
  it.each([true, false, undefined])('requires explicit success: %s', async (result) => {
    const exit = vi.fn();
    runSmokeCheck(() => Promise.resolve(result), exit);
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(result === true ? 0 : 1));
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('fails on rejected analysis', async () => {
    const exit = vi.fn();
    runSmokeCheck(() => Promise.reject(new Error('analysis failed')), exit);
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
  });

  it('fails on a synchronous error', async () => {
    const exit = vi.fn();
    runSmokeCheck(() => {
      throw new Error('renderer unavailable');
    }, exit);
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
  });

  it('times out and ignores a late success', async () => {
    vi.useFakeTimers();
    const exit = vi.fn();
    let resolve;
    runSmokeCheck(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
      exit,
      100,
    );
    await vi.advanceTimersByTimeAsync(100);
    expect(exit).toHaveBeenCalledWith(1);
    resolve(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
