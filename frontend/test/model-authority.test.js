import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SimpleSimulation } from '../src/simulation/SimpleSimulation.js';

const source = (path) => readFileSync(resolve(path), 'utf8');

describe('simple simulation integration', () => {
  it('uses one simple model in both simulation connectors', () => {
    expect(source('src/services/MockConnector.js')).toContain("import { SimpleSimulation } from '../simulation/SimpleSimulation.js'");
    expect(source('src/workers/simulation.worker.js')).toContain("import { SimpleSimulation, BENCHMARK_SCENARIOS } from '../simulation/SimpleSimulation.js'");
  });

  it('matches the real-kit ratings and produces an approximately 2 W peak', () => {
    const simulation = new SimpleSimulation({ noise: 0 });
    simulation.setSunPosition(0.5);
    simulation.setCloudCover(0);
    const curve = simulation.sweep();
    expect(curve[0].v).toBe(0);
    expect(curve[0].i).toBeCloseTo(0.18, 12);
    expect(curve.at(-1).v).toBeCloseTo(13.5, 12);
    expect(curve.at(-1).i).toBe(0);
    expect(Math.max(...curve.map(({ p }) => p))).toBeCloseTo(2, 1);
  });

  it('keeps SimulationScene visual and input-only', () => {
    const scene = source('src/components/SimulationScene.vue');
    expect(scene).not.toMatch(/SimpleSimulation|effectiveResistance|solveOperatingPoint|currentAt|powerAt/);
  });
});
