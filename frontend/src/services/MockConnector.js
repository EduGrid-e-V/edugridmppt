export default class MockConnector {
  constructor(onDataCallback) {
    this.onData = onDataCallback;
    this.intervalId = null;
    
    // Simulation State
    this.mode = 'MANUAL'; // 'MANUAL' or 'AUTO'
    this.algo = 'PNO';
    this.duty = 0.0;
    this.voltage = 0.0;
    this.current = 0.0;
    this.power = 0.0;
    this.loadVoltage = 0.0;
    this.loadCurrent = 0.0;
    this.loadPower = 0.0;
    this.filteredVoltage = 0.0;
    this.filteredCurrent = 0.0;
    this.previousAutoPower = null;
    this.autoDutyDirection = 1;
    
    // Simulated Panel Properties
    this.Voc = 49.5;
    this.Isc = 13.0;
    this.Vmpp = 41.2;
    this.Impp = 11.6;
    this.sunPosition = 0.55;
    this.cloudCover = 0.12;
    this.irradiance = this.calculateIrradiance();
    this.temperatureOffset = 0.0;
  }

  connect() {
    console.log("🔌 MOCK: Connected (Simulating MPPT)");
    
    // Update at 20Hz (50ms)
    this.intervalId = setInterval(() => {
      this.simulationStep();
      this.emitData();
    }, 50); 
  }

  disconnect() {
    if (this.intervalId) clearInterval(this.intervalId);
    console.log("MOCK: Disconnected");
  }

  // Simulate MPPT physics and algorithm
  simulationStep() {
    // 1. Calculate PV panel output from a simplified I-V curve.
    // Duty 0 behaves like open circuit, duty 1 behaves like short circuit.
    
    const targetIrradiance = this.calculateIrradiance();
    this.irradiance = this.irradiance * 0.94 + targetIrradiance * 0.06;
    this.temperatureOffset += (Math.random() - 0.5) * 0.00015;
    this.temperatureOffset = Math.max(-0.015, Math.min(0.012, this.temperatureOffset));

    const panelState = this.getPanelState();
    const panelVoc = panelState.openCircuitVoltage;
    const panelIsc = panelState.shortCircuitCurrent;
    const voltageNoise = (Math.random() - 0.5) * 0.025;
    const currentNoise = (Math.random() - 0.5) * 0.008;
    const effectiveVoltage = panelVoc * (1 - this.duty) + voltageNoise;
    const rawVoltage = Math.max(0, Math.min(panelVoc, effectiveVoltage));

    const normalizedVoltage = panelVoc > 0 ? rawVoltage / panelVoc : 0;
    const rawCurrent = Math.max(
      0,
      panelIsc * (1 - Math.pow(normalizedVoltage, panelState.curveShape)) + currentNoise
    );

    if (this.filteredVoltage === 0 && this.filteredCurrent === 0) {
      this.filteredVoltage = rawVoltage;
      this.filteredCurrent = rawCurrent;
    } else {
      this.filteredVoltage = this.filteredVoltage * 0.88 + rawVoltage * 0.12;
      this.filteredCurrent = this.filteredCurrent * 0.88 + rawCurrent * 0.12;
    }

    this.voltage = this.filteredVoltage;
    this.current = this.filteredCurrent;
    
    this.power = this.voltage * this.current;
    this.loadVoltage = Math.max(0, this.voltage * this.duty * 0.86);
    this.loadPower = this.power * 0.82;
    this.loadCurrent = this.loadVoltage > 0 ? this.loadPower / this.loadVoltage : 0;

    // 2. Auto Mode Logic
    if (this.mode === 'AUTO') {
      if (Math.random() > 0.7) { // Run occasionally
        if (this.algo === 'PNO') {
          this.runPerturbAndObserveStep();
        } else {
          this.runIncrementalConductanceLikeStep(panelVoc, panelState);
        }
      }
    }
  }

  runPerturbAndObserveStep() {
    const step = 0.006;

    if (this.previousAutoPower !== null && this.power < this.previousAutoPower) {
      this.autoDutyDirection *= -1;
    }

    this.previousAutoPower = this.power;
    this.duty = clamp(this.duty + this.autoDutyDirection * step, 0.0, 0.95);
  }

  runIncrementalConductanceLikeStep(panelVoc, panelState) {
    const step = 0.01;
    const targetVmpp = panelVoc * panelState.maximumPowerVoltageRatio;
    const voltageDeadband = Math.max(0.75, panelVoc * step * 1.8);

    if (this.voltage > targetVmpp + voltageDeadband) {
      this.duty = Math.min(0.95, this.duty + step);
    } else if (this.voltage < targetVmpp - voltageDeadband) {
      this.duty = Math.max(0.0, this.duty - step);
    } else {
      this.duty = clamp(this.duty + (Math.random() - 0.5) * 0.004, 0.0, 0.95);
    }
  }

  resetAutoTracker() {
    this.previousAutoPower = null;
    this.autoDutyDirection = 1;
  }

  calculateIrradiance() {
    const sunHeight = Math.sin(Math.PI * this.sunPosition);
    const clearSkyIrradiance = Math.pow(Math.max(0, sunHeight), 1.35);
    const cloudLoss = 1 - 0.86 * this.cloudCover;
    return Math.max(0.03, clearSkyIrradiance * cloudLoss);
  }

  getPanelState() {
    const sunHeight = Math.sin(Math.PI * this.sunPosition);
    const voltageFromLight = 0.58 + 0.42 * Math.pow(this.irradiance, 0.22);
    const cloudVoltageLoss = 0.12 * this.cloudCover;
    const lowSunVoltageLoss = 0.1 * (1 - sunHeight);
    const openCircuitVoltage =
      this.Voc * clamp(voltageFromLight - cloudVoltageLoss - lowSunVoltageLoss + this.temperatureOffset, 0.48, 1.03);
    const shortCircuitCurrent = this.Isc * this.irradiance;
    const curveShape = clamp(12 - 6.5 * this.cloudCover - 2.5 * (1 - sunHeight), 3.4, 12);
    const maximumPowerVoltageRatio = Math.pow(1 / (curveShape + 1), 1 / curveShape);

    return {
      openCircuitVoltage,
      shortCircuitCurrent,
      curveShape,
      maximumPowerVoltageRatio
    };
  }

  emitData() {
    const packet = {
      v: this.voltage,
      c: this.current,
      i: this.current,
      p: this.power,
      loadV: this.loadVoltage,
      loadI: this.loadCurrent,
      loadP: this.loadPower,
      loadSensor: true,
      d: this.duty,
      m: this.mode
    };
    this.onData(packet);
  }

  // --- Mock Commands ---

  async sendCommand(command, params = {}) {
    console.log(`[MOCK] Command: ${command}`, params);
    
    if (command === 'set') {
      if (params.mode) {
        this.mode = params.mode;
        this.resetAutoTracker();
      }
      if (params.duty !== undefined) {
        this.duty = parseFloat(params.duty);
        this.resetAutoTracker();
      }
      if (params.algo) {
        this.algo = params.algo;
        this.resetAutoTracker();
      }
    }
    else if (command === 'simulation') {
      if (params.sunPosition !== undefined) {
        this.sunPosition = clamp(parseFloat(params.sunPosition), 0, 1);
      }
      if (params.cloudCover !== undefined) {
        this.cloudCover = clamp(parseFloat(params.cloudCover), 0, 1);
      }
      this.irradiance = this.calculateIrradiance();
      this.resetAutoTracker();
    }
    else if (command === 'sweep') {
      console.log("[MOCK] Sweeping...");
      setTimeout(() => {
        this.onData({ event: 'sweep_done' });
      }, 1200);
    }
    
    return Promise.resolve();
  }

  async getSweepData() {
    console.log("[MOCK] Generating Sweep Data...");
    // Generate a full curve
    const points = [];
    // Sweep duty 0 to 0.95
    const panelState = this.getPanelState();
    for (let d = 0.0; d <= 0.95; d += 0.02) {
         const panelVoc = panelState.openCircuitVoltage;
         const panelIsc = panelState.shortCircuitCurrent;
         const v = panelVoc * (1 - d);
         const i = panelIsc * (1 - Math.pow(v / panelVoc, panelState.curveShape));
         const p = v * i;
         const loadV = Math.max(0, v * d * 0.86);
         const loadP = p * 0.82;
         const loadI = loadV > 0 ? loadP / loadV : 0;
         points.push({ v, i, p, loadV, loadI, loadP });
    }
    return { points, loadSensor: true };
  }
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
