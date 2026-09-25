import { describe, expect, it } from 'vitest';
import { SimpleSimulation, SIMPLE_SCENARIOS, sampleScenario } from '../src/simulation/SimpleSimulation.js';

describe('SimpleSimulation', () => {
  it('applies the student duty change in the current step', () => {
    const simulation = new SimpleSimulation({ noise: 0 });
    simulation.setMode('AUTO');
    simulation.setAlgorithm('STUDENT');
    simulation.setStudentFunction((_frame, duty) => duty + 0.1);
    const frame = simulation.step();
    expect(frame.d).toBeCloseTo(0.3, 12);
  });

  it('calls the student MPPT function at 10 Hz', () => {
    const simulation = new SimpleSimulation({ noise: 0, tickMs: 50, algorithmPeriodMs: 100 });
    let calls = 0;
    simulation.setStudentFunction((_frame, duty) => {
      calls += 1;
      return duty;
    });
    simulation.setAlgorithm('STUDENT');
    simulation.setMode('AUTO');
    for (let index = 0; index < 20; index += 1) simulation.tick();
    expect(calls).toBe(10);
  });

  it('moves the best duty as irradiance changes through the fixed load', () => {
    const simulation = new SimpleSimulation({ noise: 0 });
    simulation.loadScenario('passing-cloud');
    const bestDuty = () => Array.from({ length: 97 }, (_, index) => 0.02 + index * 0.01)
      .map((duty) => ({ duty, power: simulation.measure(duty, false).p }))
      .reduce((best, point) => point.power > best.power ? point : best).duty;

    simulation.scenarioTimeS = 20;
    const brightDuty = bestDuty();
    simulation.scenarioTimeS = 45;
    const cloudDuty = bestDuty();
    expect(brightDuty).toBeGreaterThan(cloudDuty + 0.2);
  });

  it('does not mistake a fixed 18 percent duty for full-sun MPPT', () => {
    const simulation = new SimpleSimulation({ noise: 0 });
    simulation.setSunPosition(0.5);
    simulation.setCloudCover(0);
    const capture = simulation.measure(0.18, false).p / simulation.maximumPower();
    expect(capture).toBeLessThan(0.5);
  });

  it('samples scenario endpoints for the benchmark plot', () => {
    const clearDay = SIMPLE_SCENARIOS.find(({ id }) => id === 'clear-day');
    expect(sampleScenario(clearDay, 0)).toBeCloseTo(0.08, 12);
    expect(sampleScenario(clearDay, 60)).toBeCloseTo(1, 12);
    expect(sampleScenario(clearDay, 120)).toBeCloseTo(0.08, 12);
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
