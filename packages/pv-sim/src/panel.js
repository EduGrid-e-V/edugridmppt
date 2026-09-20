// @ts-check

/**
 * @typedef {object} PanelParameters
 * @property {number} voc Open-circuit voltage in V.
 * @property {number} isc Short-circuit current in A.
 * @property {number} vmpp Datasheet MPP voltage in V.
 * @property {number} impp Datasheet MPP current in A.
 */

/**
 * Fit the dimensionless coefficients of the four-parameter panel model.
 *
 * @param {PanelParameters} params Panel parameters in V and A.
 * @returns {{c1: number, c2: number}} Dimensionless model coefficients.
 */
export function fitCoefficients({ voc, isc, vmpp, impp }) {
  if (!(voc > 0) || !(isc > 0) || !(vmpp > 0) || !(impp > 0)) {
    throw new RangeError('Panel voltages and currents must be positive')
  }
  if (!(vmpp < voc) || !(impp < isc)) {
    throw new RangeError('MPP voltage/current must be below open/short-circuit values')
  }

  const c2 = (vmpp / voc - 1) / Math.log(1 - impp / isc)
  const c1 = (1 - impp / isc) * Math.exp(-vmpp / (c2 * voc))
  return { c1, c2 }
}

/**
 * Calculate panel current at a terminal voltage.
 *
 * @param {number} voltageV Panel terminal voltage in V.
 * @param {PanelParameters} params Panel parameters in V and A.
 * @returns {number} Panel current in A.
 */
export function currentAt(voltageV, params) {
  if (voltageV < 0 || voltageV > params.voc) return 0
  if (voltageV === 0) return params.isc

  const { c1, c2 } = fitCoefficients(params)
  const currentA = params.isc
    * (1 - c1 * (Math.exp(voltageV / (c2 * params.voc)) - 1))
  return Math.max(0, Math.min(params.isc, currentA))
}

/**
 * Calculate panel power at a terminal voltage.
 *
 * @param {number} voltageV Panel terminal voltage in V.
 * @param {PanelParameters} params Panel parameters in V and A.
 * @returns {number} Panel power in W.
 */
export function powerAt(voltageV, params) {
  return voltageV * currentAt(voltageV, params)
}

/**
 * Find the maximum-power point of the fitted panel model.
 *
 * @param {PanelParameters} params Panel parameters in V and A.
 * @returns {{vmpp: number, impp: number, pmpp: number, ff: number}} MPP in V, A, W, and dimensionless fill factor.
 */
export function findMpp(params) {
  let lowerV = 0
  let upperV = params.voc
  const toleranceV = 1e-6 * params.voc
  const goldenRatio = (Math.sqrt(5) - 1) / 2
  let leftV = upperV - goldenRatio * (upperV - lowerV)
  let rightV = lowerV + goldenRatio * (upperV - lowerV)
  let leftPowerW = powerAt(leftV, params)
  let rightPowerW = powerAt(rightV, params)

  for (let iteration = 0; iteration < 200 && upperV - lowerV > toleranceV; iteration += 1) {
    if (leftPowerW < rightPowerW) {
      lowerV = leftV
      leftV = rightV
      leftPowerW = rightPowerW
      rightV = lowerV + goldenRatio * (upperV - lowerV)
      rightPowerW = powerAt(rightV, params)
    } else {
      upperV = rightV
      rightV = leftV
      rightPowerW = leftPowerW
      leftV = upperV - goldenRatio * (upperV - lowerV)
      leftPowerW = powerAt(leftV, params)
    }
  }

  const vmpp = (lowerV + upperV) / 2
  const impp = currentAt(vmpp, params)
  const pmpp = vmpp * impp
  const ff = pmpp / (params.voc * params.isc)
  return { vmpp, impp, pmpp, ff }
}

/**
 * Sample the panel I-V curve with extra resolution around its knee.
 *
 * @param {PanelParameters} params Panel parameters in V and A.
 * @param {number} [sampleCount=120] Number of dimensionless samples.
 * @returns {Array<{v: number, i: number, p: number}>} Points in V, A, and W.
 */
export function curve(params, sampleCount = 120) {
  if (!Number.isInteger(sampleCount) || sampleCount < 2) {
    throw new RangeError('Curve sample count must be an integer of at least two')
  }

  const lowerCount = Math.floor(sampleCount / 2)
  const upperCount = sampleCount - lowerCount
  const points = []

  for (let index = 0; index < lowerCount; index += 1) {
    const voltageV = 0.8 * params.voc * index / lowerCount
    const currentA = currentAt(voltageV, params)
    points.push({ v: voltageV, i: currentA, p: voltageV * currentA })
  }
  for (let index = 0; index < upperCount; index += 1) {
    const fraction = upperCount === 1 ? 1 : index / (upperCount - 1)
    const voltageV = params.voc * (0.8 + 0.2 * fraction)
    const currentA = currentAt(voltageV, params)
    points.push({ v: voltageV, i: currentA, p: voltageV * currentA })
  }

  return points
}
