<script setup>
import { ref } from 'vue'
import SimPanel from '../components/sim/SimPanel.vue'

const simulator = ref(null)
const recorded = ref(false)

function recordToLabBook() {
  const frame = simulator.value?.store.frame
  if (!frame) return
  const key = 'edugrid-lab-book'
  const existing = JSON.parse(localStorage.getItem(key) || '[]')
  existing.push({ type: 'reading', recordedAt: new Date().toISOString(), frame })
  localStorage.setItem(key, JSON.stringify(existing))
  recorded.value = true
}
</script>

<template>
  <section class="playground-view">
    <header class="playground-header">
      <div><p class="page-eyebrow">Open exploration</p><h1>PV playground</h1>
        <p>Change the panel, weather, load, and tracking algorithm. Every control is unlocked.</p></div>
      <button type="button" @click="recordToLabBook">Record current reading to lab book</button>
      <span class="record-status" aria-live="polite">{{ recorded ? 'Reading recorded.' : '' }}</span>
    </header>
    <SimPanel ref="simulator" preset="edugrid-kit" mode="MANUAL" algo="PNO" :duty="0.02"
      :irradiance="800" :ambient-c="25" :load-ohm="50" :lock="[]" :step-mode="true"
      :show="['readout', 'controls', 'ivChart', 'powerChart', 'sweepButton']" />
  </section>
</template>

<style scoped>
.playground-view { display: grid; gap: var(--space-5); }
.playground-header { display: grid; grid-template-columns: 1fr auto; gap: var(--space-3); align-items: center; }
.playground-header h1, .playground-header p { margin: 0; }
.playground-header > div > p:last-child { margin-top: var(--space-2); color: var(--ink-muted); }
.playground-header button { min-height: 44px; padding: var(--space-2) var(--space-4); border: 1px solid var(--accent); border-radius: var(--radius-md); color: var(--surface); background: var(--accent); font-weight: 800; }
.record-status { grid-column: 1 / -1; min-height: 1.5em; color: var(--accent); }
@media (max-width: 700px) { .playground-header { grid-template-columns: 1fr; } }
</style>
