<script setup>
import { ref } from 'vue'

const language = ref('DE')
const copy = { // i18n
  brandLabel: 'EduGrid PV Learning', brandTitle: 'EduGrid', brandSubtitle: 'PV Learning Lab',
  home: 'Home', playground: 'Playground', labBook: 'Lab book', teacher: 'Teacher',
  languageLabel: 'Language', teacherLabel: 'Open teacher view',
  footer: 'Open educational material from EduGrid e.V.', licence: 'CC BY-SA 4.0',
}
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <RouterLink class="brand-lockup" to="/" :aria-label="copy.brandLabel">
        <svg class="brand-mark" viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="36" r="27" />
          <path d="M40 8v14M13 36H3M77 36H67M21 16l-8-8M59 16l8-8M20 56l-8 8M60 56l8 8" />
          <path d="M40 36v28M40 36l-23 13M40 36l23 13" />
          <path d="M25 55h30l6 17H19l6-17Z" />
          <path d="M29 55l-3 17M40 55v17M51 55l3 17M22 64h36" />
          <circle cx="40" cy="36" r="3" />
        </svg>
        <span>
          <strong class="brand-title">{{ copy.brandTitle }}</strong>
          <span class="brand-subtitle">{{ copy.brandSubtitle }}</span>
        </span>
      </RouterLink>

      <nav class="primary-nav" :aria-label="copy.brandLabel">
        <RouterLink to="/">{{ copy.home }}</RouterLink>
        <RouterLink to="/play">{{ copy.playground }}</RouterLink>
        <RouterLink to="/lab">{{ copy.labBook }}</RouterLink>
      </nav>

      <div class="header-actions">
        <div class="language-switch" role="group" :aria-label="copy.languageLabel">
          <button v-for="option in ['DE', 'EN']" :key="option" type="button"
            :class="{ active: language === option }" :aria-pressed="language === option"
            @click="language = option">{{ option }}</button>
        </div>
        <RouterLink class="teacher-link" to="/teacher" :aria-label="copy.teacherLabel">
          {{ copy.teacher }}
        </RouterLink>
      </div>
    </header>

    <main class="site-main"><RouterView /></main>

    <footer class="site-footer">
      <span>{{ copy.footer }}</span>
      <span>{{ copy.licence }}</span>
    </footer>
  </div>
</template>
