import { createEngine } from '@edugrid/pv-sim';

export default class MockConnector {
  constructor(onDataCallback) {
    this.onData = onDataCallback;
    this.engine = createEngine({
      onFrame: (frame) => this.onData({ ...frame, c: frame.i }),
    });
  }

  connect() {
    this.engine.start();
  }

  disconnect() {
    this.engine.pause();
  }

  async sendCommand(command, params = {}) {
    if (command === 'set') {
      if (params.mode) this.engine.setMode(params.mode);
      if (params.duty !== undefined) this.engine.setDuty(Number(params.duty));
      if (params.algo) this.engine.setAlgorithm(params.algo);
      if (params.preset) this.engine.setPreset(params.preset);
    } else if (command === 'simulation') {
      if (params.sunPosition !== undefined) this.engine.setSunPosition(Number(params.sunPosition));
      if (params.cloudCover !== undefined) this.engine.setCloudCover(Number(params.cloudCover));
    } else if (command === 'sweep') {
      this.onData({ event: 'sweep_done' });
    }
  }

  async getSweepData() {
    return { points: this.engine.sweep(), loadSensor: true };
  }
}
