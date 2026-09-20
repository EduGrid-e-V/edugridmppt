<script setup>
const copy = { // i18n
  eyebrow: 'Open exploration',
  title: 'PV playground',
  body: 'The complete panel and MPPT simulator will be available here for experiments outside a lesson.',
}
</script>

<template>
  <section class="page-card">
    <p class="page-eyebrow">{{ copy.eyebrow }}</p>
    <h1>{{ copy.title }}</h1>
    <p>{{ copy.body }}</p>
  </section>
</template>
