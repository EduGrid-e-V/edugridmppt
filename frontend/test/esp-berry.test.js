import { afterEach, describe, expect, it, vi } from 'vitest';
import EspConnector from '../src/services/EspConnector.js';

describe('ESP32 Berry transport', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uploads source as a plain-text body and returns firmware diagnostics', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ ok: true, diagnostic: 'Berry program compiled and installed' })
    });
    vi.stubGlobal('fetch', fetchMock);
    const connector = new EspConnector(() => {});
    const code = 'def mppt() duty.change(-0.01) end';

    const result = await connector.sendCommand('compile-student', { code });

    expect(fetchMock).toHaveBeenCalledWith('/api/berry', expect.objectContaining({
      method: 'POST',
      body: code
    }));
    expect(result.diagnostics).toEqual([
      { severity: 'success', message: 'Berry program compiled and installed' }
    ]);
  });
});
