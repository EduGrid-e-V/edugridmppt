<script setup>
import { computed } from 'vue'
const props = defineProps({ modelValue: Number, loadOhm: Number, eta: { type: Number, default: 0.85 }, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
const rEff = computed(() => props.eta * props.loadOhm / Math.max(0.02, props.modelValue) ** 2)
function fineStep(event) {
  if (!['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(event.key)) return
  event.preventDefault()
  const direction = ['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : -1
  emit('update:modelValue', Math.max(0.02, Math.min(0.98, props.modelValue + direction * 0.005)))
}
</script>
<template>
  <label class="control"><span>Duty cycle <output>{{ (modelValue * 100).toFixed(1) }}%</output></span>
    <input aria-label="Duty cycle" type="range" min="0.02" max="0.98" step="0.01" :value="modelValue"
      :disabled="disabled" :aria-disabled="String(disabled)" @input="emit('update:modelValue', Number($event.target.value))" @keydown="fineStep">
    <small>Panel sees {{ rEff.toFixed(1) }} Ω</small>
  </label>
</template>
