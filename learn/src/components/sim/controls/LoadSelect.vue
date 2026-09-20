<script setup>
defineProps({ modelValue: Number, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
</script>
<template><label class="control">Load resistance
  <span class="load-row"><select aria-label="Common load resistance" :value="modelValue" :disabled="disabled" :aria-disabled="String(disabled)" @change="emit('update:modelValue', Number($event.target.value))">
    <option :value="10">10 Ω</option><option :value="50">50 Ω</option><option :value="100">100 Ω</option><option :value="470">470 Ω</option>
  </select><input aria-label="Custom load resistance in ohms" type="number" min="1" step="1" :value="modelValue" :disabled="disabled" :aria-disabled="String(disabled)" @change="emit('update:modelValue', Number($event.target.value))"></span>
</label></template>
