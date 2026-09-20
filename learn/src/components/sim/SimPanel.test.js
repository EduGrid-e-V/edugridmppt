// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SimPanel from './SimPanel.vue'

vi.mock('uplot', () => ({ default: class { setData() {} destroy() {} } }))

describe('SimPanel', () => {
  beforeEach(() => vi.useFakeTimers())

  it('mounts only a readout when requested', () => {
    const wrapper = mount(SimPanel, { props: { show: ['readout'] } })
    expect(wrapper.find('.sim-readout').exists()).toBe(true)
    expect(wrapper.find('.iv-chart').exists()).toBe(false)
    expect(wrapper.find('.power-chart').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders a locked preset control disabled', () => {
    const wrapper = mount(SimPanel, { props: { show: ['presetSelect'], lock: ['preset'] } })
    const select = wrapper.get('select[aria-label="Panel preset"]')
    expect(select.attributes('disabled')).toBeDefined()
    expect(select.attributes('aria-disabled')).toBe('true')
    wrapper.unmount()
  })

  it('gives two panels independent engines', () => {
    const first = mount(SimPanel, { props: { show: ['readout'], duty: 0.2 } })
    const second = mount(SimPanel, { props: { show: ['readout'], duty: 0.8 } })
    const firstStore = /** @type {any} */ (first.vm).store
    const secondStore = /** @type {any} */ (second.vm).store
    expect(firstStore.engine).not.toBe(secondStore.engine)
    expect(firstStore.duty).toBe(0.2)
    expect(secondStore.duty).toBe(0.8)
    first.unmount(); second.unmount()
  })

  it('stops emitting after unmount for ten simulated seconds', async () => {
    const onFrame = vi.fn()
    const wrapper = mount(SimPanel, { props: { show: ['readout'], onFrame } })
    vi.advanceTimersByTime(100)
    await wrapper.vm.$nextTick()
    const emissionsBeforeUnmount = onFrame.mock.calls.length
    expect(emissionsBeforeUnmount).toBeGreaterThan(0)
    wrapper.unmount()
    vi.advanceTimersByTime(10_000)
    expect(onFrame).toHaveBeenCalledTimes(emissionsBeforeUnmount)
  })
})
