<template>
  <section class="graph-card">
    <header class="graph-header">
      <div>
        <p class="graph-kicker">Panel characteristic</p>
        <h3>I–V curve</h3>
      </div>
      <div class="legend" aria-label="Chart legend">
        <span><i class="dot live"></i>Live point</span>
        <span><i class="line sweep"></i>Current</span>
        <span><i class="line power"></i>Power</span>
      </div>
    </header>

    <div class="graph-frame">
      <svg class="chart-svg" viewBox="0 0 640 420" preserveAspectRatio="none" role="img" aria-label="Voltage current characteristic chart">
        <rect class="plot-bg" :x="plot.x" :y="plot.y" :width="plot.width" :height="plot.height" rx="4" />

        <g class="grid">
          <g v-for="tick in xTicks" :key="`x-${tick.value}`">
            <line :x1="tick.x" :x2="tick.x" :y1="plot.y" :y2="plot.bottom" />
            <text class="tick-label" :x="tick.x" :y="plot.bottom + 24" text-anchor="middle">
              {{ tick.label }}
            </text>
          </g>
          <g v-for="tick in yTicks" :key="`y-${tick.value}`">
            <line :x1="plot.x" :x2="plot.right" :y1="tick.y" :y2="tick.y" />
            <text class="tick-label" :x="plot.x - 14" :y="tick.y + 4" text-anchor="end">
              {{ tick.label }}
            </text>
          </g>
        </g>
        <g class="power-scale">
          <g v-for="tick in powerTicks" :key="`p-${tick.value}`">
            <text class="tick-label power-label" :x="plot.right + 16" :y="tick.y + 4" text-anchor="start">
              {{ tick.label }}
            </text>
          </g>
        </g>

        <path class="axis-line" :d="`M ${plot.x} ${plot.y} V ${plot.bottom} H ${plot.right}`" />
        <path class="power-axis-line" :d="`M ${plot.right} ${plot.y} V ${plot.bottom}`" />

        <path v-if="sweepPath" class="sweep-path" :d="sweepPath" />
        <path v-if="powerPath" class="power-path" :d="powerPath" />
        <path v-if="historyPath" class="history-path" :d="historyPath" />
        <path v-if="powerHistoryPath" class="power-history-path" :d="powerHistoryPath" />

        <g class="live-point" :transform="`translate(${livePoint.x} ${livePoint.y})`">
          <circle class="live-halo" r="15" />
          <circle class="live-dot" r="6" />
          <circle class="live-center" r="2.2" />
        </g>
        <g v-if="livePowerPoint" class="live-power-point" :transform="`translate(${livePowerPoint.x} ${livePowerPoint.y})`">
          <circle class="live-power-halo" r="12" />
          <circle class="live-power-dot" r="5" />
        </g>

        <text class="axis-title x-title" :x="plot.x + plot.width / 2" y="402" text-anchor="middle">Voltage (V)</text>
        <text class="axis-title y-title" transform="translate(18 205) rotate(-90)" text-anchor="middle">
          Current (A)
        </text>
        <text class="axis-title power-title" transform="translate(626 205) rotate(90)" text-anchor="middle">
          Power (W)
        </text>
      </svg>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  voltage: { type: Number, required: true },
  current: { type: Number, required: true },
  sweepData: { type: Array, default: () => [] }
});

const history = ref([]);
const maxSeen = ref({
  voltage: 0,
  current: 0,
  power: 0
});
const MAX_HISTORY = 42;

const plot = {
  x: 82,
  y: 34,
  width: 430,
  height: 304,
  right: 512,
  bottom: 338
};

const bounds = computed(() => {
  return {
    x: niceMax(maxSeen.value.voltage * 1.05, 1),
    y: niceMax(maxSeen.value.current * 1.16, 0.1),
    power: niceMax(maxSeen.value.power * 1.18, 1)
  };
});

const xTicks = computed(() => createTicks(bounds.value.x, 5).map((value) => ({
  value,
  label: formatTick(value),
  x: toX(value)
})));

const yTicks = computed(() => createTicks(bounds.value.y, 4).map((value) => ({
  value,
  label: formatTick(value),
  y: toY(value)
})));

const powerTicks = computed(() => createTicks(bounds.value.power, 4).map((value) => ({
  value,
  label: formatTick(value),
  y: toPowerY(value)
})));

const sweepPath = computed(() => {
  if (!props.sweepData || props.sweepData.length < 2) return '';

  return pointsToPath(
    [...props.sweepData]
      .sort((a, b) => a.v - b.v)
      .map((point) => ({ x: toX(point.v), y: toY(point.i) }))
  );
});

const powerPath = computed(() => {
  if (!props.sweepData || props.sweepData.length < 2) return '';

  return pointsToPath(
    [...props.sweepData]
      .sort((a, b) => a.v - b.v)
      .map((point) => ({ x: toX(point.v), y: toPowerY(toPowerWatts(point)) }))
  );
});

const historyPath = computed(() => {
  if (history.value.length < 2) return '';
  return pointsToPath(history.value.map((point) => ({ x: toX(point.v), y: toY(point.i) })));
});

const powerHistoryPath = computed(() => {
  if (history.value.length < 2) return '';
  return pointsToPath(history.value.map((point) => ({
    x: toX(point.v),
    y: toPowerY(point.p)
  })));
});

const livePoint = computed(() => ({
  x: toX(props.voltage || 0),
  y: toY(props.current || 0)
}));

