<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { axisMaximum } from './chartMath.js'

const props = defineProps({
  curve: { type: Array, default: () => [] },
  frame: { type: Object, default: null },
  preset: { type: Object, required: true },
  rEff: { type: Number, required: true },
  referenceCurve: { type: Array, default: () => [] },
  mppMarker: { type: Boolean, default: true },
  loadLine: { type: Boolean, default: true },
  reference: { type: Boolean, default: false },
})

const host = ref(null)
const showMpp = ref(props.mppMarker)
const showLoadLine = ref(props.loadLine)
const showReference = ref(props.reference)
let plot = null
let previousSignature = ''

const voltageMax = computed(() => axisMaximum(props.preset.voc))
const currentMax = computed(() => axisMaximum(props.preset.isc))
const powerMax = computed(() => axisMaximum(props.preset.vmpp * props.preset.impp))

const data = computed(() => {
  const points = [...props.curve]
  if (props.frame) points.push({ v: props.frame.v, i: props.frame.i, p: props.frame.p, live: true })
  if (showMpp.value) points.push({ v: props.preset.vmpp, i: props.preset.impp, p: props.preset.vmpp * props.preset.impp, mpp: true })
  points.sort((left, right) => left.v - right.v)
  const x = points.map(({ v }) => v)
  const current = points.map(({ i }) => i)
  const power = points.map(({ p }) => p)
  const liveCurrent = points.map((point) => point.live ? point.i : null)
  const livePower = points.map((point) => point.live ? point.p : null)
  const loadCurrent = points.map(({ v }) => showLoadLine.value ? v / props.rEff : null)
  const mppCurrent = points.map((point) => point.mpp ? point.i : null)
  const reference = points.map(({ v }) => {
    if (!showReference.value || props.referenceCurve.length === 0) return null
    return props.referenceCurve.reduce((closest, point) => (
      Math.abs(point.v - v) < Math.abs(closest.v - v) ? point : closest
    )).i
  })
  return [x, current, power, liveCurrent, livePower, loadCurrent, mppCurrent, reference]
})

function colour(token, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback
}

function options() {
  return {
    width: host.value?.clientWidth || 640,
    height: 360,
    scales: {
      x: { range: [0, voltageMax.value] },
      current: { range: [0, currentMax.value] },
      power: { range: [0, powerMax.value] },
    },
    axes: [
      { label: 'Panel voltage (V)' },
      { scale: 'current', label: 'Current (A)' },
      { scale: 'power', side: 1, label: 'Power (W)' },
    ],
    series: [
      {},
      { label: 'Current', scale: 'current', stroke: colour('--trace-current', 'gray'), dash: [8, 6] },
      { label: 'Power', scale: 'power', stroke: colour('--trace-power', 'red'), dash: [8, 6] },
      { label: 'Live current', scale: 'current', stroke: colour('--trace-live', 'green'), points: { show: true, size: 10 }, paths: () => null },
      { label: 'Live power', scale: 'power', stroke: colour('--trace-live', 'green'), points: { show: true, size: 10 }, paths: () => null },
      { label: 'Load line', scale: 'current', stroke: colour('--ink-muted', 'gray'), width: 1 },
      { label: 'MPP', scale: 'current', stroke: colour('--accent-warn', 'orange'), points: { show: true, size: 9 }, paths: () => null },
      { label: 'Reference', scale: 'current', stroke: colour('--accent-warn', 'orange'), dash: [3, 4] },
    ],
  }
}

function updatePlot() {
  const signature = JSON.stringify(data.value)
  if (signature === previousSignature) return
  previousSignature = signature
  plot?.setData(data.value)
}

onMounted(() => {
  previousSignature = JSON.stringify(data.value)
  plot = new uPlot(options(), data.value, host.value)
})

watch(data, updatePlot)
onBeforeUnmount(() => plot?.destroy())
</script>

<template>
  <section class="iv-chart" aria-label="Panel current-voltage chart">
    <header>
      <h3>I–V and power curve</h3>
      <div class="overlay-controls" aria-label="Chart overlays">
        <label><input v-model="showMpp" type="checkbox"> MPP</label>
        <label><input v-model="showLoadLine" type="checkbox"> Load line</label>
        <label><input v-model="showReference" type="checkbox"> Reference</label>
      </div>
    </header>
    <div ref="host" class="plot-host" />
    <p v-if="showMpp" class="mpp-readout">
      Datasheet MPP: {{ preset.vmpp.toFixed(2) }} V · {{ preset.impp.toFixed(3) }} A
    </p>
  </section>
</template>

<style scoped>
.iv-chart { padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
header { display: flex; justify-content: space-between; gap: var(--space-3); align-items: center; }
h3, .mpp-readout { margin: 0; }
.overlay-controls { display: flex; flex-wrap: wrap; gap: var(--space-3); color: var(--ink-muted); }
.overlay-controls label { display: inline-flex; gap: var(--space-1); align-items: center; }
.plot-host { width: 100%; min-height: 360px; }
.mpp-readout { color: var(--ink-muted); font-size: var(--text-sm); }
</style>
