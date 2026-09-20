<script setup>
defineProps({ modelValue: String, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
</script>
<template><label class="control">Tracking algorithm
  <select aria-label="Tracking algorithm" :value="modelValue" :disabled="disabled" :aria-disabled="String(disabled)" @change="emit('update:modelValue', $event.target.value)">
    <option value="PNO">Perturb &amp; Observe</option><option value="INCCOND">Incremental Conductance</option><option value="FIXED">Fixed PWM</option>
  </select>
</label></template>
