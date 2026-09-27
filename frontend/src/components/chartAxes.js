export const MIN_POWER_AXIS_W = 2;
export const POWER_TICK_STEP_W = 0.5;

export function powerAxisMaximum(observedW, minimumW = MIN_POWER_AXIS_W) {
  return Math.ceil(Math.max(MIN_POWER_AXIS_W, minimumW, observedW) / POWER_TICK_STEP_W) * POWER_TICK_STEP_W;
}

export function formatPowerTick(valueW) {
  return valueW === 0 ? '0' : valueW.toFixed(1);
}
