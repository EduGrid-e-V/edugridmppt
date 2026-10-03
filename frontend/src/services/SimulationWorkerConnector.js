export default class SimulationWorkerConnector {
  constructor(onDataCallback, WorkerClass) {
    this.onData = onDataCallback;
    this.WorkerClass = WorkerClass;
    this.worker = null;
    this.requestId = 0;
    this.pending = new Map();
  }

  connect() {
    if (this.worker) return;
    this.worker = new this.WorkerClass();
    this.worker.onmessage = ({ data }) => {
      if (data.type === 'telemetry' || data.type === 'event') {
        this.onData(data.payload);
        return;
      }
      if (data.type === 'response') {
        const pending = this.pending.get(data.id);
        if (!pending) return;
        this.pending.delete(data.id);
        if (data.error) pending.reject(new Error(data.error));
        else pending.resolve(data.payload);
      }
    };
    this.request('connect');
  }

  disconnect() {
    if (!this.worker) return;
    this.worker.terminate();
    this.worker = null;
    for (const { reject } of this.pending.values()) reject(new Error('Simulation worker stopped'));
    this.pending.clear();
  }

  request(command, params = {}) {
    if (!this.worker) return Promise.reject(new Error('Simulation worker is not connected'));
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, command, params });
    });
  }

  async sendCommand(command, params = {}) {
    return this.request(command, params);
  }

  async getSweepData() {
    return this.request('sweep-data');
  }
}
