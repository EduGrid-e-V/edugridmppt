<script setup>
import { presets } from '@edugrid/pv-sim'
defineProps({ modelValue: String, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
</script>
<template><label class="control">Panel preset
  <select aria-label="Panel preset" :value="modelValue" :disabled="disabled" :aria-disabled="String(disabled)" @change="emit('update:modelValue', $event.target.value)">
    <option v-for="preset in presets" :key="preset.id" :value="preset.id">{{ preset.id }}</option>
  </select>
</label></template>
