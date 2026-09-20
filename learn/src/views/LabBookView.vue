<script setup>
const copy = { // i18n
  eyebrow: 'Your measurements',
  title: 'Lab book',
  body: 'Saved sweeps, readings, answers, and notes will appear here and remain on this device.',
}
</script>

<template>
  <section class="page-card">
    <p class="page-eyebrow">{{ copy.eyebrow }}</p>
    <h1>{{ copy.title }}</h1>
    <p>{{ copy.body }}</p>
  </section>
</template>
