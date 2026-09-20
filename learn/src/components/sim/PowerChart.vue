<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { stickyPowerMaximum, visiblePowerHistory } from './powerHistory.js'

const props = defineProps({ history: { type: Array, default: () => [] } })
const host = ref(null)
let plot = null
let stickyMaximumW = 1

function chartData() {
  const visible = visiblePowerHistory(props.history)
  stickyMaximumW = stickyPowerMaximum(stickyMaximumW, visible)
  return [visible.map(({ t }) => t), visible.map(({ p }) => p)]
}

onMounted(() => {
  plot = new uPlot({
    width: host.value?.clientWidth || 640,
    height: 300,
    scales: { y: { range: () => [0, stickyMaximumW] } },
    axes: [{ label: 'Time (s)' }, { label: 'Power (W)' }],
    series: [
      {},
      { label: 'Panel power', stroke: getComputedStyle(document.documentElement).getPropertyValue('--trace-power').trim() || 'red', width: 2 },
    ],
  }, chartData(), host.value)
})

watch(() => props.history, () => plot?.setData(chartData()), { deep: true })
onBeforeUnmount(() => plot?.destroy())
</script>

<template>
  <section class="power-chart" aria-label="Panel power over the last 30 seconds">
    <header>
      <div><p>Live response</p><h3>Power over time</h3></div>
      <output>{{ history.length ? history.at(-1).p.toFixed(2) : '0.00' }} W</output>
    </header>
    <div ref="host" class="plot-host" />
  </section>
</template>

<style scoped>
.power-chart { padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
header { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }
header p { margin: 0; color: var(--trace-power); font-size: var(--text-xs); font-weight: 800; text-transform: uppercase; }
h3 { margin: 0; }
output { color: var(--ink); font-weight: 800; }
.plot-host { width: 100%; min-height: 300px; }
</style>
