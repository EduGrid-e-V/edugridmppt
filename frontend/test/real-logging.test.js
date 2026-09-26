import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import EspConnector from '../src/services/EspConnector.js';

const source = (path) => readFileSync(resolve(path), 'utf8');

describe('real ESP32 experiment logging', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses POST for start/stop and keeps logging off the simulation connector', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ recording: true, intervalS: 30 })
    });
    vi.stubGlobal('fetch', fetchMock);
    const connector = new EspConnector(() => {});

    await connector.sendCommand('log-start', { intervalS: 30 });
    await connector.sendCommand('log-stop');
    await connector.sendCommand('log-status');

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/logging/start?intervalS=30', { method: 'POST' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/logging/stop', { method: 'POST' });
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/logging', { method: 'GET' });
    expect(source('src/workers/simulation.worker.js')).not.toMatch(/log-start|log-stop|log-status/);
  });

  it('shows benchmarking only in simulation and recording only on real hardware', () => {
    const lab = source('src/standalone/AlgorithmLab.vue');
    expect(lab).toContain('v-if="!realHardware" class="benchmark"');
    expect(lab).toContain('v-if="realHardware" class="logging-panel"');
    expect(lab).toContain('href="/downloads"');
    const app = source('src/App.vue');
    expect(app).toContain('v-if="showDeviceDownloads"');
    expect(app).toContain('class="downloads-link" href="/downloads"');
  });

  it('bounds storage, rejects unsafe filenames, and closes the file for OTA', () => {
    const logger = source('../firmware/src/log_manager.cpp');
    const ota = source('../firmware/src/ota_manager.cpp');
    const logWeb = source('../firmware/src/log_web.cpp');
    expect(logger).toContain('4U * 1024U * 1024U');
    expect(logger).toContain('MAX_LOG_FILES = 64');
    expect(logger).toContain('seconds != 1 && seconds != 30 && seconds != 60 && seconds != 300');
    expect(logger).toContain('bool isSafeLogName');
    expect(ota).toContain('stopLogRecording();');
    expect(ota).not.toMatch(/request->authenticate|requestAuthentication|getOtaAdminPassword/);
    expect(logWeb).not.toMatch(/request->authenticate|requestAuthentication|getOtaAdminPassword/);
  });
});
