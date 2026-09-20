// @ts-check

/**
 * Convert sun and cloud controls into irradiance.
 *
 * @param {{sunPosition: number, cloudCover: number, maxIrradiance?: number}} controls Dimensionless sun/cloud positions and maximum irradiance in W/m².
 * @returns {number} Irradiance G in W/m².
 */
export function irradianceFrom({ sunPosition, cloudCover, maxIrradiance = 1000 }) {
  const sunHeight = Math.sin(Math.PI * sunPosition)
  const clearSky = Math.max(0, sunHeight) ** 1.35
  const cloudFactor = 1 - 0.86 * cloudCover
  return maxIrradiance * Math.max(0.03, clearSky * cloudFactor)
}
