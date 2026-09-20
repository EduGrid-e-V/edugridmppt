import * as panel from './panel.js'
import { cellTemperature, scale } from './panel.js'
import { effectiveResistance, solveOperatingPoint } from './converter.js'
import { getPreset, presets } from './presets.js'

export const VERSION = '0.1.0'
export { cellTemperature, effectiveResistance, getPreset, panel, presets, scale, solveOperatingPoint }
