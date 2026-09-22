import MockConnector from './MockConnector';
import EspConnector from './EspConnector';

export function createSensorConnection(onData, source = 'auto') {
  if (__EDUGRID_STANDALONE__ && source !== 'real') {
    return import('./SimulationWorkerConnector.js').then(({ default: Connector }) => new Connector(onData));
  }
  if (source === 'simulation' || (source === 'auto' && import.meta.env.DEV)) {
    return Promise.resolve(new MockConnector(onData));
  }

  return Promise.resolve(new EspConnector(onData));
}
