// @ts-check

const DUTY_MIN = 0.02
const DUTY_MAX = 0.98
const DEFAULT_STEP = 0.01
const FIRST_KICK_STEP = 0.05

/** @typedef {{duty: number, step?: number, voc?: number, isc?: number, studentFunction?: Function, previousValid?: boolean, previousPowerW?: number, previousVoltageV?: number, previousCurrentA?: number, direction?: number}} AlgorithmState */
/** @typedef {{v: number, i: number, p?: number, voc?: number, isc?: number}} Measurement */

/** @param {number} duty Dimensionless converter duty. @returns {number} Clamped dimensionless duty. */
function clampDuty(duty) {
  return Math.max(DUTY_MIN, Math.min(DUTY_MAX, duty))
}

/** @param {AlgorithmState} state Mutable algorithm state. @returns {AlgorithmState} Reset state. */
function reset(state) {
  state.previousValid = false
  state.previousPowerW = 0
  state.previousVoltageV = 0
  state.previousCurrentA = 0
  state.direction = 1
  return state
}

/** @param {AlgorithmState} state Mutable algorithm state. @param {Measurement} measurement Panel measurement in V, A, and optional W. @returns {{duty: number, debug: Record<string, unknown>}} Next duty and diagnostics. */
function pnoStep(state, measurement) {
  const powerW = measurement.p ?? measurement.v * measurement.i
  const step = state.step ?? DEFAULT_STEP
  if (!state.previousValid) {
    state.duty = clampDuty(state.duty + FIRST_KICK_STEP)
    state.previousValid = true
    state.previousPowerW = powerW
    return { duty: state.duty, debug: { deltaP: null, direction: state.direction, reason: 'first-kick' } }
  }
  const deltaP = powerW - /** @type {number} */ (state.previousPowerW)
  if (deltaP < 0) state.direction = -/** @type {number} */ (state.direction)
  state.duty = clampDuty(state.duty + /** @type {number} */ (state.direction) * step)
  state.previousPowerW = powerW
  return { duty: state.duty, debug: { deltaP, direction: state.direction, reason: deltaP < 0 ? 'reverse' : 'continue' } }
}

/** @param {AlgorithmState} state Mutable algorithm state. @param {Measurement} measurement Panel measurement in V, A, and optional W. @returns {{duty: number, debug: Record<string, unknown>}} Next duty and diagnostics. */
function incCondStep(state, measurement) {
  const step = state.step ?? DEFAULT_STEP
  if (!state.previousValid) {
    state.duty = clampDuty(state.duty + FIRST_KICK_STEP)
    state.previousValid = true
    state.previousVoltageV = measurement.v
    state.previousCurrentA = measurement.i
    return { duty: state.duty, debug: { dV: null, dI: null, incCond: null, instCond: null, distance: null, branch: 'first-kick' } }
  }

  const dV = measurement.v - /** @type {number} */ (state.previousVoltageV)
  const dI = measurement.i - /** @type {number} */ (state.previousCurrentA)
  const voltageScale = (measurement.voc ?? state.voc ?? 13.5) / 13.5
  const currentScale = (measurement.isc ?? state.isc ?? 0.18) / 0.18
  const vThresh = 0.002 * voltageScale
  const iThresh = 1e-4 * currentScale
  const mppThresh = 5e-4 * currentScale / voltageScale
  /** @type {number | null} */ let incCond = null
  /** @type {number | null} */ let instCond = null
  /** @type {number | null} */ let distance = null
  let branch = 'hold'

  if (Math.abs(dV) < vThresh) {
    if (Math.abs(dI) < iThresh) branch = 'hold-stable'
    else if (dI > 0) {
      state.duty = clampDuty(state.duty - step)
      branch = 'decrease-duty-current-rise'
    } else {
      state.duty = clampDuty(state.duty + step)
      branch = 'increase-duty-current-fall'
    }
  } else {
    incCond = dI / dV
    instCond = measurement.v === 0 ? Infinity : measurement.i / measurement.v
    distance = incCond + instCond
    if (Math.abs(distance) < mppThresh) branch = 'hold-mpp'
    else if (distance > 0) {
      state.duty = clampDuty(state.duty - step)
      branch = 'decrease-duty-left-of-mpp'
    } else {
      state.duty = clampDuty(state.duty + step)
      branch = 'increase-duty-right-of-mpp'
    }
  }
  state.previousVoltageV = measurement.v
  state.previousCurrentA = measurement.i
  return { duty: state.duty, debug: { dV, dI, incCond, instCond, distance, branch } }
}

/** @param {AlgorithmState} state Mutable algorithm state. @returns {{duty: number, debug: Record<string, unknown>}} Unchanged duty and diagnostics. */
function fixedStep(state) {
  return { duty: state.duty, debug: { reason: 'fixed' } }
}

/** @param {AlgorithmState} state Mutable algorithm state. @param {Measurement} measurement Panel measurement in V, A, and optional W. @returns {{duty: number, debug: Record<string, unknown>}} Student-selected or held duty and diagnostics. */
function studentStep(state, measurement) {
  try {
    if (typeof state.studentFunction !== 'function') throw new TypeError('No student function supplied')
    const result = state.studentFunction(measurement, state)
    const requestedDuty = typeof result === 'number' ? result : result?.duty
    if (!Number.isFinite(requestedDuty)) throw new TypeError('Student function must return a finite duty')
    state.duty = clampDuty(requestedDuty)
    return { duty: state.duty, debug: { reason: 'student' } }
  } catch (error) {
    return { duty: state.duty, debug: { reason: 'student-error', error: error instanceof Error ? error.message : String(error) } }
  }
}

/** MPPT definitions; duty is dimensionless, panel limits are in V and A. */
export const algorithms = {
  PNO: { id: 'PNO', labelKey: 'algorithm.pno', reset, step: pnoStep },
  INCCOND: { id: 'INCCOND', labelKey: 'algorithm.inccond', reset, step: incCondStep },
  FIXED: { id: 'FIXED', labelKey: 'algorithm.fixed', reset, step: fixedStep },
  STUDENT: { id: 'STUDENT', labelKey: 'algorithm.student', reset, step: studentStep },
}
