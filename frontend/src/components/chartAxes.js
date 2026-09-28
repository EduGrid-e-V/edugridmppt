export const MIN_POWER_AXIS_W = 2;
export const POWER_TICK_STEP_W = 0.5;
export const REAL_MIN_POWER_AXIS_W = 0.25;
export const REAL_POWER_TICK_STEP_W = 0.05;

export function powerAxisMaximum(observedW, minimumW = MIN_POWER_AXIS_W, stepW = POWER_TICK_STEP_W) {
  return Math.ceil(Math.max(minimumW, observedW) / stepW) * stepW;
}

export function formatPowerTick(valueW, stepW = POWER_TICK_STEP_W) {
  return valueW === 0 ? '0' : valueW.toFixed(stepW < 0.1 ? 2 : 1);
}
