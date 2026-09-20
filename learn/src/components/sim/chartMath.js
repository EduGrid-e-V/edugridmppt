// @ts-check

import { solveOperatingPoint } from '@edugrid/pv-sim'

/**
 * Compute the physical intersection used by both the load line and live marker.
 *
 * @param {{voc: number, isc: number, vmpp: number, impp: number}} panelParams Panel values in V and A.
 * @param {number} rEff Effective load resistance in Ω.
 * @returns {{v: number, i: number, p: number}} Intersection in V, A, and W.
 */
export function loadLineIntersection(panelParams, rEff) {
  return solveOperatingPoint({ panelParams, rEff })
}

/** @param {number} value Data value in axis units. @param {number} maximum Axis maximum in matching units. @param {number} pixels Plot extent in px. @returns {number} Pixel coordinate in px. */
export function toPixel(value, maximum, pixels) {
  return value / maximum * pixels
}

/** @param {number} presetMaximum Preset maximum in V, A, or W. @returns {number} Adaptive axis maximum in the same unit. */
export function axisMaximum(presetMaximum) {
  if (!(presetMaximum > 0)) return 1
  const magnitude = 10 ** Math.floor(Math.log10(presetMaximum))
  return Math.ceil(presetMaximum * 1.08 / magnitude) * magnitude
}
