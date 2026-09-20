<script setup>
defineProps({ sunPosition: Number, cloudCover: Number, disabledSun: Boolean, disabledCloud: Boolean })
const emit = defineEmits(['update:sunPosition', 'update:cloudCover'])
</script>
<template><section class="sun-controls" aria-label="Sun and cloud controls">
  <svg viewBox="0 0 240 70" role="img" aria-label="Sun position and cloud cover illustration"><path d="M10 60 Q120 0 230 60"/><circle :cx="10 + 220 * sunPosition" :cy="60 - 48 * Math.sin(Math.PI * sunPosition)" r="8"/><g :opacity="0.2 + cloudCover * 0.8"><ellipse cx="120" cy="24" rx="30" ry="12"/></g></svg>
  <label class="control">Sun position<input aria-label="Sun position" type="range" min="0" max="1" step="0.01" :value="sunPosition" :disabled="disabledSun" :aria-disabled="String(disabledSun)" @input="emit('update:sunPosition', Number($event.target.value))"></label>
  <label class="control">Cloud cover<input aria-label="Cloud cover" type="range" min="0" max="1" step="0.01" :value="cloudCover" :disabled="disabledCloud" :aria-disabled="String(disabledCloud)" @input="emit('update:cloudCover', Number($event.target.value))"></label>
</section></template>
<style scoped>svg { width: 100%; max-height: 90px; } path { fill: none; stroke: var(--ink-muted); } circle { fill: var(--accent-warn); } ellipse { fill: var(--ink-muted); }</style>
