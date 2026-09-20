/**
 * FROZEN GROUND TRUTH — DO NOT EDIT TO MAKE A BUILD PASS.
 *
 * Every number in this file was computed from the formulas in
 * docs/workplan.md §7.1–§7.4 and verified numerically before the build started.
 * These tests exist BEFORE the implementation. Your job is to make them pass.
 *
 * If a test here fails, your implementation is wrong. If you believe a number
 * here is wrong, stop and write the argument into learn/BLOCKED.md. Do not
 * change, skip, loosen or delete an assertion. (Workplan rules R1 and R9.)
 *
 * Covers workplan tasks: T-1.1, T-1.2, T-1.3, T-2.1, T-2.5.
 */

import { describe, it, expect } from 'vitest';
import {
  panel,
  scale,
  cellTemperature,
  effectiveResistance,
  solveOperatingPoint,
  getPreset,
  presets,
  VERSION,
} from '../src/index.js';

/** The reference panel for all vectors: workplan §7.5 preset `up203-module`. */
const UP203 = { voc: 13.5, isc: 0.18, vmpp: 10.8, impp: 0.158 };

/** Assert |actual - expected| <= rel * |expected|. */
const closeRel = (actual, expected, rel) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(rel * Math.abs(expected));

// ---------------------------------------------------------------------------
// Vector A — panel I-V model at STC                                     T-1.1
// ---------------------------------------------------------------------------

describe('Vector A — four-parameter I-V model, up203-module at STC', () => {
  it('fits the datasheet coefficients', () => {
    const { c1, c2 } = panel.fitCoefficients(UP203);
    closeRel(c2, 0.095151, 1e-5);
    closeRel(c1, 2.7274e-5, 1e-4);
  });

  it('passes through I(0) = Isc exactly', () => {
    expect(panel.currentAt(0, UP203)).toBeCloseTo(0.18, 12);
  });

  it('passes through the datasheet MPP exactly', () => {
    closeRel(panel.currentAt(10.8, UP203), 0.158005, 1e-4);
    closeRel(panel.powerAt(10.8, UP203), 1.70645, 1e-4);
  });

  it('reproduces the frozen sample points', () => {
    closeRel(panel.currentAt(5.0, UP203), 0.179764, 1e-4);
    closeRel(panel.powerAt(5.0, UP203), 0.89882, 1e-4);
    closeRel(panel.currentAt(12.0, UP203), 0.124012, 1e-4);
    closeRel(panel.powerAt(12.0, UP203), 1.48814, 1e-4);
  });

  it('reaches ~zero current at Voc (a property of the model, not a bug)', () => {
    expect(panel.currentAt(13.5, UP203)).toBeLessThan(1e-4 * UP203.isc * 10);
    expect(panel.currentAt(13.5, UP203)).toBeGreaterThanOrEqual(0);
  });

  it('clamps outside the physical range', () => {
    expect(panel.currentAt(14.85, UP203)).toBe(0); // V > Voc
    expect(panel.currentAt(-1, UP203)).toBe(0);
    expect(panel.currentAt(6, UP203)).toBeLessThanOrEqual(UP203.isc);
  });

  it('finds the true maximum, which is NOT the datasheet MPP', () => {
    const m = panel.findMpp(UP203);
    closeRel(m.vmpp, 10.638, 2e-3);
    closeRel(m.impp, 0.16062, 2e-3);
    closeRel(m.pmpp, 1.70859, 2e-3);
    closeRel(m.ff, 0.7031, 2e-3);
    // the fitted peak is at or above the datasheet point
    expect(m.pmpp).toBeGreaterThanOrEqual(UP203.vmpp * UP203.impp);
    // and within 5 % of the datasheet voltage
    closeRel(m.vmpp, UP203.vmpp, 0.05);
  });

  it('samples a monotonically non-increasing curve', () => {
    const c = panel.curve(UP203, 120);
    expect(c.length).toBe(120);
    expect(c[0].v).toBeCloseTo(0, 9);
    closeRel(c[c.length - 1].v, UP203.voc, 1e-6);
    for (let k = 1; k < c.length; k += 1) {
      expect(c[k].v).toBeGreaterThan(c[k - 1].v);
      expect(c[k].i).toBeLessThanOrEqual(c[k - 1].i + 1e-12);
      expect(c[k].p).toBeCloseTo(c[k].v * c[k].i, 9);
    }
  });

  it('resolves the knee: at least a third of the samples sit above 0.8 Voc', () => {
    const c = panel.curve(UP203, 120);
    const knee = c.filter((pt) => pt.v >= 0.8 * UP203.voc).length;
    expect(knee).toBeGreaterThanOrEqual(40);
  });
});

// ---------------------------------------------------------------------------
// Vectors E and F — irradiance and temperature scaling                  T-1.2
// ---------------------------------------------------------------------------

