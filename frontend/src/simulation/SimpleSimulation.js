const DUTY_MIN = 0;
const DUTY_MAX = 1;
const CONVERTER_EFFICIENCY = 0.82;
const PANEL_CURVE_SHAPE = 20;
const MPPT_DUTY_STEP = 0.01;

const FLUCTUATING_DAY_SCENARIO = {
  id: 'fluctuating-day',
  label: 'Synthetic cloudy PV day (06:00-18:00)',
  durationS: 43200
};

export const BENCHMARK_SCENARIOS = [FLUCTUATING_DAY_SCENARIO];

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

function unitNoise(index, seed) {
  let value = (index + Math.imul(seed, 374761393)) | 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  value = (value ^ (value >>> 16)) >>> 0;
  return value / 4294967295;
}

function smoothNoise(timeS, spacingS, seed) {
  const position = timeS / spacingS;
  const index = Math.floor(position);
  const fraction = position - index;
  const smoothFraction = fraction * fraction * (3 - 2 * fraction);
  const left = unitNoise(index, seed);
  return left + (unitNoise(index + 1, seed) - left) * smoothFraction;
}

function sampleCloudyDay(timeS, durationS) {
  const daylightFraction = clamp(timeS / durationS, 0, 1);
  if (daylightFraction <= 0 || daylightFraction >= 1) return 0;
  const clearSkyEnvelope = Math.pow(Math.sin(Math.PI * daylightFraction), 1.25);

  const cloudBanks = smoothNoise(timeS, 900, 11);
  const cloudEdges = smoothNoise(timeS, 120, 29);
  const fastFluctuations = smoothNoise(timeS, 1, 47);
  const transmission = clamp(
    0.04 + 0.72 * cloudBanks + 0.32 * (cloudEdges - 0.5) + 0.25 * (fastFluctuations - 0.5),
    0.04,
    1
  );
  return clearSkyEnvelope * transmission;
}

export function sampleScenario(scenario, timeS) {
  return sampleCloudyDay(clamp(timeS, 0, scenario.durationS), scenario.durationS);
}

function panelCurrentAtVoltage(voltage, panel) {
  const normalizedVoltage = panel.voc > 0 ? clamp(voltage / panel.voc, 0, 1) : 0;
  return panel.isc * (1 - Math.pow(normalizedVoltage, panel.curveShape));
}

function solveOperatingVoltage(panel, resistanceOhm) {
  let low = 0;
  let high = panel.voc;
  for (let iteration = 0; iteration < 48; iteration += 1) {
    const voltage = (low + high) / 2;
    const panelCurrent = panelCurrentAtVoltage(voltage, panel);
    const loadCurrent = voltage / resistanceOhm;
    if (panelCurrent > loadCurrent) low = voltage;
    else high = voltage;
  }
  return (low + high) / 2;
}

export class SimpleSimulation {
  constructor({ onFrame = () => {}, tickMs = 50, algorithmPeriodMs = 100, noise = 0.002, seed = 1 } = {}) {
    this.onFrame = onFrame;
    this.tickMs = tickMs;
    this.algorithmPeriodMs = algorithmPeriodMs;
    this.noise = noise;
    this.initialSeed = seed >>> 0;
    this.timer = null;
    this.studentFunction = null;
    this.reset();
  }

  reset() {
    this.pause();
    this.timeS = 0;
    this.duty = 0.2;
    this.mode = 'MANUAL';
    this.algorithm = 'PNO';
    this.sunPosition = 0.55;
    this.cloudCover = 0.12;
    this.ambientC = 25;
    this.loadOhm = 25;
    this.scenario = null;
    this.scenarioTimeS = 0;
    this.algorithmElapsedMs = 0;
    this.previous = null;
    this.direction = 1;
    this.randomState = this.initialSeed;
    return this.emit(this.measure());
  }

  start() { if (this.timer === null) this.timer = setInterval(() => this.tick(), this.tickMs); }
  pause() { if (this.timer !== null) clearInterval(this.timer); this.timer = null; }
  random() { this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0; return this.randomState / 4294967296; }

  irradianceFactor() {
    if (this.scenario) return sampleScenario(this.scenario, this.scenarioTimeS);
    const sunHeight = Math.sin(Math.PI * this.sunPosition);
    return Math.max(0.03, Math.pow(Math.max(0, sunHeight), 1.35) * (1 - 0.86 * this.cloudCover));
  }

  panelState() {
    const irradiance = this.irradianceFactor();
    const cellTemperatureC = this.ambientC + 31.25 * irradiance;
    const voltageTemperatureFactor = Math.max(0.7, 1 - 0.0032 * (this.ambientC - 25));
    return {
      voc: 13.5 * voltageTemperatureFactor * (0.9 + 0.1 * Math.pow(irradiance, 0.2)),
      isc: 0.18 * irradiance * (1 + 0.0005 * (this.ambientC - 25)),
      curveShape: PANEL_CURVE_SHAPE,
      irradianceWm2: irradiance * 1000,
      cellTemperatureC
    };
  }

  measure(duty = this.duty, withNoise = true) {
    const panel = this.panelState();
    const safeDuty = clamp(duty, DUTY_MIN, DUTY_MAX);
    if (safeDuty === 0) return this.measureAtVoltage(panel.voc, panel, 0, false);
    const effectiveResistanceOhm = CONVERTER_EFFICIENCY * this.loadOhm / (safeDuty * safeDuty);
    const voltage = solveOperatingVoltage(panel, effectiveResistanceOhm);
    return this.measureAtVoltage(voltage, panel, safeDuty, withNoise);
  }

