import createBerryModule from './berry-wasm.js';

export const DEFAULT_BERRY_CODE = `# Return the next converter duty cycle (0.02 .. 0.98).
# Inputs: voltage [V], current [A], power [W], current duty [0..1].
var previous_power = nil
var direction = -1

def mppt(voltage, current, power, duty)
  if previous_power == nil
    previous_power = power
    return duty - 0.05
  end
  if power < previous_power
    direction = -direction
  end
  previous_power = power
  return duty + direction * 0.01
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
    step(measurement, state) {
      const duty = module.ccall(
        'berry_step',
        'number',
        ['number', 'number', 'number', 'number'],
        [measurement.v, measurement.i, measurement.p ?? measurement.v * measurement.i, state.duty],
      );
      if (!Number.isFinite(duty)) throw new Error(lastError() || 'Berry controller returned an invalid duty');
      return duty;
    },
  };
}
