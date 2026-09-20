// @ts-check

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createEngine, getPreset } from '@edugrid/pv-sim'

const HISTORY_LIMIT = 600

/** Store owning one simulation engine; electrical frame units are V, A, W, W/m² and °C. */
export const useSimulatorStore = defineStore('simulator', () => {
  const frame = ref(/** @type {Record<string, any> | null} */ (null))
  const preset = ref('edugrid-kit')
  const mode = ref('MANUAL')
  const algo = ref('PNO')
  const duty = ref(0.02)
  const loadOhm = ref(50)
  const G = ref(800)
  const ambientC = ref(25)
  const locked = ref(/** @type {string[]} */ ([]))
  const history = ref(/** @type {Array<Record<string, any>>} */ ([]))
  const events = ref(/** @type {Array<{type: string, control: string}>} */ ([]))

  const engine = createEngine({ onFrame: receiveFrame })

  /** @param {Record<string, any>} nextFrame Frame in V, A, W, s, W/m² and °C. */
  function receiveFrame(nextFrame) {
    frame.value = nextFrame
    duty.value = nextFrame.d
    mode.value = nextFrame.m
    algo.value = nextFrame.algo
    G.value = nextFrame.G
    history.value.push(nextFrame)
    if (history.value.length > HISTORY_LIMIT) history.value.splice(0, history.value.length - HISTORY_LIMIT)
  }

  /** @param {string} control Dimensionless control id. @returns {boolean} Whether the action must be rejected. */
  function rejectLocked(control) {
    if (!locked.value.includes(control)) return false
    events.value.push({ type: 'lockedAttempt', control })
    return true
  }

  function start() { engine.start() }
  function pause() { engine.pause() }
  function reset() { history.value = []; engine.reset() }
  function step() { return engine.step() }
  function sweep() { return engine.sweep() }

  /** @param {string} value Operating mode. */
  function setMode(value) {
    if (rejectLocked('mode')) return
    engine.setMode(value)
    mode.value = value
  }

  /** @param {string} value Algorithm id. */
  function setAlgorithm(value) {
    if (rejectLocked('algo')) return
    engine.setAlgorithm(value)
    algo.value = value
  }

  /** @param {number} value Dimensionless duty. */
  function setDuty(value) {
    if (rejectLocked('duty')) return
    engine.setDuty(value)
    duty.value = engine.getState().duty
  }

  /** @param {string} value Preset id. */
  function setPreset(value) {
    if (rejectLocked('preset')) return
    engine.setPreset(value)
    preset.value = value
  }

  /** @param {number} value Load resistance in Ω. */
  function setLoad(value) {
    if (rejectLocked('load')) return
    engine.setLoad(value)
    loadOhm.value = value
  }

  /** @param {number} value Irradiance in W/m². */
  function setIrradiance(value) {
    if (rejectLocked('irradiance')) return
    engine.setIrradiance(value)
    G.value = value
  }

  /** @param {number} value Ambient temperature in °C. */
  function setAmbient(value) {
    if (rejectLocked('ambient')) return
    engine.setAmbient(value)
    ambientC.value = value
  }

  /** @param {number} value Dimensionless sun position. */
  function setSunPosition(value) {
    if (rejectLocked('sunPosition')) return
    engine.setSunPosition(value)
  }

  /** @param {number} value Dimensionless cloud cover. */
  function setCloudCover(value) {
    if (rejectLocked('cloudCover')) return
    engine.setCloudCover(value)
  }

  /** @param {string} value Scenario id. */
  function loadScenario(value) {
    if (rejectLocked('scenario')) return
    engine.loadScenario(value)
  }

  /** @param {string[]} controls Dimensionless control ids. */
  function setLocked(controls) { locked.value = [...controls] }

  const presetData = computed(() => getPreset(preset.value))

  return {
    frame, preset, presetData, mode, algo, duty, loadOhm, G, ambientC,
    locked, history, events, engine,
    start, pause, reset, step, sweep, setMode, setAlgorithm, setDuty,
    setPreset, setLoad, setIrradiance, setAmbient, setSunPosition,
    setCloudCover, loadScenario, setLocked,
  }
})