  measureAtVoltage(voltage, panel = this.panelState(), duty = this.duty, withNoise = false) {
    const current = panelCurrentAtVoltage(voltage, panel);
    const noiseV = withNoise ? (this.random() - 0.5) * this.noise * panel.voc : 0;
    const noiseI = withNoise ? (this.random() - 0.5) * this.noise * panel.isc : 0;
    const v = clamp(voltage + noiseV, 0, panel.voc);
    const i = clamp(current + noiseI, 0, panel.isc);
    const p = v * i;
    const loadP = p * CONVERTER_EFFICIENCY;
    const loadV = Math.sqrt(loadP * this.loadOhm);
    return { t: this.timeS, v, i, c: i, p, loadV, loadI: loadV / this.loadOhm, loadP, loadSensor: true, d: duty, m: this.mode, algo: this.algorithm, G: panel.irradianceWm2, tCell: panel.cellTemperatureC, preset: 'real-kit-2w', presetSource: '13.5 V, 0.18 A real-kit scale' };
  }

  runAlgorithm(frame) {
    if (this.mode !== 'AUTO') return;
    if (this.algorithm === 'STUDENT') {
      if (typeof this.studentFunction === 'function') {
        try {
          this.duty = clamp(this.studentFunction(frame, this.duty), DUTY_MIN, DUTY_MAX);
          this.studentError = null;
        } catch (error) {
          this.studentError = error instanceof Error ? error.message : String(error);
        }
      }
    } else if (this.algorithm === 'PNO') {
      if (this.duty >= DUTY_MAX) this.direction = -1;
      else if (this.duty <= DUTY_MIN) this.direction = 1;
      else if (this.previous && frame.p < this.previous.p) this.direction *= -1;
      this.duty = clamp(this.duty + this.direction * MPPT_DUTY_STEP, DUTY_MIN, DUTY_MAX);
    } else if (this.algorithm === 'INCCOND') {
      if (!this.previous && this.duty >= DUTY_MAX) {
        this.duty = DUTY_MAX - MPPT_DUTY_STEP;
      } else if (this.previous) {
        const dV = frame.v - this.previous.v;
        const dI = frame.i - this.previous.i;
        if (Math.abs(dV) < 0.002) this.duty = clamp(this.duty + (dI < 0 ? 0.01 : dI > 0 ? -0.01 : 0), DUTY_MIN, DUTY_MAX);
        else {
          const distance = dI / dV + (frame.v > 0 ? frame.i / frame.v : 0);
          this.duty = clamp(this.duty + (distance > 0 ? -0.01 : distance < 0 ? 0.01 : 0), DUTY_MIN, DUTY_MAX);
        }
      }
    }
    this.previous = frame;
  }

  tick() {
    this.timeS += this.tickMs / 1000;
    if (this.scenario) this.scenarioTimeS = Math.min(this.scenario.durationS, this.scenarioTimeS + this.tickMs / 1000);
    let frame = this.measure();
    this.algorithmElapsedMs += this.tickMs;
    if (this.algorithmElapsedMs >= this.algorithmPeriodMs) { this.algorithmElapsedMs -= this.algorithmPeriodMs; this.runAlgorithm(frame); frame = this.measure(); }
    return this.emit(frame);
  }

  step() { const frame = this.measure(); this.runAlgorithm(frame); return this.emit(this.measure()); }
  emit(frame) { this.onFrame(frame); return frame; }
  setMode(mode) { this.mode = mode; this.previous = null; }
  setAlgorithm(algorithm) {
    if (!['PNO', 'INCCOND', 'STUDENT'].includes(algorithm)) {
      throw new RangeError(`Unknown MPPT algorithm: ${algorithm}`);
    }
    this.algorithm = algorithm;
    this.previous = null;
  }
  setDuty(duty) { this.duty = clamp(duty, DUTY_MIN, DUTY_MAX); this.previous = null; }
  setStudentFunction(fn) { this.studentFunction = typeof fn === 'function' ? fn : null; this.previous = null; }
  setSunPosition(value) { this.sunPosition = clamp(value, 0, 1); this.scenario = null; }
  setCloudCover(value) { this.cloudCover = clamp(value, 0, 1); this.scenario = null; }
  setAmbient(value) { this.ambientC = clamp(value, -10, 60); }
  loadScenario(id) { const scenario = BENCHMARK_SCENARIOS.find((candidate) => candidate.id === id); if (!scenario) throw new RangeError(`Unknown scenario: ${id}`); this.scenario = scenario; this.scenarioTimeS = 0; }
  maximumPower() {
    const panel = this.panelState();
    const normalizedVoltage = Math.pow(1 / (panel.curveShape + 1), 1 / panel.curveShape);
    return panel.voc * panel.isc * normalizedVoltage * (1 - Math.pow(normalizedVoltage, panel.curveShape));
  }
  sweep() {
    const panel = this.panelState();
    return Array.from({ length: 121 }, (_, index) => {
      const voltage = panel.voc * index / 120;
      return this.measureAtVoltage(voltage, panel, 1 - voltage / panel.voc, false);
    });
  }
}
