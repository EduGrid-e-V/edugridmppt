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

  it('reproduces 500 noisy frames for the same seed', () => {
    const first = createEngine({ seed: 42 })
    const second = createEngine({ seed: 42 })
    const firstFrames = []
    const secondFrames = []
    for (let index = 0; index < 500; index += 1) {
      firstFrames.push(first.tick())
      secondFrames.push(second.tick())
    }
    expect(secondFrames).toEqual(firstFrames)
  })

  it('produces different noise for different seeds within 20 ticks', () => {
    const first = createEngine({ seed: 1 })
    const second = createEngine({ seed: 2 })
    const differences = []
    for (let index = 0; index < 20; index += 1) {
      differences.push(first.tick().v !== second.tick().v)
    }
    expect(differences).toContain(true)
  })

  it('can disable sensor noise completely', () => {
    const first = createEngine({ seed: 1, noise: 0 })
    const second = createEngine({ seed: 2, noise: 0 })
    for (let index = 0; index < 20; index += 1) {
      expect(first.tick()).toEqual(second.tick())
    }
  })

  it('installs and resets a synchronous student controller with diagnostics', () => {
    const engine = createEngine({ noise: 0 })
    let calls = 0
    engine.installStudentFunction(({ v, i, p }, state) => {
      calls += 1
      expect(p).toBeCloseTo(v * i, 12)
      return { duty: state.duty + 0.03 }
    }, [{ severity: 'info', phase: 'compile', message: 'ready' }])
    engine.setAlgorithm('STUDENT')
    engine.setMode('AUTO')
    const frame = engine.step()
    expect(calls).toBe(1)
    expect(frame.d).toBeCloseTo(0.05, 12)
    expect(frame.algorithmDiagnostics).toEqual([
      { severity: 'info', phase: 'compile', message: 'ready' },
    ])

    engine.resetStudentFunction()
    engine.step()
    expect(calls).toBe(2)
  })

  it('surfaces student runtime failures and holds the last safe duty', () => {
    const engine = createEngine({ noise: 0 })
    engine.installStudentFunction(() => { throw new Error('student boom') })
    engine.setAlgorithm('STUDENT')
    engine.setMode('AUTO')
    const before = engine.getState().duty
    const frame = engine.step()
    expect(frame.d).toBe(before)
    expect(engine.getStudentDiagnostics()).toEqual([
      { severity: 'error', phase: 'runtime', message: 'student boom' },
    ])
  })

  it('can leave a deterministic scenario without rebuilding the engine', () => {
    const engine = createEngine({ noise: 0 })
    engine.loadScenario('passing-cloud')
    expect(engine.getState().scenario.id).toBe('passing-cloud')
    engine.clearScenario()
    expect(engine.getState().scenario).toBeNull()
    expect(engine.getState().scenarioTimeS).toBe(0)
  })
})
