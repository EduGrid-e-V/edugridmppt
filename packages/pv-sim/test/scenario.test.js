import { describe, expect, it } from 'vitest'
import { sampleScenario, scenarios } from '../src/scenario.js'

const getScenario = (id) => scenarios.find((scenario) => scenario.id === id)

describe('scenario scripting', () => {
  it('repeats the passing-cloud trace exactly', () => {
    const scenario = getScenario('passing-cloud')
    const first = Array.from({ length: 1201 }, (_, index) => sampleScenario(scenario, index / 10, 23))
    const second = Array.from({ length: 1201 }, (_, index) => sampleScenario(scenario, index / 10, 23))
    expect(second).toEqual(first)
  })

  it('models passing-cloud edges as discontinuous steps', () => {
    const scenario = getScenario('passing-cloud')
    expect(sampleScenario(scenario, 39.9, 23).G).toBe(900)
    expect(sampleScenario(scenario, 40.1, 23).G).toBe(250)
    expect(sampleScenario(scenario, 54.9, 23).G).toBe(250)
    expect(sampleScenario(scenario, 55.1, 23).G).toBe(900)
  })

  it('ramps partial shade over three seconds and then holds', () => {
    const scenario = getScenario('partial-shade')
    expect(sampleScenario(scenario, 60, 20).G).toBe(900)
    expect(sampleScenario(scenario, 61.5, 20).G).toBe(650)
    expect(sampleScenario(scenario, 120, 20).G).toBe(400)
  })

  it('ends every scenario at a defined value and inherits ambient input', () => {
    for (const scenario of scenarios) {
      const sample = sampleScenario(scenario, scenario.durationS, 27)
      expect(Number.isFinite(sample.G)).toBe(true)
      expect(sample.t).toBe(scenario.durationS)
      expect(sample.ambientC).toBe(27)
    }
  })
})
