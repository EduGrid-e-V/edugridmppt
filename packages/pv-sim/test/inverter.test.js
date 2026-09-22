import { describe, expect, it } from 'vitest'
import { bridgeVoltage, generateInverterWaveform, inverterFrequencies } from '../src/inverter.js'

describe('inverter teaching model', () => {
  it('maps the three bridge states to the DC link', () => {
    expect([-1, 0, 1].map((state) => bridgeVoltage(12, state))).toEqual([-12, 0, 12])
  })

  it('derives filter frequencies from the verified board values', () => {
    const frequencies = inverterFrequencies()
    expect(frequencies.lCutoffHz).toBeCloseTo(7234.3, 0)
    expect(frequencies.lcNaturalHz).toBeCloseTo(417.7, 0)
  })

  it('produces a bipolar unfiltered square wave', () => {
    const wave = generateInverterWaveform({ durationS: 0.03, sampleRateHz: 20000 })
    expect(new Set(wave.output)).toEqual(new Set([-12, 12]))
  })

  it('shows the flat DC-link input separately from the bridge output', () => {
    const wave = generateInverterWaveform({ mode: 'dc', durationS: 0.001 })
    expect(new Set(wave.output)).toEqual(new Set([12]))
  })

  it('makes SPWM follow positive and negative sine half-cycles on average', () => {
    const { output } = generateInverterWaveform({ mode: 'pwm', durationS: 0.02, sampleRateHz: 120000 })
    const quarter = output.length / 4
    const mean = (from, to) => output.slice(from, to).reduce((sum, value) => sum + value, 0) / (to - from)
    expect(mean(0, quarter)).toBeGreaterThan(0)
    expect(mean(output.length / 2, output.length / 2 + quarter)).toBeLessThan(0)
  })

  it('reduces carrier ripple when the LC filter is inserted', () => {
    const raw = generateInverterWaveform({ mode: 'pwm', filter: 'none' }).output
    const filtered = generateInverterWaveform({ mode: 'pwm', filter: 'lc' }).output
    const roughness = (values) => values.slice(1).reduce((sum, value, index) => sum + Math.abs(value - values[index]), 0)
    expect(roughness(filtered)).toBeLessThan(roughness(raw) / 5)
  })
})