const livePowerPoint = computed(() => {
  const voltage = Number(props.voltage) || 0;
  const current = Number(props.current) || 0;
  const powerWatts = voltage * current;

  if (powerWatts <= 0) return null;

  return {
    x: toX(voltage),
    y: toPowerY(powerWatts)
  };
});

function toX(value) {
  const clamped = clamp(Number(value) || 0, 0, bounds.value.x);
  return plot.x + (clamped / bounds.value.x) * plot.width;
}

function toY(value) {
  const clamped = clamp(Number(value) || 0, 0, bounds.value.y);
  return plot.bottom - (clamped / bounds.value.y) * plot.height;
}

function toPowerY(value) {
  const clamped = clamp(Number(value) || 0, 0, bounds.value.power);
  return plot.bottom - (clamped / bounds.value.power) * plot.height;
}

function pointsToPath(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

function createTicks(max, count) {
  return Array.from({ length: count + 1 }, (_, index) => (max / count) * index);
}

function niceMax(value, fallback) {
  if (!Number.isFinite(value) || value <= 0) return fallback;

  const exponent = Math.floor(Math.log10(value));
  const scale = Math.pow(10, exponent);
  const fraction = value / scale;
  const niceFractions = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 10];
  const niceFraction =
    niceFractions.find((candidate) => fraction <= candidate) ?? 10;

  return niceFraction * scale;
}

function formatTick(value) {
  const absoluteValue = Math.abs(value);
  if (absoluteValue >= 10 || value === 0) return value.toFixed(0);
  if (absoluteValue >= 1) return value.toFixed(1);
  return value.toFixed(2);
}

function toPowerWatts(point) {
  const explicitPower = Number(point?.p);
  if (Number.isFinite(explicitPower)) return explicitPower;

  return (Number(point?.v) || 0) * (Number(point?.i) || 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

watch(
  [() => props.voltage, () => props.current],
  ([v, i]) => {
    const voltage = Number(v) || 0;
    const current = Number(i) || 0;
    const power = voltage * current;
    history.value.push({ v: voltage, i: current, p: power });
    recordMaxSeen(voltage, current, power);

    if (history.value.length > MAX_HISTORY) {
      history.value.shift();
    }
  },
  { immediate: true }
);

watch(
  () => props.sweepData,
  (sweepData) => {
    if (!Array.isArray(sweepData)) return;

    for (const point of sweepData) {
      const voltage = Number(point?.v) || 0;
      const current = Number(point?.i) || 0;
      recordMaxSeen(voltage, current, toPowerWatts(point));
    }
  },
  { immediate: true, deep: true }
);

function recordMaxSeen(voltage, current, power) {
  maxSeen.value = {
    voltage: Math.max(maxSeen.value.voltage, voltage),
    current: Math.max(maxSeen.value.current, current),
    power: Math.max(maxSeen.value.power, power)
  };
}
</script>

<style scoped>
.graph-card {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  gap: 0;
  padding: 0;
  border: 1px solid #d7e0df;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 10px 28px rgba(35, 54, 65, 0.08);
  overflow: hidden;
}

.graph-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 18px 14px;
  border-bottom: 1px solid #edf1f0;
  background: #ffffff;
}

.graph-kicker {
  margin: 0 0 3px;
  color: #3d7f68;
  font-size: 0.72rem;
  font-weight: 850;
  text-transform: uppercase;
}

h3 {
  margin: 0;
  color: #17212b;
  font-size: 1.15rem;
  line-height: 1.1;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px 12px;
  color: #586574;
  font-size: 0.8rem;
  font-weight: 750;
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #1f9d72;
}

.line {
  width: 18px;
  height: 0;
  border-top: 2px dashed #7d8b96;
}

.line.power {
  border-top-color: #d14b3f;
  border-top-style: dashed;
}

.graph-frame {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
  margin: 10px;
  border: 1px solid #e2e9e7;
  border-radius: 8px;
  background: #fbfdfc;
  overflow: hidden;
}

.chart-svg {
  display: block;
  width: 100%;
  height: 100%;
}

.plot-bg {
  fill: #ffffff;
  stroke: #dce5e3;
}

.grid line {
  stroke: #edf2f0;
  stroke-width: 1;
}

.tick-label {
  fill: #697783;
  font-size: 13px;
  font-weight: 700;
}

.axis-line {
  fill: none;
  stroke: #8997a1;
  stroke-width: 1.4;
}

.power-axis-line {
  fill: none;
  stroke: #d2aaa4;
  stroke-width: 1.4;
}

.axis-title {
  fill: #40505f;
  font-size: 14px;
  font-weight: 850;
}

.power-label,
.power-title {
  fill: #a15043;
}

.sweep-path {
  fill: none;
  stroke: #82909a;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 8 8;
}

.power-path {
  fill: none;
  stroke: #d14b3f;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 8 8;
}

.history-path {
  fill: none;
  stroke: #6fc39f;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.62;
}

.power-history-path {
  fill: none;
  stroke: #d14b3f;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.5;
}

.live-halo {
  fill: rgba(31, 157, 114, 0.15);
}

.live-dot {
  fill: #1f9d72;
}

.live-center {
  fill: #ffffff;
}

.live-power-halo {
  fill: rgba(209, 75, 63, 0.16);
}

.live-power-dot {
  fill: #d14b3f;
  stroke: #ffffff;
  stroke-width: 2;
}

@media (max-width: 680px) {
  .graph-header {
    flex-direction: column;
    padding: 14px;
  }

  .legend {
    justify-content: flex-start;
  }

}
</style>
