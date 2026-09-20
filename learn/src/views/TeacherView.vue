<script setup>
const copy = { // i18n
  eyebrow: 'Teaching support',
  title: 'Teacher view',
  body: 'Answers, timings, equipment lists, and printable lesson material will be collected here.',
}
</script>

<template>
  <section class="page-card">
    <p class="page-eyebrow">{{ copy.eyebrow }}</p>
    <h1>{{ copy.title }}</h1>
    <p>{{ copy.body }}</p>
  </section>
</template>
