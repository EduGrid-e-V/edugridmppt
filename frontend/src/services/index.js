import MockConnector from './MockConnector';
import EspConnector from './EspConnector';

export function createSensorConnection(onData, source = 'auto') {
  if (source === 'simulation' || (source === 'auto' && import.meta.env.DEV)) {
    return new MockConnector(onData);
  }

  return new EspConnector(onData);
}
