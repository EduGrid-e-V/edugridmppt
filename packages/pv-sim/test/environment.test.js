import { describe, expect, it } from 'vitest'
import { irradianceFrom } from '../src/environment.js'

describe('irradianceFrom', () => {
  it('reaches maximum irradiance at clear noon', () => {
    expect(irradianceFrom({ sunPosition: 0.5, cloudCover: 0 })).toBeCloseTo(1000, 9)
  })

  it('keeps a three-percent floor at the horizon', () => {
    expect(irradianceFrom({ sunPosition: 0, cloudCover: 0 })).toBeCloseTo(30, 9)
  })

  it('reduces full cloud at noon below one quarter of clear noon', () => {
    const clear = irradianceFrom({ sunPosition: 0.5, cloudCover: 0 })
    const cloud = irradianceFrom({ sunPosition: 0.5, cloudCover: 1 })
    expect(cloud).toBeLessThan(0.25 * clear)
  })

  it('decreases monotonically as cloud cover increases', () => {
    let previous = Infinity
    for (let cloudCover = 0; cloudCover <= 1; cloudCover += 0.05) {
      const irradiance = irradianceFrom({ sunPosition: 0.5, cloudCover })
      expect(Number.isFinite(irradiance)).toBe(true)
      expect(irradiance).toBeGreaterThanOrEqual(0)
      expect(irradiance).toBeLessThanOrEqual(previous)
      previous = irradiance
    }
  })

  it('supports the specified desk-lamp maximum', () => {
    expect(irradianceFrom({ sunPosition: 0.5, cloudCover: 0, maxIrradiance: 200 }))
      .toBeCloseTo(200, 9)
  })
})
