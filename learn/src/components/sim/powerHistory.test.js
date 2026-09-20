import { describe, expect, it } from 'vitest'
import { stickyPowerMaximum, visiblePowerHistory } from './powerHistory.js'

describe('power history', () => {
  it('caps 1200 incoming frames at 600 points and 30 seconds', () => {
    const frames = Array.from({ length: 1200 }, (_, index) => ({ t: index * 0.05, p: index / 100 }))
    const visible = visiblePowerHistory(frames)
    expect(visible.length).toBeLessThanOrEqual(600)
    expect((visible.at(-1)?.t ?? 0) - (visible.at(0)?.t ?? 0)).toBeLessThanOrEqual(30)
  })

  it('keeps the power-axis maximum sticky', () => {
    const high = stickyPowerMaximum(1, [{ p: 10 }])
    expect(stickyPowerMaximum(high, [{ p: 2 }])).toBe(high)
  })

  it('processes 1200 frames comfortably above 30 updates per second', () => {
    const frames = []
    const started = performance.now()
    for (let index = 0; index < 1200; index += 1) {
      frames.push({ t: index * 0.05, p: index / 100 })
      visiblePowerHistory(frames)
    }
    const elapsedS = (performance.now() - started) / 1000
    expect(1200 / elapsedS).toBeGreaterThan(30)
  })
})
