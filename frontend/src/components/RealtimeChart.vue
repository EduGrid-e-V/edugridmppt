<template>
  <section class="graph-card">
    <header class="graph-header">
      <div>
        <p class="graph-kicker">{{ t('Live response') }}</p>
        <h3>{{ title }}</h3>
      </div>
      <div class="readout">
        <span class="readout-dot" :style="{ background: color }"></span>
        {{ liveLabel }} W
      </div>
    </header>

    <div ref="frameElement" class="graph-frame">
      <svg class="chart-svg" :viewBox="`0 0 640 ${chartHeight}`" preserveAspectRatio="xMidYMid meet" role="img" :aria-label="t('Power over time chart')">
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

        <path class="axis-line" :d="`M ${plot.x} ${plot.y} V ${plot.bottom} H ${plot.right}`" />
        <path v-if="areaPath" class="area-path" :d="areaPath" :style="{ fill: areaColor }" />
        <path v-if="linePath" class="line-path" :d="linePath" :style="{ stroke: color }" />

        <g v-if="latestPoint" class="latest-point" :transform="`translate(${latestPoint.x} ${latestPoint.y})`">
          <circle class="latest-halo" r="13" :style="{ fill: haloColor }" />
          <circle r="5" :style="{ fill: color }" />
        </g>

        <text class="axis-title x-title" x="342" :y="chartHeight - 12" text-anchor="middle">{{ t('Time (s)') }}</text>
        <text class="axis-title y-title" :transform="`translate(18 ${(plot.y + plot.bottom) / 2}) rotate(-90)`" text-anchor="middle">
          {{ t('Power (W)') }}
        </text>
      </svg>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { t } from '../i18n.js';
import { MIN_POWER_AXIS_W, POWER_TICK_STEP_W, REAL_MIN_POWER_AXIS_W, REAL_POWER_TICK_STEP_W, formatPowerTick, powerAxisMaximum } from './chartAxes.js';

const props = defineProps({
  data: { type: Array, default: () => [[], []] },
  title: { type: String, default: 'Power Over Time' },
  color: { type: String, default: '#d14b3f' },
  min: Number,
  max: Number,
  realHardware: { type: Boolean, default: false }
});

const frameElement = ref(null);
const chartHeight = ref(450);
const maximumSeenW = ref(0);
const powerTickStepW = computed(() => props.realHardware ? REAL_POWER_TICK_STEP_W : POWER_TICK_STEP_W);
const minimumPowerAxisW = computed(() => props.realHardware ? REAL_MIN_POWER_AXIS_W : MIN_POWER_AXIS_W);
const plot = reactive({
  x: 82,
  y: 18,
  width: 520,
  height: 367,
  right: 602,
  bottom: 385
});
let frameObserver;

onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !frameElement.value) return;
  frameObserver = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    if (width <= 0 || height <= 0) return;
    const nextHeight = Math.max(450, Math.round(640 * height / width));
    if (nextHeight === chartHeight.value) return;
    chartHeight.value = nextHeight;
    plot.bottom = nextHeight - 65;
    plot.height = plot.bottom - plot.y;
  });
  frameObserver.observe(frameElement.value);
});

onUnmounted(() => frameObserver?.disconnect());

watch(() => props.data, (data) => {
  const values = data?.[1] || [];
  if (!values.length) {
    maximumSeenW.value = 0;
    return;
  }
  const highest = Math.max(...values.map((value) => Number(value) || 0));
  maximumSeenW.value = Math.max(maximumSeenW.value, highest);
}, { immediate: true });

const points = computed(() => {
  const times = props.data?.[0] || [];
  const values = props.data?.[1] || [];
  return times.map((time, index) => ({
    time: Number(time) || 0,
    value: Number(values[index]) || 0
  }));
});

const liveValue = computed(() => {
  if (!points.value.length) return null;
  return points.value[points.value.length - 1].value;
});
const liveLabel = computed(() => {
  if (props.realHardware && liveValue.value === null) return '--';
  return (liveValue.value ?? 0).toFixed(props.realHardware ? 2 : 1);
});

const ranges = computed(() => {
  const visible = visiblePoints.value;
  const xMin = visible[0]?.time || 0;
  const xMax = Math.max(xMin + 10, visible[visible.length - 1]?.time || 10);
  return {
    xMin,
    xMax,
    yMin: Math.min(0, props.min ?? 0),
    yMax: powerAxisMaximum(maximumSeenW.value, props.max ?? minimumPowerAxisW.value, powerTickStepW.value)
  };
});

const visiblePoints = computed(() => {
  const allPoints = points.value;
  if (allPoints.length <= 180) return allPoints;
  return allPoints.slice(-180);
});

const xTicks = computed(() => {
  const { xMin, xMax } = ranges.value;
  return createTicks(xMin, xMax, 5).map((value) => ({
    value,
    label: `${Math.round(value)}s`,
    x: toX(value)
  }));
});

const yTicks = computed(() => {
  const { yMin, yMax } = ranges.value;
  return createTicks(yMin, yMax, Math.round((yMax - yMin) / powerTickStepW.value)).map((value) => ({
    value,
    label: formatPowerTick(value, powerTickStepW.value),
    y: toY(value)
  }));
});

const linePath = computed(() => pointsToPath(chartPoints.value));

const areaPath = computed(() => {
  if (chartPoints.value.length < 2) return '';
  const first = chartPoints.value[0];
  const last = chartPoints.value[chartPoints.value.length - 1];
  return `${linePath.value} L ${last.x.toFixed(1)} ${plot.bottom} L ${first.x.toFixed(1)} ${plot.bottom} Z`;
});

const latestPoint = computed(() => {
  if (!chartPoints.value.length) return null;
  return chartPoints.value[chartPoints.value.length - 1];
});

const chartPoints = computed(() => visiblePoints.value.map((point) => ({
  x: toX(point.time),
  y: toY(point.value)
})));

const areaColor = computed(() => hexToRgba(props.color, 0.12));
const haloColor = computed(() => hexToRgba(props.color, 0.18));

function toX(value) {
  const { xMin, xMax } = ranges.value;
  const span = Math.max(1, xMax - xMin);
  return plot.x + ((Number(value) - xMin) / span) * plot.width;
}

function toY(value) {
  const { yMin, yMax } = ranges.value;
  const span = yMax - yMin;
  const clamped = Math.min(yMax, Math.max(yMin, Number(value) || 0));
  return plot.bottom - ((clamped - yMin) / span) * plot.height;
}

function pointsToPath(mappedPoints) {
  if (mappedPoints.length < 2) return '';
  return mappedPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

function createTicks(min, max, count) {
  const span = max - min;
  return Array.from({ length: count + 1 }, (_, index) => min + (span / count) * index);
}

function hexToRgba(hex, alpha) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return `rgba(209, 75, 63, ${alpha})`;

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
</script>

<style scoped>
.graph-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
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
  color: #a15043;
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

.readout {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 4px 10px;
  border: 1px solid #e2e9e7;
  border-radius: 999px;
  color: #17212b;
  background: #fbfdfc;
  font-size: 0.9rem;
  font-weight: 850;
  white-space: nowrap;
}

.readout-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
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

.axis-title {
  fill: #40505f;
  font-size: 14px;
  font-weight: 850;
}

.area-path {
  stroke: none;
}

.line-path {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (max-width: 680px) {
  .graph-header {
    flex-direction: column;
    padding: 14px;
  }
}
</style>
