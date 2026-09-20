// @ts-check

const MAX_POINTS = 600
const WINDOW_SECONDS = 30

/**
 * Keep a 30 s, 600-frame power window.
 *
 * @param {Array<{t: number, p: number}>} frames Frames in s and W.
 * @returns {Array<{t: number, p: number}>} Bounded frames in s and W.
 */
export function visiblePowerHistory(frames) {
  if (frames.length === 0) return []
  const cutoffS = frames[frames.length - 1].t - WINDOW_SECONDS
  return frames.filter(({ t }) => t >= cutoffS).slice(-MAX_POINTS)
}

/** @param {number} previousMaximumW Sticky maximum in W. @param {Array<{p: number}>} frames Power frames in W. @returns {number} Sticky maximum in W. */
export function stickyPowerMaximum(previousMaximumW, frames) {
  const measuredMaximumW = Math.max(0, ...frames.map(({ p }) => p))
  return Math.max(1, previousMaximumW, measuredMaximumW * 1.15)
}
