// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DutySlider from './DutySlider.vue'
import PresetSelect from './PresetSelect.vue'

describe('simulator controls', () => {
  it('gives duty an accessible name and supports 0.5% arrow steps', async () => {
    const wrapper = mount(DutySlider, { props: { modelValue: 0.5, loadOhm: 50 } })
    const slider = wrapper.get('input[aria-label="Duty cycle"]')
    await slider.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([0.505])
  })

  it('exposes lock state through native and ARIA disabled state', () => {
    const wrapper = mount(PresetSelect, { props: { modelValue: 'edugrid-kit', disabled: true } })
    const select = wrapper.get('select')
    expect(select.attributes('disabled')).toBeDefined()
    expect(select.attributes('aria-disabled')).toBe('true')
    expect(select.attributes('aria-label')).toBe('Panel preset')
  })
})
