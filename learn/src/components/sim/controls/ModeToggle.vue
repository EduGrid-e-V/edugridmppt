<script setup>
defineProps({ modelValue: String, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
</script>
<template><fieldset class="control" :disabled="disabled" :aria-disabled="String(disabled)"><legend>Operating mode</legend>
  <label><input type="radio" value="MANUAL" :checked="modelValue === 'MANUAL'" @change="emit('update:modelValue', 'MANUAL')"> Manual</label>
  <label><input type="radio" value="AUTO" :checked="modelValue === 'AUTO'" @change="emit('update:modelValue', 'AUTO')"> Auto MPPT</label>
</fieldset></template>
