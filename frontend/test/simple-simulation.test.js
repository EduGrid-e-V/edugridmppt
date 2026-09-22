import { describe, expect, it } from 'vitest';
import { SimpleSimulation } from '../src/simulation/SimpleSimulation.js';

describe('SimpleSimulation', () => {
  it('applies the student duty change in the current step', () => {
    const simulation = new SimpleSimulation({ noise: 0 });
    simulation.setMode('AUTO');
    simulation.setAlgorithm('STUDENT');
    simulation.setStudentFunction((_frame, duty) => duty + 0.1);
    const frame = simulation.step();
    expect(frame.d).toBeCloseTo(0.3, 12);
  });

  it('replays scenarios deterministically', () => {
    const first = new SimpleSimulation({ noise: 0 });
    const second = new SimpleSimulation({ noise: 0 });
    first.loadScenario('passing-cloud');
    second.loadScenario('passing-cloud');
    for (let index = 0; index < 1200; index += 1) expect(first.tick()).toEqual(second.tick());
  });

  it('holds the physical load setting at 50 ohms', () => {
    const simulation = new SimpleSimulation();
    expect(simulation.loadOhm).toBe(50);
    expect('setLoad' in simulation).toBe(false);
  });

  it('sweeps the complete modeled curve independently of live duty limits', () => {
    const simulation = new SimpleSimulation({ noise: 0 });
    simulation.setSunPosition(0.5);
    simulation.setCloudCover(0);
    const points = simulation.sweep();
    expect(points[0]).toMatchObject({ v: 0, i: 0.18 });
    expect(points.at(-1)).toMatchObject({ v: 13.5, i: 0 });
    expect(simulation.maximumPower()).toBeCloseTo(Math.max(...points.map(({ p }) => p)), 3);
  });
});
