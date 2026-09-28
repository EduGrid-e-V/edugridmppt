import { describe, expect, it } from 'vitest';
import { BENCHMARK_SCENARIOS, SimpleSimulation, sampleScenario } from '../src/simulation/SimpleSimulation.js';

describe('SimpleSimulation', () => {
  it('accepts exact 0% and 100% duty with an open-circuit zero endpoint', () => {
    const simulation = new SimpleSimulation({ noise: 0 });
    simulation.setDuty(0);
    expect(simulation.duty).toBe(0);
    const openCircuit = simulation.measure(0, false);
    expect(openCircuit.v).toBeCloseTo(simulation.panelState().voc, 12);
    expect(openCircuit.i).toBe(0);
    expect(openCircuit.loadP).toBe(0);

    simulation.setDuty(1);
    expect(simulation.duty).toBe(1);
    const fullyOn = simulation.measure(1, false);
    expect(fullyOn.v).toBeLessThan(openCircuit.v);
    expect(fullyOn.i).toBeGreaterThan(0);

    simulation.setDuty(-1);
    expect(simulation.duty).toBe(0);
    simulation.setDuty(2);
    expect(simulation.duty).toBe(1);
  });

  it('lets student Berry control reach both duty endpoints', () => {
    const simulation = new SimpleSimulation({ noise: 0 });
    simulation.setAlgorithm('STUDENT');
    simulation.setMode('AUTO');
    simulation.setStudentFunction(() => 1);
    expect(simulation.step().d).toBe(1);
    simulation.setStudentFunction(() => 0);
    expect(simulation.step().d).toBe(0);
  });

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

  it('moves the best duty as irradiance changes during the cloudy day', () => {
    const simulation = new SimpleSimulation({ noise: 0 });
    simulation.loadScenario('fluctuating-day');
    const bestDuty = () => Array.from({ length: 97 }, (_, index) => 0.02 + index * 0.01)
      .map((duty) => ({ duty, power: simulation.measure(duty, false).p }))
      .reduce((best, point) => point.power > best.power ? point : best).duty;

    simulation.scenarioTimeS = 21600;
    const brightDuty = bestDuty();
    simulation.scenarioTimeS = 18000;
    const cloudDuty = bestDuty();
    expect(brightDuty).toBeGreaterThan(cloudDuty + 0.2);
  });

  it('rejects removed fractional MPPT algorithms without changing the active one', () => {
    const simulation = new SimpleSimulation({ noise: 0 });
    for (const algorithm of ['FRACTIONAL_VOC', 'FRACTIONAL_ISC']) {
      expect(() => simulation.setAlgorithm(algorithm)).toThrow(RangeError);
      expect(simulation.algorithm).toBe('PNO');
    }
    simulation.setAlgorithm('INCCOND');
    expect(simulation.algorithm).toBe('INCCOND');
    simulation.setAlgorithm('STUDENT');
    expect(simulation.algorithm).toBe('STUDENT');
  });

  it('does not mistake a fixed 18 percent duty for full-sun MPPT', () => {
    const simulation = new SimpleSimulation({ noise: 0 });
    simulation.setSunPosition(0.5);
    simulation.setCloudCover(0);
    const capture = simulation.measure(0.18, false).p / simulation.maximumPower();
    expect(capture).toBeLessThan(0.5);
  });

  it('does not let one fixed duty game the daylight benchmark', () => {
    const [scenario] = BENCHMARK_SCENARIOS;
    const simulation = new SimpleSimulation({ noise: 0 });
    simulation.scenario = scenario;
    let bestFixedCapture = 0;

    for (let percent = 2; percent <= 98; percent += 1) {
      let harvested = 0;
      let available = 0;
      for (let timeS = 0; timeS <= scenario.durationS; timeS += 60) {
        simulation.scenarioTimeS = timeS;
        harvested += simulation.measure(percent / 100, false).p;
        available += simulation.maximumPower();
      }
      bestFixedCapture = Math.max(bestFixedCapture, harvested / available);
    }

    expect(bestFixedCapture).toBeLessThan(0.85);
  });

  it('covers sunrise to sunset in the benchmark profile', () => {
    const [scenario] = BENCHMARK_SCENARIOS;
    expect(scenario.durationS).toBe(12 * 60 * 60);
    const minuteSamples = Array.from(
      { length: 12 * 60 + 1 },
      (_, minute) => sampleScenario(scenario, minute * 60)
    );
    expect(minuteSamples[0]).toBe(0);
    expect(Math.max(...minuteSamples)).toBeGreaterThan(0.85);
    expect(new Set(minuteSamples.map((value) => value.toFixed(3))).size).toBeGreaterThan(300);
    expect(minuteSamples.at(-1)).toBe(0);
  });

  it('accepts only the active cloudy-day profile', () => {
    const simulation = new SimpleSimulation({ noise: 0 });
    simulation.loadScenario('fluctuating-day');
    expect(simulation.scenario.id).toBe('fluctuating-day');
    for (const id of ['clear-day', 'passing-cloud', 'uniform-shadow']) {
      expect(() => simulation.loadScenario(id)).toThrow(RangeError);
    }
  });

  it('replays the cloudy-day profile deterministically', () => {
    const first = new SimpleSimulation({ noise: 0 });
    const second = new SimpleSimulation({ noise: 0 });
    first.loadScenario('fluctuating-day');
    second.loadScenario('fluctuating-day');
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
