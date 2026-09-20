import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import LabBookView from './views/LabBookView.vue'
import ModuleView from './views/ModuleView.vue'
import PlaygroundView from './views/PlaygroundView.vue'
import TeacherView from './views/TeacherView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/m/:id', component: ModuleView },
    { path: '/lab', component: LabBookView },
    { path: '/play', component: PlaygroundView },
    { path: '/teacher', component: TeacherView },
  ],
})
