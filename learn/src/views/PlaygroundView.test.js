// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PlaygroundView from './PlaygroundView.vue'

vi.mock('uplot', () => ({ default: class { setData() {} destroy() {} } }))

describe('PlaygroundView', () => {
  it('mounts the complete simulator and records a live reading', async () => {
    vi.useFakeTimers()
    localStorage.clear()
    const wrapper = mount(PlaygroundView)
    vi.advanceTimersByTime(100)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.iv-chart').exists()).toBe(true)
    expect(wrapper.find('.power-chart').exists()).toBe(true)
    expect(wrapper.get('select[aria-label="Panel preset"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('button').trigger('click')
    expect(JSON.parse(localStorage.getItem('edugrid-lab-book') || '[]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Reading recorded.')
    wrapper.unmount()
    vi.useRealTimers()
  })
})
