// @ts-check

import { algorithms } from './algorithms.js'
import { effectiveResistance, solveOperatingPoint } from './converter.js'
import { irradianceFrom } from './environment.js'
import { cellTemperature, scale } from './panel.js'
import { getPreset } from './presets.js'
import { sampleScenario, scenarios } from './scenario.js'

const DUTY_MIN = 0.02
const DUTY_MAX = 0.98

/** @param {number} duty Dimensionless duty. @returns {number} Clamped dimensionless duty. */
function clampDuty(duty) {
  return Math.max(DUTY_MIN, Math.min(DUTY_MAX, duty))
}

/** @param {string} id Algorithm id. @returns {(typeof algorithms)[keyof typeof algorithms]} Algorithm definition. */
function getAlgorithm(id) {
  return algorithms[/** @type {keyof typeof algorithms} */ (id)]
}

/**
 * Create a deterministic photovoltaic simulation engine.
 *
 * @param {{preset?: string | Record<string, any>, seed?: number, noise?: number, tickMs?: number, mpptPeriodMs?: number, onFrame?: (frame: Record<string, any>) => void}} [options] Preset values use V, A, m², 1/K and °C; periods use ms; seed and noise scale are dimensionless.
 * @returns {Record<string, any>} Stateful engine command interface.
 */
