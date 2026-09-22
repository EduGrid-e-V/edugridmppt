import { describe, expect, it } from 'vitest'
import { algorithms } from '../src/algorithms.js'
import { effectiveResistance, solveOperatingPoint } from '../src/converter.js'
import { findMpp, scale } from '../src/panel.js'

const PANEL = { voc: 13.5, isc: 0.18, vmpp: 10.8, impp: 0.158 }

function run(name, panel, startDuty, steps) {
  const state = { duty: startDuty, voc: panel.voc, isc: panel.isc }
  algorithms[name].reset(state)
  const samples = []
  for (let index = 0; index < steps; index += 1) {
    const rEff = effectiveResistance({ loadOhm: 50, duty: state.duty, eta: 0.85 })
    const point = solveOperatingPoint({ panelParams: panel, rEff })
    samples.push({ duty: state.duty, power: point.p })
    algorithms[name].step(state, { ...point, voc: panel.voc, isc: panel.isc })
  }
  return { state, samples }
}

describe('tracking algorithms', () => {
  for (const name of ['PNO', 'INCCOND']) {
    for (const startDuty of [0.02, 0.95]) {
      it(`${name} reaches 98% of MPP from duty ${startDuty}`, () => {
        const target = 0.98 * findMpp(PANEL).pmpp
        const index = run(name, PANEL, startDuty, 200).samples.findIndex(({ power }) => power >= target)
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThan(200)
      })
    }
  }

  it('uses a positive first kick from the simulation rail', () => {
    const state = { duty: 0.02 }
    algorithms.PNO.reset(state)
    expect(algorithms.PNO.step(state, { v: 13.5, i: 0 }).duty).toBeCloseTo(0.07, 12)
  })

  it('keeps PNO ripple within three steps and IncCond no worse', () => {
    const ripple = (name) => {
      const duties = run(name, PANEL, 0.02, 200).samples.slice(-50).map(({ duty }) => duty)
      return Math.max(...duties) - Math.min(...duties)
    }
    expect(ripple('PNO')).toBeLessThanOrEqual(0.03)
    expect(ripple('INCCOND')).toBeLessThanOrEqual(ripple('PNO'))
  })

  for (const name of ['PNO', 'INCCOND']) {
    it(`${name} reacquires within 4 s after a passing-cloud step`, () => {
      const bright = scale(PANEL, { G: 900, tCell: 25 })
      const shaded = scale(PANEL, { G: 250, tCell: 25 })
      const state = run(name, bright, 0.02, 100).state
      state.voc = shaded.voc
      state.isc = shaded.isc
      const target = 0.98 * findMpp(shaded).pmpp
      let reacquiredAt = -1
      for (let index = 0; index < 40; index += 1) {
        const rEff = effectiveResistance({ loadOhm: 50, duty: state.duty, eta: 0.85 })
        const point = solveOperatingPoint({ panelParams: shaded, rEff })
        if (point.p >= target && reacquiredAt < 0) reacquiredAt = index
        algorithms[name].step(state, { ...point, voc: shaded.voc, isc: shaded.isc })
      }
      expect(reacquiredAt).toBeGreaterThanOrEqual(0)
      expect(reacquiredAt).toBeLessThan(40)
    })
  }

  it('FIXED never changes duty', () => {
    const state = { duty: 0.61 }
    algorithms.FIXED.reset(state)
    expect(algorithms.FIXED.step(state, { v: 1, i: 1 }).duty).toBe(0.61)
  })

  it('STUDENT holds duty and surfaces thrown errors', () => {
    const state = { duty: 0.4, studentFunction: () => { throw new Error('lesson error') } }
    algorithms.STUDENT.reset(state)
    const result = algorithms.STUDENT.step(state, { v: 1, i: 1 })
    expect(result.duty).toBe(0.4)
    expect(result.debug.error).toBe('lesson error')
  })
})
