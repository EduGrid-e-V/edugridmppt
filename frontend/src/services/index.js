import EspConnector from './EspConnector';

export async function createSensorConnection(onData, source = 'auto') {
  if (source === 'simulation' || (__EDUGRID_STANDALONE__ && source !== 'real') ||
      (source === 'auto' && import.meta.env.DEV)) {
    const [connectorModule, workerModule] = await Promise.all([
      import('./SimulationWorkerConnector.js'),
      __EDUGRID_STANDALONE__
        ? import('../workers/simulation.worker.js?worker&inline')
        : import('../workers/simulation.worker.js?worker')
    ]);
    return new connectorModule.default(onData, workerModule.default);
  }

  return new EspConnector(onData);
}
