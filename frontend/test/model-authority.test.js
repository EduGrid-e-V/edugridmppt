import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path) => readFileSync(resolve(path), 'utf8');

describe('simulation model authority', () => {
  it('routes the legacy simulation connector through packages/pv-sim', () => {
    const connector = source('src/services/MockConnector.js');
    expect(connector).toContain("import { createEngine } from '@edugrid/pv-sim'");
    expect(connector).not.toMatch(/calculateIrradiance|getPanelState|curveShape|Math\.pow\(normalizedVoltage/);
  });

  it('owns the engine inside the standalone worker', () => {
    const worker = source('src/workers/simulation.worker.js');
    expect(worker).toContain("import { createEngine, scenarios } from '@edugrid/pv-sim'");
    expect(worker).toContain('let engine = createEngine(');
  });

  it('keeps SimulationScene visual and input-only', () => {
    const scene = source('src/components/SimulationScene.vue');
    expect(scene).not.toMatch(/createEngine|effectiveResistance|solveOperatingPoint|currentAt|powerAt/);
  });
});
