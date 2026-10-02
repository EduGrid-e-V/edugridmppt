import { afterEach, describe, expect, it, vi } from 'vitest';
import EspConnector from '../src/services/EspConnector.js';

describe('ESP32 Berry transport', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uploads source as raw bytes and returns confirmed firmware diagnostics', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ ok: true, installed: true, healthy: true, diagnostic: 'Berry program compiled and installed' })
    });
    vi.stubGlobal('fetch', fetchMock);
    const connector = new EspConnector(() => {});
    const code = 'def mppt() duty.change(-0.01) end';

    const result = await connector.sendCommand('compile-student', { code });

    expect(fetchMock).toHaveBeenCalledWith('/api/berry', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: code
    }));
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([
      { severity: 'success', message: 'Berry program compiled and installed' }
    ]);
  });

  it('does not treat an HTTP error or unhealthy runtime as an installed program', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 413,
      json: async () => ({ ok: false, installed: false, healthy: false, diagnostic: 'Program exceeds the 4096-byte limit' })
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await new EspConnector(() => {}).sendCommand('compile-student', { code: 'def mppt() end' });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([{ severity: 'error', message: 'Program exceeds the 4096-byte limit' }]);
  });

  it('reports a non-JSON response as an endpoint error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected HTML'); }
    }));
    await expect(new EspConnector(() => {}).sendCommand('compile-student', { code: 'def mppt() end' }))
      .rejects.toThrow('ESP32 Berry endpoint returned an invalid response (HTTP 200).');
  });
});
