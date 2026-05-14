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
    
    // Simulated Panel Properties
    this.Voc = 49.5;
    this.Isc = 13.0;
    this.Vmpp = 41.2;
    this.Impp = 11.6;
    this.irradiance = 0.96;
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
    
    this.irradiance += (Math.random() - 0.5) * 0.00015;
    this.irradiance = Math.max(0.82, Math.min(1.0, this.irradiance));
    this.temperatureOffset += (Math.random() - 0.5) * 0.00015;
    this.temperatureOffset = Math.max(-0.015, Math.min(0.012, this.temperatureOffset));

    const panelVoc = this.Voc * (0.98 + 0.02 * this.irradiance + this.temperatureOffset);
    const panelIsc = this.Isc * this.irradiance;
    const voltageNoise = (Math.random() - 0.5) * 0.025;
    const currentNoise = (Math.random() - 0.5) * 0.008;
    const effectiveVoltage = panelVoc * (1 - this.duty) + voltageNoise;
    const rawVoltage = Math.max(0, Math.min(panelVoc, effectiveVoltage));

    const normalizedVoltage = panelVoc > 0 ? rawVoltage / panelVoc : 0;
    const rawCurrent = Math.max(0, panelIsc * (1 - Math.pow(normalizedVoltage, 12)) + currentNoise);

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

    // 2. Auto Mode Logic (Mock P&O)
    if (this.mode === 'AUTO') {
      // Very slow mock MPPT step
      if (Math.random() > 0.9) { // Run occasionally
        const step = 0.01;
        // Blindly move towards Vmpp.
        // If V > Vmpp, increase duty (reduce V). If V < Vmpp, decrease duty (increase V).
        // To lower panel voltage, increase duty.
        const targetVmpp = panelVoc * 0.83;
        if (this.voltage > targetVmpp + 0.4) {
            this.duty = Math.min(0.95, this.duty + step);
        } else if (this.voltage < targetVmpp - 0.4) {
            this.duty = Math.max(0.0, this.duty - step);
        } else {
             // Jitter around MPP
             this.duty += (Math.random() - 0.5) * 0.001;
        }
      }
    }
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
      if (params.mode) this.mode = params.mode;
      if (params.duty !== undefined) this.duty = parseFloat(params.duty);
      if (params.algo) this.algo = params.algo;
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
    for (let d = 0.0; d <= 0.95; d += 0.02) {
         const panelVoc = this.Voc * (0.98 + 0.02 * this.irradiance + this.temperatureOffset);
         const panelIsc = this.Isc * this.irradiance;
         const v = panelVoc * (1 - d);
         const i = panelIsc * (1 - Math.pow(v / panelVoc, 12));
         const p = v * i;
         const loadV = Math.max(0, v * d * 0.86);
         const loadP = p * 0.82;
         const loadI = loadV > 0 ? loadP / loadV : 0;
         points.push({ v, i, p, loadV, loadI, loadP });
    }
    return { points, loadSensor: true };
  }
}
