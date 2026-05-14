export default class EspConnector {
  constructor(onDataCallback) {
    this.onData = onDataCallback;
    this.socket = null;
  }

  connect() {
    // Connect to the ESP32's IP
    const wsUrl = `ws://${window.location.hostname}/ws`;
    console.log(`Trying to connect to ${wsUrl}...`);

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => console.log("✅ WebSocket Connected");
      
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event) {
            this.onData(data);
          } else {
            this.onData(this.normalizeTelemetry(data));
          }
        } catch (e) {
          console.error("Data Parse Error", e);
        }
      };

      this.socket.onclose = () => {
        console.log("❌ WebSocket Disconnected");
        // Optional: Add auto-reconnect logic here later
      };
    } catch (e) {
      console.error("Connection Failed", e);
    }
  }

  disconnect() {
    if (this.socket) this.socket.close();
  }

  async sendCommand(command, params = {}) {
    // Construct Query String
    const query = new URLSearchParams(params).toString();
    // command is like 'sweep' or 'set'
    const url = `/api/${command}${query ? '?' + query : ''}`;
    console.log(`Sending command: ${url}`);
    try {
        await fetch(url);
    } catch(e) {
        console.error(`Command ${command} failed`, e);
    }
  }

  async getSweepData() {
    try {
      const response = await fetch('/api/sweepdata');
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      return this.normalizeSweepData(data);
    } catch (e) {
      console.error("Failed to load sweep data", e);
      return null;
    }
  }

  normalizeTelemetry(data) {
    return {
      v: numberOrZero(data.v ?? data.vin),
      c: numberOrZero(data.c ?? data.i ?? data.iin),
      p: numberOrZero(data.p ?? data.pin),
      loadV: numberOrZero(data.loadV ?? data.vout),
      loadI: numberOrZero(data.loadI ?? data.iout),
      loadP: numberOrZero(data.loadP ?? data.pout),
      loadSensor: Boolean(data.loadSensor),
      d: normalizeDuty(data.d ?? data.duty),
      m: data.m ?? data.mode,
      algo: data.algo
    };
  }

  normalizeSweepData(data) {
    if (Array.isArray(data?.points)) {
      return data;
    }

    const voltage = Array.isArray(data?.v) ? data.v : [];
    const current = Array.isArray(data?.i) ? data.i : [];
    const power = Array.isArray(data?.p) ? data.p : [];
    const loadVoltage = Array.isArray(data?.loadV) ? data.loadV : [];
    const loadCurrent = Array.isArray(data?.loadI) ? data.loadI : [];
    const loadPower = Array.isArray(data?.loadP) ? data.loadP : [];
    const points = voltage.map((v, index) => ({
      v: numberOrZero(v),
      i: numberOrZero(current[index]),
      p: power.length
        ? numberOrZero(power[index])
        : numberOrZero(v) * numberOrZero(current[index]),
      loadV: numberOrZero(loadVoltage[index]),
      loadI: numberOrZero(loadCurrent[index]),
      loadP: numberOrZero(loadPower[index])
    }));

    return { points, loadSensor: Boolean(data?.loadSensor) };
  }
}

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeDuty(value) {
  if (value === undefined || value === null || value === '') return null;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  return numeric > 1 ? numeric / 100 : numeric;
}
