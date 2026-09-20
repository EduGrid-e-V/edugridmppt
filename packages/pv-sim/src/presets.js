// @ts-check

/**
 * Built-in panel presets. Electrical values are at STC; voltage is in V,
 * current in A, area in m², temperature coefficients in 1/K, and NOCT in °C.
 */
export const presets = [
  {
    id: 'edugrid-kit',
    labelKey: 'preset.edugridKit',
    voc: 13.5,
    isc: 0.18,
    vmpp: 10.8,
    impp: 0.158,
    areaM2: 0.01496,
    alphaIsc: 0.0005,
    alphaImpp: 0.0003,
    betaVoc: -0.0032,
    betaVmpp: -0.0045,
    noct: 45,
    source: 'AliExpress listing for Voc, Isc, and 110 × 136 mm outline; MPP estimated from the UP203 curve; advertised 5 W rejected as inconsistent with Isc',
  },
  {
    id: 'single-cell', labelKey: 'preset.singleCell', voc: 0.6, isc: 0.7,
    vmpp: 0.48, impp: 0.625, areaM2: 0.0156,
    alphaIsc: 0.0005, alphaImpp: 0.0003, betaVoc: -0.0032, betaVmpp: -0.0045,
    noct: 45, source: 'PV Education HUB worksheet, Aufgabe 1',
  },
  {
    id: 'up201-small', labelKey: 'preset.up201Small', voc: 2, isc: 0.13,
    vmpp: 1.6, impp: 0.114, areaM2: 0.0029,
    alphaIsc: 0.0005, alphaImpp: 0.0003, betaVoc: -0.0032, betaVmpp: -0.0045,
    noct: 45, source: 'Unterricht Physik 201/202',
  },
  {
    id: 'up203-module', labelKey: 'preset.up203Module', voc: 13.5, isc: 0.18,
    vmpp: 10.8, impp: 0.158, areaM2: 0.015,
    alphaIsc: 0.0005, alphaImpp: 0.0003, betaVoc: -0.0032, betaVmpp: -0.0045,
    noct: 45, source: 'Unterricht Physik 203',
  },
  {
    id: 'roof-module-450w', labelKey: 'preset.roofModule450w', voc: 49.5, isc: 13,
    vmpp: 41.2, impp: 11.6, areaM2: 2,
    alphaIsc: 0.0005, alphaImpp: 0.0003, betaVoc: -0.0032, betaVmpp: -0.0045,
    noct: 45, source: 'Typical 450 W roof module; representative values, not the EduGrid kit',
  },
]

/**
 * Look up a panel preset.
 *
 * @param {string} id Preset identifier (dimensionless).
 * @returns {(typeof presets)[number]} Panel preset with electrical units documented on `presets`.
 */
export function getPreset(id) {
  const preset = presets.find((candidate) => candidate.id === id)
  if (!preset) throw new RangeError(`Unknown panel preset: ${id}`)
  return preset
}
