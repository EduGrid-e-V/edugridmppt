<script setup>
const copy = { // i18n
  eyebrow: 'Guided module',
  title: 'Module content',
  body: 'Experiments, observations, explanations, challenges, and individual tasks will appear here.',
}
</script>

<template>
  <section class="page-card">
    <p class="page-eyebrow">{{ copy.eyebrow }}</p>
    <h1>{{ copy.title }}</h1>
    <p>{{ copy.body }}</p>
  </section>
</template>
