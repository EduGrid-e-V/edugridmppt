import { createEngine, scenarios } from '@edugrid/pv-sim';
import { createBerryRuntime } from '../standalone/berry/runtime.js';

let suppressTelemetry = false;
let engine = createEngine({
  onFrame: (frame) => {
    if (!suppressTelemetry) postMessage({ type: 'telemetry', payload: { ...frame, c: frame.i } });
  },
});
let sweepData = [];
let berryRuntime = null;

function reply(id, payload, error) {
  postMessage({ type: 'response', id, payload, error });
}

async function loadBerryRuntime() {
  if (!berryRuntime) {
    berryRuntime = await createBerryRuntime((line) => {
      postMessage({ type: 'event', payload: { event: 'student-console', line } });
    });
  }
  return berryRuntime;
}

function configure(params) {
  if (params.mode) engine.setMode(params.mode);
  if (params.duty !== undefined) engine.setDuty(Number(params.duty));
  if (params.algo) engine.setAlgorithm(params.algo);
  if (params.preset) engine.setPreset(params.preset);
  if (params.loadOhm !== undefined) engine.setLoad(Number(params.loadOhm));
}

async function benchmark(params) {
  const runtime = await loadBerryRuntime();
  const diagnostics = runtime.compile(params.code);
  if (diagnostics.some(({ severity }) => severity === 'error')) return { diagnostics, runs: [] };

  const runs = [];
  suppressTelemetry = true;
  try {
    for (const scenario of scenarios.filter(({ id }) => id !== 'partial-shade')) {
      runtime.compile(params.code);
      engine.pause();
      engine.reset();
      engine.installStudentFunction((measurement, state) => runtime.step(measurement, state), diagnostics);
      engine.setAlgorithm('STUDENT');
      engine.setMode('AUTO');
      engine.loadScenario(scenario);
      let energyJ = 0;
      let frame;
      const ticks = Math.ceil(scenario.durationS / 0.05);
      for (let index = 0; index < ticks; index += 1) {
        frame = engine.tick();
        energyJ += frame.p * 0.05;
      }
      runs.push({ scenario: scenario.id, energyJ, finalPowerW: frame?.p ?? 0 });
    }
    runtime.compile(params.code);
    engine.reset();
    engine.installStudentFunction((measurement, state) => runtime.step(measurement, state), diagnostics);
    engine.setAlgorithm('STUDENT');
    engine.setMode('AUTO');
  } finally {
    suppressTelemetry = false;
  }
  const frame = engine.step();
  postMessage({ type: 'telemetry', payload: { ...frame, c: frame.i } });
  return { diagnostics, runs };
}

self.onmessage = async ({ data }) => {
  const { id, command, params = {} } = data;
  try {
    let payload = null;
    if (command === 'connect' || command === 'run') engine.start();
    else if (command === 'pause') engine.pause();
    else if (command === 'step') payload = engine.step();
    else if (command === 'reset') {
      payload = engine.reset();
      if (berryRuntime) {
        engine.resetStudentFunction();
        engine.setAlgorithm('STUDENT');
        engine.setMode('AUTO');
        payload = engine.step();
      }
    }
    else if (command === 'set') configure(params);
    else if (command === 'simulation') {
      if (params.sunPosition !== undefined) engine.setSunPosition(Number(params.sunPosition));
      if (params.cloudCover !== undefined) engine.setCloudCover(Number(params.cloudCover));
      if (params.ambientC !== undefined) engine.setAmbient(Number(params.ambientC));
      if (params.loadOhm !== undefined) engine.setLoad(Number(params.loadOhm));
      if (Object.hasOwn(params, 'scenario')) {
        if (params.scenario) engine.loadScenario(params.scenario);
        else engine.clearScenario();
      }
    } else if (command === 'sweep') {
      sweepData = engine.sweep();
      postMessage({ type: 'event', payload: { event: 'sweep_done' } });
    } else if (command === 'sweep-data') payload = { points: sweepData.length ? sweepData : engine.sweep(), loadSensor: true };
    else if (command === 'compile-student') {
      const runtime = await loadBerryRuntime();
      const diagnostics = runtime.compile(params.code);
      if (!diagnostics.some(({ severity }) => severity === 'error')) {
        engine.installStudentFunction((measurement, state) => runtime.step(measurement, state), diagnostics);
        engine.setAlgorithm('STUDENT');
      }
      payload = { diagnostics };
    } else if (command === 'benchmark') payload = await benchmark(params);
    else throw new RangeError(`Unknown simulation command: ${command}`);
    reply(id, payload);
  } catch (error) {
    reply(id, null, error instanceof Error ? error.message : String(error));
  }
};
