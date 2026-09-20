<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createPinia, storeToRefs } from 'pinia'
import { effectiveResistance, panel, scale, scenarios } from '@edugrid/pv-sim'
import { useSimulatorStore } from '../../stores/simulator.js'
import IVChart from './IVChart.vue'
import PowerChart from './PowerChart.vue'
import DutySlider from './controls/DutySlider.vue'
import ModeToggle from './controls/ModeToggle.vue'
import AlgoSelect from './controls/AlgoSelect.vue'
import PresetSelect from './controls/PresetSelect.vue'
import LoadSelect from './controls/LoadSelect.vue'
import SunControls from './controls/SunControls.vue'
import ScenarioPlayer from './controls/ScenarioPlayer.vue'
import StepButton from './controls/StepButton.vue'
import './controls/controls.css'

const props = defineProps({
  preset: { type: String, default: 'edugrid-kit' },
  mode: { type: String, default: 'MANUAL' },
  algo: { type: String, default: 'PNO' },
  duty: { type: Number, default: 0.02 },
  irradiance: { type: Number, default: 800 },
  ambientC: { type: Number, default: 25 },
  loadOhm: { type: Number, default: 50 },
  show: { type: Array, default: () => ['readout', 'ivChart', 'powerChart', 'controls'] },
  lock: { type: Array, default: () => [] },
  stepMode: { type: Boolean, default: false },
})
const emit = defineEmits(['ready', 'frame', 'sweepComplete', 'userChanged'])

const pinia = createPinia()
const store = useSimulatorStore(pinia)
const { frame, presetData, history, locked } = storeToRefs(store)
const sunPosition = ref(0.5)
const cloudCover = ref(0)
const scenarioId = ref(scenarios[0].id)
const scenarioPlaying = ref(false)
const sweepCurve = ref([])

store.setPreset(props.preset)
store.setMode(props.mode)
store.setAlgorithm(props.algo)
store.setDuty(props.duty)
store.setIrradiance(props.irradiance)
store.setAmbient(props.ambientC)
store.setLoad(props.loadOhm)
store.setLocked(props.lock)

const has = (id) => props.show.includes(id) || props.show.includes('controls')
const isLocked = (id) => locked.value.includes(id)
const scaledPanel = computed(() => frame.value
  ? scale(presetData.value, { G: frame.value.G, tCell: frame.value.tCell })
  : presetData.value)
const curve = computed(() => sweepCurve.value.length ? sweepCurve.value : panel.curve(scaledPanel.value))
const rEff = computed(() => effectiveResistance({ loadOhm: store.loadOhm, duty: store.duty, eta: 0.85 }))
const scenarioDuration = computed(() => scenarios.find(({ id }) => id === scenarioId.value)?.durationS ?? 120)

function changed(control, value, action) {
  action(value)
  emit('userChanged', { control, value })
}
function setSun(value) { sunPosition.value = value; changed('sunPosition', value, store.setSunPosition) }
function setCloud(value) { cloudCover.value = value; changed('cloudCover', value, store.setCloudCover) }
function setScenario(value) { scenarioId.value = value; store.loadScenario(value); emit('userChanged', { control: 'scenario', value }) }
function setScenarioPlaying(value) { scenarioPlaying.value = value; value ? store.start() : store.pause() }
function runSweep() { sweepCurve.value = store.sweep(); emit('sweepComplete', sweepCurve.value) }

watch(frame, (value) => { if (value) emit('frame', value) })
watch(() => props.lock, (value) => store.setLocked(value))

onMounted(() => { store.start(); emit('ready', store) })
onBeforeUnmount(() => store.pause())
defineExpose({ store })
</script>

<template>
  <section class="sim-panel" aria-label="Photovoltaic simulator">
    <div v-if="has('readout')" class="sim-readout" aria-label="Simulation readout">
      <strong>{{ presetData.id }}</strong><span>{{ frame?.v.toFixed(2) ?? '—' }} V</span><span>{{ frame?.i.toFixed(3) ?? '—' }} A</span><span>{{ frame?.p.toFixed(2) ?? '—' }} W</span>
      <small>{{ presetData.source }}</small>
    </div>

    <div v-if="has('controls') || show.some((id) => id.endsWith('Select') || id.endsWith('Slider'))" class="sim-controls">
      <PresetSelect v-if="has('presetSelect')" :model-value="store.preset" :disabled="isLocked('preset')" @update:model-value="changed('preset', $event, store.setPreset)" />
      <ModeToggle v-if="has('modeToggle')" :model-value="store.mode" :disabled="isLocked('mode')" @update:model-value="changed('mode', $event, store.setMode)" />
      <AlgoSelect v-if="has('algoSelect')" :model-value="store.algo" :disabled="isLocked('algo')" @update:model-value="changed('algo', $event, store.setAlgorithm)" />
      <DutySlider v-if="has('dutySlider')" :model-value="store.duty" :load-ohm="store.loadOhm" :disabled="isLocked('duty')" @update:model-value="changed('duty', $event, store.setDuty)" />
      <LoadSelect v-if="has('loadSelect')" :model-value="store.loadOhm" :disabled="isLocked('load')" @update:model-value="changed('load', $event, store.setLoad)" />
      <SunControls v-if="has('sunControls')" :sun-position="sunPosition" :cloud-cover="cloudCover" :disabled-sun="isLocked('sunPosition')" :disabled-cloud="isLocked('cloudCover')" @update:sun-position="setSun" @update:cloud-cover="setCloud" />
      <ScenarioPlayer v-if="has('scenarioPlayer')" :model-value="scenarioId" :playing="scenarioPlaying" :time-s="store.engine.getState().scenarioTimeS" :duration-s="scenarioDuration" :disabled="isLocked('scenario')" @update:model-value="setScenario" @update:playing="setScenarioPlaying" @scrub="store.seekScenario" />
      <StepButton v-if="stepMode" :disabled="store.mode !== 'AUTO'" @step="store.step" />
      <button v-if="has('sweepButton')" type="button" @click="runSweep">Run sweep</button>
    </div>

    <IVChart v-if="has('ivChart')" :curve="curve" :frame="frame" :preset="presetData" :r-eff="rEff" />
    <PowerChart v-if="has('powerChart')" :history="history" />
  </section>
</template>

<style scoped>
.sim-panel { display: grid; gap: var(--space-4); color: var(--ink); }
.sim-readout { display: grid; grid-template-columns: repeat(4, auto); gap: var(--space-3); align-items: baseline; padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
.sim-readout small { grid-column: 1 / -1; color: var(--ink-muted); }
.sim-controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--space-3); padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface-muted); }
@media (max-width: 600px) { .sim-readout { grid-template-columns: repeat(2, 1fr); } }
</style>
