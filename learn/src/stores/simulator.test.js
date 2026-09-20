import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSimulatorStore } from './simulator.js'

describe('simulator store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('rejects locked actions and emits a lockedAttempt event', () => {
    const store = useSimulatorStore()
    store.setLocked(['duty'])
    store.setDuty(0.9)
    expect(store.duty).toBe(0.02)
    expect(store.events).toContainEqual({ type: 'lockedAttempt', control: 'duty' })
  })

  it('keeps only the latest 600 frames', () => {
    const store = useSimulatorStore()
    for (let index = 0; index < 700; index += 1) store.engine.tick()
    expect(store.history).toHaveLength(600)
    expect(store.history[0].t).toBeCloseTo(5.05, 10)
    store.pause()
  })
})
