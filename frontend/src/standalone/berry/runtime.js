import createBerryModule from './berry-wasm.js';

export const DEFAULT_BERRY_CODE = `# Same student API as firmware/src/mppt_alg.cpp.
# mppt() is called every 100 ms. Complete the controller below.

def mppt()
  var voltage = PV.getVoltage()
  var current = PV.getCurrent()
  var power = PV.getPower()
  var current_duty = duty.get()

  # TODO: use the measurements to decide whether duty should change.
end
`;

export async function createBerryRuntime(onConsole = () => {}) {
  const module = await createBerryModule({
    print: (line) => onConsole(String(line)),
    printErr: (line) => onConsole(String(line)),
  });

  const lastError = () => module.UTF8ToString(module.ccall('berry_last_error', 'number', [], []));

  return {
    compile(code) {
      const status = module.ccall('berry_compile', 'number', ['string'], [String(code)]);
      return status === 0
        ? [{ severity: 'info', phase: 'compile', message: 'Berry program compiled successfully.' }]
        : [{ severity: 'error', phase: 'compile', message: lastError() || `Berry error ${status}` }];
    },
    step(measurement) {
      const duty = module.ccall(
        'berry_step',
        'number',
        ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
        [
          measurement.PV.voltage, measurement.PV.current, measurement.PV.power,
          measurement.load.voltage, measurement.load.current, measurement.load.power,
          measurement.duty, measurement.load.available ? 1 : 0,
        ],
      );
      if (!Number.isFinite(duty)) throw new Error(lastError() || 'Berry controller returned an invalid duty');
      return duty;
    },
  };
}
