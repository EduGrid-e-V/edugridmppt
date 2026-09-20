// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { effectiveResistance, panel } from '@edugrid/pv-sim'
import { axisMaximum, loadLineIntersection, toPixel } from './chartMath.js'

const setData = vi.fn()
vi.mock('uplot', () => ({ default: class {
  constructor() { this.setData = setData }
  destroy() {}
} }))

const PRESET = { voc: 13.5, isc: 0.18, vmpp: 10.8, impp: 0.158 }

describe('IVChart', () => {
  beforeEach(() => setData.mockClear())

  it('places the load-line intersection within one pixel of the live marker', () => {
    const rEff = effectiveResistance({ loadOhm: 50, duty: 0.8, eta: 0.85 })
    const live = loadLineIntersection(PRESET, rEff)
    const intersection = loadLineIntersection(PRESET, rEff)
    expect(Math.abs(toPixel(live.v, PRESET.voc, 640) - toPixel(intersection.v, PRESET.voc, 640))).toBeLessThan(1)
    expect(Math.abs(toPixel(live.i, PRESET.isc, 360) - toPixel(intersection.i, PRESET.isc, 360))).toBeLessThan(1)
  })

  it('adapts the voltage axis to a small panel', () => {
    expect(axisMaximum(7)).toBeLessThan(10)
  })

  it('does not redraw when props are unchanged', async () => {
    const { default: IVChart } = await import('./IVChart.vue')
    const curve = panel.curve(PRESET, 20)
    const wrapper = mount(IVChart, { props: { curve, frame: curve[5], preset: PRESET, rEff: 50 } })
    // @ts-expect-error Vue Test Utils loses script-setup prop inference here.
    await wrapper.setProps({ frame: curve[5] })
    expect(setData).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
