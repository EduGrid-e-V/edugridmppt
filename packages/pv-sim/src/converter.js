// @ts-check

import { currentAt as panelCurrentAt } from './panel.js'

const DUTY_MIN = 0.02
const DUTY_MAX = 0.98

/**
 * Calculate the resistance presented to a panel by a buck converter.
 *
 * @param {{loadOhm: number, duty: number, eta?: number}} input Load resistance in Ω, dimensionless duty, and dimensionless efficiency.
 * @returns {number} Effective panel-side resistance in Ω.
 */
export function effectiveResistance({ loadOhm, duty, eta = 0.85 }) {
  if (!(loadOhm > 0) || !Number.isFinite(loadOhm)) {
    throw new RangeError('Load resistance must be a finite positive value in ohms')
  }
  if (!(eta > 0) || !Number.isFinite(eta)) {
    throw new RangeError('Converter efficiency must be a finite positive ratio')
  }

  const clampedDuty = Math.max(DUTY_MIN, Math.min(DUTY_MAX, duty))
  return eta * loadOhm / (clampedDuty * clampedDuty)
}

/**
 * Find the intersection of a panel I-V curve and a resistive load line.
 *
 * @param {{panelParams: import('./panel.js').PanelParameters & {currentAt?: (voltageV: number) => number}, rEff: number, duty?: number, eta?: number}} input Panel values in V and A, effective resistance in Ω, optional dimensionless duty and efficiency.
 * @returns {{v: number, i: number, loadV?: number, loadI?: number, loadP?: number}} Panel operating point in V and A, with optional load-side V, A, and W.
 */
export function solveOperatingPoint({ panelParams, rEff, duty, eta = 0.85 }) {
  if (!(rEff > 0) || !Number.isFinite(rEff)) {
    throw new RangeError('Effective resistance must be a finite positive value in ohms')
  }

  const currentAt = typeof panelParams.currentAt === 'function'
    ? panelParams.currentAt
    : (voltageV) => panelCurrentAt(voltageV, panelParams)

  let v = 0
  let i = 0
  if (panelParams.voc > 0 && panelParams.isc > 0) {
    let lowerV = 0
    let upperV = panelParams.voc
    for (let iteration = 0; iteration < 60; iteration += 1) {
      const midpointV = (lowerV + upperV) / 2
      if (currentAt(midpointV) > midpointV / rEff) lowerV = midpointV
      else upperV = midpointV
    }
    v = (lowerV + upperV) / 2
    i = Math.max(0, currentAt(v))
  }

  if (duty === undefined) return { v, i }

  const clampedDuty = Math.max(DUTY_MIN, Math.min(DUTY_MAX, duty))
  const loadV = clampedDuty * v
  const loadP = eta * v * i
  const loadI = loadV > 0 ? loadP / loadV : 0
  return { v, i, loadV, loadI, loadP }
}
