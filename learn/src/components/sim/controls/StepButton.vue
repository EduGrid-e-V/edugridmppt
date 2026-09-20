<script setup>defineProps({ disabled: Boolean }); defineEmits(['step'])</script>
<template><button type="button" :disabled="disabled" :aria-disabled="String(disabled)" @click="$emit('step')">Advance one MPPT step</button></template>
