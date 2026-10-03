import SimulationWorker from '../../workers/simulation.worker.js?worker';

export function preflightBerry(source, timeoutMs = 10000, createWorker = () => new SimulationWorker()) {
  return new Promise((resolve, reject) => {
    const worker = createWorker();
    let settled = false;
    const finish = (error, diagnostics) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      if (error) reject(error);
      else resolve(diagnostics);
    };
    const timer = setTimeout(() => finish(new Error('Local Berry check timed out; nothing was installed.')), timeoutMs);
    worker.onmessage = ({ data }) => {
      if (data?.type !== 'response' || data.id !== 1) return;
      if (data.error) finish(new Error(data.error));
      else if (Array.isArray(data.payload?.diagnostics)) finish(null, data.payload.diagnostics);
      else finish(new Error('Local Berry check returned an invalid response.'));
    };
    worker.onerror = () => finish(new Error('Local Berry check failed to start.'));
    try {
      worker.postMessage({ id: 1, command: 'check-student', params: { code: source } });
    } catch {
      finish(new Error('Local Berry check failed to start.'));
    }
  });
}
