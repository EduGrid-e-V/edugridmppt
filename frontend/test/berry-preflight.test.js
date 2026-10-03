import { describe, expect, it, vi } from 'vitest';
import { preflightBerry } from '../src/standalone/berry/preflight.js';

describe('Berry browser-worker preflight', () => {
  it('terminates a hung worker and rejects before upload', async () => {
    const worker = { postMessage: vi.fn(), terminate: vi.fn() };
    await expect(preflightBerry('def mppt() end', 1, () => worker))
      .rejects.toThrow('Local Berry check timed out; nothing was installed.');
    expect(worker.postMessage).toHaveBeenCalledWith({ id: 1, command: 'check-student', params: { code: 'def mppt() end' } });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('terminates the worker and returns compile diagnostics', async () => {
    const worker = {
      postMessage: vi.fn(function () {
        queueMicrotask(() => {
          this.onmessage({ data: { type: 'telemetry', payload: { v: 1 } } });
          this.onmessage({ data: { type: 'response', id: 1, payload: { diagnostics: [{ severity: 'error', message: 'syntax error' }] } } });
        });
      }),
      terminate: vi.fn(),
    };
    await expect(preflightBerry('bad code', 1000, () => worker))
      .resolves.toEqual([{ severity: 'error', message: 'syntax error' }]);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