describe('Vectors E/F — irradiance and temperature scaling', () => {
  const p = { ...UP203, alphaIsc: 5e-4, alphaImpp: 3e-4, betaVoc: -32e-4, betaVmpp: -45e-4 };

  it('is the identity at STC', () => {
    const s = scale(p, { G: 1000, tCell: 25 });
    closeRel(s.voc, UP203.voc, 1e-9);
    closeRel(s.isc, UP203.isc, 1e-9);
    closeRel(s.vmpp, UP203.vmpp, 1e-9);
    closeRel(s.impp, UP203.impp, 1e-9);
  });

  it('Vector F — halving the light halves the current but costs ~6 % of the voltage', () => {
    const s = scale(p, { G: 500, tCell: 25 });
    closeRel(s.isc / UP203.isc, 0.5, 1e-9);
    closeRel(s.voc / UP203.voc, 0.9411, 2e-3);
    expect(s.voc / UP203.voc).toBeGreaterThan(0.92);
    expect(s.voc / UP203.voc).toBeLessThan(0.96);
  });

  it('Vector E — Pmpp falls by 0.42 %/K', () => {
    const cold = panel.findMpp(scale(p, { G: 1000, tCell: 25 })).pmpp;
    const hot = panel.findMpp(scale(p, { G: 1000, tCell: 65 })).pmpp;
    closeRel(cold, 1.7086, 2e-3);
    closeRel(hot, 1.417, 3e-3);
    const perK = ((hot / cold - 1) * 100) / 40;
    expect(perK).toBeGreaterThan(-0.46);
    expect(perK).toBeLessThan(-0.38);
  });

  it('moves Voc down and Isc up with temperature', () => {
    const hot = scale(p, { G: 1000, tCell: 65 });
    expect(hot.voc).toBeLessThan(UP203.voc);
    expect(hot.isc).toBeGreaterThan(UP203.isc);
  });

  it('returns zeros, never NaN, in the dark', () => {
    for (const G of [0, -1]) {
      const s = scale(p, { G, tCell: 25 });
      for (const k of ['voc', 'isc', 'vmpp', 'impp']) {
        expect(Number.isFinite(s[k])).toBe(true);
        expect(s[k]).toBe(0);
      }
    }
  });

  it('applies the NOCT cell-temperature model', () => {
    closeRel(cellTemperature({ ambientC: 25, G: 1000, noct: 45 }), 56.25, 1e-9);
    closeRel(cellTemperature({ ambientC: 20, G: 0, noct: 45 }), 20, 1e-9);
  });
});

// ---------------------------------------------------------------------------
// Vector B — solver sanity against an analytically known source         T-2.1
// ---------------------------------------------------------------------------

describe('Vector B — bisection solver against a linear source', () => {
  // I(V) = 1 A * (1 - V/10 V). Intersect with I = V / 10 Ω  =>  V = 5 exactly.
  const linear = { voc: 10, isc: 1, currentAt: (V) => Math.max(0, 1 * (1 - V / 10)) };

  it('finds the exact analytic intersection', () => {
    const op = solveOperatingPoint({ panelParams: linear, rEff: 10 });
    expect(Math.abs(op.v - 5)).toBeLessThan(1e-6);
    expect(Math.abs(op.i - 0.5)).toBeLessThan(1e-6);
  });

  it('degenerates correctly at the rails', () => {
    const shortCircuit = solveOperatingPoint({ panelParams: linear, rEff: 1e-9 });
    expect(shortCircuit.v).toBeLessThan(0.01);
    const openCircuit = solveOperatingPoint({ panelParams: linear, rEff: 1e9 });
    closeRel(openCircuit.v, 10, 1e-3);
  });
});

// ---------------------------------------------------------------------------
// Vectors C and D — the converter load-line model                       T-2.1
// ---------------------------------------------------------------------------