export function createEngine({ preset = 'edugrid-kit', seed = 1, noise = 1, tickMs = 50, mpptPeriodMs = 100, onFrame = () => {} } = {}) {
  const initialSeed = seed
  const initialPreset = typeof preset === 'string' ? getPreset(preset) : preset
  /** @type {ReturnType<typeof setInterval> | null} */
  let timer = null
  let listeners = [onFrame]
  let randomState = initialSeed >>> 0
  /** @type {any} */
  let state

  function initialState() {
    return {
      preset: initialPreset,
      seed: initialSeed,
      t: 0,
      duty: DUTY_MIN,
      loadOhm: 50,
      eta: 0.85,
      mode: 'MANUAL',
      algorithmId: 'PNO',
      algorithmState: { duty: DUTY_MIN, voc: initialPreset.voc, isc: initialPreset.isc },
      irradiance: 800,
      ambientC: 25,
      sunPosition: 0.5,
      cloudCover: 0,
      environmentMode: 'irradiance',
      scenario: null,
      scenarioTimeS: 0,
      mpptElapsedMs: 0,
      lastFrame: null,
      algorithmSteps: 0,
    }
  }

  state = initialState()
  getAlgorithm(state.algorithmId).reset(state.algorithmState)

  function random() {
    randomState += 0x6D2B79F5
    let mixed = randomState
    mixed = Math.imul(mixed ^ mixed >>> 15, mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61)
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296
  }

  function conditions() {
    if (state.scenario) return sampleScenario(state.scenario, state.scenarioTimeS, state.ambientC)
    const G = state.environmentMode === 'sky'
      ? irradianceFrom({ sunPosition: state.sunPosition, cloudCover: state.cloudCover, maxIrradiance: 1000 })
      : state.irradiance
    return { t: state.t, G, ambientC: state.ambientC }
  }

  function solveFrame() {
    const environment = conditions()
    const tCell = cellTemperature({ ambientC: environment.ambientC, G: environment.G, noct: state.preset.noct })
    const panelParams = scale(state.preset, { G: environment.G, tCell })
    const rEff = effectiveResistance({ loadOhm: state.loadOhm, duty: state.duty, eta: state.eta })
    const point = solveOperatingPoint({ panelParams, rEff, duty: state.duty, eta: state.eta })
    const gaussianish = () => 2 * (random() + random() + random() - 1.5)
    const v = Math.max(0, point.v + noise * 0.0015 * state.preset.voc * gaussianish())
    const i = Math.max(0, point.i + noise * 0.0015 * state.preset.isc * gaussianish())
    return {
      t: state.t,
      v,
      i,
      p: v * i,
      loadV: point.loadV,
      loadI: point.loadI,
      loadP: point.loadP,
      loadSensor: true,
      d: state.duty,
      m: state.mode,
      algo: state.algorithmId,
      G: environment.G,
      tCell,
      preset: state.preset.id,
      presetSource: state.preset.source,
    }
  }

  /** @param {Record<string, any>} frame Frame in V, A, W, s, W/m² and °C. */
  function emit(frame) {
    state.lastFrame = frame
    for (const listener of listeners) listener(frame)
    return frame
  }

  /** @param {Record<string, any>} frame Frame in V, A, W, s, W/m² and °C. */
  function runAlgorithm(frame) {
    if (state.mode !== 'AUTO') return
    const algorithm = getAlgorithm(state.algorithmId)
    state.algorithmState.duty = state.duty
    state.algorithmState.voc = state.preset.voc
    state.algorithmState.isc = state.preset.isc
    const result = algorithm.step(state.algorithmState, {
      v: frame.v, i: frame.i, p: frame.p,
      voc: state.preset.voc, isc: state.preset.isc,
    })
    state.duty = clampDuty(result.duty)
    state.algorithmSteps += 1
  }

  function tick() {
    state.t += tickMs / 1000
    if (state.scenario) state.scenarioTimeS = Math.min(state.scenario.durationS, state.scenarioTimeS + tickMs / 1000)
    let frame = solveFrame()
    state.mpptElapsedMs += tickMs
    if (state.mpptElapsedMs >= mpptPeriodMs) {
      state.mpptElapsedMs -= mpptPeriodMs
      runAlgorithm(frame)
      frame = solveFrame()
    }
    return emit(frame)
  }

  const engine = {
    /** Start emitting simulation frames at `tickMs` intervals. */
    start() {
      if (timer === null) timer = setInterval(tick, tickMs)
    },
    /** Pause frame emission without resetting time or state. */
    pause() {
      if (timer !== null) clearInterval(timer)
      timer = null
    },
    /** Restore initial state, time in s, and algorithm memory. */
    reset() {
      engine.pause()
      randomState = initialSeed >>> 0
      state = initialState()
      getAlgorithm(state.algorithmId).reset(state.algorithmState)
      const frame = emit(solveFrame())
      randomState = initialSeed >>> 0
      return frame
    },
    /** Run one MPPT decision in AUTO mode and emit one frame. */
    step() {
      const frame = solveFrame()
      runAlgorithm(frame)
      return emit(solveFrame())
    },
    /** Advance one timer tick; intended for deterministic hosts and tests. */
    tick,
    /** @param {(frame: Record<string, any>) => void} listener Frame callback using V, A, W, s, W/m² and °C. */
    subscribe(listener) {
      listeners.push(listener)
      return () => { listeners = listeners.filter((candidate) => candidate !== listener) }
    },
    /** @param {string} mode `AUTO` or `MANUAL`. */
    setMode(mode) {
      if (!['AUTO', 'MANUAL'].includes(mode)) throw new RangeError(`Unknown mode: ${mode}`)
      state.mode = mode
      getAlgorithm(state.algorithmId).reset(state.algorithmState)
    },
    /** @param {string} id Algorithm identifier (dimensionless). */
    setAlgorithm(id) {
      if (!Object.hasOwn(algorithms, id)) throw new RangeError(`Unknown algorithm: ${id}`)
      state.algorithmId = id
      algorithms[/** @type {keyof typeof algorithms} */ (id)].reset(state.algorithmState)
    },
    /** @param {number} duty Dimensionless converter duty. */
    setDuty(duty) {
      state.duty = clampDuty(duty)
      state.algorithmState.duty = state.duty
    },
    /** @param {string | Record<string, any>} nextPreset Preset id or values in V, A, m², 1/K and °C. */
    setPreset(nextPreset) {
      state.preset = typeof nextPreset === 'string' ? getPreset(nextPreset) : nextPreset
      state.algorithmState.voc = state.preset.voc
      state.algorithmState.isc = state.preset.isc
      getAlgorithm(state.algorithmId).reset(state.algorithmState)
    },
    /** @param {number} loadOhm Resistive load in Ω. */
    setLoad(loadOhm) {
      if (!(loadOhm > 0) || !Number.isFinite(loadOhm)) throw new RangeError('Load must be positive and finite')
      state.loadOhm = loadOhm
    },
    /** @param {number} G Irradiance in W/m². */
    setIrradiance(G) {
      state.irradiance = Math.max(0, G)
      state.environmentMode = 'irradiance'
      state.scenario = null
    },
    /** @param {number} ambientC Ambient temperature in °C. */
    setAmbient(ambientC) {
      if (!Number.isFinite(ambientC)) throw new TypeError('Ambient temperature must be finite')
      state.ambientC = ambientC
    },
    /** @param {number} sunPosition Dimensionless sun position in [0,1]. */
    setSunPosition(sunPosition) {
      state.sunPosition = Math.max(0, Math.min(1, sunPosition))
      state.environmentMode = 'sky'
      state.scenario = null
    },
    /** @param {number} cloudCover Dimensionless cloud cover in [0,1]. */
    setCloudCover(cloudCover) {
      state.cloudCover = Math.max(0, Math.min(1, cloudCover))
      state.environmentMode = 'sky'
      state.scenario = null
    },
    /** @param {string | Record<string, any>} scenario Scenario id or object with s, W/m² and optional °C keyframes. */
    loadScenario(scenario) {
      const selected = typeof scenario === 'string' ? scenarios.find(({ id }) => id === scenario) : scenario
      if (!selected) throw new RangeError(`Unknown scenario: ${scenario}`)
      state.scenario = selected
      state.scenarioTimeS = 0
    },
    /** @param {number} timeS Scenario position in s. */
    seekScenario(timeS) {
      if (!state.scenario) return
      state.scenarioTimeS = Math.max(0, Math.min(state.scenario.durationS, timeS))
    },
    /** Return 48 converter operating points in V, A, and W without changing visible duty. */
    sweep() {
      const previousDuty = state.duty
      const previousRandomState = randomState
      const points = Array.from({ length: 48 }, (_, index) => {
        state.duty = DUTY_MIN + index * (DUTY_MAX - DUTY_MIN) / 47
        return solveFrame()
      })
      state.duty = previousDuty
      state.algorithmState.duty = previousDuty
      randomState = previousRandomState
      return points
    },
    /** Return a read-only snapshot of dimensionless state and values in s, Ω, W/m² and °C. */
    getState() {
      return { ...state, algorithmState: { ...state.algorithmState } }
    },
  }
  return engine
}
