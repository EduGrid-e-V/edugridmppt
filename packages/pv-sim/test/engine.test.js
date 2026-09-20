import { describe, expect, it, vi } from 'vitest'
import { createEngine } from '../src/engine.js'

describe('simulation engine', () => {
  it('advances 100 50 ms ticks by exactly five seconds and runs MPPT 50 times', () => {
    const engine = createEngine({ tickMs: 50, mpptPeriodMs: 100 })
    engine.setMode('AUTO')
    for (let index = 0; index < 100; index += 1) engine.tick()
    expect(engine.getState().t).toBeCloseTo(5, 12)
    expect(engine.getState().algorithmSteps).toBe(50)
  })

  it('sweeps 48 points and restores duty', () => {
    const engine = createEngine()
    engine.setDuty(0.37)
    const points = engine.sweep()
    expect(points).toHaveLength(48)
    expect(engine.getState().duty).toBe(0.37)
    expect(points.every((point) => Number.isFinite(point.p))).toBe(true)
  })

  it('pauses and resumes without resetting state', () => {
    vi.useFakeTimers()
    const frames = []
    const engine = createEngine({ onFrame: (frame) => frames.push(frame) })
    engine.start()
    vi.advanceTimersByTime(100)
    engine.pause()
    expect(frames).toHaveLength(2)
    vi.advanceTimersByTime(100)
    expect(frames).toHaveLength(2)
    engine.start()
    vi.advanceTimersByTime(50)
    engine.pause()
    expect(frames).toHaveLength(3)
    expect(engine.getState().t).toBeCloseTo(0.15, 12)
    vi.useRealTimers()
  })

  it('steps only in AUTO mode', () => {
    const engine = createEngine()
    const initialDuty = engine.getState().duty
    engine.step()
    expect(engine.getState().duty).toBe(initialDuty)
    engine.setMode('AUTO')
    engine.step()
    expect(engine.getState().duty).toBeGreaterThan(initialDuty)
    expect(engine.getState().algorithmSteps).toBe(1)
  })

  it('reset reproduces the deterministic initial frame', () => {
    const frames = []
    const engine = createEngine({ seed: 42, onFrame: (frame) => frames.push(frame) })
    engine.tick()
    const first = frames.at(-1)
    engine.tick()
    engine.reset()
    engine.tick()
    expect(frames.at(-1)).toEqual(first)
  })
})
