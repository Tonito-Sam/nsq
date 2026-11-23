import { describe, expect, it } from 'vitest';
import { throwIfAborted, waitForAbort } from '../abortSignal';

describe('abortSignal', () => {
  it('rejects pending work when its signal is aborted', async () => {
    const controller = new AbortController();
    const pending = waitForAbort(new Promise<string>(() => {}), controller.signal);

    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('throws immediately for an already-aborted signal', () => {
    const controller = new AbortController();
    controller.abort();

    expect(() => throwIfAborted(controller.signal)).toThrowError(
      expect.objectContaining({ name: 'AbortError' }),
    );
  });
});
