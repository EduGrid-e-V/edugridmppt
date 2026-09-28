import { SimpleSimulation } from '../simulation/SimpleSimulation.js';

export default class MockConnector {
  constructor(onDataCallback) {
    this.onData = onDataCallback;
    this.engine = new SimpleSimulation({ onFrame: onDataCallback });
  }

  connect() { this.engine.start(); }
  disconnect() { this.engine.pause(); }

  async sendCommand(command, params = {}) {
    if (command === 'set') {
      if (params.mode) this.engine.setMode(params.mode);
      if (params.duty !== undefined) this.engine.setDuty(params.duty);
      if (params.algo) this.engine.setAlgorithm(params.algo);
    } else if (command === 'simulation') {
      if (params.sunPosition !== undefined) this.engine.setSunPosition(params.sunPosition);
      if (params.cloudCover !== undefined) this.engine.setCloudCover(params.cloudCover);
      if (params.ambientC !== undefined) this.engine.setAmbient(params.ambientC);
    } else if (command === 'sweep') {
      this.onData({ event: 'sweep_done' });
    }
  }

  async getSweepData() {
    return { points: this.engine.sweep(), loadSensor: true };
  }
}
