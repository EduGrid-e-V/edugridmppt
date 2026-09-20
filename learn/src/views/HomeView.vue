<script setup>
const copy = { // i18n
  eyebrow: 'Learn photovoltaics by experimenting',
  title: 'From sunlight to maximum power',
  body: 'Explore a solar panel, compare real measurements with a simulation, and discover how an MPPT controller finds the best operating point.',
}
</script>

<template>
  <section class="page-card">
    <p class="page-eyebrow">{{ copy.eyebrow }}</p>
    <h1>{{ copy.title }}</h1>
    <p>{{ copy.body }}</p>
  </section>
</template>