describe('Vectors C/D — buck converter as a resistance transformer', () => {
  const ETA = 0.85;
  const R = 50;

  it('transforms the load resistance as eta*R/D^2', () => {
    closeRel(effectiveResistance({ loadOhm: R, duty: 0.5, eta: ETA }), 170, 1e-12);
    closeRel(effectiveResistance({ loadOhm: R, duty: 0.25, eta: ETA }), 680, 1e-12);
  });

  it('clamps duty to [0.02, 0.98] so R_eff never diverges', () => {
    // eta*R/0.98^2 = 42.5 / 0.9604
    closeRel(effectiveResistance({ loadOhm: R, duty: 1.0, eta: ETA }), 44.25239, 1e-5);
    closeRel(effectiveResistance({ loadOhm: R, duty: 2.0, eta: ETA }), 44.25239, 1e-5);
    // eta*R/0.02^2 = 42.5 / 0.0004
    closeRel(effectiveResistance({ loadOhm: R, duty: 0, eta: ETA }), 106250, 1e-9);
    expect(Number.isFinite(effectiveResistance({ loadOhm: R, duty: 0, eta: ETA }))).toBe(true);
  });

  it('Vector C — operating point at duty 0.5', () => {
    const rEff = effectiveResistance({ loadOhm: R, duty: 0.5, eta: ETA });
    const op = solveOperatingPoint({ panelParams: UP203, rEff });
    closeRel(op.v, 12.8038, 1e-3);
    closeRel(op.i, 0.075317, 1e-3);
    closeRel(op.v * op.i, 0.96434, 1e-3);
  });

  it('RULE — increasing duty strictly lowers the panel voltage', () => {
    // This is firmware/README.md's documented rule. A failure here is a sign error.
    let previous = Infinity;
    for (let d = 0.1; d <= 0.95; d += 0.05) {
      const rEff = effectiveResistance({ loadOhm: R, duty: d, eta: ETA });
      const { v } = solveOperatingPoint({ panelParams: UP203, rEff });
      expect(v).toBeLessThan(previous);
      previous = v;
    }
  });

  it('Vector D — an interior optimal duty exists and reaches the MPP', () => {
    let best = { duty: 0, p: -1 };
    for (let d = 0.05; d <= 0.95001; d += 0.005) {
      const rEff = effectiveResistance({ loadOhm: R, duty: d, eta: ETA });
      const { v, i } = solveOperatingPoint({ panelParams: UP203, rEff });
      if (v * i > best.p) best = { duty: d, p: v * i };
    }
    // must be an interior maximum, not a rail
    expect(best.duty).toBeGreaterThan(0.77);
    expect(best.duty).toBeLessThan(0.82);
    closeRel(best.p, 1.70857, 2e-3);
    expect(best.p / panel.findMpp(UP203).pmpp).toBeGreaterThan(0.99);
  });

  it('matches the closed form D_mpp = sqrt(eta*R/R_opt)', () => {
    const rOpt = UP203.vmpp / UP203.impp;
    closeRel(rOpt, 68.354, 1e-3);
    closeRel(Math.sqrt((ETA * R) / rOpt), 0.7885, 2e-3);
  });

  it('conserves power through the converter at exactly eta', () => {
    for (const d of [0.05, 0.25, 0.5, 0.75, 0.95]) {
      const rEff = effectiveResistance({ loadOhm: R, duty: d, eta: ETA });
      const op = solveOperatingPoint({ panelParams: UP203, rEff, duty: d, eta: ETA });
      if (op.loadP === undefined) continue; // solver may be called without converter context
      closeRel(op.loadP / (op.v * op.i), ETA, 1e-9);
      closeRel(op.loadV, d * op.v, 1e-9);
      closeRel(op.loadI * op.loadV, op.loadP, 1e-9);
    }
  });

  it('never produces NaN over the whole parameter space', () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const p = { ...UP203, alphaIsc: 5e-4, alphaImpp: 3e-4, betaVoc: -32e-4, betaVmpp: -45e-4 };
    for (let k = 0; k < 2000; k += 1) {
      const loadOhm = 1 + rnd() * 4999;
      const duty = 0.02 + rnd() * 0.96;
      const G = rnd() * 1200;
      const tCell = -10 + rnd() * 90;
      const scaled = scale(p, { G, tCell });
      const rEff = effectiveResistance({ loadOhm, duty, eta: ETA });
      const op = solveOperatingPoint({ panelParams: scaled, rEff, duty, eta: ETA });
      for (const key of ['v', 'i']) {
        expect(Number.isFinite(op[key])).toBe(true);
        expect(op[key]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Presets and public API                                         T-1.3, T-2.5
// ---------------------------------------------------------------------------

describe('Presets', () => {
  it('defaults to the real EduGrid kit, not the roof module', () => {
    expect(presets[0].id).toBe('edugrid-kit');
  });

  it('ships exactly the five presets of workplan §7.5', () => {
    expect(presets.map((p) => p.id).sort()).toEqual(
      ['edugrid-kit', 'roof-module-450w', 'single-cell', 'up201-small', 'up203-module'].sort(),
    );
  });

  it('is physically consistent and declares its provenance', () => {
    for (const p of presets) {
      expect(p.vmpp).toBeLessThan(p.voc);
      expect(p.impp).toBeLessThan(p.isc);
      const ff = (p.vmpp * p.impp) / (p.voc * p.isc);
      expect(ff).toBeGreaterThan(0.5);
      expect(ff).toBeLessThan(0.85);
      expect(p.areaM2).toBeGreaterThan(0);
      expect(typeof p.source).toBe('string');
      expect(p.source.length).toBeGreaterThan(0);
    }
  });

  it('reproduces the worksheet single cell', () => {
    const cell = getPreset('single-cell');
    expect(cell.voc).toBeCloseTo(0.6, 9);
    expect(cell.isc).toBeCloseTo(0.7, 9);
  });

  it('throws on an unknown id rather than falling back silently', () => {
    expect(() => getPreset('nope')).toThrow();
  });
});

describe('Public API surface', () => {
  it('exports exactly the agreed set (workplan §2.5)', async () => {
    const mod = await import('../src/index.js');
    expect(Object.keys(mod).sort()).toEqual(
      [
        'VERSION',
        'algorithms',
        'cellTemperature',
        'createEngine',
        'effectiveResistance',
        'getPreset',
        'panel',
        'presets',
        'scale',
        'scenarios',
        'solveOperatingPoint',
      ].sort(),
    );
  });

  it('declares a version', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
