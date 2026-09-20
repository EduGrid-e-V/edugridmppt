<script setup>
import { scenarios } from '@edugrid/pv-sim'
defineProps({ modelValue: String, playing: Boolean, timeS: Number, durationS: { type: Number, default: 120 }, disabled: Boolean })
const emit = defineEmits(['update:modelValue', 'update:playing', 'scrub'])
</script>
<template><section class="scenario-player" aria-label="Scenario player">
  <label class="control">Weather scenario<select aria-label="Weather scenario" :value="modelValue" :disabled="disabled" :aria-disabled="String(disabled)" @change="emit('update:modelValue', $event.target.value)"><option v-for="scenario in scenarios" :key="scenario.id" :value="scenario.id">{{ scenario.id }}</option></select></label>
  <button type="button" :disabled="disabled" :aria-disabled="String(disabled)" @click="emit('update:playing', !playing)">{{ playing ? 'Pause scenario' : 'Play scenario' }}</button>
  <label class="control">Scenario time<input aria-label="Scenario time" type="range" min="0" :max="durationS" step="0.1" :value="timeS" :disabled="disabled" :aria-disabled="String(disabled)" @input="emit('scrub', Number($event.target.value))"></label>
</section></template>
