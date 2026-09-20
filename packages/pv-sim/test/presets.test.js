import { describe, expect, it } from 'vitest'
import { getPreset, presets } from '../src/presets.js'

describe('panel presets', () => {
  it('uses the physical EduGrid experiment panel as the default', () => {
    const panel = presets[0]
    expect(panel.id).toBe('edugrid-kit')
    expect(panel.voc).toBe(13.5)
    expect(panel.isc).toBe(0.18)
    expect(panel.vmpp * panel.impp).toBeCloseTo(1.7064, 9)
  })

  it('keeps every curve and its provenance physically consistent', () => {
    for (const panel of presets) {
      expect(panel.vmpp).toBeLessThan(panel.voc)
      expect(panel.impp).toBeLessThan(panel.isc)
      expect(panel.vmpp * panel.impp / (panel.voc * panel.isc)).toBeGreaterThan(0.5)
      expect(panel.vmpp * panel.impp / (panel.voc * panel.isc)).toBeLessThan(0.85)
      expect(panel.areaM2).toBeGreaterThan(0)
      expect(panel.source.length).toBeGreaterThan(0)
    }
  })

  it('throws rather than silently substituting an unknown panel', () => {
    expect(() => getPreset('not-a-panel')).toThrow(/Unknown panel preset/)
  })
})
