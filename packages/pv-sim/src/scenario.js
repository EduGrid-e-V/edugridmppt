// @ts-check

/**
 * Reproducible irradiance scenarios. Time is in s and irradiance is in W/m².
 * Ambient temperature remains an engine input unless a keyframe overrides it.
 */
export const scenarios = [
  {
    id: 'clear-day',
    durationS: 120,
    keyframes: [
      { t: 0, G: 0 },
      { t: 60, G: 1000 },
      { t: 120, G: 0 },
    ],
  },
  {
    id: 'passing-cloud',
    durationS: 120,
    keyframes: [
      { t: 0, G: 900 },
      { t: 40, G: 250, step: true },
      { t: 55, G: 900, step: true },
      { t: 120, G: 900 },
    ],
  },
  {
    id: 'partial-shade',
    durationS: 120,
    keyframes: [
      { t: 0, G: 900 },
      { t: 60, G: 900 },
      { t: 63, G: 400 },
      { t: 120, G: 400 },
    ],
  },
]

/**
 * Sample a scenario deterministically.
 *
 * @param {{durationS: number, keyframes: Array<{t: number, G: number, ambientC?: number, step?: boolean}>}} scenario Scenario time in s, irradiance in W/m², and optional temperature in °C.
 * @param {number} timeS Requested scenario time in s.
 * @param {number} ambientC Engine ambient-temperature input in °C.
 * @returns {{t: number, G: number, ambientC: number}} Sample time in s, irradiance in W/m², and ambient temperature in °C.
 */
export function sampleScenario(scenario, timeS, ambientC) {
  if (!Number.isFinite(ambientC)) throw new TypeError('Ambient temperature must be finite')
  if (scenario.keyframes.length === 0) throw new RangeError('Scenario needs at least one keyframe')

  const t = Math.max(0, Math.min(scenario.durationS, timeS))
  let left = scenario.keyframes[0]
  let right = left
  for (let index = 1; index < scenario.keyframes.length; index += 1) {
    right = scenario.keyframes[index]
    if (t < right.t) break
    left = right
  }

  if (left === right || t >= right.t || right.step) {
    return { t, G: left.G, ambientC: left.ambientC ?? ambientC }
  }

  const fraction = (t - left.t) / (right.t - left.t)
  const leftAmbientC = left.ambientC ?? ambientC
  const rightAmbientC = right.ambientC ?? ambientC
  return {
    t,
    G: left.G + fraction * (right.G - left.G),
    ambientC: leftAmbientC + fraction * (rightAmbientC - leftAmbientC),
  }
}
