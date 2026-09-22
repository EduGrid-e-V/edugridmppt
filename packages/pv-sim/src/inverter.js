export const INVERTER_DEFAULTS = Object.freeze({
  dcVoltage: 12,
  outputHz: 50,
  carrierHz: 16000000 / (2 * 533),
  slowCarrierHz: 500,
  loadOhm: 200,
  inductanceH: 4.4e-3,
  capacitanceF: 33e-6,
  modulationIndex: 0.9,
})

/** @param {number} dcVoltage @param {-1|0|1} switchState */
export function bridgeVoltage(dcVoltage, switchState) {
  if (![-1, 0, 1].includes(switchState)) throw new RangeError('switchState must be -1, 0, or 1')
  return dcVoltage * switchState
}

export function inverterFrequencies({ loadOhm = 200, inductanceH = 4.4e-3, capacitanceF = 33e-6 } = {}) {
  return {
    lCutoffHz: loadOhm / (2 * Math.PI * inductanceH),
    lcNaturalHz: 1 / (2 * Math.PI * Math.sqrt(inductanceH * capacitanceF)),
  }
}

/** @param {number} phase */
function triangle(phase) {
  const cycle = phase - Math.floor(phase)
  return 1 - 4 * Math.abs(cycle - 0.5)
}

export function generateInverterWaveform(options = {}) {
  const config = { ...INVERTER_DEFAULTS, durationS: 0.04, sampleRateHz: 120000, mode: 'square', filter: 'none', ...options }
  const { dcVoltage, outputHz, carrierHz, loadOhm, inductanceH, capacitanceF, modulationIndex, durationS, sampleRateHz } = config
  if (!(durationS > 0 && sampleRateHz > 0 && loadOhm > 0 && inductanceH > 0 && capacitanceF > 0)) throw new RangeError('physical values must be positive')
  if (modulationIndex < 0 || modulationIndex > 1) throw new RangeError('modulationIndex must be between 0 and 1')
  if (!['dc', 'square', 'pwm'].includes(config.mode) || !['none', 'l', 'lc'].includes(config.filter)) throw new RangeError('unknown inverter mode or filter')

  const count = Math.max(2, Math.floor(durationS * sampleRateHz))
  const dt = 1 / sampleRateHz
  const time = new Float64Array(count)
  const bridge = new Float64Array(count)
  const output = new Float64Array(count)
  let voltage = 0
  let current = 0

  for (let index = 0; index < count; index += 1) {
    const t = index * dt
    const reference = Math.sin(2 * Math.PI * outputHz * t)
    const state = config.mode === 'dc' ? 1 : config.mode === 'square'
      ? (reference >= 0 ? 1 : -1)
      : (modulationIndex * reference >= triangle(carrierHz * t) ? 1 : -1)
    const raw = bridgeVoltage(dcVoltage, state)

    if (config.filter === 'none') voltage = raw
    else if (config.filter === 'l') voltage += dt * (loadOhm / inductanceH) * (raw - voltage)
    else {
      current += dt * (raw - voltage) / inductanceH
      voltage += dt * (current - voltage / loadOhm) / capacitanceF
    }
    time[index] = t
    bridge[index] = raw
    output[index] = voltage
  }
  return { time, bridge, output, sampleRateHz, config }
}
