import { SimpleSimulation, SIMPLE_SCENARIOS } from '../simulation/SimpleSimulation.js';
import { createBerryRuntime } from '../standalone/berry/runtime.js';

let suppressTelemetry = false;
const engine = new SimpleSimulation({
  onFrame: (frame) => {
    if (!suppressTelemetry) postMessage({ type: 'telemetry', payload: frame });
  }
});
let sweepData = [];
let berryRuntime = null;
let compiledCode = '';

const reply = (id, payload, error) => postMessage({ type: 'response', id, payload, error });

async function loadBerryRuntime() {
  if (!berryRuntime) {
    berryRuntime = await createBerryRuntime((line) => {
      postMessage({ type: 'event', payload: { event: 'student-console', line } });
    });
  }
  return berryRuntime;
}

function installStudent(runtime) {
  engine.setStudentFunction((frame, duty) => runtime.step({
    PV: { voltage: frame.v, current: frame.i, power: frame.p },
    load: { voltage: frame.loadV, current: frame.loadI, power: frame.loadP, available: frame.loadSensor },
    duty
  }));
  engine.setAlgorithm('STUDENT');
}

function configure(params) {
  if (params.mode) engine.setMode(params.mode);
  if (params.duty !== undefined) engine.setDuty(params.duty);
  if (params.algo) engine.setAlgorithm(params.algo);
}

async function benchmark(code) {
  const runtime = await loadBerryRuntime();
  const diagnostics = runtime.compile(code);
  if (diagnostics.some(({ severity }) => severity === 'error')) return { diagnostics, runs: [] };
  const runs = [];
  suppressTelemetry = true;
  try {
    for (const scenario of SIMPLE_SCENARIOS) {
      runtime.compile(code);
      engine.reset();
      installStudent(runtime);
      engine.setMode('AUTO');
      engine.loadScenario(scenario.id);
      let energyJ = 0;
      let availableEnergyJ = 0;
      let frame;
      for (let index = 0; index < Math.ceil(scenario.durationS / 0.05); index += 1) {
        frame = engine.tick();
        energyJ += frame.p * 0.05;
        availableEnergyJ += Math.max(...engine.sweep().map(({ p }) => p)) * 0.05;
      }
      runs.push({
        scenario: scenario.id,
        energyJ,
        availableEnergyJ,
        capturePercent: availableEnergyJ > 0 ? 100 * energyJ / availableEnergyJ : 0,
        finalPowerW: frame?.p ?? 0
      });
    }
    runtime.compile(code);
    engine.reset();
    installStudent(runtime);
    engine.setMode('AUTO');
  } finally {
    suppressTelemetry = false;
  }
  const frame = engine.step();
  postMessage({ type: 'telemetry', payload: frame });
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
      if (berryRuntime && compiledCode) berryRuntime.compile(compiledCode);
      payload = engine.reset();
      if (berryRuntime && compiledCode) {
        installStudent(berryRuntime);
        engine.setMode('AUTO');
        payload = engine.step();
      }
    } else if (command === 'set') configure(params);
    else if (command === 'simulation') {
      if (params.sunPosition !== undefined) engine.setSunPosition(params.sunPosition);
      if (params.cloudCover !== undefined) engine.setCloudCover(params.cloudCover);
      if (params.ambientC !== undefined) engine.setAmbient(params.ambientC);
      if (Object.hasOwn(params, 'scenario')) params.scenario ? engine.loadScenario(params.scenario) : engine.clearScenario();
    } else if (command === 'sweep') {
      sweepData = engine.sweep();
      postMessage({ type: 'event', payload: { event: 'sweep_done' } });
    } else if (command === 'sweep-data') {
      payload = { points: sweepData.length ? sweepData : engine.sweep(), loadSensor: true };
    } else if (command === 'compile-student') {
      const runtime = await loadBerryRuntime();
      const diagnostics = runtime.compile(params.code);
      if (!diagnostics.some(({ severity }) => severity === 'error')) {
        compiledCode = params.code;
        installStudent(runtime);
      } else engine.setStudentFunction(null);
      payload = { diagnostics };
    } else if (command === 'benchmark') payload = await benchmark(params.code);
    else throw new RangeError(`Unknown simulation command: ${command}`);
    reply(id, payload);
  } catch (error) {
    reply(id, null, error instanceof Error ? error.message : String(error));
  }
};
